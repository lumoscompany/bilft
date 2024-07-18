import type { model } from "@/api";
import {
  fetchMethod,
  fetchMethodCurry,
  getWalletError,
  keysFactory,
} from "@/api/api";
import type {
  CreateCommentRequest,
  NoteArray,
  NoteWithComment,
} from "@/api/model";
import { type StyleProps } from "@/common";
import { BottomDialog } from "@/features/BottomDialog";
import { assertOk } from "@/lib/assert";
import { SignalHelper, type Ref } from "@/lib/solid";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { AxiosError } from "axios";
import { batch, createEffect, createMemo, createSignal } from "solid-js";
import { PostInput, type PostInputProps } from "./PostInput";
import { WalletModalContent } from "./WalletModal";
import { ErrorHelper, type ModalStatus } from "./common";

// hard to generalize
export const CommentCreator = (
  props: {
    noteId: string;
    onCreated(comment: model.Comment): Promise<void>;
    boardId: string | null;
    disabled: boolean;
  } & StyleProps & {
      ref?: Ref<HTMLFormElement>;
    } & Pick<PostInputProps, "onBlur" | "onFocus">,
) => {
  const queryClient = useQueryClient();
  if (import.meta.env.DEV) {
    createEffect(() => {
      assertOk(props.boardId || props.disabled);
    });
  }

  const [inputValue, setInputValue] = createSignal("");
  const [isAnonymous, setIsAnonymous] = createSignal(false);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );
  const addCommentMutation = createMutation(() => ({
    mutationFn: (request: CreateCommentRequest) => {
      return ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/note/createComment", request),
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
        queryKey: keysFactory.comments({
          noteId: props.noteId,
        }).queryKey,
      });
      assertOk(props.boardId);
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
    onSuccess: async ([comment, walletError]) => {
      if (!comment) {
        setWalletError(walletError);
        return;
      }
      /* queryClient.setQueryData(
        keysFactory.comments({
          noteId: props.noteId,
        }).queryKey,
        (data) => {
          if (!data || !data.pages || data.pages.length < 1) {
            return data;
          }
          const lastPage = data.pages.at(-1);
          assertOk(lastPage);

          const pages = data.pages.slice(0, -1);

          pages.push({
            count: lastPage.count,
            items: [...lastPage.items, comment],
          });

          return {
            pageParams: data.pageParams,
            pages,
          };
        },
      ); */

      assertOk(props.boardId);
      queryClient.setQueryData(
        keysFactory.notes({
          board: props.boardId,
        }).queryKey,
        (board) => {
          if (!board || !board.pages || board.pages.length < 1) return board;

          for (let i = 0; i < board.pages.length; ++i) {
            const notesPage = board.pages[i];
            for (let j = 0; j < notesPage.data.length; ++j) {
              const note = notesPage.data[j];
              if (note.id === props.noteId) {
                const newNote: NoteWithComment = {
                  commentsCount: note.commentsCount + 1,
                  content: note.content,
                  createdAt: note.createdAt,
                  id: note.id,
                  author: note.author,
                  lastComment: comment,
                };

                const copyNotesPageData = Array.from(notesPage.data);
                copyNotesPageData[j] = newNote;
                const copyNotesPage: NoteArray = {
                  data: copyNotesPageData,
                  next: notesPage.next,
                };

                const copyPages = Array.from(board.pages);
                copyPages[i] = copyNotesPage;
                return {
                  pageParams: board.pageParams,
                  pages: copyPages,
                };
              }
            }
          }

          return board;
        },
      );

      await batch(() => {
        setInputValue("");
        setIsAnonymous(false);
        setWalletError(null);
        return props.onCreated(comment);
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

  const hasEnoughMoney = createMemo(() => {
    const curWalletError = walletError();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (!curWalletError || !tokensBalance) {
      return;
    }
    return (
      BigInt(curWalletError.error.payload.requiredBalance) <=
      BigInt(tokensBalance)
    );
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(walletError, (error) =>
      !error
        ? null
        : hasEnoughMoney()
          ? {
              type: "success",
              data: null,
            }
          : {
              type: "error",
              data: error,
            },
    );
  const sendContent = (anonymous: boolean) =>
    addCommentMutation.mutate({
      noteID: props.noteId,
      content: inputValue(),
      type: anonymous ? "anonymous" : "public",
    });

  return (
    <>
      <PostInput
        preventScrollTouches
        onBlur={props.onBlur}
        onFocus={props.onFocus}
        position="bottom"
        ref={props.ref}
        isAnonymous={isAnonymous()}
        setIsAnonymous={setIsAnonymous}
        class={props.class}
        isLoading={addCommentMutation.isPending}
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
