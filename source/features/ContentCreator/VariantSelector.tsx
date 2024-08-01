import { CloseIcon } from "@/icons";
import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { PxStringFromNumber } from "@/lib/pxString";
import { createTransitionPresence, SignalHelper } from "@/lib/solid";
import type { StyleProps } from "@/lib/types";
import { postEvent } from "@telegram-apps/sdk";
import {
  batch,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  For,
  Show,
  untrack,
  type JSXElement,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { BottomDialog } from "../BottomDialog";
import { Ripples } from "../Ripple";
import { isApple, platform } from "../telegramIntegration";
import { pointIsInsideBox } from "./point";
import { createInputFocusPreventer } from "./PostInput";

export const SEND_PUBLIC_TITLE = "Send public";
export const SEND_PRIVATE_TITLE = "Send private";
export const SEND_ANONYMOUS_TITLE = "Send anonymously";

export const SEND_PUBLIC_DESCRIPTION =
  "Your name and the content of the post will be visible to everyone.";
export const SEND_PRIVATE_DESCRIPTION =
  "A private post is visible only to the two individuals involved. The owner of the board cannot see your name";
export const SEND_ANONYMOUS_DESCRIPTION =
  "You can post anonymously, and no one will see your name. Maybe you want to ask a question?";

export type VariantEntry<T extends string> = {
  value: T;
  title: string;
  description: string;
  icon: (props: StyleProps) => JSXElement;
};
export const VariantEntryMake = <T extends string>(
  value: T,
  title: string,
  description: string,
  icon: (props: StyleProps) => JSXElement,
): VariantEntry<T> => ({
  value,
  title,
  description,
  icon,
});

/**
 *
 * @description backdrop blur must be applied to the parent element
 * There are crazy stuff going on inside of chrome https://issues.chromium.org/issues/41475939
 */
export const VariantSelector = <T extends string>(props: {
  variants: readonly VariantEntry<T>[];
  value: T;
  setValue(newVariant: T): void;
  estimatePopoverSize: number;
}) => {
  const variantValues = createMemo(() => props.variants.map((it) => it.value));
  const variantStateIndex = () => variantValues().indexOf(props.value);
  const [isNearbySelectorChoose, setIsNearbySelectorChoose] =
    createSignal(true);
  const [touchOver, _setTouchOver] = createSignal<null | T>(null);
  const setTouchOver: (value: null | T) => null | T = _setTouchOver;
  const [isGripping, setIsGripping] = createSignal(false);

  const visibleSelectionIndex = () => {
    let curTouchOver: T | null;
    let index: number;
    if (
      isGripping() &&
      (curTouchOver = touchOver()) &&
      (index = variantValues().indexOf(curTouchOver)) !== -1
    ) {
      return index;
    }

    return variantStateIndex();
  };
  const onTouchMove = (
    currentTarget: HTMLElement,
    firstTouch: Touch,
    prevVariant: T | null,
    detectTouchesIndependentOfY: boolean,
  ): T | null => {
    for (const child of currentTarget.children) {
      assertOk(child instanceof HTMLElement);
      const variant = child.dataset.variant as T | undefined;
      if (variant === undefined) {
        continue;
      }
      const increaseHitSlop = variant === prevVariant || prevVariant === null;
      const baseHitSlopXY = increaseHitSlop ? 30 : 0;
      const rect = child.getBoundingClientRect();
      if (
        pointIsInsideBox(
          firstTouch.clientX,
          firstTouch.clientY,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          baseHitSlopXY,
          detectTouchesIndependentOfY ? 10_000 : baseHitSlopXY,
        )
      ) {
        return variant;
      }
    }

    const rect = currentTarget.getBoundingClientRect();
    if (
      !pointIsInsideBox(
        firstTouch.clientX,
        firstTouch.clientY,

        rect.x,
        rect.y,
        rect.width,
        rect.height,
        30,
        40,
      )
    ) {
      return null;
    }
    return prevVariant;
  };
  const moveSelectorWithPhysics = (newSelection: T) => {
    const diff = Math.abs(
      variantValues().indexOf(props.value) -
        variantValues().indexOf(newSelection),
    );

    setIsNearbySelectorChoose(diff <= 1);
    props.setValue(newSelection);
  };

  let touchId: number | null = null;

  const [popoverRef, setPopoverRef] = createSignal<HTMLElement>();

  const presentPopover = createTransitionPresence({
    element: popoverRef,
    when: () => (isGripping() && touchOver()) || null,
  });
  const shouldShowPopover = createMemo(() => !!presentPopover.present());
  const [sectionRef, setSectionRef] = createSignal<HTMLElement>();
  const [sectionY, setSectionY] = createSignal<number | null>(null);
  const [sectionHeight, setSectionHeight] = createSignal<number | null>(null);
  const positionPopoverBottom = createMemo(() => {
    const _sectionY = sectionY();
    // 16 - is offset
    return (
      _sectionY !== null &&
      _sectionY < untrack(() => props.estimatePopoverSize) + 16
    );
  });
  createRenderEffect(() => {
    const _sectionRef = sectionRef();
    if (!_sectionRef || !shouldShowPopover()) return;

    const rect = _sectionRef.getBoundingClientRect();
    batch(() => {
      setSectionY(rect.top);
      setSectionHeight(rect.height);
    });
  });

  const [bottomSheet, setBottomSheet] = createSignal<T | null>(null);
  const bottomSheetInfo = createMemo(
    () => props.variants.find((it) => it.value === bottomSheet()) ?? null,
  );

  //#region haptic
  createEffect((prev: T | null) => {
    const next = presentPopover.present();

    if (next === prev || !prev || !next) return next;

    postEvent("web_app_trigger_haptic_feedback", {
      type: "selection_change",
    });
    return next;
  }, null);
  createEffect((prev: boolean) => {
    const next = !!presentPopover.present();

    if (next === prev || !next) return next;

    postEvent("web_app_trigger_haptic_feedback", {
      type: "impact",
      impact_style: "soft",
    });
    return next;
  }, false);
  //#endregion haptic

  return (
    <article class="relative">
      <section
        ref={setSectionRef}
        onTouchStart={(e) => {
          if (touchId !== null) return;

          const firstTouch = e.changedTouches.item(0);
          if (!firstTouch) return;
          const firstTouchId = firstTouch.identifier;
          touchId = firstTouchId;
          const targetVariant = onTouchMove(
            e.currentTarget,
            firstTouch,
            touchOver(),
            isGripping(),
          );
          const nextIsGripping = targetVariant === props.value;

          batch(() => {
            // resetting animation state
            setIsNearbySelectorChoose(false);
            setTouchOver(targetVariant);
            setIsGripping(nextIsGripping);
          });
        }}
        onTouchMove={(e) => {
          if (touchId === null) return;
          const curPointerOver = touchOver();

          for (const touch of e.changedTouches) {
            if (touch.identifier !== touchId) {
              continue;
            }

            setTouchOver(
              onTouchMove(e.currentTarget, touch, curPointerOver, isGripping()),
            );
            return;
          }
        }}
        onTouchCancel={(e) => {
          if (touchId === null) return;
          for (const touch of e.changedTouches) {
            if (touch.identifier !== touchId) {
              continue;
            }
            touchId = null;
            batch(() => {
              setTouchOver(null);
              setIsGripping(false);
            });
            return;
          }
        }}
        onTouchEnd={(e) => {
          if (touchId === null) return;

          for (const touch of e.changedTouches) {
            if (touch.identifier !== touchId) {
              continue;
            }
            touchId = null;
            batch(() => {
              const curPointerOver = touchOver();
              curPointerOver && moveSelectorWithPhysics(curPointerOver);
              setIsGripping(false);
              setTouchOver(null);
            });
            return;
          }
        }}
        class="relative isolate grid min-h-9 touch-pan-x select-none grid-cols-[repeat(auto-fit,minmax(0,1fr))] grid-rows-1 self-stretch overflow-hidden rounded-full bg-secondary-bg p-[2px] [&>*]:contain-strict"
      >
        <div
          style={{
            "--variants": props.variants.length,
            "--selection-index": visibleSelectionIndex(),
          }}
          class={clsxString(
            "pointer-events-none absolute inset-y-0 top-0 -z-10 flex w-[calc(100%/var(--variants))] translate-x-[calc(100%*var(--selection-index))] items-stretch justify-stretch p-[2px] transition-transform ease-out",
            isNearbySelectorChoose() ? "duration-150" : "duration-[225ms]",
          )}
        >
          <div
            class={clsxString(
              "flex-1 rounded-full bg-accent",
              "origin-center transition-transform ease-out",
              isGripping() ? "scale-95" : "",
            )}
          />
        </div>
        <For each={variantValues()}>
          {(variant) => (
            <button
              type="button"
              {...createInputFocusPreventer.FRIENDLY}
              data-variant={variant}
              class={clsxString(
                "flex items-center justify-center transition-[transform,color,opacity] duration-[150ms,150ms,300ms]",
                (
                  isGripping() && touchOver()
                    ? touchOver() === variant
                    : props.value === variant
                )
                  ? "text-button-text"
                  : "text-text",
                "font-inter text-[13px] leading-[18px]",
                // workaround because we cannot use disable
                props.value !== variant &&
                  // on safari active style will be applied until touchend even if active class removed
                  platform !== "ios" &&
                  touchOver() !== variant
                  ? "active:opacity-30 active:ease-out"
                  : "",
                isGripping() && variant === touchOver()
                  ? "scale-95 ease-out"
                  : "",
                !isGripping() &&
                  touchOver() === variant &&
                  touchOver() !== props.value
                  ? "opacity-30 ease-out"
                  : "",
              )}
              onClick={(e) => {
                if (
                  // ios click event doesn't have pointerType property
                  platform === "ios" ||
                  (e as unknown as PointerEvent).pointerType === "touch"
                ) {
                  return;
                }
                if (variant === props.value) {
                  setBottomSheet(() => variant);
                  return;
                }
                moveSelectorWithPhysics(variant);
              }}
              // we cannot disable input because it will redirect focus to nothing, only option is to delay disabled update
              // disabled={variantState() === variant}
            >
              {variant.slice(0, 1).toUpperCase() + variant.slice(1)}
            </button>
          )}
        </For>
      </section>

      <Portal>
        <div
          data-bottom={positionPopoverBottom() ? "" : undefined}
          style={{
            "--sec-y": PxStringFromNumber(sectionY() ?? 0),
            "--sec-h": PxStringFromNumber(sectionHeight() ?? 0),
          }}
          class={clsxString(
            "pointer-events-none fixed inset-x-0 top-0 translate-y-[calc(var(--sec-y)-100%-1rem)] data-[bottom]:translate-y-[calc(var(--sec-y)+var(--sec-h)+1rem)]",
            sectionY() !== null && presentPopover.present()
              ? ""
              : "invisible content-hidden",
          )}
        >
          <div
            ref={setPopoverRef}
            class={clsxString(
              "grid grid-cols-1 content-center transition-opacity duration-300 [&>*]:[grid-area:1/1/2/2]",
              presentPopover.status() === "present" ? "" : "opacity-0",
            )}
          >
            <For each={props.variants}>
              {(variant, index) => {
                const relativeToActiveIndex = () =>
                  SignalHelper.map(presentPopover.present, (value) =>
                    value === null
                      ? 0
                      : index() - variantValues().indexOf(value),
                  );
                const isActive = () => relativeToActiveIndex() === 0;

                return (
                  <div
                    style={{
                      "--index": relativeToActiveIndex(),
                      "--opacity": isActive() ? 1 : 0.5,
                    }}
                    class="flex -translate-x-[calc(100%*var(--index))] flex-row items-center px-4 opacity-[--opacity] drop-shadow-[0px_0px_8px_rgba(0,0,0,0.1)] transition-[transform,opacity] duration-200"
                  >
                    <div
                      class={
                        "flex flex-row items-start gap-2 rounded-3xl bg-bg p-4"
                      }
                    >
                      <Dynamic
                        component={variant.icon}
                        class="aspect-square w-7 text-text"
                      />
                      <div class="flex flex-1 flex-col gap-[2px]">
                        <strong class="font-inter text-base leading-[22px] text-text">
                          {variant.title}
                        </strong>
                        <p class="font-inter text-sm leading-[18px] text-subtitle">
                          {variant.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Portal>
      <BottomDialog
        onClose={() => setBottomSheet(null)}
        when={bottomSheetInfo()}
      >
        {(variant) => (
          <div class="flex flex-col items-center pb-3">
            <section class="relative flex justify-end self-stretch pb-3 pr-1 pt-5">
              <button
                onClick={() => {
                  setBottomSheet(null);
                }}
                type="button"
              >
                <span class="sr-only">Close</span>
                <CloseIcon class="text-accent" />
              </button>
            </section>
            <Dynamic
              component={variant().icon}
              class="aspect-square w-[82px] text-text"
            />

            <strong class="mt-6 text-center font-inter text-xl font-semibold leading-6 text-text">
              {variant().title}
            </strong>
            <p class="mt-2 text-center font-inter text-[17px] leading-[22px] text-text">
              {variant().description}
            </p>

            <button
              onClick={() => {
                setBottomSheet(null);
              }}
              class="group relative mt-[76px] flex w-full items-center justify-center overflow-hidden rounded-xl bg-accent p-[14px] font-inter text-button-text"
            >
              <Show when={isApple()} fallback={<Ripples />}>
                <div class="pointer-events-none absolute inset-0 -z-10 select-none bg-text opacity-0 transition-opacity ease-out group-active:opacity-10" />
              </Show>
              Fine
            </button>
          </div>
        )}
      </BottomDialog>
    </article>
  );
};
