import { clsxString } from "@/lib/clsxString";
import { PxStringFromNumber } from "@/lib/pxString";
import { batch, createSignal, For, type Accessor } from "solid-js";

function findFurthestPoint(
  relativeX: number,
  relativeY: number,
  width: number,
  height: number,
) {
  const x = relativeX > width / 2 ? 0 : width;
  const y = relativeY > height / 2 ? 0 : height;
  const r = Math.hypot(x - relativeX, y - relativeY);
  return r;
}

type RippleData = [
  x: number,
  y: number,
  radius: number,
  isCancelling: Accessor<boolean>,
  setIsCancelling: (newCancelling: boolean) => unknown,
];
/**
 *
 * @description it must to be inserted into components with overflow hidden and position relative
 */
export const Ripples = (props: { rippleClass?: string }) => {
  const [ripples, setRipples] = createSignal<RippleData[]>([]);

  const onCancel = () => {
    batch(() => {
      for (const [, , , , setIsCancelling] of ripples()) {
        setIsCancelling(true);
      }
    });
  };

  return (
    <div
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = e.clientX - rect.x;
        const relativeY = e.clientY - rect.y;

        const radius = findFurthestPoint(
          relativeX,
          relativeY,
          rect.width,
          rect.height,
        );

        const [isCancelling, setIsCancelling] = createSignal(false);

        setRipples((ripples) => [
          ...ripples,
          [relativeX, relativeY, radius, isCancelling, setIsCancelling],
        ]);
      }}
      onPointerCancel={onCancel}
      onDragLeave={onCancel}
      onMouseLeave={onCancel}
      onPointerUp={onCancel}
      onPointerLeave={onCancel}
      onTouchMove={onCancel}
      onTouchEnd={onCancel}
      onTouchCancel={onCancel}
      class={clsxString("absolute inset-0 overflow-hidden")}
    >
      <For each={ripples()}>
        {(ripple) => {
          const [x, y, radius, isCancelling] = ripple;
          return (
            <div
              class={clsxString(
                "pointer-events-none absolute aspect-square origin-center animate-ripple rounded-full transition-opacity duration-[600ms] ease-out",
                props.rippleClass ?? "bg-text opacity-[2.7%] blur-sm",
                isCancelling() ? "!opacity-0" : "",
              )}
              onTransitionEnd={() => {
                setRipples(ripples().filter((it) => it !== ripple));
              }}
              style={{
                left: PxStringFromNumber(x - radius),
                top: PxStringFromNumber(y - radius),
                width: PxStringFromNumber(radius * 2),
              }}
            />
          );
        }}
      </For>
    </div>
  );
};
