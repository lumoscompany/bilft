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
import { platform } from "../telegramIntegration";
import {
  PostInput,
  createInputFocusPreventer,
  type PostInputProps,
} from "./PostInput";
import { WalletModalContent } from "./WalletModal";
import { ErrorHelper, type ModalStatus } from "./common";
import { pointIsInsideBox } from "./point";

const createInputState = <TVariant extends string>(initial: TVariant) => {
  const [inputValue, setInputValue] = createSignal("");
  const [variant, setVariant] = createSignal(initial);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );

  return [
    [inputValue, setInputValue],
    [variant, setVariant],
    [walletError, setWalletError],
  ] as const;
};
type InputState = ReturnType<typeof createInputState>;

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
  const variants = ["public", "anonymous"] as const;
  type Variant = (typeof variants)[number];
  const [
    [inputValue, setInputValue],
    [variant, setVariant],
    [walletError, setWalletError],
  ] = createInputState<Variant>(variants[0]);

  const addCommentMutation = createCommentMutation(
    async (comment) => {
      await props.onCreated(comment);

      batch(() => {
        setWalletError(null);
        setInputValue("");
      });
    },
    () => {
      setWalletError(null);
    },
    (error) => {
      setWalletError(error);
    },
  );

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
  const sendContent = (type: Variant) => {
    assertOk(props.boardId);

    addCommentMutation.mutate({
      noteID: props.noteId,
      content: inputValue(),
      type,
      boardId: props.boardId,
    });
  };

  return (
    <>
      <PostInput
        preventScrollTouches
        onBlur={props.onBlur}
        onFocus={props.onFocus}
        ref={props.ref}
        class={props.class}
        isLoading={addCommentMutation.isPending}
        onSubmit={() => {
          if (!inputValue) {
            return;
          }

          sendContent(variant());
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
              sendContent(variant());
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
              sendContent("public");
            }}
          />
        )}
      </BottomDialog>
    </>
  );
};

