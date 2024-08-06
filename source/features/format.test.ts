import { describe, expect, it } from "vitest";
import { formatPostDate, type DateString } from "./format";

describe(formatPostDate, () => {
  let date: number;
  const toDateString = (date: number) =>
    new Date(date).toISOString() as DateString;
  it("formats", () => {
    date = Date.now();
    expect(formatPostDate(toDateString(date))).toBe("today");
    date = date - 1000 * 60 * 60 * 24;
    expect(formatPostDate(toDateString(date))).toBe("yesterday");
    date = date - 1000 * 60 * 60 * 24;
    expect(formatPostDate(toDateString(date))).toBe("3 days ago");
    date = date - 1000 * 60 * 60 * 24 * 4;
    expect(formatPostDate(toDateString(date))).toBe("7 days ago");

    date = new Date("2021-01-01").valueOf();
    expect(formatPostDate(toDateString(date))).toBe(
      new Date(date).toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
    );
  });
});
