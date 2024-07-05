import { keysFactory } from "@/api/api";
import type { Note } from "@/api/model";
import {
  assertOk,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  scrollableElement,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import { A, useSearchParams } from "@solidjs/router";
import { createInfiniteQuery } from "@tanstack/solid-query";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { Virtualizer } from "virtua/solid";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { LoadingSvg } from "../LoadingSvg";
import { CommentCreator } from "../ProfilePage/PostCreator";
import { useInfiniteScroll } from "../infiniteScroll";
import { setVirtualizerHandle } from "../pageTransitions";

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

  const commentsQuery = createInfiniteQuery(() =>
    keysFactory.comments({
      noteId: note().id,
    }),
  );

  const comments = createMemo(() =>
    commentsQuery.isSuccess
      ? commentsQuery.data.pages.flatMap((it) => it.items)
      : [],
  );

  const commentCreator = (
    <CommentCreator
      boardId={boardId()}
      noteId={note().id}
      onCreated={() => {
        if (platform === "ios") {
          return;
        }
        // wait for render
        requestAnimationFrame(() => {
          scrollableElement.scrollTo({
            behavior: "smooth",
            top: scrollableElement.scrollHeight,
          });
        });
      }}
    />
  );

  useInfiniteScroll(() => {
    if (!commentsQuery.isFetchingNextPage) {
      commentsQuery.fetchNextPage();
    }
  });

  const [scrollMarginTop, setScrollMarginTop] = createSignal<number>(
    platform === "ios" ? 250 : 128,
  );
  const [boardNote, setBoardNote] = createSignal<HTMLElement>();
  const [commentCreatorTop, setCommentCreatorTop] = createSignal<HTMLElement>();

  createEffect(() => {
    const observer = new ResizeObserver(() => {
      const bottom = Math.max(
        boardNote()?.getBoundingClientRect().bottom ?? -1,
        commentCreatorTop()?.getBoundingClientRect().bottom ?? -1,
      );
      if (bottom === -1) {
        return;
      }
      setScrollMarginTop(bottom);
    });

    const _commentCreator = commentCreatorTop();
    if (_commentCreator) {
      observer.observe(_commentCreator);
    }
    const _boardNote = boardNote();
    if (_boardNote) {
      observer.observe(_boardNote);
    }
  });

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

      <Show when={platform === "ios"}>
        <div
          // good pack of styling TG will not overscroll on any fixed/sticky element
          class="sticky top-0 z-10 -mx-2 -mt-3 mb-5 bg-secondary-bg px-2 pb-1 pt-2"
          // class="-mt-2 mb-2"
          //
          ref={setCommentCreatorTop}
        >
          {commentCreator}
        </div>
      </Show>
      <Switch>
        <Match when={commentsQuery.isLoading}>
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
            startMargin={scrollMarginTop()}
            data={comments()}
            scrollRef={scrollableElement}
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

          <Show when={commentsQuery.isFetchingNextPage}>
            <div role="status" class="mx-auto mt-6">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
              <span class="sr-only">Next comments is loading</span>
            </div>
          </Show>
        </Match>
      </Switch>

      <Show when={platform !== "ios"}>
        <div class="sticky bottom-0 -mx-4 mt-auto bg-secondary-bg px-4 pb-6 pt-2">
          {commentCreator}
        </div>
      </Show>
    </main>
  );
};
