import { COMMENTS_PAGE_SIZE, keysFactory } from "@/api/api";
import type { Comment, Note } from "@/api/model";
import {
  PxString,
  assertOk,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  scrollableElement,
  sortNumbers,
  unwrapSignals,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import {
  createInnerHeight,
  createWindowScrollTop,
  useCleanup,
} from "@/lib/solid";
import { A, useSearchParams } from "@solidjs/router";
import {
  createQueries,
  useQueryClient,
  type CreateQueryResult,
} from "@tanstack/solid-query";
import {
  Match,
  Switch,
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
  type Accessor,
} from "solid-js";
import { Virtualizer } from "virtua/solid";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { CommentCreator } from "../ContentCreator/CommentCreator";
import { LoadingSvg } from "../LoadingSvg";
import { useKeyboardStatus, type KeyboardStatus } from "../keyboardStatus";
import { getVirtualizerHandle, setVirtualizerHandle } from "../pageTransitions";
import { useScreenSize } from "../screenSize";

type CommentItem =
  | Comment
  | {
      type: "query";
      query: CreateQueryResult;
    }
  | { type: "gap"; pageIndex: number; direction: "forward" | "backward" };

export const CommentsPage = () => {
  const [searchParams] = useSearchParams();
  // [TODO]: add validation
  const note = createMemo(() => {
    assertOk(searchParams.note);
    return JSON.parse(searchParams.note) as Note;
  });
  const boardId = createMemo(() => {
    assertOk(searchParams.boardId);
    return searchParams.boardId;
  });

  // const commentsQuery = createInfiniteQuery(() =>
  //   keysFactory.comments({
  //     noteId: note().id,
  //   }),
  // );

  const queryClient = useQueryClient();

  const [commentPages, setCommentPages] = (() => {
    const defaultKey = keysFactory
      .commentsNew({
        noteId: note().id,
        page: 0,
      })
      .queryKey.slice(0, -1);
    const pages = queryClient
      .getQueryCache()
      .findAll({
        queryKey: defaultKey,
      })
      .map((it) => it.queryKey.at(-1) as number);
    if (import.meta.env.DEV) {
      assertOk(pages.every((it) => typeof it === "number"));
    }
    // console.log({
    //   pages,
    // });
    return createSignal(pages.length > 0 ? sortNumbers(pages) : [1]);
  })();

  const commentsQueries = createQueries(() => ({
    queries: commentPages().map((page) =>
      keysFactory.commentsNew({
        page,
        noteId: note().id,
      }),
    ),
  }));

  // [TODO]: if there will be problem on big pages - it'c necessary to rewrite it imperative
  const comments = createMemo((prev: CommentItem[]) => {
    const pages = commentPages();
    if (pages.length !== commentsQueries.length) {
      return prev;
    }
    const commentItems: CommentItem[] = [];
    for (let i = 0; i < pages.length; ++i) {
      const pageQuery = commentsQueries[i];

      if (pageQuery.isSuccess) {
        commentItems.push(...pageQuery.data.items);
      } else {
        commentItems.push({
          type: "query",
          query: pageQuery,
        });
      }

      const pageNumber = pages[i];
      const nextPage = pages[i + 1];

      const direction = !nextPage
        ? "forward"
        : nextPage - pageNumber > 1
          ? "backward"
          : null;
      // object pooL?
      if (direction) {
        commentItems.push({
          type: "gap",
          direction,
          pageIndex: direction === "backward" ? i + 1 : i,
        });
      }
    }

    return commentItems;
  }, []);

  // [1,2,3,100]
  // [1,2,3,99,100]
  //      | |    |
  //    scroll trigger elements
  // representations
  // [page1,page2,page3,null,100, null]
  //                      |         |
  //                      a         b
  // a) if there is item after - we will fetch from the end ??? (not sure it's good)
  // [TODO] Maybe it must be dependent on type of comments (if it's private - it's a chat)
  // b) if there is at the end of array just trying to fetch the next page
  const onScrollGap = ({
    pageIndex,
    direction,
  }: CommentItem & { type: "gap" }) => {
    console.log({
      commentPagesLength: commentPages().length,
      queries: commentsQueries.length,
    });
    if (commentPages().length !== commentsQueries.length) {
      return;
    }

    const targetPage = commentsQueries[pageIndex];
    const targetNumber = commentPages()[pageIndex];
    // console.log("we are here", {
    //   targetPage,
    //   targetNumber,
    // });
    // [TODO]: WE MUST FETCH PAGES, even if we failed to load some page (or at least show gap on ui)
    if (!targetNumber || !targetPage || !targetPage.data) {
      return;
    }
    if (direction === "backward") {
      // console.log({
      //   first: commentPages()[pageIndex - 1],
      //   targetNumber,
      //   second: targetNumber - commentPages()[pageIndex - 1] > 1,
      // });
      assertOk(
        commentPages()[pageIndex - 1] &&
          targetNumber - commentPages()[pageIndex - 1] > 1,
      );
    }

    if (direction === "forward") {
      assertOk(
        !commentPages()[pageIndex + 1] ||
          commentPages()[pageIndex + 1] - targetNumber > 1,
      );
    }

    if (
      (direction == "forward" &&
        targetNumber < targetPage.data.count / COMMENTS_PAGE_SIZE) ||
      (direction === "backward" && targetNumber > 0)
    ) {
      setCommentPages((pages) => {
        const start = direction === "forward" ? pageIndex + 1 : pageIndex;
        const next =
          direction === "forward" ? targetNumber + 1 : targetNumber - 1;

        const pagesCopy = [...pages];
        pagesCopy.splice(start, 0, next);

        return pagesCopy;
      });
    }
  };
  if (import.meta.env.DEV) {
    createEffect(() => {
      // check that our list is in ascending order
      // console.log(unwrap(comments()));
      assertOk(
        commentPages().every(
          (it, index, arr) => index === 0 || arr[index - 1] < it,
        ),
      );
    });
  }
  const { height: tgHeight } = useScreenSize();
  const keyboard = useKeyboardStatus();

  const initialHeightDiff = window.innerHeight - tgHeight();

  const [scrollMarginTop, setScrollMarginTop] = createSignal<number>(128);
  const [boardNote, setBoardNote] = createSignal<HTMLElement>();
  createEffect(() => {
    const onObserve = () => {
      const el = boardNote();
      if (!el) {
        return;
      }
      const marginTop = el.offsetTop + el.offsetHeight;

      setScrollMarginTop((prev) =>
        Math.abs(prev - marginTop) > 2 ? marginTop : prev,
      );
    };
    const observer = new ResizeObserver(onObserve);

    const _boardNote = boardNote();
    if (_boardNote) {
      observer.observe(_boardNote);
      useCleanup((signal) =>
        window.addEventListener("resize", onObserve, { signal }),
      );
    }
    onObserve();
  });

  // long story short: Webview Safari + IOS Telegram = dog shit
  let commentInputTranslateTopPx: null | Accessor<PxString> = null;

  const innerHeight = createInnerHeight();
  if (platform === "ios") {
    const commentInputSize = createCommentInputBottomOffset(
      innerHeight,
      tgHeight,
      keyboard,
      initialHeightDiff,
    );
    commentInputTranslateTopPx = () => PxString.fromNumber(commentInputSize());
    createSafariScrollAdjuster(keyboard, commentInputSize);
  } else {
    createScrollAdjuster(innerHeight);
  }

  let commentCreatorContainerRef!: HTMLDivElement;
  createOnResizeScrollAdjuster(() => commentCreatorContainerRef);

  // const [isScrollingToLastElement, setIsScrollingToLastElement] =
  //   createSignal(false);
  // createEffect(
  //   on(
  //     () => (isScrollingToLastElement() ? comments().length - 1 : 0),
  //     (value, prevValue) => {
  //       if (value <= (prevValue ?? 0)) {
  //         return;
  //       }

  //       getVirtualizerHandle()?.scrollToIndex(value, {
  //         smooth: true,
  //       });
  //       let startToCheck = false;
  //       useCleanupTimeout(() => {
  //         startToCheck = true;
  //       }, 200);

  //       createEffect(() => {
  //         const offset = getVirtualizerHandle()?.getItemOffset(value);
  //         const scrollOffset = getVirtualizerHandle()?.scrollOffset;

  //         if (
  //           startToCheck &&
  //           scrollOffset &&
  //           offset &&
  //           scrollOffset - 200 < offset
  //         ) {
  //           setIsScrollingToLastElement(false);
  //         }
  //       });
  //     },
  //   ),
  // );
  const backwardGapIndex = createMemo(() =>
    comments().findIndex(
      (it) => it.type === "gap" && it.direction === "backward",
    ),
  );
  const [maintainScrollFromBottom, setMaintainScrollFromBottom] =
    createSignal(false);
  createEffect(() => {
    console.log(
      "shift",
      unwrapSignals({
        maintainScrollFromBottom,
        backwardGapIndex,
      }),
    );
  });
  const [endRangeIndex, setEndRangeIndex] = createSignal(0);
  /* 
  createEffect((prev: number | undefined) => {
    const handle = getVirtualizerHandle();
    if (!maintainScrollFromBottom() || !handle) {
      return undefined;
    }

    const prevItemOffset = handle.getItemOffset(endRangeIndex());
    const prevScrollOffset = handle.scrollOffset;
    const prevOffsetFromItem = prevScrollOffset - prevItemOffset;
    const item = untrack(() => comments()[endRangeIndex()]);

    onCleanup(() => {
      const newItemIndex = comments().findIndex((it) => it === item);
      if (newItemIndex === -1) {
        return;
      }

      const newScrollOffset = handle.scrollOffset;
      const newItemOffset = handle.getItemOffset(newItemIndex);
      const newOffsetFromItem = newScrollOffset - newItemOffset;

      const diff = newOffsetFromItem - prevOffsetFromItem;
      console.log({
        prevItemOffset,
        prevScrollOffset,
        prevOffsetFromItem,

        newItemIndex,
        newScrollOffset,
        newOffsetFromItem,

        diff,
      });

      if (Math.abs(diff) > 2) {
        handle.scrollBy(diff);
      }
    });
    return prevItemOffset;
  }, undefined); */
  let delayOnScrollGap: null | Promise<void> = null;
  let isGapDelayed = false;

  return (
    <main class="flex min-h-screen flex-col bg-secondary-bg px-4">
      <BoardNote ref={setBoardNote} class="my-4">
        <BoardNote.Card>
          <Switch
            fallback={<BoardNote.PrivateHeader createdAt={note().createdAt} />}
          >
            <Match when={note().author}>
              {(author) => (
                <BoardNote.PublicHeader
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
        </BoardNote.Card>
      </BoardNote>

      <Switch>
        <Match when={commentsQueries[0]?.isLoading}>
          <div class="flex w-full flex-1 items-center justify-center">
            <LoadingSvg class="w-8 fill-accent text-transparent" />
          </div>
        </Match>
        <Match when={comments().length === 0}>
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
        <Match when={comments().length > 0}>
          <Virtualizer
            itemSize={110}
            ref={(handle) => setVirtualizerHandle(handle)}
            // startMargin={scrollMarginTop()}
            startMargin={scrollMarginTop()}
            data={comments()}
            scrollRef={scrollableElement}
            shift={maintainScrollFromBottom()}
            // onScroll={() => {
            //   console.log("scroll", performance.now());
            // }}
            // onScrollEnd={() => {
            //   console.log("scroll end", performance.now());
            // }}
            onRangeChange={(startIndex, endIndex) => {
              batch(() => {
                setEndRangeIndex(endIndex);

                if (isGapDelayed) {
                  return;
                }

                for (let i = startIndex; i <= endIndex; ++i) {
                  const commentItem = comments()[i];
                  if (commentItem.type === "gap") {
                    const wait = () => {
                      if (!delayOnScrollGap) {
                        isGapDelayed = false;
                        onScrollGap(commentItem);
                      } else {
                        delayOnScrollGap.then(wait);
                      }
                    };
                    isGapDelayed = true;
                    wait();
                    return;
                  }
                }

                // if (
                //   backwardGapIndex() !== -1 &&
                //   commentPages().length > 1 &&
                //   backwardGapIndex() <= endIndex
                // ) {
                //   setMaintainScrollFromBottom(true);
                // } else {
                //   setMaintainScrollFromBottom(false);
                // }
              });
            }}
            // [TODO] use shift while reverse scroll
          >
            {(commentItem, index) => (
              <Switch>
                <Match
                  when={
                    (commentItem.type === "gap" &&
                      ["anonymous", "public"].includes(
                        comments()[index - 1]?.type,
                      ) &&
                      ["anonymous", "public"].includes(
                        comments()[index + 1]?.type,
                      )) ||
                    (commentItem.type === "query" &&
                      commentItem.query.isLoading)
                  }
                >
                  <div role="status" class="my-3 flex w-full justify-center">
                    <LoadingSvg class="w-8 fill-accent text-transparent" />
                    <span class="sr-only">Next comments is loading</span>
                  </div>
                </Match>
                <Match
                  when={
                    commentItem.type === "query" && commentItem.query.isError
                  }
                >
                  <p class="my-4 w-full text-center">Failed to load page</p>
                </Match>
                <Match
                  when={
                    commentItem.type !== "query" &&
                    commentItem.type !== "gap" &&
                    commentItem
                  }
                >
                  {(comment) => (
                    <article
                      data-not-last={
                        index !== comments().length - 2 ? "" : undefined
                      }
                      class={clsxString(
                        "mb-4 grid grid-cols-[36px,1fr] grid-rows-[auto,auto,auto] gap-y-[2px] pb-4 [&[data-not-last]]:border-b-[0.4px] [&[data-not-last]]:border-b-separator",
                      )}
                    >
                      <Switch>
                        <Match when={comment().author}>
                          {(author) => (
                            <A
                              class="col-span-full flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity active:opacity-70"
                              href={`/board/${author().id}`}
                            >
                              <AvatarIcon
                                lazy
                                class="h-[22px] w-[22px]"
                                isLoading={false}
                                url={comment().author?.photo ?? null}
                              />
                              {author().name}
                            </A>
                          )}
                        </Match>
                        <Match when={comment().type === "anonymous"}>
                          <div class="col-span-full flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity">
                            <AnonymousAvatarIcon class="h-[22px] w-[22px]" />
                            Anonymously
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
              </Switch>
            )}
          </Virtualizer>
        </Match>
      </Switch>

      {platform === "ios" && commentInputTranslateTopPx && (
        <div
          class="h-0 contain-strict"
          style={{
            height: commentInputTranslateTopPx(),
          }}
        />
      )}
      <div
        ref={commentCreatorContainerRef}
        style={
          platform === "ios" && commentInputTranslateTopPx
            ? {
                transform: `translateY(-${commentInputTranslateTopPx()})`,
              }
            : undefined
        }
        class="sticky bottom-0 -mx-2 mt-auto bg-secondary-bg px-2 pb-6 pt-2"
      >
        <CommentCreator
          boardId={boardId()}
          noteId={note().id}
          onCreated={(comment) => {
            if (commentsQueries.length !== commentPages().length) {
              if (import.meta.env.DEV) {
                console.warn("unexpected length mismatch");
              }
              return;
            }
            let lastCount = -1;
            for (const query of commentsQueries) {
              if (query.data?.count !== undefined) {
                lastCount = Math.max(query.data.count, lastCount);
              }
            }
            if (lastCount === -1) {
              return;
            }

            const newCount = lastCount + 1;
            const newPageNumber = ((newCount / COMMENTS_PAGE_SIZE) | 0) + 1;

            batch(() => {
              queryClient.setQueryData(
                keysFactory.commentsNew({
                  noteId: note().id,
                  page: newPageNumber,
                }).queryKey,
                (curData) =>
                  curData
                    ? {
                        count: curData.count,
                        items: [...curData.items, comment],
                      }
                    : {
                        count: newCount,
                        items: [comment],
                      },
              );
              // we need to create new page
              if (!commentPages().includes(newPageNumber)) {
                setCommentPages((pages) => [...pages, newPageNumber]);
              }
            });

            const wait = () =>
              new Promise<void>((resolve) => {
                setTimeout(resolve, 1_000);
              });

            delayOnScrollGap = delayOnScrollGap
              ? delayOnScrollGap.then(wait)
              : wait();
            delayOnScrollGap.finally(() => {
              delayOnScrollGap = null;
            });
            // setIsScrollingToLastElement(true);
            requestAnimationFrame(() => {
              // scrollableElement.children.item(0)?.scrollIntoView({
              //   behavior: "smooth",
              //   block: "end",
              // });
              batch(() => {
                setMaintainScrollFromBottom(true);
                // setTimeout(() => setMaintainScrollFromBottom(true), 999);
                getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
                  smooth: true,
                });

                console.log("maintaining scroll from end");
              });
            });
            // requestAnimationFrame(() => {
            //   getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
            //     smooth: true,
            //     align: "end",
            //   });
            // });
          }}
        />
      </div>
    </main>
  );
};
function createOnResizeScrollAdjuster(
  commentCreatorContainer: () => HTMLDivElement,
) {
  createEffect(() => {
    const commentCreatorContainerRef = commentCreatorContainer();
    assertOk(commentCreatorContainerRef);
    useCleanup((signal) => {
      let prevHeight = commentCreatorContainerRef.clientHeight;
      const resizeObserver = new ResizeObserver(() => {
        const curHeight = commentCreatorContainerRef.clientHeight;
        scrollableElement.scrollBy({
          top: (curHeight - prevHeight) * (platform === "ios" ? 0.5 : 1),
        });
        prevHeight = curHeight;
      });

      resizeObserver.observe(commentCreatorContainerRef);

      signal.onabort = () => resizeObserver.disconnect();
    });
  });
}

function createScrollAdjuster(innerHeight: Accessor<number>) {
  createEffect(
    on(
      () => innerHeight(),
      (height, prevHeight) => {
        if (prevHeight === undefined) {
          return;
        }
        const diff = prevHeight - height;

        if (Math.abs(diff) > 5) {
          getVirtualizerHandle()?.scrollBy(diff);
        }
      },
    ),
  );
}

function createSafariScrollAdjuster(
  keyboard: KeyboardStatus,
  commentInputSize: Accessor<number>,
) {
  createEffect(
    on(
      () => keyboard.isKeyboardOpen(),
      (isOpen) => {
        if (!isOpen) return;

        const bottom =
          scrollableElement.scrollHeight -
          scrollableElement.scrollTop -
          scrollableElement.clientHeight;

        if (bottom - commentInputSize() < 50) {
          getVirtualizerHandle()?.scrollBy(bottom);
          return;
        }
      },
    ),
  );
}

function createCommentInputBottomOffset(
  innerHeight: Accessor<number>,
  tgHeight: Accessor<number>,
  keyboard: KeyboardStatus,
  initialHeightDiff: number,
) {
  const windowScrollTop = createWindowScrollTop();
  const commentInputBottomOffset = () =>
    innerHeight() -
    tgHeight() -
    windowScrollTop() -
    (!keyboard.isKeyboardOpen()
      ? initialHeightDiff
      : keyboard.isPortrait()
        ? 0
        : initialHeightDiff / 2);
  return commentInputBottomOffset;
}
