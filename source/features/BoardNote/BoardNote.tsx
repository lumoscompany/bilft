import {
  clsxString,
  formatPostDate,
  formatPostTime,
  themeParams,
  type DateString,
  type StyleProps,
} from "@/common";
import { AnonymousAvatarIcon } from "@/icons";
import { A } from "@solidjs/router";
import type { ComponentProps, ParentProps } from "solid-js";
import { AvatarIcon } from "./AvatarIcon";

const BoardNotePublicHeader = (props: {
  name: string;
  avatarUrl: string | null;
  authorId: string | null;
  createdAt: DateString;

  onClick?: (e: MouseEvent) => void;
}) => (
  <A
    href={`/board/${props.authorId}`}
    onClick={props.onClick}
    class="flex items-center gap-[10px]"
  >
    <AvatarIcon lazy isLoading={false} url={props.avatarUrl} class="w-10" />
    <div class="flex flex-col">
      <div class="font-inter text-[17px] font-medium leading-[22px]">
        {props.name}
      </div>
      <div class="font-inter text-[13px] leading-4 text-subtitle">
        posted {formatPostDate(props.createdAt)} at{" "}
        {formatPostTime(props.createdAt)}
      </div>
    </div>
  </A>
);
const BoardNoteAnonymousHeader = (props: { createdAt: DateString }) => (
  <div class="flex items-center gap-[10px]">
    <AnonymousAvatarIcon
      class={clsxString(
        themeParams.isDark
          ? "fill-[#1C1C1D] text-white"
          : "fill-slate-200 text-black",
      )}
    />
    <div class="flex flex-col">
      <div class="font-inter text-[17px] font-medium leading-[22px]">
        Anonymously
      </div>
      <div class="font-inter text-[13px] leading-4 text-subtitle">
        posted {formatPostDate(props.createdAt)} at{" "}
        {formatPostTime(props.createdAt)}
      </div>
    </div>
  </div>
);
const BoardNoteDivider = (props: StyleProps) => (
  <div
    class={clsxString(
      "mx-[2px] my-[10px] h-separator bg-separator",
      props.class ?? "",
    )}
  />
);

const BoardNoteContent = (props: ParentProps<StyleProps>) => (
  <div
    class={clsxString(
      "overflow-hidden whitespace-pre-wrap font-inter text-[16px] leading-[21px]",
      props.class ?? "",
    )}
  >
    {props.children}
  </div>
);

function BoardNoteCard(props: ParentProps<StyleProps>) {
  return (
    <section
      class={clsxString(
        "flex flex-col rounded-3xl bg-section-bg px-[14px] pb-4 pt-[14px] transition-transform has-[a:active]:scale-[0.98]",
        props.class ?? "",
      )}
    >
      {props.children}
    </section>
  );
}

const BoardNoteRoot = (props: ComponentProps<"article">) => (
  <article class={clsxString(props.class ?? "")} style={props.style}>
    {props.children}
  </article>
);

/**
 * @example
 * <BoardNote>
 *  <BoardNote.Card>
 *    <BoardNote.PublicHeader />
 *    <BoardNote.Divider />
 *    <BoardNote.Content />
 *  </BoardNote.Card>
 * </BoardNote>
 */
export const BoardNote = Object.assign(BoardNoteRoot, {
  Card: BoardNoteCard,
  PublicHeader: BoardNotePublicHeader,
  PrivateHeader: BoardNoteAnonymousHeader,
  Divider: BoardNoteDivider,
  Content: BoardNoteContent,
});
