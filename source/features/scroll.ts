import { assertOk } from "@/lib/assert";
import type { VirtualizerHandle } from "virtua/solid";

let virtualizerHandle: VirtualizerHandle | null = null;
export const setVirtualizerHandle = (
  newVirtualizedHandle: VirtualizerHandle | null | undefined,
) => {
  virtualizerHandle = newVirtualizedHandle ?? null;
};
export const getVirtualizerHandle = () => virtualizerHandle;

export const scrollableElement = (() => {
  const _scrollEl = document.getElementById("scroll-target");
  if (import.meta.env.DEV) {
    const findScrollElement = () => {
      const body = document.body;
      const childTargets: Element[] = [body];

      for (const childTarget of childTargets) {
        for (const it of childTarget.children) {
          // if (it.scrollHeight <= it.clientHeight) {
          //   childTargets.push(it);
          //   continue;
          // }
          const overflowY = window.getComputedStyle(it).overflowY;
          if (overflowY !== "auto" && overflowY !== "scroll") {
            childTargets.push(it);
            continue;
          }
          return it;
        }
      }
    };
    assertOk(_scrollEl === findScrollElement());
  }
  assertOk(_scrollEl);

  return _scrollEl as HTMLDivElement;
})();
