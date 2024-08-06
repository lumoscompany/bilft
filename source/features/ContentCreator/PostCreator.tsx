import type { model } from "@/api";
import {
  fetchMethod,
  fetchMethodCurry,
  getWalletError,
  keysFactory,
  type CreateNoteRequest,
} from "@/api/api";
import type { WalletError } from "@/api/model";
import { SignalHelper } from "@/lib/solid";
import type { StyleProps } from "@/lib/types";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { AxiosError } from "axios";
import { batch, createMemo, createSignal } from "solid-js";
import { BottomDialog } from "../BottomDialog";
import { PostInput } from "./PostInput";
import { WalletModalContent } from "./WalletModal";
import { ErrorHelper, type ModalStatus } from "./common";

export const PostCreator = (props: { boardId: string } & StyleProps) => {
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = createSignal("");
  const [isAnonymous, setIsAnonymous] = createSignal(false);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );
  const addNoteMutation = createMutation(() => ({
    mutationFn: (request: CreateNoteRequest) => {
      return ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/board/createNote", request),
        (error) => {
          if (typeof error !== "object" && error === null) {
            return null;
          }

          if (!(error instanceof AxiosError) || !error.response) {
            return null;
          }
          const walletError = getWalletError(error.response);
          if (!walletError) {
            return null;
          }

          return walletError;
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: keysFactory.notes({
          board: props.boardId,
        }).queryKey,
      });
    },
    onMutate: ({ type }) => {
      if (type === "public") {
        setWalletError(null);
      }
    },
    onSuccess: ([note, walletError]) => {
      if (!note) {
        setWalletError(walletError);
        return;
      }
      queryClient.setQueryData(
        keysFactory.notes({
          board: props.boardId,
        }).queryKey,
        (data) => {
          if (!data || !data.pages || data.pages.length < 1) {
            return data;
          }
          const firstPage = data.pages[0];

          return {
            pageParams: data.pageParams,
            pages: [
              {
                data: [
                  {
                    ...note,
                    commentsCount: 0,
                  },
                  ...firstPage.data,
                ],
                next: firstPage.next,
              },
              ...data.pages.slice(1),
            ],
          };
        },
      );

      batch(() => {
        setInputValue("");
        setIsAnonymous(false);
        setWalletError(null);
      });
    },
  }));

  const unlinkMutation = createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/unlinkWallet"),
    onMutate: () => {
      const curWalletError = walletError();
      if (curWalletError) {
        setWalletError({
          error: {
            reason: "no_connected_wallet",
            payload: curWalletError.error.payload,
          },
        });
      }
      const curData = queryClient.getQueryData(keysFactory.me.queryKey);

      queryClient.setQueryData(keysFactory.me.queryKey, (data) =>
        data ? { ...data, wallet: undefined } : undefined,
      );

      return {
        curWalletError,
        curData,
      };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(keysFactory.me.queryKey, ctx?.curData);
      if (!walletError()) {
        return;
      }
      setWalletError(ctx?.curWalletError ?? null);
    },
  }));

  const meQuery = createQuery(() => keysFactory.me);

  const balanceStatus = createMemo(() => {
    const curWalletError = walletError();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (tokensBalance === undefined || !curWalletError) {
      return null;
    }
    return BigInt(curWalletError.error.payload.requiredBalance) <=
      BigInt(tokensBalance)
      ? "enough-money"
      : "not-enough-money";
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(walletError, (error): ModalStatus | null => {
      if (!error) {
        return null;
      }
      const status = balanceStatus();
      if (status === "enough-money") {
        return {
          type: "success",
          data: null,
        };
      }
      if (
        status === "not-enough-money" &&
        error.error.reason === "no_connected_wallet"
      ) {
        return {
          type: "error",
          data: {
            error: {
              reason: "insufficient_balance",
              payload: error.error.payload,
            },
          },
        };
      }
      return {
        type: "error",
        data: error,
      };
    });
  const sendContent = (anonymous: boolean) =>
    addNoteMutation.mutate({
      board: props.boardId,
      content: inputValue(),
      type: anonymous ? "public-anonymous" : "public",
    });

  return (
    <>
      <PostInput
        preventScrollTouches={false}
        position="top"
        isAnonymous={isAnonymous()}
        setIsAnonymous={setIsAnonymous}
        class={props.class}
        isLoading={addNoteMutation.isPending}
        onSubmit={() => {
          if (!inputValue) {
            return;
          }

          sendContent(isAnonymous());
        }}
        value={inputValue()}
        onChange={setInputValue}
      />
      <BottomDialog
        onClose={() => {
          setWalletError(null);
        }}
        when={modalStatus()}
      >
        {(status) => (
          <WalletModalContent
            onSend={() => {
              sendContent(isAnonymous());
              setWalletError(null);
            }}
            status={status()}
            onClose={() => {
              setWalletError(null);
            }}
            onUnlinkWallet={() => {
              unlinkMutation.mutate();
            }}
            onSendPublic={() => {
              sendContent(false);
            }}
          />
        )}
      </BottomDialog>
    </>
  );
};

export const createNoteMutation = (
  boardId: () => string,
  onSuccess: () => void,
  onResetError: (value: null) => void,
  onCreationError: (error: WalletError) => void,
) => {
  const queryClient = useQueryClient();
  return createMutation(() => ({
    mutationFn: (request: CreateNoteRequest) => {
      return ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/board/createNote", request),
        (error) => {
          if (typeof error !== "object" && error === null) {
            return null;
          }

          if (!(error instanceof AxiosError) || !error.response) {
            return null;
          }
          const walletError = getWalletError(error.response);
          if (!walletError) {
            return null;
          }

          return walletError;
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: keysFactory.notes({
          board: boardId(),
        }).queryKey,
      });
    },
    onMutate: ({ type }) => {
      if (type === "public") {
        onResetError(null);
        // setWalletError(null);
      }
    },
    onSuccess: ([note, walletError]) => {
      if (!note) {
        onCreationError(walletError);
        return;
      }
      queryClient.setQueryData(
        keysFactory.notes({
          board: boardId(),
        }).queryKey,
        (data) => {
          if (!data || !data.pages || data.pages.length < 1) {
            return data;
          }
          const firstPage = data.pages[0];

          return {
            pageParams: data.pageParams,
            pages: [
              {
                data: [
                  {
                    ...note,
                    commentsCount: 0,
                  },
                  ...firstPage.data,
                ],
                next: firstPage.next,
              },
              ...data.pages.slice(1),
            ],
          };
        },
      );

      onSuccess();
      // batch(() => {
      //   setInputValue("");
      //   setIsAnonymous(false);
      //   setWalletError(null);
      // });
    },
  }));
};