export const VariantSelector = <T extends string>(props: {
  variants: T[];
  value: T;
  setValue(newVariant: T): void;
}) => {
  const variantStateIndex = () => props.variants.indexOf(props.value);
  const [isNearbySelectorChoose, setIsNearbySelectorChoose] =
    createSignal(true);
  const [touchOver, _setTouchOver] = createSignal<null | T>(null);
  const setTouchOver: (value: null | T) => null | T = _setTouchOver;
  const [touchMoveSelection, setTouchMoveSelection] = createSignal(false);

  const visibleSelectionIndex = () => {
    let curTouchOver: T | null;
    let index: number;
    if (
      touchMoveSelection() &&
      (curTouchOver = touchOver()) &&
      (index = props.variants.indexOf(curTouchOver)) !== -1
    ) {
      return index;
    }

    return variantStateIndex();
  };
  const onTouchMove = (
    currentTarget: HTMLElement,
    firstTouch: Touch,
    prevVariant: T | null,
    detectTouchesIndependentOfY: boolean,
  ): T | null => {
    for (const child of currentTarget.children) {
      assertOk(child instanceof HTMLElement);
      const variant = child.dataset.variant as T | undefined;
      if (variant === undefined) {
        continue;
      }
      const increaseHitSlop = variant === prevVariant || prevVariant === null;
      const baseHitSlopXY = increaseHitSlop ? 30 : 0;
      const rect = child.getBoundingClientRect();
      if (
        pointIsInsideBox(
          firstTouch.clientX,
          firstTouch.clientY,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          baseHitSlopXY,
          detectTouchesIndependentOfY ? 10_000 : baseHitSlopXY,
        )
      ) {
        return variant;
      }
    }

    const rect = currentTarget.getBoundingClientRect();
    if (
      !pointIsInsideBox(
        firstTouch.clientX,
        firstTouch.clientY,

        rect.x,
        rect.y,
        rect.width,
        rect.height,
        30,
        40,
      )
    ) {
      return null;
    }
    return prevVariant;
  };
  const moveSelectorWithPhysics = (newSelection: T) => {
    const diff = Math.abs(
      props.variants.indexOf(props.value) -
        props.variants.indexOf(newSelection),
    );

    setIsNearbySelectorChoose(diff <= 1);
    props.setValue(newSelection);
  };

  let touchId: number | null = null;

  return (
    <section
      onTouchStart={(e) => {
        if (touchId !== null) return;

        const firstTouch = e.changedTouches.item(0);
        if (!firstTouch) return;
        touchId = firstTouch.identifier;
        const targetVariant = onTouchMove(
          e.currentTarget,
          firstTouch,
          touchOver(),
          touchMoveSelection(),
        );
        batch(() => {
          // resetting animation state
          setIsNearbySelectorChoose(false);
          setTouchOver(targetVariant);
          setTouchMoveSelection(targetVariant === props.value);
        });
      }}
      onTouchMove={(e) => {
        if (touchId === null) return;
        const curPointerOver = touchOver();

        for (const touch of e.changedTouches) {
          if (touch.identifier !== touchId) {
            continue;
          }

          setTouchOver(
            onTouchMove(
              e.currentTarget,
              touch,
              curPointerOver,
              touchMoveSelection(),
            ),
          );
          return;
        }
      }}
      onTouchCancel={(e) => {
        if (touchId === null) return;
        for (const touch of e.changedTouches) {
          if (touch.identifier !== touchId) {
            continue;
          }
          touchId = null;
          batch(() => {
            setTouchOver(null);
            setTouchMoveSelection(false);
          });
          return;
        }
      }}
      onTouchEnd={(e) => {
        if (touchId === null) return;

        for (const touch of e.changedTouches) {
          if (touch.identifier !== touchId) {
            continue;
          }
          touchId = null;
          batch(() => {
            const curPointerOver = touchOver();
            curPointerOver && moveSelectorWithPhysics(curPointerOver);
            setTouchMoveSelection(false);
            setTouchOver(null);
          });
          return;
        }
      }}
      class="relative isolate -mx-1 mb-2 grid min-h-11 touch-pan-x select-none grid-cols-[repeat(auto-fit,minmax(0,1fr))] grid-rows-1 self-stretch overflow-hidden rounded-full before:absolute before:inset-0 before:-z-10 before:bg-section-bg before:opacity-70 before:backdrop-blur-3xl before:content-['']"
    >
      <div
        style={{
          width: `calc(100%/${props.variants.length})`,
          transform: `translateX(calc(100%*${visibleSelectionIndex()}))`,
        }}
        class={clsxString(
          "pointer-events-none absolute inset-y-0 top-0 -z-10 rounded-full bg-accent transition-transform ease-out contain-strict",
          isNearbySelectorChoose() ? "duration-150" : "duration-[225ms]",
        )}
      />
      <For each={props.variants}>
        {(variant) => (
          <button
            {...createInputFocusPreventer.FRIENDLY}
            data-variant={variant}
            class={clsxString(
              "flex items-center justify-center transition-opacity duration-300 contain-strict",
              "text-text",
              // on safari active style will be applied until touchend even if active class removed
              platform !== "ios" && touchOver() !== variant
                ? "active:opacity-30"
                : "",
              touchOver() === variant &&
                touchOver() !== props.value &&
                !touchMoveSelection()
                ? "opacity-30"
                : "",
            )}
            onClick={() => {
              moveSelectorWithPhysics(variant);
            }}
            // we cannot disable input because it will redirect focus to nothing, only option is to delay disabled update
            // disabled={variantState() === variant}
          >
            {variant.slice(0, 1).toUpperCase() + variant.slice(1)}
          </button>
        )}
      </For>
    </section>
  );
};
function createCommentMutation(
  onCreated: (
    comment: model.Comment,
    boardId: string,
    noteId: string,
  ) => Promise<void>,
  onResetError: () => void,
  onSendError: (newError: WalletError) => unknown,
) {
  const queryClient = useQueryClient();
  return createMutation(() => ({
    mutationFn: (request: CreateCommentRequest & { boardId: string }) => {
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
