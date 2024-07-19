import { useCleanup } from "@/lib/solid";
import { onMount } from "solid-js";
import { scrollableElement } from "./scroll";

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
    onMount(onScroll);
  });
