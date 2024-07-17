import {
  COMMENTS_PAGE_SIZE,
  keysFactory,
  type GetCommentResponse,
} from "@/api/api";
import type { Comment, Note } from "@/api/model";
import {
  PxString,
  clamp,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  scrollableElement,
} from "@/common";
import { AnonymousAvatarIcon, ArrowDownIcon } from "@/icons";
import { ArrayHelper, type IsEqual } from "@/lib/array";
import { assertOk } from "@/lib/assert";
import {
  createInnerHeight,
  createTransitionPresence,
  unwrapSignals,
} from "@/lib/solid";
import { queryClient } from "@/queryClient";
import { A, useSearchParams } from "@solidjs/router";
import {
  Query,
  createMutation,
  createQueries,
  useQueryClient,
  type QueryKey,
} from "@tanstack/solid-query";
import {
  Match,
  Show,
  Switch,
  batch,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  on,
  onCleanup,
  type Accessor,
} from "solid-js";
import { createMutable } from "solid-js/store";
import { Virtualizer } from "virtua/solid";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { CommentCreator } from "../ContentCreator/CommentCreator";
import { createInputFocusPreventer } from "../ContentCreator/PostInput";
import { LoadingSvg } from "../LoadingSvg";
import { useKeyboardStatus } from "../keyboardStatus";
import { getVirtualizerHandle, setVirtualizerHandle } from "../pageTransitions";
import { useScreenSize } from "../screenSize";
import {
  createCommentInputBottomOffset,
  createOnResizeScrollAdjuster,
  createSafariScrollAdjuster,
  createScrollAdjuster,
} from "./scrollAdjusters";
import { wait } from "./utils";

type CommentItem = { type: "loader"; id: "prev-item" | "next-item" } | Comment;
const PREV_LOADING_ITEM: CommentItem = {
  type: "loader",
  id: "prev-item",
};
const NEXT_LOADING_ITEM: CommentItem = {
  type: "loader",
  id: "next-item",
};

const pagesCountOfCommentsCount = (commentsCount: number) => {
  return Math.max(Math.ceil(commentsCount / COMMENTS_PAGE_SIZE), 1);
};

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

const isLoaded = (items: Query) => {
  return items.state.status === "success";
};

const getPagesNumbers = (queries: { readonly queryKey: QueryKey }[]) =>
  queries.map((it) => it.queryKey.at(-1) as number);

const REVERSED_KEY = "reversed";
export const createCommentsPageUrl = (
  note: Note,
  boardId: string,
  reversed: boolean,
) => {
  const params = new URLSearchParams([
    ["note", JSON.stringify(note)],
    ["boardId", boardId],
    [REVERSED_KEY, String(reversed)],
  ]);

  return `/comments/${note.id}?${params.toString()}`;
};

const createOneSideArraySync = <T,>(
  arr: () => T[],
  anchorElement: () => number,
  isEqual: IsEqual<T>,
) => {
  const [sig, setArr] = createSignal(arr());
  const [isInsertingBefore, setIsInsertingBefore] = createSignal(false);

  const [hasTimer, setHasTimer] = createSignal(false);
  let animationEndPromise: null | Promise<void> = null;
  createEffect(() => {
    if (hasTimer()) {
      return;
    }
    const equal = ArrayHelper.isEqual(sig(), arr(), isEqual);
    // console.log(
    //   unwrapUntrackSignals({
    //     sig,
    //     arr,
    //     equal,
    //     anchorElement,
    //   }),
    // );

    if (equal) {
      return;
    }

    setHasTimer(true);
    const pr = Promise.withResolvers<void>();
    animationEndPromise = pr.promise;

    // delaying rerenders to release event loop
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const res = ArrayHelper.oneSideChange(
            sig(),
            arr(),
            isEqual,
            clamp(anchorElement(), 0, sig().length - 1),
          );

          batch(() => {
            setArr(res.data);
            setIsInsertingBefore(res.front);
          });
        } finally {
          pr.resolve();
          animationEndPromise = null;
          setHasTimer(false);
        }
      });
    });
  });

  return [sig, isInsertingBefore, () => animationEndPromise] as const;
};

