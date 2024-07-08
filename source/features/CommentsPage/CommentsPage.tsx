import { keysFactory } from "@/api/api";
import type { Note } from "@/api/model";
import {
  assertOk,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  PxString,
  scrollableElement,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import {
  createInnerHeight,
  createWindowScrollTop,
  useCleanup,
} from "@/lib/solid";
import { A, useSearchParams } from "@solidjs/router";
import { createInfiniteQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  Show,
  Switch,
  type Accessor,
} from "solid-js";
import { Virtualizer } from "virtua/solid";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { CommentCreator } from "../ContentCreator/CommentCreator";
import { useInfiniteScroll } from "../infiniteScroll";
import { useKeyboardStatus } from "../keyboardStatus";
import { LoadingSvg } from "../LoadingSvg";
import { getVirtualizerHandle, setVirtualizerHandle } from "../pageTransitions";
import { useScreenSize } from "../screenSize";

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

  useInfiniteScroll(() => {
    if (!commentsQuery.isFetchingNextPage) {
      commentsQuery.fetchNextPage();
    }
  });
  const { height } = useScreenSize();
  const keyboard = useKeyboardStatus();

  const initialHeightDiff = window.innerHeight - height();

  const [scrollMarginTop, setScrollMarginTop] = createSignal<number>(128);
  const [boardNote, setBoardNote] = createSignal<HTMLElement>();

  createEffect(() => {
    const onObserve = () => {
      const el = boardNote();
      if (!el) {
        return;
      }
      const marginTop = el.offsetTop + el.offsetHeight;

      setScrollMarginTop(marginTop);
    };
    const observer = new ResizeObserver(onObserve);

    const _boardNote = boardNote();
    if (_boardNote) {
      observer.observe(_boardNote);
    }
    onObserve();
  });

  // long story short: Webview Safari + IOS Telegram = dog shit
  let commentInputTranslateTopPx: null | Accessor<PxString> = null;

  const innerHeight = createInnerHeight();
  if (platform === "ios") {
    const windowScrollTop = createWindowScrollTop();
    const commentInputSize = () =>
      innerHeight() -
      height() -
      windowScrollTop() -
      (!keyboard.isKeyboardOpen()
        ? initialHeightDiff
        : keyboard.isPortrait()
          ? 0
          : initialHeightDiff / 2);
    commentInputTranslateTopPx = () => PxString.fromNumber(commentInputSize());

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
  } else {
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

  let commentCreatorContainerRef!: HTMLDivElement;

  createEffect(() => {
    assertOk(commentCreatorContainerRef);
    useCleanup((signal) => {
      let prevHeight = commentCreatorContainerRef.clientHeight;
      const resizeObserver = new ResizeObserver(() => {
        const curHeight = commentCreatorContainerRef.clientHeight;
        // console.log({
        //   diff: curHeight - prevHeight,
        //   curHeight,
        //   prevHeight,
        // });
        scrollableElement.scrollBy({
          top: (curHeight - prevHeight) * (platform === "ios" ? 0.5 : 1),
        });
        prevHeight = curHeight;
      });

      resizeObserver.observe(commentCreatorContainerRef);

      signal.onabort = () => resizeObserver.disconnect();
    });
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
          onCreated={() => {
            requestAnimationFrame(() => {
              getVirtualizerHandle()?.scrollToIndex(comments().length - 1, {
                smooth: true,
              });
            });
          }}
        />
      </div>
    </main>
  );
};
