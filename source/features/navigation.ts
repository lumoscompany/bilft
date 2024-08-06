import { assertOk } from "@/lib/assert";
import {
  initNavigator,
  type BrowserNavigatorAnyHistoryItem,
} from "@telegram-apps/sdk";
import { createContext, useContext } from "solid-js";
import {
  ProfileIdRemovePrefix,
  getSelfUserId,
  type ProfileIdWithoutPrefix,
} from "./idUtils";
import type { StartParam } from "./parseStartParam";

const NavigationReadyContext = createContext<null | (() => boolean)>(null);
export const NavigationReadyProvider = NavigationReadyContext.Provider;

export const useNavigationReady = () => {
  const ctx = useContext(NavigationReadyContext);
  assertOk(ctx);

  return ctx;
};

export const createNavigatorFromStartParam = (
  startParam: StartParam | null,
) => {
  const targetEntry: BrowserNavigatorAnyHistoryItem<unknown> = (() => {
    if (startParam?.type === "note") {
      return createCommentsUrl(
        startParam.data.noteId,
        startParam.data.reversed,
      );
    }

    return createBoardUrl(
      ProfileIdRemovePrefix(startParam?.data ?? getSelfUserId()),
    );
  })();
  const selfEntry: BrowserNavigatorAnyHistoryItem<unknown> = createBoardUrl(
    ProfileIdRemovePrefix(getSelfUserId()),
  );
  const historySessionStorageKey = "app-navigator-state";
  const hasPreviousHistory = !!sessionStorage.getItem(historySessionStorageKey);

  const navigator = initNavigator(historySessionStorageKey);
  if (hasPreviousHistory) {
    return navigator;
  }
  if (selfEntry === targetEntry) {
    navigator.replace(selfEntry);
    return navigator;
  }
  navigator.replace(selfEntry);
  navigator.push(targetEntry);
  return navigator;
};

export const createBoardUrl = (profileId: ProfileIdWithoutPrefix) =>
  `/board/${profileId}`;

export const COMMENTS_REVERSED_KEY = "reversed";
export const createCommentsUrl = (noteId: string, reversed: boolean) => {
  return `/comments/${noteId}?${COMMENTS_REVERSED_KEY}=${reversed}`;
};

