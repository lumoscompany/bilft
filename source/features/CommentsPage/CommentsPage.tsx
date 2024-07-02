import { keysFactory } from "@/api/api";
import type { Note } from "@/api/model";
import {
  assertOk,
  clsxString,
  formatPostDate,
  formatPostTime,
  platform,
  scrollableElement,
  unwrapSignals,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import { useCleanup } from "@/lib/solid";
import { A, useSearchParams } from "@solidjs/router";
import { createInfiniteQuery } from "@tanstack/solid-query";
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { LoadingSvg } from "../LoadingSvg";
import { CommentCreator } from "../ProfilePage/PostCreator";
import { useKeyboardStatus } from "../keyboardStatus";
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

  return (
    <main class="flex min-h-screen flex-col bg-secondary-bg px-4">
      <BoardNote class="my-4">
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

      {/* <div class="max-h-[100vh] overflow-auto"> */}
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
          <For each={comments()}>
            {(comment, index) => (
              <article
                data-not-last={
                  index() !== comments().length - 1 ? "" : undefined
                }
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
          </For>

          <Show when={commentsQuery.isFetchingNextPage}>
            <div role="status" class="mx-auto mt-6">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
              <span class="sr-only">Next comments is loading</span>
            </div>
          </Show>
        </Match>
      </Switch>
      {/* </div> */}

      <Switch>
        {/* [TODO]: remove always true */}
        <Match when={platform === "ios"}>
          <IosCommentCreator boardId={boardId()} noteId={note().id} />
        </Match>
        <Match when={true}>
          <div class="sticky bottom-0 -mx-4 mt-auto bg-secondary-bg px-4 pb-6 pt-2">
            <CommentCreator
              boardId={boardId()}
              noteId={note().id}
              onCreated={() => {
                // wait for render
                requestAnimationFrame(() => {
                  scrollableElement.scrollTo({
                    behavior: "smooth",
                    top: window.innerHeight,
                  });
                });
              }}
            />
          </div>
        </Match>
      </Switch>
    </main>
  );
};

const useInnerHeight = () => {
  // innerHeight do not change on Safari even keyboard is open
  const [innerHeight, setInnerHeight] = createSignal(window.innerHeight);
  const [visualHeight, setVisualHeight] = createSignal(
    window.visualViewport?.height ?? window.innerHeight,
  );
  const { height } = useScreenSize();
  createEffect(() => {
    console.log(
      unwrapSignals({
        innerHeight,
        height,
      }),
    );
  });
  new ResizeObserver(() => {
    console.log({ h: window.innerHeight });
  }).observe(document.body);
  useCleanup((signal) => {
    window.addEventListener(
      "resize",
      () => {
        setInnerHeight(window.innerHeight);
      },
      {
        signal,
      },
    );

    window.visualViewport?.addEventListener(
      "resize",
      () => {
        console.log("visual resize", window.visualViewport?.height);
        setVisualHeight(window.visualViewport?.height ?? window.innerHeight);
      },
      {
        signal,
      },
    );
  });

  // const id = setInterval(() => {
  //   setInnerHeight(window.innerHeight);
  //   // Function to measure the height for a given CSS unit
  //   function getViewportUnitHeight(unit) {
  //     // Create a temporary element
  //     const tempElement = document.createElement("div");

  //     // Apply the desired unit as height
  //     tempElement.style.height = `100${unit}`;
  //     tempElement.style.position = "absolute";
  //     tempElement.style.top = "-9999px";
  //     tempElement.style.visibility = "hidden";

  //     // Append to the body
  //     document.body.appendChild(tempElement);

  //     // Measure the height in pixels
  //     const height = tempElement.clientHeight;

  //     // Remove the element from the DOM
  //     document.body.removeChild(tempElement);

  //     return height;
  //   }

  //   // Get the height in pixels for svh and dvh
  //   const svhHeight = getViewportUnitHeight("svh");
  //   const dvhHeight = getViewportUnitHeight("dvh");
  //   const perecentHeight = getViewportUnitHeight("%");
  //   console.log({
  //     svhHeight,
  //     dvhHeight,
  //     perecentHeight,
  //     innerHeight: window.innerHeight,
  //     tgHeight: height(),
  //   });
  // }, 100);

  // onCleanup(() => clearInterval(id));

  return {
    get inner() {
      return innerHeight();
    },
    get visual() {
      return visualHeight();
    },
  };
};

const IosCommentCreator = (props: { noteId: string; boardId: string }) => {
  const [placeHeight, setPlaceHeight] = createSignal(0);
  const [inputElement, setInputElement] = createSignal<HTMLDivElement>();
  createEffect(() => {
    const el = inputElement();
    if (!el) {
      return;
    }

    let prevHeight = el.getBoundingClientRect().height;
    const mutObserver = new ResizeObserver(() => {
      const curHeight = el.getBoundingClientRect().height;
      if (Math.abs(curHeight - prevHeight) > 2) {
        // scrollableElement.scrollBy({
        //   top: curHeight - prevHeight,
        //   behavior: "instant",
        // });
      }
      prevHeight = curHeight;

      setPlaceHeight(curHeight);
    });

    mutObserver.observe(el);

    onCleanup(() => mutObserver.disconnect());
  });
  const { isKeyboardOpen } = useKeyboardStatus();

  const { height } = useScreenSize();
  const browserHeight = useInnerHeight();
  // bottom is work from innerHeight, not visual one
  const initialDiff =
    browserHeight.visual - height() > 0 ? browserHeight.visual - height() : 0;

  const hasShitLine = () => browserHeight.inner - browserHeight.visual;
  const bottom = () =>
    `${browserHeight.inner - height() + (isKeyboardOpen() ? (browserHeight.visual !== height() ? height() - browserHeight.visual : 0) : -initialDiff)}px`;
  createEffect(() => {
    console.log(
      unwrapSignals({
        initialDiff,
        innerHeight: browserHeight,
        ...browserHeight,
        height,
        bottom,
        hasShitLine,
      }),
    );
  });
  createEffect(
    on(
      () => isKeyboardOpen(),
      () => {
        // window.scrollBy({
        //   top: -0.1,
        //   behavior: "instant",
        // });
      },
    ),
  );

  return (
    <>
      <div
        style={{ height: `${placeHeight()}px`, background: "transparent" }}
      />
      <Portal>
        <div
          ref={setInputElement}
          class={clsxString(
            "fixed inset-x-0 bottom-0 bg-secondary-bg px-4 pt-2",
            !isKeyboardOpen() ? "pb-6" : "",
          )}
          style={{
            // bottom: 0,
            // transform: `translateY(${-1 * (innerHeight() - height() - initialDiff)}px)`,
            // transform: `translateY(${-1 * initialDiff}px)`,
            bottom: bottom(),
          }}
        >
          <CommentCreator
            boardId={props.boardId}
            noteId={props.noteId}
            onCreated={() => {
              // wait for render
              requestAnimationFrame(() => {
                scrollableElement.scrollTo({
                  behavior: "smooth",
                  top: document.body.scrollHeight,
                });
              });
            }}
          />
        </div>
      </Portal>
    </>
  );
};
