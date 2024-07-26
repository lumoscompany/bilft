import type { CreateUnit } from "@/lib/types";

export type DateString = CreateUnit<string, "DateString">;
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
