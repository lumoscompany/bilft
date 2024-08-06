import type { CreateUnit } from "@/lib/types";

export type DateString = CreateUnit<string, "DateString">;

const ONE_DAY = 60 * 60 * 24 * 1000;
const todayEndOfDay = new Date().setHours(0, 0, 0, 0) + ONE_DAY;
export const formatPostDate = (createdAt: DateString) => {
  const date = new Date(createdAt);
  const dateUnix = date.valueOf();

  const todayDiff = todayEndOfDay - dateUnix;
  switch (true) {
    case todayDiff > 0 && todayDiff <= ONE_DAY:
      return "today";
    case todayDiff > 0 && todayDiff <= ONE_DAY * 2:
      return "yesterday";
    case todayDiff > 0 && todayDiff <= ONE_DAY * 7:
      return Math.ceil(todayDiff / ONE_DAY) + " days ago";
    default:
      return date.toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
  }
};

export const formatPostTime = (createdAt: DateString) =>
  new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
