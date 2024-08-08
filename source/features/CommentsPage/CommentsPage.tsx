import { keysFactory } from "@/api/api";
import type { Comment, Note } from "@/api/model";
import { formatPostDate, formatPostTime } from "@/features/format";
import {
  getVirtualizerHandle,
  scrollableElement,
  setVirtualizerHandle,
} from "@/features/scroll";
import { platform } from "@/features/telegramIntegration";
import {
  AnonymousAvatarIcon,
  AnonymousHintIcon,
  ArrowDownIcon,
  PublicHintIcon,
} from "@/icons";
import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { PxStringFromNumber, type PxString } from "@/lib/pxString";
import {
  createInnerHeight,
  createTransitionPresence,
  type Ref,
} from "@/lib/solid";
import { A, useParams } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import {
  Match,
  Show,
  Switch,
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
} from "solid-js";
import { Virtualizer } from "virtua/solid";
import {
  AvatarIcon,
  AvatarIconEntryMakeGenerated,
  AvatarIconEntryMakeLoaded,
} from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { BottomDialog } from "../BottomDialog";
import {
  createCommentMutation,
  createInputState,
} from "../ContentCreator/CommentCreator";
import {
  PostInput,
  createInputFocusPreventer,
} from "../ContentCreator/PostInput";
import {
  SEND_ANONYMOUS_DESCRIPTION,
  SEND_ANONYMOUS_TITLE,
  SEND_PUBLIC_DESCRIPTION,
  SEND_PUBLIC_TITLE,
  VariantEntryMake,
  VariantSelector,
  type VariantEntry,
} from "../ContentCreator/VariantSelector";
import { WalletModalContent } from "../ContentCreator/WalletModal";
import {
  createOptimisticModalStatus,
  createUnlinkMutation,
} from "../ContentCreator/shared";
import { LoadingSvg } from "../LoadingSvg";
import type { ProfileIdWithoutPrefix } from "../idUtils";
import { useKeyboardStatus } from "../keyboardStatus";
import { createBoardUrl } from "../navigation";
import { createReversingCommentsQuery } from "./createReversingCommentsQuery";
import {
  createCommentInputBottomOffset,
  createOnResizeScrollAdjuster,
  createSafariScrollAdjuster,
  createScrollAdjuster,
} from "./scrollAdjusters";
import {
  IntAvg,
  createListMarginTop,
  createOneSideArraySync,
  useReversed,
} from "./utils";

type CommentItem = { type: "loader"; id: "prev-item" | "next-item" } | Comment;
const PREV_LOADING_ITEM: CommentItem = {
  type: "loader",
  id: "prev-item",
};
const NEXT_LOADING_ITEM: CommentItem = {
  type: "loader",
  id: "next-item",
};

