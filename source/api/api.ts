import axios from "axios";
import type { model } from ".";

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

type RequestResponseMappings = {
  "/board/resolve": RequestResponse<{ value: string }, model.Board>;
  "/board/createNote": RequestResponse<CreateNoteRequest, model.Note>;
  "/board/getNotes": RequestResponse<
    { board: string; next?: string },
    model.NoteArray
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
      page: number;
      pageSize: number;
    },
    {
      count: number;
      items: Comment[];
    }
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
  comments: ({ noteId }: { noteId: string }) =>
    infiniteQueryOptions({
      queryKey: ["comments", noteId],
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        fetchMethod("/note/getComments", {
          noteID: noteId,
          page: pageParam,
          pageSize: 30,
        }),
      getNextPageParam: ({ items }, _, lastPageParam) =>
        items.length > 0 ? lastPageParam + 1 : undefined,
      reconcile: "id",
    }),
};
