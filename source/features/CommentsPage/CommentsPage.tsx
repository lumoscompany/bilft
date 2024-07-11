import {
  COMMENTS_PAGE_SIZE,
  keysFactory,
  type GetCommentResponse,
} from "@/api/api";
import type { Comment, Note } from "@/api/model";
import {
  PxString,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  scrollableElement,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import { ArrayHelper } from "@/lib/array";
import { assertOk } from "@/lib/assert";
import {
  createInnerHeight,
  createWindowScrollTop,
  unwrapSignals,
  useCleanup,
} from "@/lib/solid";
import { queryClient } from "@/queryClient";
import { A, useSearchParams } from "@solidjs/router";
import {
  Query,
  createQueries,
  useQueryClient,
  type QueryKey,
} from "@tanstack/solid-query";
import {
  Match,
  Switch,
  batch,
  createEffect,
  createMemo,
  createRenderEffect,
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

type CommentItem = Comment;
type FetchingDirection = "start" | "end";
// | {
//     type: "query";
//     query: CreateQueryResult;
//   }
// | { type: "gap"; pageIndex: number; direction: "forward" | "backward" };

const noteCommentsKey = (noteId: string) =>
  keysFactory
    .commentsNew({
      noteId: noteId,
      page: 0,
    })
    .queryKey.slice(0, -1);

const getAllNoteCommentsQueries = (noteId: string) => {
  const defaultKey = noteCommentsKey(noteId);
  const pages = queryClient.getQueryCache().findAll({
    queryKey: defaultKey,
  });

  return pages;
};

const getPagesNumbers = (queries: { readonly queryKey: QueryKey }[]) =>
  queries.map((it) => it.queryKey.at(-1) as number);

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

  const queryClient = useQueryClient();

  const [commentPages, setCommentPages] = (() => {
    const pages = getPagesNumbers(getAllNoteCommentsQueries(note().id));
    if (import.meta.env.DEV) {
      assertOk(pages.every((it) => typeof it === "number"));
    }
    // console.log({
    //   pages,
    // });
    if (pages.length === 0) {
      return createSignal([1]);
    }

    const sortedPages = ArrayHelper.sortNumbersAsc(pages);
    const gapIndex = ArrayHelper.findGapAsc(sortedPages);

    return createSignal(
      gapIndex === null ? sortedPages : sortedPages.slice(0, gapIndex),
    );
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

      // [TODO]: handle errros
      if (pageQuery.isSuccess) {
        commentItems.push(...pageQuery.data.items);
      }
      // } else {
      //   commentItems.push({
      //     type: "query",
      //     query: pageQuery,
      //   });
      // }

      // const pageNumber = pages[i];
      // const nextPage = pages[i + 1];

      // const direction = !nextPage
      //   ? "forward"
      //   : nextPage - pageNumber > 1
      //     ? "backward"
      //     : null;
      // // object pooL?
      // if (direction) {
      //   commentItems.push({
      //     type: "gap",
      //     direction,
      //     pageIndex: direction === "backward" ? i + 1 : i,
      //   });
      // }
    }

    return commentItems;
  }, []);

  const commentsCount = () => {
    let lastCount = -1;
    const queries = queryClient.getQueryCache().findAll({
      queryKey: keysFactory
        .commentsNew({ noteId: note().id, page: 0 })
        .queryKey.slice(0, -1),
    }) as Array<Query<GetCommentResponse>>;
    for (const query of queries) {
      if (query.state.data?.count !== undefined) {
        lastCount = Math.max(query.state.data.count, lastCount);
      }
    }

    return lastCount === -1 ? null : lastCount;
  };
  const amountOfCommentPages = (commentsCount: number) => {
    return Math.ceil(commentsCount / COMMENTS_PAGE_SIZE);
  };

  // [1,2,3] -> [1,2,3,100] -> [100]
  // [99, 100, 101] -> [1,2,3,99,100,101] -> [1,2,3]
  const onScrollGap = (isStart: boolean, isEnd: boolean) => {
    console.log(
      unwrapSignals({
        isStart,
        isEnd,
        commentPages,
        listMode,
        commentPagesLength: commentPages().length,
        queries: commentsQueries.length,
      }),
    );
    assertOk(commentPages().length > 0);
    if (commentPages().length !== commentsQueries.length) {
      return;
    }

    if (listMode() === "regular" && isStart) {
      isStart = false;
    }
    const direction = isStart ? "start" : isEnd ? "end" : null;

    // [TODO]: in future it's possible to remove fetchingSide and make shift more imperative parameter
    if (!direction || fetchingSide() !== null) {
      return;
    }

    if (direction === "start" && commentPages()[0] === 1) {
      return;
    }
    const _commentsCount = commentsCount();
    if (
      _commentsCount === null ||
      (direction === "end" &&
        commentPages().at(-1) === amountOfCommentPages(_commentsCount))
    ) {
      return;
    }

    const newFetchingSide = direction;

    batch(() => {
      setCommentPages((items) =>
        direction === "start"
          ? [items[0] - 1, ...items]
          : [...items, items.at(-1)! + 1],
      );
    });
    // if (
    //   (direction == "forward" &&
    //     targetNumber < targetPage.data.count / COMMENTS_PAGE_SIZE) ||
    //   (direction === "backward" && targetNumber > 0)
    // ) {
    //   setCommentPages((pages) => {
    //     const start = direction === "forward" ? pageIndex + 1 : pageIndex;
    //     const next =
    //       direction === "forward" ? targetNumber + 1 : targetNumber - 1;

    //     const pagesCopy = [...pages];
    //     pagesCopy.splice(start, 0, next);

    //     return pagesCopy;
    //   });
    // }
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

  const [listMode, setListMode] = createSignal<"reversed" | "regular">(
    "regular",
  );
  const fetchingSide = createMemo<"end" | "start" | null>(() =>
    commentsQueries.at(-1)?.isLoading
      ? "end"
      : commentsQueries.at(0)?.isLoading
        ? "start"
        : null,
  );
  const prevFetchingSize = (() => {
    const [sig, setSig] = createSignal(fetchingSide());

    createEffect(
      on(
        () => fetchingSide(),
        (curFetchingSide) => {
          if (curFetchingSide) {
            setSig(curFetchingSide);
          }
        },
      ),
    );

    return sig;
  })();

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

  // const [maintainScrollFromBottom, setMaintainScrollFromBottom] =
  //   createSignal(false);

  let delayOnScrollGap: null | Promise<void> = null;
  const [isGapDelayed, setIsGapDelayed] = createSignal(false);

  // const rememberedArgs: null | [number, number] = null;
  const [range, setRange] = createSignal<[number, number] | undefined>(
    undefined,
    {
      equals: (a, b) =>
        a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1]),
    },
  );
  const tailStatus = ([startIndex, endIndex]: [number, number]) => {
    const isStart = startIndex < 2;
    const isEnd = endIndex >= comments().length - 2;

    return [isStart, isEnd] as const;
  };
  createEffect(
    on(
      () => !isGapDelayed() && range(),
      (curRange) => {
        if (!curRange) {
          return;
        }

        if (delayOnScrollGap) {
          setIsGapDelayed(true);
          const onThen = () => {
            if (!delayOnScrollGap) {
              setIsGapDelayed(false);
            } else {
              delayOnScrollGap.then(onThen);
            }
          };
          onThen();
          return;
        }
        onScrollGap(...tailStatus(curRange));
      },
    ),
  );
  // createEffect(() => {
  //   console.log(
  //     "changed",
  //     unwrapSignals({
  //       scrollMarginTop,
  //     }),
  //   );
  // });
  // const onChangeRange = (start: number, end: number) => {
  //   if (delayOnScrollGap) {
  //     rememberedArgs = [start, end];
  //   }
  //   if (delayOnScrollGap && !isGapDelayed) {
  //     delayOnScrollGap.then(
  //       () => rememberedArgs && onChangeRange(...rememberedArgs),
  //     );
  //     isGapDelayed = true;
  //     return;
  //   }

  //   if (!delayOnScrollGap && isGapDelayed) {
  //     isGapDelayed = false;
  //   }
  //   onScrollGap();
  // };
  createRenderEffect(
    on(
      () => comments().length,
      (length) => {
        console.log(
          "length change",
          unwrapSignals({
            length,
            shift:
              listMode() === "reversed" &&
              (prevFetchingSize() === "start" || isGapDelayed()),
            listMode,
            prevFetchingSize,
            isGapDelayed,
          }),
        );
      },
    ),
  );

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
        <Match
          when={commentsQueries[0]?.isLoading && commentsQueries.length === 1}
        >
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
          {/* <Match
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
                </Match> */}
          <Virtualizer
            itemSize={110}
            ref={(handle) => setVirtualizerHandle(handle)}
            // startMargin={scrollMarginTop()}
            startMargin={scrollMarginTop()}
            data={comments()}
            scrollRef={scrollableElement}
            // shift={maintainScrollFromBottom()}
            shift={
              listMode() === "reversed" &&
              (prevFetchingSize() === "start" || isGapDelayed())
            }
            // onScroll={() => {
            //   console.log("scroll", performance.now());
            // }}
            // onScrollEnd={() => {
            //   console.log("scroll end", performance.now());
            // }}
            onRangeChange={(startIndex, endIndex) => {
              setRange([startIndex, endIndex]);
            }}
            // [TODO] use shift while reverse scroll
          >
            {(comment, index) => (
              <article
                data-not-last={index !== comments().length - 1 ? "" : undefined}
                class={clsxString(
                  "mb-4 grid grid-cols-[36px,1fr] grid-rows-[auto,auto,auto] gap-y-[2px] pb-4 [&[data-not-last]]:border-b-[0.4px] [&[data-not-last]]:border-b-separator",
                )}
              >
                <Switch>
                  <Match when={comment.author}>
                    {(author) => (
                      <A
                        class="col-span-full flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity active:opacity-70"
                        href={`/board/${author().id}`}
                      >
                        <AvatarIcon
                          lazy
                          class="h-[22px] w-[22px]"
                          isLoading={false}
                          url={comment.author?.photo ?? null}
                        />
                        {author().name}
                      </A>
                    )}
                  </Match>
                  <Match when={comment.type === "anonymous"}>
                    <div class="col-span-full flex flex-row items-center gap-x-[6px] pl-2 font-inter text-[17px] font-medium leading-[22px] text-text transition-opacity">
                      <AnonymousAvatarIcon class="h-[22px] w-[22px]" />
                      Anonymously
                    </div>
                  </Match>
                </Switch>
                <div class="col-start-2 max-w-full overflow-hidden whitespace-pre-wrap font-inter text-[16px] leading-[22px]">
                  {comment.content}
                </div>
                <div class="col-start-2 font-inter text-[13px] leading-[18px] text-hint">
                  {formatPostDate(comment.createdAt)} at{" "}
                  {formatPostTime(comment.createdAt)}
                </div>
              </article>
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
          // eslint-disable-next-line solid/reactivity
          onCreated={async (comment) => {
            if (commentsQueries.length !== commentPages().length) {
              if (import.meta.env.DEV) {
                console.warn("unexpected length mismatch");
              }
              return;
            }
            console.log("onCreated");
            // [TODO]: figure out what to do
            if (listMode() === "reversed") {
              return;
            }
            const count = commentsCount();
            assertOk(count);
            const newCount = count + 1;
            const newPageNumber = amountOfCommentPages(newCount);

            let waitPr: Promise<void>;
            const wait = () =>
              waitPr ??
              (waitPr = new Promise<void>((resolve) => {
                setTimeout(resolve, 1_000);
              }));

            // [TODO]: use last loaded page
            const lastPage = commentPages().at(-1);
            assertOk(lastPage !== undefined);
            // what can happen?
            // user can stop scroll - if we are after point of gap - we need to stick to bottom and remove items
            // if not - we should stick to top and remove bottom items
            // if pageSize where we trying to scroll is less than 6 elements - we need to load it first
            // if page will have less than 6 elements - we need to load previous page

            const itemsOnNewPage = newCount % COMMENTS_PAGE_SIZE;
            const promisesArr: Promise<unknown>[] = [];

            const newPageQueryOptions = keysFactory.commentsNew({
              noteId: note().id,
              page: newPageNumber,
            });
            const newPageQueryKey = newPageQueryOptions.queryKey;
            await queryClient.cancelQueries({
              queryKey: newPageQueryKey,
            });
            if (
              queryClient.getQueryData(newPageQueryKey) ||
              itemsOnNewPage === 1
            ) {
              queryClient.setQueryData(newPageQueryKey, (curData) =>
                curData
                  ? {
                      count: newCount,
                      items: [...curData.items, comment],
                    }
                  : {
                      count: newCount,
                      items: [comment],
                    },
              );
            } else {
              promisesArr.push(
                queryClient.ensureQueryData(newPageQueryOptions),
              );
            }
            const loadPrevPage = itemsOnNewPage < 6 && newPageNumber > 1;
            if (loadPrevPage) {
              promisesArr.push(
                queryClient.ensureQueryData(
                  keysFactory.commentsNew({
                    noteId: note().id,
                    page: newPageNumber - 1,
                  }),
                ),
              );
            }

            await Promise.all(promisesArr);
            console.log("ensured load", promisesArr.length);
            if (!commentPages().includes(newPageNumber)) {
              setCommentPages((currentPages) => {
                // impossible case
                if (currentPages.length === 0) {
                  return [newPageNumber - 1, newPageNumber];
                }
                const lastPage = currentPages.at(-1);
                assertOk(lastPage);
                const nextPages = [newPageNumber - 1, newPageNumber];
                const prevPageIndex = currentPages.findIndex(
                  (it) => it >= newPageNumber - 2,
                );
                if (prevPageIndex === -1) {
                  return [...currentPages, ...nextPages];
                }
                const el = currentPages[prevPageIndex];
                assertOk(el >= newPageNumber - 2 && el <= newPageNumber);
                const sliceAmount = newPageNumber - el;
                if (sliceAmount === 2) {
                  return currentPages;
                }
                return [...currentPages, ...nextPages.slice(sliceAmount)];
              });
              const gapIndex = ArrayHelper.findGapAsc(commentPages());

              {
                const curPromise = delayOnScrollGap
                  ? delayOnScrollGap.then(wait)
                  : wait();
                curPromise.finally(() => {
                  if (delayOnScrollGap === curPromise) {
                    delayOnScrollGap = null;
                  }
                });

                delayOnScrollGap = curPromise;
              }

              if (gapIndex !== null) {
                wait().then(() => {
                  batch(() => {
                    setListMode("reversed");
                    setCommentPages((pages) => pages.slice(gapIndex + 1));
                  });
                });
              }
            }

            requestAnimationFrame(() => {
              getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
                smooth: true,
              });
            });

            /*             const amountOfNewPages = Math.abs(lastPage - newPageNumber);
            const needToReverseList =
              (amountOfNewPages === 1 && !isFirstCommentOnPage) ||
              amountOfNewPages >= 2;

            if (needToReverseList) {
              await queryClient.cancelQueries({
                queryKey: noteCommentsKey(note().id),
              });

            }

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
              if (!lastPage || commentPages().includes(newPageNumber)) {
                return;
              }
              setCommentPages((pages) => [...pages, newPageNumber]);

              if (needToReverseList) {
                wait().then(() => {
                  setListMode("reversed");
                  setCommentPages(() => [newPageNumber]);
                });
              }
            });

            requestAnimationFrame(() => {
              batch(() => {
                // setMaintainScrollFromBottom(true);
                // setTimeout(() => setMaintainScrollFromBottom(true), 999);
                getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
                  smooth: true,
                });

                console.log("scrolling to the end");
              });
            }); */
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
