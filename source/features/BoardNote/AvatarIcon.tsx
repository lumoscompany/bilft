import { clsxString, type StyleProps } from "@/common";
import { Show, createRenderEffect, createSignal } from "solid-js";

let img: HTMLImageElement;
const isImageAlreadyLoaded = (imageSrc: string) => {
  if (!img) {
    img = document.createElement("img");
  }
  img.src = imageSrc;

  return img.complete;
};

export const AvatarIcon = (
  props: StyleProps & {
    isLoading: boolean;
    url: string | null;
    lazy?: boolean;
  },
) => {
  const [isImageLoaded, setIsImageLoaded] = createSignal(false);

  createRenderEffect((prev) => {
    if (props.url && props.url !== prev) {
      setIsImageLoaded(isImageAlreadyLoaded(props.url));
    }

    return props.url;
  });

  const isLoading = () => props.isLoading && !isImageLoaded();

  return (
    <div
      class={clsxString(
        "relative aspect-square select-none overflow-hidden rounded-full",
        props.class ?? "",
      )}
    >
      <div
        class={clsxString(
          "absolute inset-0 bg-gray-400 transition-opacity",
          isLoading() ? "animate-pulse" : props.url ? "opacity-0" : "",
        )}
      />
      <Show when={props.url}>
        {(url) => (
          <img
            loading={props.lazy ? "lazy" : "eager"}
            onLoadStart={() => {
              setIsImageLoaded(false);
            }}
            onLoad={() => {
              setIsImageLoaded(true);
            }}
            alt="Avatar"
            src={url()}
            class={clsxString(
              "inset-0 object-cover",
              isLoading() ? "opacity-0" : "",
            )}
          />
        )}
      </Show>
    </div>
  );
};
