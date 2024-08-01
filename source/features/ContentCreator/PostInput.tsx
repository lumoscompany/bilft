import { platform, themeParams } from "@/features/telegramIntegration";
import { ArrowUpIcon } from "@/icons";
import { clsxString } from "@/lib/clsxString";
import { mergeRefs, useCleanup, useObserverCleanup } from "@/lib/solid";
import { isEmpty } from "@/lib/string";
import { type StyleProps } from "@/lib/types";
import {
  Show,
  createEffect,
  createSignal,
  onMount,
  type Accessor,
  type JSX,
  type JSXElement,
  type Ref,
} from "solid-js";
import { LoadingSvg } from "../LoadingSvg";
import { useKeyboardStatus } from "../keyboardStatus";
import { createSafariKeyboardHider } from "./safariKeyboardHider";

export type PostInputProps = StyleProps & {
  onFocus?: JSX.FocusEventHandler<HTMLTextAreaElement, FocusEvent>;
  onBlur?: JSX.FocusEventHandler<HTMLTextAreaElement, FocusEvent>;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  ref?: Ref<HTMLFormElement>;
  preventScrollTouches: boolean;
  disabled?: boolean;
  children: JSXElement;
};

const _createInputFocusPreventer = (
  focusTarget: () => HTMLElement | undefined,
  shouldRefocusOnFriendly: Accessor<boolean>,
) =>
  onMount(() => {
    useCleanup((signal) => {
      window.addEventListener(
        "click",
        (e) => {
          const target = focusTarget();
          if (
            target &&
            shouldRefocusOnFriendly() &&
            e.target instanceof HTMLElement &&
            e.target.dataset.refocusFriendly === "1"
          ) {
            target.focus();
          }
        },
        {
          capture: true,
          signal,
        },
      );
    });
  });

export const createInputFocusPreventer = Object.assign(
  _createInputFocusPreventer,
  {
    FRIENDLY: {
      "data-refocus-friendly": "1",
    },
  },
);

// [TODO]: share number with backend
const MAX_POST_LENGTH = 1200;
export function PostInput(props: PostInputProps) {
  let inputRef!: HTMLTextAreaElement;
  let formRef!: HTMLFormElement;
  const isDisabled = () =>
    props.value.length > MAX_POST_LENGTH || isEmpty(props.value);
  const [isFocused, setIsFocused] = createSignal(false);

  if (platform === "ios") {
    createSafariKeyboardHider(
      isFocused,
      () => formRef,
      () => inputRef,
    );
  }
  const { isKeyboardOpen } = useKeyboardStatus();

  const isLayoutVertical = () =>
    props.value.length > 10 || props.value.includes("\n");

  createInputFocusPreventer(
    () => inputRef,
    () => isKeyboardOpen(),
  );

  let inputWrapperRef!: HTMLDivElement;
  const shouldPreventScrollTouches = (() => {
    const [shouldPrevent, setShouldPrevent] = createSignal(
      props.preventScrollTouches,
    );

    createEffect(() => {
      if (!props.preventScrollTouches) {
        setShouldPrevent(false);
        return;
      }

      useObserverCleanup(() => {
        const resizeObserver = new ResizeObserver((boxes) => {
          const inputHeight = Math.round(
            boxes[0].contentRect.height ?? boxes[0].borderBoxSize[0].blockSize,
          );
          const inputWrapperSize = inputWrapperRef.offsetHeight;

          setShouldPrevent(inputHeight - inputWrapperSize <= 1);
        });
        resizeObserver.observe(inputRef);

        return resizeObserver;
      });
    });

    return shouldPrevent;
  })();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      ref={mergeRefs((e) => (formRef = e), props.ref)}
      class={clsxString(
        "relative isolate flex flex-col gap-3 overflow-hidden rounded-3xl p-4",
        shouldPreventScrollTouches() ? "touch-none [&_*]:touch-none" : "",
        props.class ?? "",
      )}
    >
      <div
        data-dark={themeParams.isDark ? "" : undefined}
        class="bg-section-bg absolute inset-0 -z-10 data-[dark]:opacity-70"
      />
      {props.children}

      <div
        class={clsxString(
          "flex gap-2 overflow-hidden",
          isLayoutVertical() ? "flex-col" : "flex-row items-center",
        )}
      >
        <div
          ref={inputWrapperRef}
          class='grid max-h-[calc(var(--tgvh)*40)] flex-1 grid-cols-1 overflow-y-auto pr-1 font-inter text-[16px] leading-[21px] [scrollbar-gutter:stable] after:invisible after:select-none after:whitespace-pre-wrap after:break-words after:font-[inherit] after:content-[attr(data-value)_"_"] after:[grid-area:1/1/2/2] [&>textarea]:[grid-area:1/1/2/2]'
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
              "mt-[-50vh] pt-[50vh]": platform === "ios",
            }}
          />
        </div>

        <div
          class={clsxString(
            "flex flex-row items-center gap-2",
            isLayoutVertical() ? "self-end" : "",
          )}
        >
          <p
            class={clsxString(
              "font-inter text-[11px] leading-[13px]",
              props.value.length <= MAX_POST_LENGTH
                ? "text-hint"
                : "text-destructive-text",
            )}
          >
            {props.value.length}/{MAX_POST_LENGTH}
          </p>
          <button
            disabled={!!props.disabled || props.isLoading || isDisabled()}
            class="relative mt-auto flex aspect-square w-7 items-center justify-center overflow-hidden rounded-full [&:disabled>svg>path]:fill-gray-400 [&>svg>path]:fill-accent"
          >
            <Show fallback={<ArrowUpIcon />} when={props.isLoading}>
              <div role="status">
                <LoadingSvg class="w-7 fill-gray-300 text-gray-600" />
                <span class="sr-only">Loading...</span>
              </div>
            </Show>
          </button>
        </div>
      </div>
    </form>
  );
}
