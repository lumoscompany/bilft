import { clsxString } from "@/lib/clsxString";
import { PxStringFromNumber } from "@/lib/pxString";
import { type StyleProps } from "@/lib/types";
import {
  Match,
  Show,
  Switch,
  createRenderEffect,
  createSignal,
} from "solid-js";
import { isApple, platform } from "../telegramIntegration";

let img: HTMLImageElement;
const isImageAlreadyLoaded = (imageSrc: string) => {
  if (!img) {
    img = document.createElement("img");
  }
  img.src = imageSrc;

  return img.complete;
};

const hashToNumber = (source: string) => {
  // fash path for telegram id's
  let lastChar: number;
  if (
    (lastChar = source.charCodeAt(source.length - 1) || 0) &&
    lastChar >= 48 &&
    lastChar < 58
  ) {
    return lastChar - 48;
  }

  // polynomial hash
  const p = 31;
  const m = 1e9 + 7;
  let hash = 0;
  for (let i = 0; i < source.length; ++i) {
    hash = (hash * p + source.charCodeAt(i)) % m;
  }
  return hash;
};

// https://github.com/twa-dev/Mark42/blob/1528017888a3131b1b83deb92d2b595263746292/src/Components/InitialsAvatar/InitialsAvatar.tsx#L12-L20
const bgColors = [
  ["#e17076", "#ff885e", "#ff516a"], // red
  ["#faa774", "#ffcd6a", "#ffa85c"], // orange
  ["#a695e7", "#82b1ff", "#665fff"], // purple
  ["#7bc862", "#a0de7e", "#54cb68"], // green
  ["#6ec9cb", "#53edd6", "#28c9b7"], // cyan
  ["#65aadd", "#72d5fd", "#2a9ef1"], // blue
  ["#ee7aae", "#e0a2f3", "#d669ed"], // pink
] as const;

const AVATAR_LOADING = 0;
const AVATAR_LOADED = 1;
const AVATAR_GENERATED = 2;
export type AvatarIconEntry =
  | {
      status: typeof AVATAR_LOADING;
      url: null;
      entityInitials: null;
      entityHash: null;
    }
  | {
      status: typeof AVATAR_LOADED;
      url: string;
      entityInitials: null;
      entityHash: null;
    }
  | {
      url: null;
      status: typeof AVATAR_GENERATED;
      entityInitials: string;
      /**
       * [0, 7)
       */
      entityHash: number;
    };

const makeEntry = (
  status: AvatarIconEntry["status"],
  url: string | null,
  entityInitials: string | null,
  entityHash: number | null,
) =>
  ({
    status,
    url,
    entityInitials,
    entityHash,
  }) as AvatarIconEntry;

export const AvatarIconEntryLoading = makeEntry(
  AVATAR_LOADING,
  null,
  null,
  null,
);
export const AvatarIconEntryMakeLoaded = (url: string): AvatarIconEntry =>
  makeEntry(AVATAR_LOADED, url, null, null);
export const AvatarIconEntryMakeGenerated = (
  entityName: string,
  entityId: string,
): AvatarIconEntry => {
  const firstNameLetter = entityName?.at(0)?.toUpperCase() ?? "";

  const nextLetterSym = entityName.indexOf(" ") + 1;
  const secondNameLetter =
    nextLetterSym === 0 ||
    // (me) postfix when showing inside of title: Maria (me) -> M
    entityName.at(nextLetterSym) === "("
      ? ""
      : entityName?.at(nextLetterSym)?.toUpperCase() ?? "";

  return makeEntry(
    AVATAR_GENERATED,
    null,
    firstNameLetter + secondNameLetter,
    hashToNumber(entityId) % 7,
  );
};

export const AvatarIcon = (
  props: StyleProps & {
    size: number;
    entry: AvatarIconEntry;
  },
) => {
  const [isImageLoaded, setIsImageLoaded] = createSignal(false);

  createRenderEffect((prev) => {
    if (props.entry.status !== AVATAR_LOADED) return prev;
    const next = props.entry.url;
    if (next && next !== prev) {
      setIsImageLoaded(isImageAlreadyLoaded(next));
    }

    return next;
  });

  const loader = <div class={"absolute inset-0 animate-pulse bg-gray-400"} />;

  return (
    <div
      style={{ "--size": PxStringFromNumber(props.size) }}
      class={clsxString(
        "pointer-events-none relative aspect-square w-[--size] select-none overflow-hidden rounded-full",
        props.class ?? "",
      )}
    >
      <Switch>
        <Match when={props.entry.status === AVATAR_LOADING}>{loader}</Match>
        <Match when={props.entry.status === AVATAR_LOADED ? props.entry : null}>
          {(entry) => (
            <>
              <img
                loading="lazy"
                onLoadStart={() => {
                  setIsImageLoaded(false);
                }}
                onLoad={() => {
                  setIsImageLoaded(true);
                }}
                alt="Avatar"
                src={entry().url}
                class={clsxString(
                  "inset-0 object-cover",
                  !isImageLoaded() ? "opacity-0" : "",
                )}
              />
              <Show when={!isImageLoaded()}>{loader}</Show>
            </>
          )}
        </Match>

        <Match when={props.entry.status === AVATAR_GENERATED && props.entry}>
          {(item) => {
            const color = () => bgColors[item().entityHash];

            return (
              <div
                class={clsxString(
                  "absolute inset-0 flex items-center justify-center text-center text-[calc(var(--size)/2.2)] leading-none text-white",
                  isApple()
                    ? "font-apple font-semibold"
                    : "font-inter font-medium tracking-tight",
                )}
                style={{
                  background:
                    platform === "ios"
                      ? `linear-gradient(180deg, ${color()[1]} 0%, ${color()[2]} 100%)`
                      : color()[0],
                }}
              >
                {item().entityInitials}
              </div>
            );
          }}
        </Match>
      </Switch>
    </div>
  );
};
