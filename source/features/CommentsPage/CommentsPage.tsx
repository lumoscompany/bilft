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
import { createInnerHeight, unwrapSignals, useCleanup } from "@/lib/solid";
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
  type Accessor,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Virtualizer } from "virtua/solid";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { CommentCreator } from "../ContentCreator/CommentCreator";
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

type CommentItem = Comment;

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [isReversed, setIsReversed] = (() => {
    const reversedKey = "reversed";
    const isReversed = () => searchParams[reversedKey] === "true";

    return [
      isReversed,
      (newIsReversed: boolean) => {
        setSearchParams(
          {
            ...searchParams,
            [reversedKey]: newIsReversed,
          },
          {
            replace: true,
            scroll: false,
          },
        );
      },
    ];
  })();
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
    // [TODO]: frank checking
    commentPages();

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

  const listMode = createMemo<"reversed" | "regular">(() =>
    isReversed() ? "reversed" : "regular",
  );
  const fetchingSide = createMemo<"end" | "start" | null>(() =>
    commentsQueries.at(-1)?.isLoading
      ? "end"
      : commentsQueries.at(0)?.isLoading
        ? "start"
        : null,
  );
  const prevFetchingSide = (() => {
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

  /**
   * reversing - process of think with scroll down
   */
  const [isReversing, setIsReversing] = createSignal<{
    scrollIndex: number;
    targetPageNumbers: number[];
    doNotCheckBefore: number;
    fallbackPageNumber: number[];
  } | null>(null);
  createEffect(() => {
    console.log("range", range());
  });
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

      return scrollIndex >= start && scrollIndex <= end;
    })();

    if (isReversed) {
      const currentReversing = isReversing();
      assertOk(currentReversing);
      batch(() => {
        const pages = currentReversing.targetPageNumbers;
        if (pages) {
          const prevShift = shift;
          shift = true;
          setCommentPages(pages);
          queueMicrotask(() => {
            shift = prevShift;
          });
        }

        setIsReversing(null);
        setIsReversed(true);
      });

      console.log(
        "isReversed.after",
        unwrapSignals({
          range,
          isReversing,
          commentPages,
        }),
      );
    }
  };
  createEffect(
    on(
      () => !isReversing() && range(),
      (curRange) => {
        if (!curRange) {
          return;
        }

        onScrollGap(...tailStatus(curRange));
      },
    ),
  );

  const hasPrevPage = () => commentPages()[0] !== 1;
  const hasNextPage = () => {
    const count = commentsCount();
    if (!count) {
      return false;
    }

    return commentPages().at(-1) !== amountOfCommentPages(count);
  };

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

  const reverseListMutation = createMutation(() => ({
    mutationFn: async (comment: Comment | null) => {
      if (commentsQueries.length !== commentPages().length) {
        if (import.meta.env.DEV) {
          console.warn("unexpected length mismatch");
        }
        return;
      }
      console.log("onCreated");
      // [TODO]: figure out what to do
      if (listMode() === "reversed" || isReversing()) {
        return;
      }
      const count = commentsCount();
      assertOk(count);
      const newCount = comment ? count + 1 : count;
      const newPageNumber = amountOfCommentPages(newCount);

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
      console.log("ensured load", promisesArr.length);
      if (!commentPages().includes(newPageNumber)) {
        batch(() => {
          const prevShift = shift;
          shift = false;
          setCommentPages(
            ArrayHelper.toInsertedInUniqueSortedArray(commentPages(), [
              newPageNumber - 1,
              newPageNumber,
            ]),
          );
          const gapIndex = ArrayHelper.findGapAsc(commentPages());

          setIsReversing(() => ({
            fallbackPageNumber: commentPages(),
            scrollIndex: -1,
            doNotCheckBefore: Date.now() + 200,
            targetPageNumbers: gapIndex
              ? commentPages().slice(gapIndex)
              : commentPages(),
          }));

          queueMicrotask(() => {
            shift = prevShift;
          });
        });
      }

      wait(1_000).then(onFallbackReverse);
      requestAnimationFrame(() => {
        const commentIndex =
          comment && comments().findIndex((it) => it.id === comment.id);
        const scrollIndex =
          commentIndex === null || commentIndex === -1
            ? comments().length - 1
            : commentIndex;

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
    },
  }));

  let shift = !!isReversed();

  createEffect(() => {
    if (isReversed()) {
      shift = fetchingSide() === "start";
    }
  });
  // const shift = () =>
  //   !isReversing() && listMode() === "reversed" && prevFetchingSide() !== "end";

  createRenderEffect(
    on(
      () => comments().length,
      (length) => {
        console.log(
          "length change",
          unwrapSignals({
            length,
            shift,
            isReversing,
            listMode,
            prevFetchingSize: prevFetchingSide,
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
          <Show when={hasPrevPage()}>
            <div role="status" class="my-3 flex w-full justify-center">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
              <span class="sr-only">Prev comments is loading</span>
            </div>
          </Show>
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
            onScrollEnd={onScrollEnd}
            ref={(handle) => setVirtualizerHandle(handle)}
            startMargin={scrollMarginTop()}
            data={comments()}
            scrollRef={scrollableElement}
            shift={(() => shift)()}
            onRangeChange={(startIndex, endIndex) => {
              setRange([startIndex, endIndex]);
            }}
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

          <Show when={hasNextPage()}>
            <div role="status" class="my-3 flex w-full justify-center">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
              <span class="sr-only">Next comments is loading</span>
            </div>
          </Show>
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
            !reverseListMutation.isPending &&
              (await reverseListMutation.mutateAsync(comment));
          }}
        />
      </div>

      <Portal>
        <button
          onClick={() =>
            !reverseListMutation.isPending && reverseListMutation.mutate(null)
          }
          class="fixed bottom-4 right-4 aspect-square w-10 rounded-full bg-section-bg font-inter text-xs contain-strict"
        >
          Go down
        </button>
      </Portal>
    </main>
  );
};
