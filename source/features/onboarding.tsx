import {
  AnonymousHintIcon,
  BilftLogoIcon,
  CloseIcon,
  PrivateHintIcon,
  PublicHintIcon,
} from "@/icons";
import { Show, createMemo, createSignal } from "solid-js";
import {
  SEND_ANONYMOUS_DESCRIPTION,
  SEND_ANONYMOUS_TITLE,
  SEND_PRIVATE_DESCRIPTION,
  SEND_PRIVATE_TITLE,
  SEND_PUBLIC_DESCRIPTION,
  SEND_PUBLIC_TITLE,
} from "./ContentCreator/VariantSelector";
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
    <div class="flex select-none flex-col items-center pb-[max(var(--safe-area-inset-bottom),1rem)]">
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
      <section class="flex flex-col gap-5 self-stretch">
        <BilftLogoIcon class="aspect-square w-16 self-center" />

        <h2 class="self-center pb-1 text-center font-inter text-[28px] font-bold leading-[34px] text-text">
          Welcome to <br />
          BILFT
        </h2>

        <div class="flex flex-row items-start gap-3">
          <AnonymousHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              {SEND_PRIVATE_TITLE}
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              {SEND_PRIVATE_DESCRIPTION}
            </p>
          </div>
        </div>
        <div class="flex flex-row items-start gap-3">
          <PublicHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              {SEND_ANONYMOUS_TITLE}
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              {SEND_ANONYMOUS_DESCRIPTION}
            </p>
          </div>
        </div>
        <div class="flex flex-row items-start gap-3">
          <PrivateHintIcon class="aspect-square w-7 shrink-0" />
          <div class="flex flex-col gap-1">
            <strong class="font-inter text-[20px] font-semibold leading-6 text-text">
              {SEND_PUBLIC_TITLE}
            </strong>

            <p class="font-inter text-[14px] leading-[18px] text-hint">
              {SEND_PUBLIC_DESCRIPTION}
            </p>
          </div>
        </div>
      </section>

      <button
        onClick={() => {
          onClose();
        }}
        class="group relative isolate mt-8 flex w-full select-none items-center justify-center overflow-hidden rounded-xl bg-accent p-[14px] font-inter text-button-text"
      >
        <Show when={isApple()} fallback={<Ripples />}>
          <div class="pointer-events-none absolute inset-0 -z-10 select-none bg-text opacity-0 transition-opacity ease-out group-active:opacity-10" />
        </Show>
        Continue
      </button>
    </div>
  );
};
