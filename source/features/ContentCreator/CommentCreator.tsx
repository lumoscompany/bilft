import type { model } from "@/api";
import {
  fetchMethod,
  getWalletOrLimitError,
  isWalletError,
  keysFactory,
} from "@/api/api";
import type {
  CreateCommentRequest,
  NoteArray,
  NoteWithComment,
} from "@/api/model";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { AxiosError } from "axios";
import { createSignal } from "solid-js";
import type { ProfileIdWithoutPrefix } from "../idUtils";
import { ErrorHelper } from "./common";

export const createInputState = <
  TVariant extends string,
  TIsActionLimitPossible extends boolean,
>(
  initial: TVariant,
) => {
  const [inputValue, setInputValue] = createSignal("");
  const [variant, setVariant] = createSignal(initial);
  const [modalStatus, setModalStatus] = createSignal<
    | (TIsActionLimitPossible extends true
        ? model.WalletOrLimitError
        : model.WalletError)
    | null
  >(null);

  return [
    [inputValue, setInputValue],
    [modalStatus, setModalStatus],
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
  onSendError: (newError: model.WalletError) => unknown,
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
          const walletError = getWalletOrLimitError(error.response);
          // it's unexpected to throw with limit error from adding comment
          if (!walletError || !isWalletError(walletError)) {
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
                  type: note.type,
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
