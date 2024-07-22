import {
  COMMENTS_PAGE_SIZE,
  keysFactory,
  type GetCommentResponse,
} from "@/api/api";
import type { Comment } from "@/api/model";
import { ArrayHelper } from "@/lib/array";
import { assertOk } from "@/lib/assert";
import { queryClient } from "@/queryClient";
import {
  createMutation,
  createQueries,
  type Query,
  type QueryKey,
} from "@tanstack/solid-query";
import { batch, createEffect, createMemo, createSignal, on } from "solid-js";
import { wait } from "./utils";

const pagesCountOfCommentsCount = (commentsCount: number) => {
  return Math.max(Math.ceil(commentsCount / COMMENTS_PAGE_SIZE), 1);
};

export type CommentItem =
  | { type: "loader"; id: "prev-item" | "next-item" }
  | Comment;

const noteCommentsKey = (noteId: string) =>
  keysFactory
    .comments({
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

function commentsCountFromCache(noteId: string) {
  let lastCount = -1;
  const queries = queryClient.getQueryCache().findAll({
    queryKey: noteCommentsKey(noteId),
  }) as Array<Query<GetCommentResponse>>;
  for (const query of queries) {
    if (query.state.data?.count !== undefined) {
      lastCount = Math.max(query.state.data.count, lastCount);
    }
  }

  return lastCount === -1 ? null : lastCount;
}

const isLoaded = (items: Query) => {
  return items.state.status === "success";
};

const getPagesNumbers = (queries: { readonly queryKey: QueryKey }[]) =>
  queries.map((it) => it.queryKey.at(-1) as number);
function getInitialPagesList(noteId: string, isReversed: () => boolean) {
  const pages = getPagesNumbers(
    getAllNoteCommentsQueries(noteId).filter(isLoaded),
  );
  if (import.meta.env.DEV) {
    assertOk(pages.every((it) => typeof it === "number"));
  }
  if (pages.length === 0) {
    return isReversed() ? [-1] : [1];
  }

  const sortedPages = ArrayHelper.sortNumbersAsc(pages);
  let oneSidePages: number[];
  if (isReversed()) {
    const gapIndex = ArrayHelper.findLastGapAsc(sortedPages);

    oneSidePages =
      gapIndex === null ? sortedPages : sortedPages.slice(gapIndex + 1);
  } else if (sortedPages.at(0) !== 1) {
    oneSidePages = [];
  } else {
    const gapIndex = ArrayHelper.findGapAsc(sortedPages);

    oneSidePages =
      gapIndex === null ? sortedPages : sortedPages.slice(0, gapIndex);
  }

  if (oneSidePages.length === 0) {
    return isReversed() ? [-1] : [1];
  }

  return oneSidePages;
}

export const createReversingCommentsQuery = (
  noteId: () => string,
  isReversed: () => boolean,
  setIsReversed: (newReversed: boolean) => void,
  onReverseDataReady: (comment: Comment | null) => void,
  onReverseOpenScroll: () => void,
) => {
  const [commentPages, setCommentPages] = createSignal(
    getInitialPagesList(noteId(), isReversed),
  );

  const commentsQueries = createQueries(() => ({
    queries: commentPages().map((page) =>
      keysFactory.comments({
        page,
        noteId: noteId(),
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
        const minusKey = keysFactory.comments({
          noteId: noteId(),
          page: -1,
        }).queryKey;
        const currentData = queryClient.getQueryData(minusKey);
        // must exist since we checked it earlier
        assertOk(currentData);
        queryClient.cancelQueries({ queryKey: minusKey });

        const page = pagesCountOfCommentsCount(currentData.count);

        batch(() => {
          queryClient.setQueryData(
            keysFactory.comments({
              page,
              noteId: noteId(),
            }).queryKey,
            currentData,
          );
          setCommentPages([page]);
        });

        onReverseOpenScroll();
        // waitAddition(() => {
        //   getVirtualizerHandle()?.scrollToIndex(commentItems().length - 1, {
        //     align: "start",
        //   });
        // });
      },
    ),
  );

  const commentsPagesSynced = createMemo<number[]>(
    (prev) =>
      commentPages().length === commentsQueries.length ? commentPages() : prev,
    commentPages(),
  );

  const hasPrevPage = () => commentPages()[0] !== 1 || commentPages()[0] === -1;
  const hasNextPage = () => {
    const count = commentsCount();
    if (!count || commentPages()[0] === -1) {
      return false;
    }

    return commentPages().at(-1) !== pagesCountOfCommentsCount(count);
  };

  type CommentsMemoRes = {
    commentItems: CommentItem[];
    firstLoadedPageNumber: number | null;
    lastCommentId: string | null;
  };
  const commentsMemo = createMemo(
    (prev: CommentsMemoRes) => {
      const pages = commentPages();
      let firstVisiblePageNumber: null | number = null;
      // tanstack query batches updates with queueMicrotask
      if (pages.length !== commentsQueries.length) {
        return prev;
      }
      const commentItems: CommentItem[] = [];
      for (let i = 0; i < pages.length; ++i) {
        const pageQuery = commentsQueries[i];

        if (pageQuery.isSuccess) {
          firstVisiblePageNumber ??= pages[i];
          commentItems.push(...pageQuery.data.items);
        }
      }

      return {
        commentItems,
        firstLoadedPageNumber: firstVisiblePageNumber,
        lastCommentId: commentItems.at(-1)?.id ?? null,
      };
    },
    { firstLoadedPageNumber: null, commentItems: [], lastCommentId: null },
    {
      equals: (prev, next) =>
        Object.is(prev?.commentItems, next?.commentItems) &&
        Object.is(prev?.firstLoadedPageNumber, next?.firstLoadedPageNumber) &&
        Object.is(prev?.lastCommentId, next.lastCommentId),
    },
  );

  const commentsCount = createMemo(() => {
    // [TODO]: frank checking
    commentPages();
    commentsQueries.length;
    commentsMemo();

    return commentsCountFromCache(noteId());
  });

  const fetchNext = (fromStart: boolean, fromEnd: boolean) => {
    if (isReversing()) {
      return;
    }
    assertOk(commentPages().length > 0);
    if (commentPages().length !== commentsQueries.length) {
      return;
    }

    if (!isReversed() && fromStart) {
      fromStart = false;
    }
    const direction = fromStart ? "start" : fromEnd ? "end" : null;

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

  //#region reversing
  /**
   * reversing - process of scroll down and then removal of top
   * while this process our pages must not be changed
   */
  const [isReversing, setIsReversing] = createSignal<{
    targetPageNumbers: number[];
    gapStartIndex: number | null;
    fallbackPageNumber: number[];
  } | null>(null);

  const onFallbackReverse = () => {
    const currentReversing = isReversing();
    if (!currentReversing) {
      return;
    }

    batch(() => {
      setCommentPages(currentReversing?.fallbackPageNumber);
      setIsReversing(null);
    });
  };
  const reversedMutation = createMutation(() => ({
    mutationFn: async (comment: Comment | null) => {
      if (commentsQueries.length !== commentPages().length) {
        if (import.meta.env.DEV) {
          console.warn("unexpected length mismatch");
        }
        return;
      }
      assertOk(!isReversing());
      const count = commentsCount();
      assertOk(count !== null);
      const newCount = comment ? count + 1 : count;
      const newPageNumber = pagesCountOfCommentsCount(newCount);

      // [TODO]: use last **loaded** page
      const lastPage = commentPages().findLast((_, index) => {
        return commentsQueries[index].isSuccess;
      });
      assertOk(lastPage !== undefined);
      // what can happen?
      // user can stop scroll - if we are after point of gap - we need to stick to bottom and remove items
      // if not - we should stick to top and remove bottom items
      // if pageSize where we trying to scroll is less than 6 elements - we need to load it first
      // if page will have less than 6 elements - we need to load previous page
      const itemsOnNewPage = newCount % COMMENTS_PAGE_SIZE;
      const promisesArr: Promise<unknown>[] = [];

      const newPageQueryOptions = keysFactory.comments({
        noteId: noteId(),
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
      const loadPrevPage = newPageNumber > 1;
      if (loadPrevPage) {
        promisesArr.push(
          queryClient.ensureQueryData(
            keysFactory.comments({
              noteId: noteId(),
              page: newPageNumber - 1,
            }),
          ),
        );
      }

      await Promise.all(promisesArr);

      return newPageNumber;
    },
    onSuccess: (newPageNumber, comment) => {
      if (newPageNumber === undefined) {
        return;
      }
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
            gapStartIndex,
            targetPageNumbers: gapIndex
              ? commentPages().slice(gapIndex)
              : commentPages(),
          }));
        });
      }

      onReverseDataReady(comment);
      wait(1_500).then(onFallbackReverse);
    },
  }));
  const reverse = reversedMutation.mutateAsync;

  const onScrollEnd = ([start, end]: [
    startIndex: number,
    endIndex: number,
  ]) => {
    const isReversed = (() => {
      const curIsReversing = isReversing();
      if (!curIsReversing) {
        return false;
      }
      // if we scrolled gap line - consider list reversed -> remove top part
      return (
        curIsReversing.gapStartIndex !== null &&
        (start > curIsReversing.gapStartIndex ||
          end > curIsReversing.gapStartIndex)
      );
    })();

    if (!isReversed) {
      return;
    }
    const currentReversing = isReversing();
    assertOk(currentReversing);
    batch(() => {
      const pages = currentReversing.targetPageNumbers;
      if (pages) {
        setCommentPages(pages);
      }

      setIsReversing(null);
      setIsReversed(true);
    });
  };
  //#endregion reversing

  return {
    commentPages: commentsPagesSynced,
    commentsQueries,
    /**
     *
     * @description while reversing addition scrolling and reversing disallowed
     */
    isReversing: () => !!isReversing() || reversedMutation.isPending,
    isLoading: () =>
      (commentPages().length === 1 && commentsQueries.length === 0) ||
      (commentsQueries[0]?.isLoading && commentsQueries.length === 1),

    commentsCount,
    comments: () => commentsMemo().commentItems,
    firstLoadedPageNumber: () => commentsMemo().firstLoadedPageNumber,
    lastCommentId: () => commentsMemo().lastCommentId,

    reverse,
    checkIsReversed: onScrollEnd,
    fetchNext,

    hasPrevPage,
    hasNextPage,
  };
};
