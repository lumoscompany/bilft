import { scrollableElement } from "@/common";
import { useCleanup } from "@/lib/solid";

export const useInfiniteScroll = (onInfiniteScroll: () => void) =>
  useCleanup((signal) => {
    scrollableElement.addEventListener(
      "scroll",
      () => {
        if (
          scrollableElement.scrollHeight -
            scrollableElement.offsetHeight -
            scrollableElement.scrollTop <
          400
        ) {
          onInfiniteScroll();
        }
      },
      {
        signal,
        passive: true,
      },
    );
  });
