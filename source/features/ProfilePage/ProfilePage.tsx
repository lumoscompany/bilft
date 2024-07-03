import { A, useNavigate, useParams } from "@solidjs/router";
import { createInfiniteQuery, createQuery } from "@tanstack/solid-query";
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  type ParentProps,
} from "solid-js";
import { keysFactory } from "../../api/api";
import {
  addPrefix,
  assertOk,
  clsxString,
  getSelfUserId,
  isEqualIds,
  platform,
  removePrefix,
  scrollableElement,
  type StyleProps,
} from "../../common";
import { AnonymousAvatarIcon, ArrowPointUp } from "../../icons";

import type { Comment, NoteWithComment } from "@/api/model";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { BoardNote } from "../BoardNote/BoardNote";
import { LoadingSvg } from "../LoadingSvg";
import { useScreenSize } from "../screenSize";
import { PostCreator } from "./PostCreator";

const UserStatus = (props: ParentProps<StyleProps>) => (
  <article class={clsxString("relative flex flex-col", props.class ?? "")}>
    <svg
      class="absolute left-0 top-0 text-accent"
      width="21"
      height="20"
      viewBox="0 0 21 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0.04006C4.46481 4.16015 5.65964 5.81985 5.65964 19.9819C20.3365 16.2557 21.9956 13.836 19.8257 7.41852C11.0669 2.45015 2.95905 -0.37397 0 0.04006Z"
        fill="currentColor"
      />
    </svg>
    <div class="ml-1 min-h-[38px] self-start rounded-3xl bg-accent px-4 py-2">
      {props.children}
    </div>
  </article>
);

const UserProfilePage = (props: {
  isSelf: boolean;
  idWithoutPrefix: string;
}) => {
  const boardQuery = createQuery(() =>
    keysFactory.board({
      value: addPrefix(props.idWithoutPrefix),
    }),
  );

  const getBoardId = () => removePrefix(props.idWithoutPrefix);

  const notesQuery = createInfiniteQuery(() => ({
    ...keysFactory.notes({
      board: getBoardId(),
    }),
    reconcile: "id",
  }));
  const notes = createMemo(() =>
    notesQuery.isSuccess ? notesQuery.data.pages.flatMap((it) => it.data) : [],
  );
  const navigate = useNavigate();

  return (
    <main class="flex min-h-screen flex-col pb-6 pt-4 text-text">
      <section class="sticky top-0 z-10 mx-2 flex flex-row items-center gap-3 bg-secondary-bg px-4 py-2">
        <AvatarIcon
          class="w-12"
          isLoading={boardQuery.isLoading}
          url={boardQuery.data?.profile?.photo ?? null}
        />
        <div class="flex flex-1 flex-col">
          <p class="relative font-inter text-[20px] font-bold leading-6">
            {boardQuery.data?.profile?.title ?? boardQuery.data?.name ?? " "}
            <Show when={boardQuery.isLoading}>
              <div class="absolute inset-y-1 left-0 right-[50%] animate-pulse rounded-xl bg-gray-600" />
            </Show>
          </p>
          {/* TODO: add date */}
          {/* <p class="text-[15px] font-inter leading-[22px]">Member since Jan 2021</p> */}
        </div>
      </section>

      <UserStatus class="mx-4 mt-2 text-button-text">
        {boardQuery.isLoading
          ? "Loading..."
          : boardQuery.data?.profile?.description}
      </UserStatus>

      <PostCreator class="mx-4 mt-6" boardId={getBoardId()} />

      <section class="mt-6 flex flex-1 flex-col">
        <Switch>
          <Match when={notesQuery.isLoading}>
            <div class="flex w-full flex-1 items-center justify-center">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
            </div>
          </Match>
          <Match when={notes().length === 0}>
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
                Be the first to post here!
              </p>
            </div>
          </Match>
          <Match when={notes().length > 0}>
            <For each={notes()}>
              {(note) => (
                <BoardNote class="mx-4 mb-4">
                  <BoardNote.Card>
                    {/* extends to match based on type */}
                    <Switch
                      fallback={
                        <BoardNote.PrivateHeader createdAt={note.createdAt} />
                      }
                    >
                      <Match when={note.author}>
                        {(author) => (
                          <BoardNote.PublicHeader
                            name={author().name}
                            avatarUrl={author().photo}
                            authorId={author().id}
                            createdAt={note.createdAt}
                            onClick={(e) => {
                              if (author().id === props.idWithoutPrefix) {
                                e.preventDefault();
                                scrollableElement.scrollTo({
                                  top: 0,
                                  behavior: "smooth",
                                });
                              }
                            }}
                          />
                        )}
                      </Match>
                    </Switch>
                    <BoardNote.Divider />
                    <BoardNote.Content>{note.content}</BoardNote.Content>
                  </BoardNote.Card>
                  <Show when={boardQuery.data?.id}>
                    {(boardId) => (
                      <CommentFooter note={note} boardId={boardId()} />
                    )}
                  </Show>
                </BoardNote>
              )}
            </For>

            <Switch>
              <Match when={notesQuery.isFetchingNextPage}>
                <div role="status" class="mx-auto mt-6">
                  <LoadingSvg class="w-8 fill-accent text-transparent" />
                  <span class="sr-only">Next boards is loading</span>
                </div>
              </Match>
              <Match when={notes().length >= 8}>
                <button
                  onClick={() => {
                    scrollableElement.scrollTo({
                      behavior: "smooth",
                      top: 0,
                    });
                  }}
                  class="mx-auto mt-6 flex items-center gap-x-2 font-inter text-[17px] leading-[22px] text-accent transition-opacity active:opacity-70"
                >
                  Back to top
                  <ArrowPointUp />
                </button>
              </Match>
            </Switch>
          </Match>
        </Switch>
      </section>
    </main>
  );
};

