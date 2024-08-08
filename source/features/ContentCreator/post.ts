import type { model } from "@/api";
import {
  fetchMethod,
  getWalletOrLimitError,
  isWalletError,
  keysFactory,
  type CreateNoteRequest,
} from "@/api/api";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { AxiosError } from "axios";
import type { ProfileIdWithoutPrefix } from "../idUtils";
import { ErrorHelper } from "./common";

export const createNoteMutation = (
  boardId: () => ProfileIdWithoutPrefix,
  onSuccess: () => void,
  onResetError: (value: null) => void,
  onCreationError: (error: model.LimitReachedError) => void,
) => {
  const queryClient = useQueryClient();
  return createMutation(() => ({
    mutationFn: (request: CreateNoteRequest) =>
      ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/board/createNote", request),
        (error) => {
          if (typeof error !== "object" && error === null) {
            return null;
          }

          if (!(error instanceof AxiosError) || !error.response) {
            return null;
          }
          const walletError = getWalletOrLimitError(error.response);

          // it's unexpected to throw with wallet error
          if (!walletError || isWalletError(walletError)) {
            return null;
          }

          return walletError;
        },
      ),
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
    },
  }));
};
