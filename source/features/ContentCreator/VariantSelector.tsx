import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { batch, createSignal, For } from "solid-js";
import { platform } from "../telegramIntegration";
import { pointIsInsideBox } from "./point";
import { createInputFocusPreventer } from "./PostInput";

/**
 *
 * @description backdrop blur must be applied to the parent element
 * There are crazy stuff going on inside of chrome https://issues.chromium.org/issues/41475939
 */
export const VariantSelector = <T extends string>(props: {
  variants: readonly T[];
  value: T;
  setValue(newVariant: T): void;
}) => {
  const variantStateIndex = () => props.variants.indexOf(props.value);
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
      (index = props.variants.indexOf(curTouchOver)) !== -1
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
      props.variants.indexOf(props.value) -
        props.variants.indexOf(newSelection),
    );

    setIsNearbySelectorChoose(diff <= 1);
    props.setValue(newSelection);
  };

  let touchId: number | null = null;

  return (
    <section
      onTouchStart={(e) => {
        if (touchId !== null) return;

        const firstTouch = e.changedTouches.item(0);
        if (!firstTouch) return;
        touchId = firstTouch.identifier;
        const targetVariant = onTouchMove(
          e.currentTarget,
          firstTouch,
          touchOver(),
          isGripping(),
        );
        batch(() => {
          // resetting animation state
          setIsNearbySelectorChoose(false);
          setTouchOver(targetVariant);
          setIsGripping(targetVariant === props.value);
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
      class="relative isolate grid min-h-11 touch-pan-x select-none grid-cols-[repeat(auto-fit,minmax(0,1fr))] grid-rows-1 self-stretch overflow-hidden rounded-full p-[2px] before:absolute before:inset-0 before:-z-10 before:bg-section-bg before:opacity-70 before:content-['']"
    >
      <div
        style={{
          "--variants": props.variants.length,
          "--selection-index": visibleSelectionIndex(),
        }}
        class={clsxString(
          "pointer-events-none absolute inset-y-0 top-0 -z-10 flex w-[calc(100%/var(--variants))] translate-x-[calc(100%*var(--selection-index))] items-stretch justify-stretch p-[2px] transition-transform ease-out contain-strict",
          isNearbySelectorChoose() ? "duration-150" : "duration-[225ms]",
        )}
      >
        <div
          class={clsxString(
            "flex-1 rounded-full bg-accent font-inter text-[13px] font-[590] leading-[18px]",
            "origin-center transition-transform ease-out",
            isGripping() ? "scale-95" : "",
          )}
        />
      </div>
      <For each={props.variants}>
        {(variant) => (
          <button
            {...createInputFocusPreventer.FRIENDLY}
            data-variant={variant}
            class={clsxString(
              "flex items-center justify-center transition-[transform,opacity] duration-[150ms,300ms] ease-out contain-strict",
              "text-text",
              // workaround because we cannot use disable
              props.value !== variant &&
                // on safari active style will be applied until touchend even if active class removed
                platform !== "ios" &&
                touchOver() !== variant
                ? "active:opacity-30"
                : "",
              isGripping() && variant === touchOver() ? "scale-95" : "",
              !isGripping() &&
                touchOver() === variant &&
                touchOver() !== props.value
                ? "opacity-30"
                : "",
            )}
            onClick={() => {
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
  );
};
