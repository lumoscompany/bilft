import {
  formatPostDate,
  formatPostTime,
  type DateString,
} from "@/features/format";
import { platform, themeParams } from "@/features/telegramIntegration";
import { AnonymousAvatarIcon } from "@/icons";
import { clsxString } from "@/lib/clsxString";
import { type StyleProps } from "@/lib/types";
import { A } from "@solidjs/router";
import { Show, type ComponentProps, type ParentProps } from "solid-js";
import { Ripples } from "../Ripple";
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
    class="group relative isolate flex items-center gap-[10px] px-[14px] pb-[10px] pt-[14px]"
  >
    <Show when={platform === "ios"} fallback={<Ripples />}>
      <div class="pointer-events-none absolute inset-0 -z-10 bg-text opacity-0 transition-opacity ease-out group-active:opacity-10" />
    </Show>
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
  <div class="flex items-center gap-[10px] px-[14px] pb-[10px] pt-[14px]">
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
    class={clsxString("mx-[14px] h-separator bg-separator", props.class ?? "")}
  />
);

const BoardNoteContent = (props: ParentProps<StyleProps>) => (
  <div
    class={clsxString(
      "overflow-hidden whitespace-pre-wrap px-[14px] pb-4 pt-[10px] font-inter text-[16px] leading-[21px]",
      props.class ?? "",
    )}
  >
    {props.children}
  </div>
);

const BoardNoteContentLink = (
  props: ParentProps<StyleProps & { href: string } & { onClick?(): void }>,
) => (
  <A
    class={clsxString(
      "group relative isolate -mt-[1px] overflow-hidden whitespace-pre-wrap px-[14px] pb-4 pt-[11px] font-inter text-[16px] leading-[21px]",
      props.class ?? "",
    )}
    href={props.href}
    onClick={props.onClick}
  >
    <Show when={platform === "ios"} fallback={<Ripples />}>
      <div class="pointer-events-none absolute inset-0 -z-10 bg-text opacity-0 transition-opacity ease-out group-active:opacity-10" />
    </Show>
    {props.children}
  </A>
);

function BoardNoteCard(props: ParentProps<StyleProps>) {
  return (
    <section
      class={clsxString(
        "flex flex-col overflow-hidden rounded-3xl bg-section-bg",
        props.class ?? "",
      )}
    >
      {props.children}
    </section>
  );
}

const BoardNoteRoot = (props: ComponentProps<"article">) => (
  <article {...props} class={clsxString(props.class ?? "")} style={props.style}>
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
  ContentLink: BoardNoteContentLink,
});
