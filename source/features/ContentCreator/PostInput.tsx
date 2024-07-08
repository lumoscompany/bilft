import { clsxString, platform, type StyleProps } from "@/common";
import { ArrowUpIcon } from "@/icons";
import { mergeRefs } from "@/lib/solid";
import { Show, createMemo, createSignal, type JSX, type Ref } from "solid-js";
import { LoadingSvg } from "../LoadingSvg";
import { useKeyboardStatus } from "../keyboardStatus";
import { CheckboxUI } from "./common";
import { createSafariKeyboardHider } from "./safariKeyboardHider";

export type PostInputProps = StyleProps & {
  onFocus?: JSX.FocusEventHandler<HTMLTextAreaElement, FocusEvent>;
  onBlur?: JSX.FocusEventHandler<HTMLTextAreaElement, FocusEvent>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isAnonymous: boolean;
  setIsAnonymous: (status: boolean) => void;
  ref?: Ref<HTMLFormElement>;
  position: "top" | "bottom";
};

// [TODO]: share number with backend
const MAX_POST_LENGTH = 1200;
export function PostInput(props: PostInputProps) {
  let inputRef!: HTMLTextAreaElement | undefined;
  let formRef!: HTMLFormElement;
  const trimmedText = createMemo(() => props.value.trim());
  const isEmpty = () => trimmedText().length === 0;
  const symbolsRemaining = () => MAX_POST_LENGTH - trimmedText().length;
  const [isFocused, setIsFocused] = createSignal(false);

  if (platform === "ios") {
    createSafariKeyboardHider(
      isFocused,
      () => props.position,
      () => formRef,
      () => inputRef,
    );
  }
  const { isKeyboardOpen } = useKeyboardStatus();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      ref={mergeRefs((e) => (formRef = e), props.ref)}
      class={clsxString(
        "flex flex-col items-stretch justify-between gap-[10px] overflow-hidden rounded-[20px] border border-[#AAA] border-opacity-15 bg-section-bg p-4",
        props.class ?? "",
      )}
    >
      <div
        class='-mr-4 grid max-h-[calc(var(--tgvh)*40)] flex-1 grid-cols-1 overflow-y-auto pr-3 font-inter text-[16px] leading-[21px] [scrollbar-gutter:stable] after:invisible after:whitespace-pre-wrap after:break-words after:font-[inherit] after:content-[attr(data-value)_"_"] after:[grid-area:1/1/2/2] [&>textarea]:[grid-area:1/1/2/2]'
        data-value={props.value}
      >
        <textarea
          placeholder="Text me here..."
          rows={1}
          value={props.value}
          onInput={(e) => {
            props.onChange(e.target.value);
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props?.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          inert={props.isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey && props.value.length > 0) {
              e.preventDefault();
              props.onSubmit();
            }
          }}
          ref={inputRef}
          class="w-full max-w-full resize-none overflow-hidden break-words border-none bg-transparent placeholder:select-none focus:border-none focus:outline-none"
          classList={{
            // outsmarting safari repositioning for inputs outside of top of page
            "mt-[-50vh] pt-[50vh]":
              platform === "ios" && props.position === "bottom",
          }}
        />
      </div>
      <div class="h-separator w-full bg-separator" />
      <div class="flex flex-row items-center p-[2px]">
        <label
          class="group mr-auto flex cursor-pointer select-none flex-row items-center"
          data-checked={props.isAnonymous ? "" : undefined}
        >
          <input
            onChange={(e) => {
              // preventing keyboard from closing
              if (isKeyboardOpen()) {
                inputRef?.focus();
              }
              props.setIsAnonymous(e.target.checked);
            }}
            checked={props.isAnonymous}
            type="checkbox"
            class="invisible h-0 w-0"
          />
          <CheckboxUI />

          <div class="ml-2 font-inter text-[16px] leading-[22px] text-subtitle">
            Send anonymously
          </div>
        </label>

        <Show when={symbolsRemaining() < MAX_POST_LENGTH / 4}>
          <p
            class={clsxString(
              "ml-auto font-inter text-[16px] leading-[16px]",
              symbolsRemaining() > 0 ? "text-hint" : "text-destructive-text",
            )}
          >
            {symbolsRemaining()}
          </p>
        </Show>
        <button
          disabled={isEmpty() || props.isLoading || symbolsRemaining() <= 0}
          class="relative ml-2 flex aspect-square w-7 items-center justify-center overflow-hidden rounded-full [&:disabled>svg>path]:fill-gray-400 [&>svg>path]:fill-accent"
        >
          <Show fallback={<ArrowUpIcon />} when={props.isLoading}>
            <div role="status">
              <LoadingSvg class="w-7 fill-gray-300 text-gray-600" />
              <span class="sr-only">Loading...</span>
            </div>
          </Show>
        </button>
      </div>
    </form>
  );
}
