import { assertOk } from "@/lib/assert";

export type Point = { x: number; y: number };
export const Point = {
  isInsideElement: (point: Point, element: HTMLElement) => {
    const elementRect = element.getBoundingClientRect();
    if (point.x < elementRect.left || point.x > elementRect.right) {
      return false;
    }

    if (point.y > elementRect.bottom || point.y < elementRect.top) {
      return false;
    }
    return true;
  },
  make: (x: number, y: number) => ({
    x,
    y,
  }),
  fromTouch: (item: Touch): Point => Point.make(item.clientX, item.clientY),
  fromElement: (item: HTMLElement) => {
    return Point.make(item.clientTop, item.clientLeft);
  },
};

export const pointIsInsideBox = (
  pointX: number,
  pointY: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  hitSlopX: number = 0,
  hitSlopY: number = hitSlopX,
) => {
  if (import.meta.env.DEV) {
    assertOk(hitSlopY >= 0);
  }
  if (pointX < boxX - hitSlopX || pointX > boxX + boxWidth + hitSlopX) {
    return false;
  }

  if (pointY < boxY - hitSlopY || pointY > boxY + boxHeight + hitSlopY) {
    return false;
  }
  return true;
};
