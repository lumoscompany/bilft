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
import { BottomDialog } from "@/features/BottomDialog";
import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { SignalHelper, type Ref } from "@/lib/solid";
import { type StyleProps } from "@/lib/types";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { AxiosError } from "axios";
import { For, batch, createEffect, createMemo, createSignal } from "solid-js";
import { createMutable } from "solid-js/store";
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

      await props.onCreated(comment);

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

  const variants = ["public", "anonymous", "other"];
  type Variant = (typeof variants)[number];
  const [variantState, setVariantState] = createSignal<Variant>(variants[0]);
  const variantStateIndex = () => variants.indexOf(variantState());
  const [isNearbySelectorChoosed, setIsNearbySelectorChoosed] =
    createSignal(true);
  const isPointerOver = createMutable(
    Object.fromEntries(variants.map((it) => [it, false])),
  );
  return (
    <>
      <section class="relative isolate -mx-1 mb-2 grid min-h-11 touch-none select-none grid-cols-[repeat(auto-fit,minmax(0,1fr))] grid-rows-1 self-stretch overflow-hidden rounded-full before:absolute before:inset-0 before:-z-10 before:bg-section-bg before:opacity-70 before:backdrop-blur-3xl before:content-['']">
        <div
          style={{
            width: `calc(100%/${variants.length})`,
            transform: `translateX(calc(100%*${variantStateIndex()}))`,
          }}
          class={clsxString(
            "absolute inset-y-0 top-0 -z-10 rounded-full bg-accent transition-transform ease-out contain-strict",
            isNearbySelectorChoosed() ? "duration-150" : "duration-[225ms]",
          )}
        />
        <For each={variants}>
          {(variant) => (
            <button
              class={clsxString(
                "flex items-center justify-center transition-opacity contain-strict",
                "text-text",
                isPointerOver[variant] ? "opacity-30" : "",
                // variantState() === variant ? "text-secondary-bg" : "text-text",
              )}
              // onPointerOut={() => {
              //   isPointerOver[variant] = false;
              // }}
              onTouchMove={() => {
                isPointerOver[variant] = false;
              }}
              onTouchCancel={(e) => {
                isPointerOver[variant] = true;
              }}
              onClick={() => {
                const diff = Math.abs(
                  variants.indexOf(variantState()) - variants.indexOf(variant),
                );

                setIsNearbySelectorChoosed(diff === 1);
                setVariantState(variant);
              }}
              disabled={variantState() === variant}
            >
              {variant.slice(0, 1).toUpperCase() + variant.slice(1)}
            </button>
          )}
        </For>
      </section>
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
