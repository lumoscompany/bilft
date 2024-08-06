import {
  AnonymousHintIcon,
  BilftLogoIcon,
  CloseIcon,
  PrivateHintIcon,
  PublicHintIcon,
} from "@/icons";
import { Show, createMemo, createSignal } from "solid-js";
import { Ripples } from "./Ripple";
import { isApple } from "./telegramIntegration";

export const createOnboarding = () => {
  const [rerender, invalidate] = createSignal<void>(undefined, {
    equals: false,
  });
  const finishedOnboardingKey = "finishedOnboarding";
  const finishedOnboardingValue = "1";
  const needToShow = createMemo(
    () => (
      rerender(),
      localStorage.getItem(finishedOnboardingKey) !== finishedOnboardingValue
    ),
  );

  const onClose = () => {
    localStorage.setItem(finishedOnboardingKey, finishedOnboardingValue);
    invalidate();
  };
  return [needToShow, onClose] as const;
};

export const OnboardingContent = (props: { onClose(): void }) => {
  const onClose = () => props.onClose();
  return (
    <div class="flex select-none flex-col items-center pb-4">
      <section class="relative flex justify-end self-stretch pb-3 pr-1 pt-3">
        <button
          onClick={() => {
            onClose();
          }}
          type="button"
        >
          <span class="sr-only">Close</span>
          <CloseIcon class="text-accent" />
        </button>
      </section>
      <section class="flex flex-col gap-6 self-stretch">
        <BilftLogoIcon class="aspect-square w-16 self-center" />

        <h2 class="self-center text-center font-inter text-[28px] font-bold leading-[34px] text-text">
          Welcome to <br />
          BILFT
        </h2>

        <div class="flex flex-row items-start gap-3">
          <AnonymousHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              Send Private
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              Only you and the board owner can see the post, but the board owner
              won’t see your name, so you stay anonymous
            </p>
          </div>
        </div>
        <div class="flex flex-row items-start gap-3">
          <PublicHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              Send Anonym
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              Everyone can see the post, but your name stays hidden
            </p>
          </div>
        </div>
        <div class="flex flex-row items-start gap-3">
          <PrivateHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              Send Public
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              Everyone can see the post, and your name will be visible
            </p>
          </div>
        </div>
      </section>

      <button
        onClick={() => {
          onClose();
        }}
        class="group relative isolate mt-4 flex w-full select-none items-center justify-center overflow-hidden rounded-xl bg-accent p-[14px] font-inter text-button-text"
      >
        <Show when={isApple()} fallback={<Ripples />}>
          <div class="pointer-events-none absolute inset-0 -z-10 select-none bg-text opacity-0 transition-opacity ease-out group-active:opacity-10" />
        </Show>
        Continue
      </button>
    </div>
  );
};