export const CommentsPage = () => {
  const params = useParams();
  const noteId = () => params.noteId;

  const note = createQuery(() => keysFactory.note(params.noteId));

  const [isReversed, setIsReversed] = useReversed();
  const reversingComments = createReversingCommentsQuery(
    noteId,
    isReversed,
    setIsReversed,
    (comment) => {
      waitAddition(() => {
        requestAnimationFrame(() => {
          const commentIndex =
            comment && commentItems().findIndex((it) => it.id === comment.id);
          const scrollIndex =
            commentIndex === null || commentIndex === -1
              ? commentItems().length - 1
              : commentIndex;
          assertOk(scrollIndex !== -1);
          getVirtualizerHandle()?.scrollToIndex(scrollIndex, {
            smooth: true,
          });
        });
      });
    },
    () =>
      // waiting until pr is created from one side items
      queueMicrotask(() =>
        waitAddition(() => {
          getVirtualizerHandle()?.scrollToIndex(commentItems().length - 1);
        }),
      ),
  );

  //#region scroll
  const keyboard = useKeyboardStatus();
  const [scrollMarginTop, setBeforeListElement] = createListMarginTop(128);

  // long story short: Webview Safari + IOS Telegram = dog shit
  const innerHeight = createInnerHeight();
  const commentInputBottomOffset =
    platform === "ios"
      ? createCommentInputBottomOffset(innerHeight, keyboard)
      : null;

  if (platform === "ios") {
    assertOk(commentInputBottomOffset);
    createSafariScrollAdjuster(keyboard, commentInputBottomOffset);
  } else {
    createScrollAdjuster(innerHeight);
  }

  const commentInputBottomOffsetPx = commentInputBottomOffset
    ? () => PxStringFromNumber(commentInputBottomOffset())
    : null;
  const [commentCreatorContainerRef, setCommentCreatorContainerRef] =
    createSignal<HTMLElement>();
  createOnResizeScrollAdjuster(commentCreatorContainerRef);
  //#endregion scroll

  const [range, setRange] = createSignal<[number, number]>([0, 0], {
    equals: (a, b) => a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1]),
  });
  const getRangeStatus = ([startIndex, endIndex]: [number, number]) => {
    const isNearStart = startIndex < 10;
    const isNearEnd = endIndex >= reversingComments.comments().length - 9;

    return [isNearStart, isNearEnd] as const;
  };

  const waitAddition = (callback: () => void) => {
    const pr = addedElements();
    if (pr) {
      const onResolve = () => waitAddition(callback);

      pr.then(onResolve);
      return;
    }
    callback();
  };

  const isSomethingLoading = createMemo(() =>
    reversingComments.commentsQueries.some((it) => it.isLoading),
  );

  createEffect(
    on(
      () =>
        !reversingComments.isReversing() &&
        !isSomethingLoading() &&
        !reversingComments.commentPages().includes(-1) &&
        range(),
      (curRange) => {
        if (!curRange) {
          return;
        }

        reversingComments.fetchNext(...getRangeStatus(curRange));
      },
    ),
  );

  // createEffect(() => {
  //   console.log(
  //     unwrapSignals({
  //       commentPages,
  //     }),
  //   );
  // });

  const onScrollDown = async (comment: Comment | null) => {
    if (reversingComments.isReversing()) {
      return;
    }
    if (!comment && isReversed()) {
      // console.log("scrolling to last");
      getVirtualizerHandle()?.scrollToIndex(commentItems().length - 1, {
        smooth: true,
      });
      return;
    }

    await reversingComments.reverse(comment);
  };

  const _commentsWithLoaders = createMemo(() => {
    if (reversingComments.isLoading()) {
      return [];
    }
    const copy: CommentItem[] = [];
    if (reversingComments.hasPrevPage()) {
      copy.push(PREV_LOADING_ITEM);
    }
    copy.push(...reversingComments.comments());
    if (reversingComments.hasNextPage()) {
      copy.push(NEXT_LOADING_ITEM);
    }
    return copy;
  });
  const [commentItems, shift, addedElements] = createOneSideArraySync(
    () => _commentsWithLoaders(),
    () => {
      const min = Math.max(
        _commentsWithLoaders().findIndex((it) => it.type !== "loader"),
        0,
      );
      return Math.max(min, IntAvg(...range()));
    },
    (a, b) => a === b || a.id === b.id,
  );

  // createRenderEffect(
  //   on(
  //     () => reversingComments.comments().length,
  //     (length) => {
  //       console.log(
  //         "length change",
  //         unwrapSignals({
  //           length,
  //           shift,
  //           range,
  //           isReversing: reversingComments.isReversing(),
  //           isReversed,
  //           pages: reversingComments.commentPages(),
  //           now: performance.now(),
  //         }),
  //       );
  //     },
  //   ),
  // );
  // createEffect(() => {
  //   console.log(
  //     unwrapSignals({
  //       length: () => commentItems().length,
  //       shift,
  //     }),
  //   );
  // });
  // //
  // createComputed(
  //   on(
  //     () => commentItems().length,
  //     (length) => {
  //       console.log(
  //         "one side items length change",
  //         unwrapSignals({
  //           length,
  //           // shift,
  //           isReversing,
  //           isReversed,
  //         }),
  //       );
  //     },
  //   ),
  // );
  //

  const [scrollTop, setScrollTop] = createSignal(0);
  const [isRendered, setIsRendered] = createSignal(false);
  onMount(() => setIsRendered(true));
  const showBottomScroller = createMemo(() => {
    if (!isRendered()) {
      return false;
    }
    // for some reason on IOS scroll is not working when keyboard open
    // [TODO]: figure out why
    if (platform === "ios" && keyboard.isKeyboardOpen()) {
      return false;
    }
    const count = reversingComments.commentsCount();

    if (!count) {
      return false;
    }
    if (reversingComments.hasNextPage()) {
      return true;
    }

    const scrollSize = getVirtualizerHandle()?.scrollSize;
    const viewportHeight = getVirtualizerHandle()?.viewportSize;
    if (scrollSize === undefined || viewportHeight === undefined) {
      return false;
    }

    return scrollSize - viewportHeight - scrollTop() > 500;
  });

  return (
    <main class="flex min-h-screen flex-col bg-secondary-bg px-4">
      <BoardNote ref={setBeforeListElement("note")} class="my-4">
        <BoardNote.Card>
          <Show
            fallback={
              <div class="flex min-h-[82px] items-center justify-center">
                <LoadingSvg class="w-10 fill-accent text-transparent" />
              </div>
            }
            when={note.data}
          >
            {(note) => (
              <>
                <Switch
                  fallback={
                    <BoardNote.AnonymousHeader
                      private={note().type === "private"}
                      createdAt={note().createdAt}
                    />
                  }
                >
                  <Match when={note().author}>
                    {(author) => (
                      <BoardNote.AuthorHeader
                        name={author().name}
                        avatarUrl={author().photo}
                        authorId={author().id}
                        createdAt={note().createdAt}
                      />
                    )}
                  </Match>
                </Switch>

                <BoardNote.Divider />

                <BoardNote.Content>{note().content}</BoardNote.Content>
              </>
            )}
          </Show>
        </BoardNote.Card>
      </BoardNote>

      <Switch>
        <Match
          when={
            reversingComments.comments().length > 0 && commentItems().length > 0
          }
        >
          <Virtualizer
            itemSize={110}
            onScrollEnd={() => {
              reversingComments.checkIsReversed(range());
            }}
            onScroll={(e) => {
              setScrollTop(e);

              if (platform !== "ios" || e > 0) {
                return;
              }
              const firstItem = _commentsWithLoaders()[0];
              if (
                firstItem &&
                firstItem.type === "loader" &&
                firstItem.id === "prev-item"
              ) {
                getVirtualizerHandle()?.scrollTo(0);
              }
            }}
            ref={(handle) => setVirtualizerHandle(handle)}
            startMargin={scrollMarginTop()}
            data={commentItems()}
            shift={shift()}
            scrollRef={scrollableElement}
            onRangeChange={(startIndex, endIndex) => {
              setRange([startIndex, endIndex]);
            }}
          >
            {(comment) => (
              <Switch>
                <Match when={comment.type !== "loader" && comment}>
                  {(comment) => (
                    <article
                      data-last={
                        comment().id === reversingComments.lastCommentId()
                          ? ""
                          : undefined
                      }
                      class={clsxString(
                        "mb-4 grid grid-cols-[36px,1fr] grid-rows-[auto,auto,auto] gap-y-[2px] border-b-[0.4px] border-b-separator bg-secondary-bg pb-4 data-[last]:border-none",
                        platform === "ios"
                          ? "relative after:absolute after:inset-x-0 after:top-[calc(100%+0.4px)] after:h-4 after:bg-secondary-bg"
                          : "",
                      )}
                    >
                      <Switch>
                        <Match when={comment().author}>
                          {(author) => (
                            <div class="col-span-full flex">
                              <A
                                class="flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity active:opacity-70"
                                href={createBoardUrl(author().id)}
                              >
                                <AvatarIcon
                                  entry={
                                    author().photo
                                      ? AvatarIconEntryMakeLoaded(
                                          author().photo,
                                        )
                                      : AvatarIconEntryMakeGenerated(
                                          author().name,
                                          author().id,
                                        )
                                  }
                                  size={22}
                                />
                                {author().name}
                              </A>
                            </div>
                          )}
                        </Match>
                        <Match when={comment().type === "anonymous"}>
                          <div class="col-span-full flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity">
                            <AnonymousAvatarIcon class="h-[22px] w-[22px]" />
                            Anonym
                          </div>
                        </Match>
                      </Switch>
                      <div class="col-start-2 max-w-full overflow-hidden whitespace-pre-wrap font-inter text-[16px] leading-[22px]">
                        {comment().content}
                      </div>
                      <div class="col-start-2 font-inter text-[13px] leading-[18px] text-hint">
                        {formatPostDate(comment().createdAt)} at{" "}
                        {formatPostTime(comment().createdAt)}
                      </div>
                    </article>
                  )}
                </Match>

                <Match
                  when={
                    comment.type === "loader" &&
                    reversingComments.commentsQueries.at(
                      comment.id === "next-item" ? -1 : 0,
                    )?.isError &&
                    reversingComments.commentsQueries.at(
                      comment.id === "next-item" ? -1 : 0,
                    )
                  }
                >
                  {(query) => (
                    <section class="flex w-full justify-center bg-secondary-bg py-3 font-inter text-[17px] font-medium leading-[22px] text-text">
                      Failed to load comments page
                      <button
                        onClick={() => {
                          query().refetch();
                        }}
                        class="ml-1 text-accent transition-opacity active:opacity-50"
                      >
                        Retry
                      </button>
                    </section>
                  )}
                </Match>
                <Match when={comment.type === "loader"}>
                  <div
                    role="status"
                    class="flex w-full justify-center bg-secondary-bg py-3"
                  >
                    <LoadingSvg class="w-8 fill-accent text-transparent" />
                    <span class="sr-only">Comments page is loading</span>
                  </div>
                </Match>
              </Switch>
            )}
          </Virtualizer>
        </Match>
        <Match
          when={
            !reversingComments.isLoading() &&
            reversingComments.comments().length === 0
          }
        >
          <div class="flex flex-col items-center p-8">
            <img
              src="/assets/empty-notes.webp"
              class="aspect-square w-32"
              alt="Questioning banana"
            />
            <strong class="mt-6 text-center font-inter text-[20px] font-medium leading-[25px]">
              It's still empty
            </strong>
            <p class="text-center font-inter text-[17px] leading-[22px] text-subtitle">
              Be the first to comment here!
            </p>
          </div>
        </Match>
        {/* fallback when reversing and one side out of sync */}
        <Match when={reversingComments.isLoading() || true}>
          <div class="flex w-full flex-1 items-center justify-center">
            <LoadingSvg class="w-8 fill-accent text-transparent" />
          </div>
        </Match>
      </Switch>

      <Show when={note.data}>
        {(note) => (
          <CommentsFooter
            inputBottomOffset={commentInputBottomOffsetPx?.() ?? null}
            showBottomScroller={showBottomScroller()}
            ref={setCommentCreatorContainerRef}
            boardId={note().boardId}
            noteId={note().id}
            noteType={note().type}
            onScrollDown={onScrollDown}
          />
        )}
      </Show>
    </main>
  );
};

