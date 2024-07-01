import { initThemeParams, initUtils, retrieveLaunchParams } from "@tma.js/sdk";
import type { Accessor } from "solid-js";

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

const _scrollEl = findScrollElement();
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

export function assertOk(value: unknown): asserts value {
  if (!value) {
    throw new Error("Assertion failed " + value);
  }
}

export const addPrefix = (id: string) => (id.startsWith("id") ? id : `id${id}`);
export const removePrefix = (id: string) =>
  id.startsWith("id") ? id.slice(2) : id;

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

  {
    return addPrefix(getSelfUserId());
  }
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

type UnwrapSignals<T extends Record<string, unknown>> = {
  [TKey in keyof T]: T[TKey] extends Accessor<infer TValue> ? TValue : T[TKey];
};
export const unwrapSignals = <T extends Record<string, unknown>>(
  obj: T,
): UnwrapSignals<T> => {
  const copy: Partial<UnwrapSignals<T>> = {};

  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "function") {
      copy[key] = val();
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      copy[key] = val;
    }
  }

  return copy as UnwrapSignals<T>;
};

export const PxString = {
  fromNumber: (value: number): `${number}px` => `${value}px`,
};
