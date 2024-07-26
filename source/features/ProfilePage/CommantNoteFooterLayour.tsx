import type { Comment } from "@/api/model";
import { platform } from "@/features/telegramIntegration";
import { AnonymousAvatarIcon } from "@/icons";
import { assertOk } from "@/lib/assert";
import { A } from "@solidjs/router";
import { Show, createEffect, createMemo, createSignal, on } from "solid-js";
import { AvatarIcon } from "../BoardNote/AvatarIcon";
import { useScreenSize } from "../screenSize";

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

const AVATAR_WIDTH_WITH_GAP = 18 + 4;
const CONTENT_MARGIN_LEFT = 4;
const MORE_TEXT_PADDING_LEFT = 8;

const calculateLayout = (
  content: string,
  commentsSize: number,
  showMoreSize: number,
  userNameSize: number,
) => {
  CanvasHelper.setFontAssert(ctx, `600 14px "Inter Variable"`);
  const contentSize = ctx.measureText(content).width;

  const targetFirstLineSize =
    commentsSize -
    (AVATAR_WIDTH_WITH_GAP +
      userNameSize +
      CONTENT_MARGIN_LEFT +
      MORE_TEXT_PADDING_LEFT +
      showMoreSize);

  if (contentSize < targetFirstLineSize) {
    return [content];
  }

  const targetFirstLineSizeTwoRows =
    targetFirstLineSize + showMoreSize + MORE_TEXT_PADDING_LEFT;

  const maxLengthThatCanFitInOneLine = 300;

  const size = binIntSearch(
    0,
    Math.min(content.length + 1, maxLengthThatCanFitInOneLine),
    (size) =>
      ctx.measureText(content.slice(0, size)).width >
      targetFirstLineSizeTwoRows,
  );

  const lastFirstLineChar: string = content[size];
  let whiteSpaceAwareSize: number = size;

  if (
    content.length !== size &&
    lastFirstLineChar &&
    !isWhiteSpace(lastFirstLineChar)
  ) {
    for (let i = 1; i <= 10; ++i) {
      const curChar = content[size - i];
      if (isWhiteSpace(curChar)) {
        whiteSpaceAwareSize = size - i;
        break;
      }
    }
  }

  return [
    content.slice(0, whiteSpaceAwareSize),
    content
      .slice(
        whiteSpaceAwareSize,
        whiteSpaceAwareSize + maxLengthThatCanFitInOneLine,
      )
      .trimStart(),
  ];
};

const [read, invalidate] = createSignal<void>(undefined, {
  equals: false,
});
document.fonts.addEventListener("loadingdone", () => {
  invalidate();
});

let resizeBatched = false;
export const CommentNoteFooterLayout = (props: {
  lastComment: Omit<Comment, "createdAt">;
  commentsCount: number;
  href: string;
  onClick(): void;
}) => {
  const content = () => props.lastComment.content;

  const isFontLoaded = createMemo(() => {
    read();
    return document.fonts.check('14px "Inter Variable"', content());
  });
  const author = () =>
    props.lastComment.type === "public" ? props.lastComment.author : undefined;
  const authorName = () => author()?.name ?? "Anonymous";
  const userNameSize = createMemo(() => {
    // tracking font
    isFontLoaded();
    CanvasHelper.setFontAssert(ctx, `600 14px "Inter Variable"`);
    const metrics = ctx.measureText(authorName());

    return metrics.width;
  });

  const showMoreText = () => `show more (${props.commentsCount})`;
  const showMoreSize = createMemo(() => {
    // tracking font
    isFontLoaded();
    CanvasHelper.setFontAssert(ctx, `15px "Inter Variable"`);
    const metrics = ctx.measureText(showMoreText());

    return metrics.width;
  });

  const layout = createMemo(() => {
    // tracking font
    isFontLoaded();
    const _showMoreSize = showMoreSize();
    const _userNameSize = userNameSize();
    const _commentsSize = commentsSize();
    const _content = content();

    // hot path
    return calculateLayout(
      _content,
      _commentsSize,
      _showMoreSize,
      _userNameSize,
    );
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
          <A
            href={props.href}
            onClick={() => props.onClick()}
            class="absolute bottom-0 right-0 bg-secondary-bg pl-2 font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            {showMoreText()}
          </A>
        }
        when={isTwoLineLayout()}
      >
        <div class="inline-flex">
          <div class="h-[18px] overflow-hidden text-ellipsis text-nowrap break-words font-inter text-[14px] leading-[18px]">
            {layout()[1]}
          </div>

          <A
            href={props.href}
            onClick={() => props.onClick()}
            class="ml-auto shrink-0 pl-2 font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            {showMoreText()}
          </A>
        </div>
      </Show>
    </div>
  );
};