export const CommentsFooter = (props: {
  boardId: ProfileIdWithoutPrefix;
  noteId: string;
  noteType: Note["type"];
  inputBottomOffset: PxString | null;
  showBottomScroller: boolean;

  onScrollDown(comment: Comment | null): Promise<void>;

  ref: Ref<HTMLElement>;
}) => {
  const variants = [
    VariantEntryMake(
      "public",
      SEND_PUBLIC_TITLE,
      SEND_PUBLIC_DESCRIPTION,
      PublicHintIcon,
    ),
    VariantEntryMake(
      "anonym",
      SEND_ANONYMOUS_TITLE,
      SEND_ANONYMOUS_DESCRIPTION,
      AnonymousHintIcon,
    ),
  ] satisfies VariantEntry<string>[];
  type Variant = (typeof variants)[number]["value"];
  const [
    [inputValue, setInputValue],
    [walletError, setWalletError],
    [variant, setVariant],
  ] = createInputState<Variant>(variants[0].value);

  const addCommentMutation = createCommentMutation(
    async (comment) => {
      await props.onScrollDown(comment);

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

  const unlinkMutation = createUnlinkMutation(
    walletError,
    setWalletError,
    setWalletError,
  );

  const optimisticModalStatus = createOptimisticModalStatus(walletError);

  const sendComment = (type: Variant) => {
    const _boardId = props.boardId;
    assertOk(_boardId);

    addCommentMutation.mutate({
      noteID: props.noteId,
      content: inputValue(),
      type:
        props.noteType === "private"
          ? undefined
          : type === "anonym"
            ? "anonymous"
            : "public",
      boardId: props.boardId,
    });
  };
  const keyboard = useKeyboardStatus();

  let bottomScroller!: HTMLButtonElement;
  const shouldShowBottomScroller = createTransitionPresence({
    when: () => props.showBottomScroller,
    element: () => bottomScroller,
  });

  return (
    <>
      <Show
        when={
          platform === "ios" &&
          props.inputBottomOffset !== null &&
          props.inputBottomOffset
        }
      >
        {(height) => (
          <div
            class="h-0 contain-strict"
            style={{
              height: height(),
            }}
          />
        )}
      </Show>

      <section
        ref={props.ref}
        style={
          platform === "ios" && props.inputBottomOffset !== null
            ? {
                transform: `translateY(-${props.inputBottomOffset})`,
              }
            : undefined
        }
        class={clsxString(
          "sticky bottom-0 isolate -mx-4 mt-auto [&_*]:overscroll-y-contain",
        )}
      >
        <button
          {...createInputFocusPreventer.FRIENDLY}
          onClick={() => props.onScrollDown(null)}
          inert={!props.showBottomScroller}
          ref={bottomScroller}
          class={clsxString(
            "absolute bottom-[calc(100%+12px)] right-3 -z-10 flex aspect-square w-10 items-center justify-center rounded-full bg-section-bg transition-[transform,opacity] duration-200 will-change-[transform,opacity] contain-strict after:absolute after:-inset-3 after:content-[''] active:scale-90",
            shouldShowBottomScroller.present() ? "visible" : "invisible",
            shouldShowBottomScroller.status() === "present"
              ? "translate-y-0"
              : "translate-y-[calc(100%+12px)] opacity-0",
          )}
          aria-label="Scroll to the bottom"
        >
          <ArrowDownIcon class="scale-[85%] text-hint" />
        </button>

        <div
          class={clsxString(
            "bg-secondary-bg px-4 pt-2 contain-layout contain-style",
            keyboard.isKeyboardOpen()
              ? "pb-2"
              : "pb-[max(var(--safe-area-inset-bottom,0px),0.5rem)]",
          )}
        >
          <PostInput
            preventScrollTouches
            isLoading={addCommentMutation.isPending}
            onSubmit={() => {
              if (!inputValue) {
                return;
              }

              sendComment(variant());
            }}
            value={inputValue()}
            onChange={setInputValue}
          >
            <Show when={props.noteType !== "private"}>
              <div class={clsxString("contain-layout contain-style")}>
                <VariantSelector
                  estimatePopoverSize={110}
                  setValue={setVariant}
                  value={variant()}
                  variants={variants}
                />
              </div>
            </Show>
          </PostInput>
        </div>

        <BottomDialog
          onClose={() => {
            setWalletError(null);
          }}
          when={optimisticModalStatus()}
        >
          {(status) => (
            <WalletModalContent
              onSend={() => {
                sendComment(variant());
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
                sendComment("public");
              }}
            />
          )}
        </BottomDialog>
      </section>
    </>
  );
};
