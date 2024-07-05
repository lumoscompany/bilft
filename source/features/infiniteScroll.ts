import { scrollableElement } from "@/common";
import { useCleanup } from "@/lib/solid";

export const useInfiniteScroll = (onInfiniteScroll: () => void) =>
  useCleanup((signal) => {
    const onScroll = () => {
      if (
        scrollableElement.scrollHeight -
          scrollableElement.offsetHeight -
          scrollableElement.scrollTop <
        400
      ) {
        onInfiniteScroll();
      }
    };
    scrollableElement.addEventListener("scroll", onScroll, {
      signal,
      passive: true,
    });
    onScroll();
  });