export const CommentsPage = () => {
  const [searchParams] = useSearchParams();

  const [isReversed, setIsReversed] = useReversed();
  const note = createMemo(() => {
    assertOk(searchParams.note);
    return JSON.parse(searchParams.note) as Note;
  });
  const boardId = createMemo(() => {
    assertOk(searchParams.boardId);
    return searchParams.boardId;
  });

  const queryClient = useQueryClient();

  const [commentPages, setCommentPages] = createInitialPagesList(
    note(),
    isReversed,
  );

  const commentsQueries = createQueries(() => ({
    queries: commentPages().map((page) =>
      keysFactory.commentsNew({
        page,
        noteId: note().id,
      }),
    ),
  }));
  // -1 => realPageNumber, to simplify paging
  createEffect(
    on(
      () => {
        const minusOneIndex = commentPages().indexOf(-1);
        if (import.meta.env.DEV) {
          assertOk(minusOneIndex === -1 || minusOneIndex === 0);
        }
        if (minusOneIndex === -1) {
          return null;
        }
        if (
          commentsQueries.length !== commentPages().length ||
          !commentsQueries[0].isSuccess
        ) {
          return null;
        }

        return minusOneIndex;
      },
      (index) => {
        if (index === null) {
          return;
        }
        const minusKey = keysFactory.commentsNew({
          noteId: note().id,
          page: -1,
        }).queryKey;
        const currentData = queryClient.getQueryData(minusKey);
        // must exist since we checked it earlier
        assertOk(currentData);
        queryClient.cancelQueries({ queryKey: minusKey });

        const page = pagesCountOfCommentsCount(currentData.count);

        batch(() => {
          queryClient.setQueryData(
            keysFactory.commentsNew({
              page,
              noteId: note().id,
            }).queryKey,
            currentData,
          );
          setCommentPages([page]);
        });

        waitAddition(() => {
          getVirtualizerHandle()?.scrollToIndex(commentItems().length - 1, {
            align: "start",
          });
        });
      },
    ),
  );

  // [TODO]: if there will be problem on big pages - it'c necessary to rewrite it imperative
  type CommentsMemoRes = {
    commentItems: CommentItem[];
    firstVisiblePageNumber: number | null;
    lastCommentId: string | null;
  };
  const commentsMemo = createMemo(
    (prev: CommentsMemoRes) => {
      const pages = commentPages();
      let firstVisiblePageNumber: null | number = null;
      // console.log(pages.length, commentsQueries.length, performance.now());
      // tanstack query batches updates with queueMicrotask
      if (pages.length !== commentsQueries.length) {
        return prev;
      }
      const commentItems: CommentItem[] = [];
      for (let i = 0; i < pages.length; ++i) {
        const pageQuery = commentsQueries[i];

        // [TODO]: handle errros
        if (pageQuery.isSuccess) {
          firstVisiblePageNumber ??= pages[i];
          commentItems.push(...pageQuery.data.items);
        }
      }

      return {
        commentItems,
        firstVisiblePageNumber,
        lastCommentId: commentItems.at(-1)?.id ?? null,
      };
    },
    { firstVisiblePageNumber: null, commentItems: [], lastCommentId: null },
    {
      equals: (prev, next) =>
        Object.is(prev?.commentItems, next?.commentItems) &&
        Object.is(prev?.firstVisiblePageNumber, next?.firstVisiblePageNumber) &&
        Object.is(prev?.lastCommentId, next.lastCommentId),
    },
  );

  const comments = () => commentsMemo()?.commentItems;
  const firstPageNumber = () => commentsMemo()?.firstVisiblePageNumber;
  const lastCommentId = () => commentsMemo()?.lastCommentId;

  const commentsCount = () => {
    // [TODO]: frank checking
    commentPages();
    commentsQueries.length;
    firstPageNumber();

    let lastCount = -1;
    const queries = queryClient.getQueryCache().findAll({
      queryKey: noteCommentsKey(note().id),
    }) as Array<Query<GetCommentResponse>>;
    for (const query of queries) {
      if (query.state.data?.count !== undefined) {
        lastCount = Math.max(query.state.data.count, lastCount);
      }
    }

    return lastCount === -1 ? null : lastCount;
  };

  // [1,2,3] -> [1,2,3,100] -> [100]
  // [99, 100, 101] -> [1,2,3,99,100,101] -> [1,2,3]
  const onScrollGap = (isNearStart: boolean, isNearEnd: boolean) => {
    // console.log(
    //   unwrapSignals({
    //     isStart,
    //     isEnd,
    //     commentPages,
    //     listMode,
    //     commentPagesLength: commentPages().length,
    //     queries: commentsQueries.length,
    //   }),
    // );
    assertOk(commentPages().length > 0);
    if (commentPages().length !== commentsQueries.length) {
      return;
    }

    if (!isReversed() && isNearStart) {
      isNearStart = false;
    }
    const direction = isNearStart ? "start" : isNearEnd ? "end" : null;

    if (!direction) {
      return;
    }

    if (direction === "start" && commentPages()[0] === 1) {
      return;
    }
    const _commentsCount = commentsCount();
    if (
      _commentsCount === null ||
      _commentsCount === 0 ||
      (direction === "end" &&
        commentPages().at(-1) === pagesCountOfCommentsCount(_commentsCount))
    ) {
      return;
    }

    batch(() => {
      setCommentPages((items) =>
        direction === "start"
          ? [items[0] - 1, ...items]
          : [...items, items.at(-1)! + 1],
      );
    });
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

  const [scrollMarginTop, setBeforeListElement] = createListMarginTop(128);

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

  const [range, setRange] = createSignal<[number, number]>([0, 0], {
    equals: (a, b) => a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1]),
  });
  const getRangeStatus = ([startIndex, endIndex]: [number, number]) => {
    const isNearStart = startIndex < 10;
    const isNearEnd = endIndex >= comments().length - 9;

    return [isNearStart, isNearEnd] as const;
  };

  /**
   * reversing - process of think with scroll down
   */
  const [isReversing, setIsReversing] = createSignal<{
    scrollIndex: number;
    targetPageNumbers: number[];
    gapStartIndex: number | null;
    fallbackPageNumber: number[];
  } | null>(null);

  const onFallbackReverse = () => {
    const currentReversing = isReversing();
    if (!currentReversing) {
      return;
    }
    console.log(
      "reverted reverse",
      unwrapSignals({
        currentReversing,
        range,
      }),
    );

    batch(() => {
      setCommentPages(currentReversing?.fallbackPageNumber);
      setIsReversing(null);
    });
  };
  const onScrollEnd = () => {
    const isReversed = (() => {
      const curIsReversing = isReversing();
      if (!curIsReversing) {
        return;
      }
      const scrollIndex = curIsReversing?.scrollIndex;
      const _range = range();
      if (!_range) {
        return false;
      }
      const [start, end] = _range;
      // if we scrolled gap line - consider list reversed -> remove top part
      return (
        (curIsReversing.gapStartIndex !== null &&
          start > curIsReversing.gapStartIndex) ||
        (scrollIndex >= start && scrollIndex <= end)
      );
    })();

    if (isReversed) {
      const currentReversing = isReversing();
      assertOk(currentReversing);
      batch(() => {
        const pages = currentReversing.targetPageNumbers;
        if (pages) {
          // const prevShift = shift;
          // shift = true;
          setCommentPages(pages);
          // queueMicrotask(() => {
          //   shift = prevShift;
          // });
        }

        setIsReversing(null);
        setIsReversed(true);
      });

      // console.log(
      //   "isReversed.after",
      //   unwrapSignals({
      //     range,
      //     isReversing,
      //     commentPages,
      //   }),
      // );
    }
  };

  const waitAddition = (callback: () => void) => {
    const pr = addedElements();
    if (pr) {
      pr.then(() => waitAddition(callback));
      return;
    }
    callback();
  };

  const isSomethingLoading = createMemo(() =>
    commentsQueries.some((it) => it.isLoading),
  );

  createEffect(
    on(
      () =>
        !isReversing() &&
        !isSomethingLoading() &&
        !commentPages().includes(-1) &&
        range(),
      (curRange) => {
        if (!curRange) {
          return;
        }

        onScrollGap(...getRangeStatus(curRange));
      },
    ),
  );

  const hasPrevPage = () => commentPages()[0] !== 1 || commentPages()[0] === -1;
  const hasNextPage = () => {
    const count = commentsCount();
    if (!count || commentPages()[0] === -1) {
      return false;
    }

    return commentPages().at(-1) !== pagesCountOfCommentsCount(count);
  };

  const reverseListMutation = createMutation(() => ({
    mutationFn: async (comment: Comment | null) => {
      if (commentsQueries.length !== commentPages().length) {
        if (import.meta.env.DEV) {
          console.warn("unexpected length mismatch");
        }
        return;
      }
      assertOk(!isReversing());
      console.log("onCreated");
      // [TODO]: figure out what to do
      const newPageNumber = await (async () => {
        const count = commentsCount();
        assertOk(count);
        const newCount = comment ? count + 1 : count;
        const newPageNumber = pagesCountOfCommentsCount(newCount);

        // [TODO]: use last **loaded** page
        const lastPage = commentPages().findLast((it) => {
          return commentsQueries[it].isSuccess;
        });
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
          comment &&
          (queryClient.getQueryData(newPageQueryKey) || itemsOnNewPage === 1)
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
          promisesArr.push(queryClient.ensureQueryData(newPageQueryOptions));
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
        return newPageNumber;
      })();

      // console.log("ensured load", promisesArr.length);
      if (!commentPages().includes(newPageNumber)) {
        batch(() => {
          const fallbackCommentPages = commentPages();
          setCommentPages(
            ArrayHelper.toInsertedInUniqueSortedArray(commentPages(), [
              newPageNumber - 1,
              newPageNumber,
            ]),
          );
          const gapIndex = ArrayHelper.findGapAsc(commentPages());
          const gapStartIndex =
            gapIndex !== null ? gapIndex * COMMENTS_PAGE_SIZE : null;

          setIsReversing(() => ({
            fallbackPageNumber: fallbackCommentPages,
            scrollIndex: -1,
            gapStartIndex,
            targetPageNumbers: gapIndex
              ? commentPages().slice(gapIndex)
              : commentPages(),
          }));
        });
      }

      waitAddition(() => {
        wait(1_500).then(onFallbackReverse);

        requestAnimationFrame(() => {
          const commentIndex =
            comment && comments().findIndex((it) => it.id === comment.id);
          const scrollIndex =
            commentIndex === null || commentIndex === -1
              ? comments().length - 1
              : commentIndex;
          assertOk(scrollIndex !== -1);

          setIsReversing((current) =>
            current
              ? {
                  ...current,
                  scrollIndex,
                }
              : current,
          );
          getVirtualizerHandle()?.scrollToIndex(scrollIndex, {
            smooth: true,
          });
        });
      });
    },
  }));

  createRenderEffect(
    on(
      () => comments().length,
      (length) => {
        console.log(
          "length change",
          unwrapSignals({
            length,
            // shift,
            isReversing,
            isReversed,
          }),
        );
      },
    ),
  );

  createEffect(() => {
    console.log(
      unwrapSignals({
        commentPages,
      }),
    );
  });

  const onScrollDown = async (comment: Comment | null) => {
    if (reverseListMutation.isPending || isReversing()) {
      return;
    }
    if (!comment && isReversed()) {
      console.log("scrolling to last");
      getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
        smooth: true,
      });
      return;
    }

    await reverseListMutation.mutateAsync(comment);
  };

  const showBottomScroller = createMemo(() => {
    // for some reason on IOS scroll is not working when keyboard open
    // [TODO]: figure out why
    if (platform === "ios" && keyboard.isKeyboardOpen()) {
      return false;
    }
    const count = commentsCount();

    if (!count) {
      return false;
    }

    return (
      count -
        COMMENTS_PAGE_SIZE * ((firstPageNumber() ?? 1) - 1) -
        (range()?.[1] ?? 0) >
      10
    );
  });
  let bottomScroller!: HTMLButtonElement;
  const shouldShowBottomScroller = createTransitionPresence({
    when: showBottomScroller,
    element: () => bottomScroller,
  });

  const avg = (a: number, b: number) => ((a + b) / 2) | 0;
  const _commentsWithLoaders = createMemo(() => {
    const copy: CommentItem[] = [];
    if (hasPrevPage()) {
      copy.push(PREV_LOADING_ITEM);
    }
    copy.push(...comments());
    if (hasNextPage()) {
      copy.push(NEXT_LOADING_ITEM);
    }
    return copy;
  });
  const [commentItems, shift, addedElements] = createOneSideArraySync(
    () => _commentsWithLoaders(),
    () => {
      const min = _commentsWithLoaders().length > 1 ? 1 : 0;
      return Math.max(min, avg(...range()));
    },
    (a, b) => a === b || a.id === b.id,
  );
  // createEffect(() => {
  //   console.log(
  //     unwrapSignals({
  //       length: () => commentItems().length,
  //       shift,
  //     }),
  //   );
  // });
  //
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

  return (
    <main class="flex min-h-screen flex-col bg-secondary-bg px-4">
      <BoardNote ref={setBeforeListElement("note")} class="my-4">
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
          <Virtualizer
            itemSize={110}
            onScrollEnd={onScrollEnd}
            onScroll={(e) => {
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
                        comment().id === lastCommentId() ? "" : undefined
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
                            </div>
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

                <Match
                  when={
                    comment.type === "loader" &&
                    commentsQueries.at(comment.id === "next-item" ? -1 : 0)
                      ?.isError &&
                    commentsQueries.at(comment.id === "next-item" ? -1 : 0)
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
      </Switch>

      <Show
        when={
          platform === "ios" &&
          commentInputTranslateTopPx &&
          commentInputTranslateTopPx()
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
        ref={commentCreatorContainerRef}
        style={
          platform === "ios" && commentInputTranslateTopPx
            ? {
                transform: `translateY(-${commentInputTranslateTopPx()})`,
              }
            : undefined
        }
        class="sticky bottom-0 isolate -mx-2 mt-auto px-2 pb-6 pt-2 [&_*]:overscroll-y-contain"
      >
        <button
          {...createInputFocusPreventer.FRIENDLY}
          onClick={() => onScrollDown(null)}
          inert={!showBottomScroller()}
          ref={bottomScroller}
          class={clsxString(
            "absolute bottom-[calc(100%+12px)] right-0 -z-10 flex aspect-square w-9 items-center justify-center rounded-full bg-section-bg transition-[background,transform] duration-[150ms,300ms] contain-strict after:absolute after:-inset-3 after:content-[''] active:opacity-65",
            showBottomScroller() ? "" : "translate-y-[calc(100%+12px)]",
            shouldShowBottomScroller.present() ? "visible" : "invisible",
          )}
          aria-label="Scroll to the bottom"
        >
          <ArrowDownIcon class="scale-[85%] text-hint" />
        </button>
        <div class="absolute inset-0 -z-10 bg-secondary-bg" />

        <CommentCreator
          boardId={boardId()}
          noteId={note().id}
          onCreated={onScrollDown}
        />
      </section>
    </main>
  );
};
function createListMarginTop(defaultMarginTop: number) {
  const [scrollMarginTop, setScrollMarginTop] =
    createSignal<number>(defaultMarginTop);
  const beforeListElements = createMutable<Record<string, HTMLElement>>({});
  createEffect(() => {
    const maxTopFromEntries = (entires: ResizeObserverEntry[]) => {
      let maxScrollTop: number | null = null;
      for (const entry of entires) {
        const curMarginTopPlusSize =
          (entry?.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height) +
          entry.target.scrollTop;

        maxScrollTop =
          maxScrollTop === null
            ? curMarginTopPlusSize
            : Math.max(curMarginTopPlusSize, maxScrollTop);
      }

      return maxScrollTop;
    };

    const maxTopFromElements = (elements: HTMLElement[]) => {
      let maxScrollTop: number | null = null;
      for (const element of elements) {
        const curMarginTopPlusSize = element.scrollTop + element.offsetHeight;

        maxScrollTop =
          maxScrollTop === null
            ? curMarginTopPlusSize
            : Math.max(curMarginTopPlusSize, maxScrollTop);
      }

      return maxScrollTop;
    };

    const onNewMaxTopScroll = (newMarginTopScroll: number | null) => {
      if (
        newMarginTopScroll !== null &&
        Math.abs(scrollMarginTop() - newMarginTopScroll) >= 2
      ) {
        setScrollMarginTop(newMarginTopScroll);
      }
    };

    const observer = new ResizeObserver((entries) => {
      onNewMaxTopScroll(maxTopFromEntries(entries));
    });

    createEffect(
      on(
        () => Object.values(beforeListElements),
        (elements) => {
          for (const el of elements) {
            observer.observe(el);
          }

          onCleanup(() => {
            for (const el of elements) {
              observer.unobserve(el);
            }
          });
          onNewMaxTopScroll(maxTopFromElements(elements));
        },
      ),
    );
  });

  return [
    scrollMarginTop,
    (elId: string) => (beforeListElement: HTMLElement) => {
      onCleanup(() => {
        delete beforeListElements[elId];
      });
      beforeListElements[elId] = beforeListElement;
    },
  ] as const;
}

function createInitialPagesList(note: Note, isReversed: () => boolean) {
  const pages = getPagesNumbers(
    getAllNoteCommentsQueries(note.id).filter(isLoaded),
  );
  if (import.meta.env.DEV) {
    assertOk(pages.every((it) => typeof it === "number"));
  }
  if (pages.length === 0) {
    return createSignal(isReversed() ? [-1] : [1]);
  }

  const sortedPages = ArrayHelper.sortNumbersAsc(pages);
  let resPages: number[];
  if (isReversed()) {
    const gapIndex = ArrayHelper.findLastGapAsc(sortedPages);

    resPages =
      gapIndex === null ? sortedPages : sortedPages.slice(gapIndex + 1);
  } else {
    const gapIndex = ArrayHelper.findGapAsc(sortedPages);

    resPages = gapIndex === null ? sortedPages : sortedPages.slice(0, gapIndex);
  }

  if (resPages.length === 0) {
    return createSignal(isReversed() ? [-1] : [1]);
  }

  return createSignal(resPages);
}

function useReversed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isReversed = () => searchParams[REVERSED_KEY] === "true";

  return [
    isReversed,
    (newIsReversed: boolean) => {
      setSearchParams(
        {
          ...searchParams,
          [REVERSED_KEY]: newIsReversed ? "true" : "false",
        },
        {
          replace: true,
          scroll: false,
        },
      );
    },
  ] as const;
}
