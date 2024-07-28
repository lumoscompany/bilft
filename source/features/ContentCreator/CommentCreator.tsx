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
  WalletError,
} from "@/api/model";
import { SignalHelper } from "@/lib/solid";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { AxiosError } from "axios";
import { createMemo, createSignal } from "solid-js";
import type { ProfileIdWithoutPrefix } from "../idUtils";
import { ErrorHelper, type ModalStatus } from "./common";

export const createInputState = <TVariant extends string>(
  initial: TVariant,
) => {
  const [inputValue, setInputValue] = createSignal("");
  const [variant, setVariant] = createSignal(initial);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );

  return [
    [inputValue, setInputValue],
    [walletError, setWalletError],
    [variant, setVariant],
  ] as const;
};

export function createCommentMutation(
  onCreated: (
    comment: model.Comment,
    boardId: ProfileIdWithoutPrefix,
    noteId: string,
  ) => Promise<void>,
  onResetError: () => void,
  onSendError: (newError: WalletError) => unknown,
) {
  const queryClient = useQueryClient();
  return createMutation(() => ({
    mutationFn: (
      request: CreateCommentRequest & { boardId: ProfileIdWithoutPrefix },
    ) => {
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
    onSettled: (_, __, { boardId }) => {
      queryClient.invalidateQueries({
        queryKey: keysFactory.notes({
          board: boardId,
        }).queryKey,
      });
    },
    onMutate: ({ type }) => {
      if (type === "public") {
        onResetError();
      }
    },
    onSuccess: async ([comment, walletError], { boardId, noteID }) => {
      if (!comment) {
        onSendError(walletError);
        return;
      }

      queryClient.setQueryData(
        keysFactory.notes({
          board: boardId,
        }).queryKey,
        (board) => {
          if (!board || !board.pages || board.pages.length < 1) return board;

          for (let i = 0; i < board.pages.length; ++i) {
            const notesPage = board.pages[i];
            for (let j = 0; j < notesPage.data.length; ++j) {
              const note = notesPage.data[j];
              if (note.id === noteID) {
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

      await onCreated(comment, boardId, noteID);
    },
  }));
}
export const createUnlinkMutation = (
  walletError: () => null | WalletError,
  onUnlinkCauseError: (value: WalletError) => unknown,
  onFallbackError: (value: WalletError | null) => unknown,
) => {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/unlinkWallet"),
    onMutate: () => {
      const curWalletError = walletError();
      if (curWalletError) {
        onUnlinkCauseError({
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
      onFallbackError(ctx?.curWalletError ?? null);
    },
  }));
};

export const createOptimisticModalStatus = (
  walletError: () => null | WalletError,
) => {
  const meQuery = createQuery(() => keysFactory.me);

  const hasEnoughMoney = createMemo(() => {
    const curWalletError = walletError();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (!curWalletError || !tokensBalance) {
      return false;
    }
    return (
      BigInt(curWalletError.error.payload.requiredBalance) <=
      BigInt(tokensBalance)
    );
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(walletError, (error): ModalStatus | null => {
      if (!error) {
        return null;
      }
      if (hasEnoughMoney()) {
        return {
          type: "success",
          data: null,
        };
      }

      if (
        error.error.reason === "no_connected_wallet" &&
        meQuery.data?.wallet
      ) {
        return {
          type: "error",
          data: {
            error: {
              reason: "insufficient_balance",
              payload: { ...error.error.payload },
            },
          },
        };
      }
      return {
        type: "error",
        data: error,
      };
    });

  return modalStatus;
};