export const ProfilePage = () => {
  const selfUserId = getSelfUserId().toString();
  const params = useParams();
  const idWithoutPrefix = () => params.idWithoutPrefix;

  return (
    <UserProfilePage
      idWithoutPrefix={idWithoutPrefix()}
      isSelf={isEqualIds(selfUserId, idWithoutPrefix())}
    />
  );
};

const cnv = document.createElement("canvas");
const ctx = cnv.getContext("2d");
assertOk(ctx);

const CanvasHelper = {
  setFontAssert: (ctx: CanvasRenderingContext2D, font: string) => {
    ctx.font = font;
    if (import.meta.env.DEV) {
      const matches =
        ctx.font === font ||
        /* Safari is unique peace of shit */
        (platform === "ios" && font.includes(ctx.font));

      if (!matches) {
        console.log("mismatch", {
          should: font,
          real: ctx.font,
        });
      }
      assertOk(matches);
    }
  },
};

// preloading cyrillic glyphs
document.fonts.load('14px "Inter Variable"', "фa");

const binIntSearch = (
  left: number,
  right: number,
  isResultLower: (value: number) => boolean,
) => {
  left |= 0;
  right |= 0;
  assertOk(right >= left);
  while (right - left > 1) {
    const mid = left + (((right - left) / 2) | 0);

    if (isResultLower(mid)) {
      right = mid;
    } else {
      left = mid;
    }
  }

  return left;
};

const estimation =
  ((window.visualViewport?.width ?? window.innerWidth) | 0) -
  // 74 px is distance from screen border to comments (on windows desktop)
  (platform === "ios" || platform === "android" ? 64 : 74);

// [TODO]: reduce amount of overhead per comment (virtual scroll)
const [commentsSize, setCommentSize] = createSignal(estimation);

export const isWhiteSpace = (str: string) => {
  return str === " " || str === "\n" || str === "\t";
};

