import { initThemeParams, initUtils, retrieveLaunchParams } from "@telegram-apps/sdk";
import { assertOk } from "./lib/assert";

export type StyleProps = {
  class?: string;
};

const launchParams = retrieveLaunchParams();
export const authData = launchParams.initDataRaw;
export const [themeParams] = initThemeParams();
export const utils = initUtils();
export const platform = launchParams.platform;

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

const _scrollEl = document.getElementById("scroll-target");
if (import.meta.env.DEV) {
  assertOk(_scrollEl === findScrollElement());
}
assertOk(_scrollEl);
export const scrollableElement = _scrollEl as HTMLElement;

export const clsxString = (...items: string[]) => {
  let res = "";
  for (const it of items) {
    if (it.length === 0) {
      continue;
    }

    if (res.length > 0) {
      res += " ";
    }
    res += it;
  }

  return res;
};

export const addPrefix = (id: string) => (id.startsWith("id") ? id : `id${id}`);
export const removePrefix = (id: string) =>
  id.startsWith("id") ? id.slice(2) : id;

type StartParam =
  | {
      type: "board";
      data: string;
    }
  | {
      type: "note";
      data: {
        noteId: string;
        reversed: boolean;
      };
    };
function unescapeBase64Url(str: string) {
  return (str + "===".slice((str.length + 3) % 4))

    .replace(/-/g, "+")

    .replace(/_/g, "/");
}
export const getStartParam = (): StartParam | null => {
  const startParamId = launchParams.initData?.startParam;

  if (!startParamId) {
    return null;
  }
  if (!startParamId.startsWith("b64")) {
    return {
      type: "board",
      data: startParamId,
    };
  }
  const content = (() => {
    try {
      return JSON.parse(
        Buffer.from(
          unescapeBase64Url(startParamId.slice(3)),
          "base64",
        ).toString(),
      ) as {
        noteId?: string;
        reversed?: boolean;
      };
    } catch (err) {
      console.error("failed to parse json", err);
      return null;
    }
  })();
  if (!content) {
    return null;
  }
  if (!content.noteId || typeof content.noteId !== "string") {
    console.error("unknown content", content);
    return null;
  }

  return {
    type: "note",
    data: {
      noteId: content.noteId,
      reversed: !!content.reversed,
    },
  };
};

export function getProfileId() {
  const searchParams = new URLSearchParams(window.location.search);
  const searchParamsID = searchParams.get("id");
  if (searchParamsID) {
    return addPrefix(searchParamsID);
  }

  {
    const startParamId = launchParams.initData?.startParam;
    if (startParamId) {
      return startParamId;
    }
  }

  return addPrefix(getSelfUserId());
}
export const getProfileIdWithoutPrefix = () => removePrefix(getProfileId());

export const isEqualIds = (a: string, b: string) => {
  const aStrip = a.slice(a.startsWith("id") ? 2 : 0);
  const bStrip = b.slice(b.startsWith("id") ? 2 : 0);

  return aStrip === bStrip;
};

export const getSelfUserId = () => {
  const id = launchParams.initData?.user?.id;
  if (!id) {
    throw new Error("Invalid user");
  }
  return id.toString();
};
export const getBoardId = getProfileIdWithoutPrefix;

declare const _symbol: unique symbol;
export type Opaque<T, TTag> = T & {
  [_symbol]: TTag;
};

export type DateString = Opaque<string, "DateString">;

const todayDate = new Date();
export const formatPostDate = (createdAt: DateString) => {
  const date = new Date(createdAt);

  const isSameMonth =
    todayDate.getMonth() === date.getMonth() &&
    todayDate.getFullYear() === date.getFullYear();
  if (isSameMonth && todayDate.getDate() === date.getDate()) {
    return "today";
  }
  if (isSameMonth && todayDate.getDate() - 1 === date.getDate()) {
    return "yesterday";
  }

  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

export const formatPostTime = (createdAt: DateString) =>
  new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

export const pick = <TObj extends object, TKeys extends keyof TObj>(
  obj: TObj,
  keys: TKeys[],
): Pick<TObj, TKeys> => {
  const res = {} as Pick<TObj, TKeys>;

  for (const key of keys) {
    res[key] = obj[key];
  }

  return res;
};

export type PxString = `${number}px`;
export const PxString = {
  fromNumber: (value: number): `${number}px` => `${value}px`,
};

export const clamp = (item: number, min: number, max: number) =>
  Math.max(min, Math.min(item, max));
