import axios from "axios";
import type * as model from "./model";

import { authData } from "@/common";
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query";
import type { Comment, CreateCommentRequest } from "./model";

const instance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 15000,
});

type RequestResponse<Request, Response> = {
  request: Request;
  response: Response;
};

export type CreateNoteRequest = {
  board: string;
  content: string;
  type: "private" | "public" | "public-anonymous";
};

export type GetCommentResponse = {
  count: number;
  items: Comment[];
};

type RequestResponseMappings = {
  "/board/resolve": RequestResponse<{ value: string }, model.Board>;
  "/board/createNote": RequestResponse<CreateNoteRequest, model.Note>;
  "/board/getNotes": RequestResponse<
    { board: string; next?: string },
    model.NoteArray
  >;
  "/note/resolve": RequestResponse<
    { noteId: string },
    model.Note & {
      boardId: string;
    }
  >;
  "/me": RequestResponse<
    void,
    {
      wallet?: model.Wallet;
    }
  >;
  "/me/linkWallet": RequestResponse<
    model.WalletConfirmation,
    {
      wallet: model.Wallet;
    }
  >;
  "/me/unlinkWallet": RequestResponse<void, void>;
  "/note/createComment": RequestResponse<CreateCommentRequest, Comment>;
  "/note/getComments": RequestResponse<
    {
      noteID: string;
      /**
       * @description positive or -1
       */
      page: number;
      pageSize: number;
    },
    GetCommentResponse
  >;
};
type AvailableRequests = keyof RequestResponseMappings;

type PickRequest<T extends AvailableRequests> = Pick<
  RequestResponseMappings,
  T
>[T]["request"];
type PickResponse<T extends AvailableRequests> = Pick<
  RequestResponseMappings,
  T
>[T]["response"];

export const fetchMethod = async <T extends AvailableRequests>(
  path: T,
  data: PickRequest<T>,
): Promise<PickResponse<T>> =>
  instance
    .post(path, {
      ...data,
      authentication_data: authData,
    })
    .then((it) => it.data);

export const getWalletError = (response: {
  status: number;
  data: unknown;
}): model.WalletError | null => {
  if (response.status !== 403) {
    return null;
  }
  if (!response.data || typeof response.data !== "object") {
    return null;
  }
  const data: {
    error?: {
      reason?: string;
    };
  } = response.data;

  if (
    data?.error?.reason !== "no_connected_wallet" &&
    data.error?.reason !== "insufficient_balance"
  ) {
    return null;
  }

  return data as model.WalletError;
};

export const fetchMethodCurry =
  <T extends AvailableRequests>(path: T) =>
  (data: PickRequest<T>) =>
    fetchMethod(path, data);

export const keysFactory = {
  board: (params: PickRequest<"/board/resolve">) =>
    queryOptions({
      queryFn: () => fetchMethod("/board/resolve", params),
      queryKey: ["board", params],
    }),
  notes: ({ board }: Omit<PickRequest<"/board/getNotes">, "next">) =>
    infiniteQueryOptions({
      queryKey: ["notes", board],
      initialPageParam: undefined,
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        fetchMethod("/board/getNotes", {
          board,
          next: pageParam,
        }),
      getNextPageParam: (response) => response?.next,
    }),
  me: queryOptions({
    queryFn: () => fetchMethod("/me", undefined),
    queryKey: ["me"],
  }),
  comments: ({
    noteId,
    initialPage = 1,
  }: {
    noteId: string;
    initialPage?: number;
  }) =>
    infiniteQueryOptions({
      queryKey: ["comments", noteId],
      initialPageParam: initialPage,
      queryFn: ({ pageParam }) =>
        fetchMethod("/note/getComments", {
          noteID: noteId,
          page: pageParam,
          pageSize: COMMENTS_PAGE_SIZE,
        }),
      getPreviousPageParam: (_, __, firstPageParam) =>
        firstPageParam > 1 ? firstPageParam - 1 : undefined,
      getNextPageParam: ({ items }, _, lastPageParam) =>
        items.length > 0 ? lastPageParam + 1 : undefined,
      reconcile: "id",
    }),

  note: (noteId: string) =>
    queryOptions({
      queryKey: ["note", noteId],
      queryFn: () =>
        fetchMethod("/note/resolve", {
          noteId,
        }),
    }),

  commentsNew: ({ noteId, page }: { noteId: string; page: number }) =>
    queryOptions({
      queryKey: ["comments-new", noteId, page],
      queryFn: () =>
        fetchMethod("/note/getComments", {
          noteID: noteId,
          page,
          pageSize: COMMENTS_PAGE_SIZE,
        }),
    }),
};
export const COMMENTS_PAGE_SIZE = 20;