if (import.meta.env.DEV) {
  createEffect(
    on(
      () => estimation !== commentsSize(),
      (mismtach) => {
        if (mismtach) {
          console.log("size mismatch", {
            estmation: estimation,
            real: commentsSize(),
          });
        }
      },
    ),
  );
}
let resizeBatched = false;
const CommentNoteFooterLayout = (props: {
  lastComment: Omit<Comment, "createdAt">;
  commentsCount: number;
  onClick(): void;
}) => {
  // [TODO]: we need to check if font really loaded or not
  const author = () =>
    props.lastComment.type === "public" ? props.lastComment.author : undefined;
  const content = () => props.lastComment.content;
  const authorName = () => author()?.name ?? "Anonymous";
  const userNameSize = createMemo(() => {
    CanvasHelper.setFontAssert(ctx, `600 14px "Inter Variable"`);
    const metrics = ctx.measureText(authorName());

    return metrics.width;
  });
  const avatarSizeWithGap = 18 + 4;

  const showMoreText = () => `show more (${props.commentsCount})`;
  const showMoreSize = createMemo(() => {
    CanvasHelper.setFontAssert(ctx, `15px "Inter Variable"`);
    const metrics = ctx.measureText(showMoreText());

    return metrics.width;
  });
  const contentMarginLeft = 4;
  const moreTextPaddingLeft = 8;

  const layout = createMemo(() => {
    CanvasHelper.setFontAssert(ctx, `600 14px "Inter Variable"`);
    const contentSize = ctx.measureText(content()).width;

    const targetFirstLineSize =
      commentsSize() -
      (avatarSizeWithGap +
        userNameSize() +
        contentMarginLeft +
        moreTextPaddingLeft +
        showMoreSize());

    if (contentSize < targetFirstLineSize) {
      return [content()];
    }

    const targetFirstLineSizeTwoRows =
      targetFirstLineSize + showMoreSize() + moreTextPaddingLeft;

    const maxLengthThatCanFitInOneLine = 300;

    const size = binIntSearch(
      0,
      Math.min(content().length + 1, maxLengthThatCanFitInOneLine),
      (size) =>
        ctx.measureText(content().slice(0, size)).width >
        targetFirstLineSizeTwoRows,
    );

    const lastFirstLineChar: string = content()[size];
    let whiteSpaceAwareSize: number = size;

    if (
      content().length !== size &&
      lastFirstLineChar &&
      !isWhiteSpace(lastFirstLineChar)
    ) {
      for (let i = 1; i <= 10; ++i) {
        const curChar = content()[size - i];
        if (isWhiteSpace(curChar)) {
          whiteSpaceAwareSize = size - i;
          break;
        }
      }
    }

    return [
      content().slice(0, whiteSpaceAwareSize),
      content()
        .slice(
          whiteSpaceAwareSize,
          whiteSpaceAwareSize + maxLengthThatCanFitInOneLine,
        )
        .trimStart(),
    ];
  });

  let divRef!: HTMLDivElement;
  createEffect(
    on(
      () => useScreenSize().width(),
      () => {
        if (resizeBatched) {
          return;
        }

        setCommentSize(divRef.clientWidth | 0);
        resizeBatched = true;
        queueMicrotask(() => {
          resizeBatched = false;
        });
      },
    ),
  );
  const isTwoLineLayout = () => layout().length === 2;

  return (
    <div ref={divRef} class="relative flex min-w-full flex-col overflow-hidden">
      {/* someone can break layout if name is too long */}
      <div class="flex items-center gap-1">
        <Show
          fallback={
            <div class="inline-flex shrink-0 gap-1 font-inter text-[14px] font-semibold leading-[18px]">
              <AnonymousAvatarIcon class="h-[18px] w-[18px]" />
              {authorName()}
            </div>
          }
          when={author()}
        >
          {(author) => (
            <A
              class="inline-flex shrink-0 gap-1 font-inter text-[14px] font-semibold leading-[18px] transition-opacity active:opacity-70"
              href={`/board/${author().id}`}
            >
              <AvatarIcon
                class="h-[18px] w-[18px]"
                isLoading={false}
                url={author().photo}
              />
              {authorName()}
            </A>
          )}
        </Show>

        <span class="overflow-hidden break-words font-inter text-[14px] leading-[18px]">
          {layout()[0]}
        </span>
      </div>
      <Show
        fallback={
          <button
            type="button"
            onClick={() => props.onClick()}
            class="absolute bottom-0 right-0 bg-secondary-bg pl-2 font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            {showMoreText()}
          </button>
        }
        when={isTwoLineLayout()}
      >
        <div class="inline-flex">
          <div class="h-[18px] overflow-hidden text-ellipsis text-nowrap break-words font-inter text-[14px] leading-[18px]">
            {layout()[1]}
          </div>

          <button
            type="button"
            onClick={() => props.onClick()}
            class="ml-auto shrink-0 pl-2 font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            {showMoreText()}
          </button>
        </div>
      </Show>
    </div>
  );
};
function CommentFooter(props: { boardId: string; note: NoteWithComment }) {
  const navigate = useNavigate();

  const navigateToComment = () => {
    navigate(
      `/comments/${props.note.id}?note=${JSON.stringify(props.note)}&boardId=${props.boardId}`,
    );
  };

  return (
    <div class="mx-4 mt-2 flex self-stretch">
      <Switch>
        <Match when={props.note.lastComment}>
          {(lastComment) => (
            <CommentNoteFooterLayout
              commentsCount={props.note.commentsCount}
              lastComment={lastComment()}
              onClick={navigateToComment}
            />
          )}
        </Match>
        <Match when={props.note.commentsCount === 0}>
          <button
            type="button"
            onClick={navigateToComment}
            class="ml-auto font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            post you reply
          </button>
        </Match>
      </Switch>
    </div>
  );
}
