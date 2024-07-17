import { scrollableElement } from "@/common";
import { useCleanup } from "@/lib/solid";

export const useFixSafariScroll = () =>
  useCleanup((signal) => {
    const compensateScroll = () => {
      const top = window.screenTop;
      scrollableElement.scrollBy({ top });
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });
    };
    window.addEventListener(
      "scroll",
      (e) => {
        const targetIsWindow = e.target === window || e.target === document;
        if (targetIsWindow) {
          compensateScroll();
        }
      },
      {
        signal: signal,
        passive: false,
      },
    );
    window.addEventListener(
      "focus",
      (e) => {
        if (e.currentTarget !== e.target) {
          return;
        }
        compensateScroll();
      },
      { signal },
    );
    compensateScroll();
  });
