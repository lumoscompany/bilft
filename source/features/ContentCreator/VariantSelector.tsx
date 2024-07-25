import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { batch, createSignal, For } from "solid-js";
import { platform } from "../telegramIntegration";
import { pointIsInsideBox } from "./point";
import { createInputFocusPreventer } from "./PostInput";

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
  const [touchMoveSelection, setTouchMoveSelection] = createSignal(false);

  const visibleSelectionIndex = () => {
    let curTouchOver: T | null;
    let index: number;
    if (
      touchMoveSelection() &&
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
          touchMoveSelection(),
        );
        batch(() => {
          // resetting animation state
          setIsNearbySelectorChoose(false);
          setTouchOver(targetVariant);
          setTouchMoveSelection(targetVariant === props.value);
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
            onTouchMove(
              e.currentTarget,
              touch,
              curPointerOver,
              touchMoveSelection(),
            ),
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
            setTouchMoveSelection(false);
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
            setTouchMoveSelection(false);
            setTouchOver(null);
          });
          return;
        }
      }}
      class="relative isolate grid min-h-11 touch-pan-x select-none grid-cols-[repeat(auto-fit,minmax(0,1fr))] grid-rows-1 self-stretch overflow-hidden rounded-full p-[2px] backdrop-blur-3xl before:absolute before:inset-0 before:-z-10 before:bg-section-bg before:opacity-70 before:content-['']"
    >
      <div
        style={{
          "--variants": props.variants.length,
          // '--width': `calc(100%/${props.variants.length}-4px*${props.variants.length})`,
          transform: `translateX(calc(100%*${visibleSelectionIndex()}))`,
        }}
        class={clsxString(
          "pointer-events-none absolute inset-y-[2px] left-[2px] -z-10 w-[calc((100%-4px)/var(--variants))] rounded-full bg-accent font-inter text-[13px] font-[590] leading-[18px] transition-transform ease-out contain-strict",
          isNearbySelectorChoose() ? "duration-150" : "duration-[225ms]",
        )}
      />
      <For each={props.variants}>
        {(variant) => (
          <button
            {...createInputFocusPreventer.FRIENDLY}
            data-variant={variant}
            class={clsxString(
              "flex items-center justify-center transition-opacity duration-300 contain-strict",
              "text-text",
              // on safari active style will be applied until touchend even if active class removed
              platform !== "ios" && touchOver() !== variant
                ? "active:opacity-30"
                : "",
              touchOver() === variant &&
                touchOver() !== props.value &&
                !touchMoveSelection()
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
