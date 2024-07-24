import { useCleanup } from "@/lib/solid";
import { createEffect, type Accessor } from "solid-js";
import { Point } from "./point";

export function createSafariKeyboardHider(
  isFocused: Accessor<boolean>,
  position: Accessor<"top" | "bottom">,
  formRef: () => HTMLFormElement,
  inputRef: () => HTMLTextAreaElement | undefined,
) {
  createEffect(() => {
    if (!isFocused()) {
      return;
    }

    let touchState: null | "start" | "inside-input" | "outside-input" = null;
    type Identifier = number;
    const touchMap = new Map<Identifier, Point>();
    useCleanup((signal) => {
      window.addEventListener(
        "touchstart",
        (e) => {
          for (const touch of e.changedTouches) {
            touchMap.set(touch.identifier, Point.fromTouch(touch));
          }

          if (touchState === null) {
            touchState = "start";
          }
        },
        {
          signal,
          passive: true,
        },
      );
      window.addEventListener(
        "touchmove",
        (e) => {
          if (touchState === "inside-input") {
            return;
          }

          let someInside = false;
          for (const touch of e.changedTouches) {
            const prevPoint = touchMap.get(touch.identifier);
            const nextPoint = Point.fromTouch(touch);
            // touch started before focus
            if (!prevPoint) {
              touchMap.set(touch.identifier, nextPoint);
              touchState ??= "outside-input";
              continue;
            }

            if (
              nextPoint.y > prevPoint.y &&
              !Point.isInsideElement(prevPoint, formRef()) &&
              Point.isInsideElement(nextPoint, formRef())
            ) {
              someInside = true;
              continue;
            }

            touchMap.set(touch.identifier, nextPoint);
          }
          if (touchState === "start") {
            touchState = "outside-input";
          }
          if (someInside && touchState === "outside-input") {
            touchState = "inside-input";
          }
        },
        {
          signal,
          passive: true,
        },
      );
      const onTouchFinish = (e: TouchEvent) => {
        for (const touch of e.changedTouches) {
          touchMap.delete(touch.identifier);
        }
        if (touchMap.size === 0) {
          touchState = null;
        }
      };
      window.addEventListener("touchcancel", onTouchFinish, {
        signal,
        passive: true,
      });
      window.addEventListener("touchend", onTouchFinish, {
        signal,
        passive: true,
      });
      window.addEventListener(
        "scroll",
        (e) => {
          const input = inputRef();
          const form = formRef();
          if (
            input &&
            form &&
            (position() === "top"
              ? touchState === "outside-input" || touchState === "inside-input"
              : touchState === "inside-input") &&
            e.target &&
            (e.target instanceof Element || e.target instanceof Document) &&
            !form.contains(e.target)
          ) {
            input.blur();
          }
        },
        {
          passive: true,
          signal,
          capture: true,
        },
      );
    });
  });
}
