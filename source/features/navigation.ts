import {
  initNavigator,
  type BrowserNavigatorAnyHistoryItem,
} from "@telegram-apps/sdk";
import {
  createCommentPagePathname,
  createCommentPageSearchEntries,
} from "./CommentsPage/utils";
import { getSelfUserId, removePrefix } from "./idUtils";
import type { StartParam } from "./parseStartParam";

export const createNavigatorFromStartParam = (
  startParam: StartParam | null,
) => {
  const targetEntry: BrowserNavigatorAnyHistoryItem<unknown> = (() => {
    if (startParam?.type === "note") {
      return {
        pathname: createCommentPagePathname(startParam.data.noteId),
        search: new URLSearchParams(
          createCommentPageSearchEntries(startParam.data.reversed),
        ).toString(),
      };
    }

    return {
      pathname: `/board/${removePrefix(startParam?.data ?? getSelfUserId())}`,
    };
  })();
  const selfEntry: BrowserNavigatorAnyHistoryItem<unknown> = {
    pathname: `/board/${removePrefix(getSelfUserId())}`,
  };
  const historySessionStorageKey = "app-navigator-state";
  const hasPreviousHistory = !!sessionStorage.getItem(historySessionStorageKey);

  const navigator = initNavigator(historySessionStorageKey);
  if (hasPreviousHistory) {
    return navigator;
  }
  if (selfEntry.pathname === targetEntry.pathname) {
    navigator.replace(selfEntry);
    return navigator;
  }
  navigator.replace(selfEntry);
  navigator.push(targetEntry);
  return navigator;
};
