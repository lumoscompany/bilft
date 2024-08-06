import { assertOk } from "@/lib/assert";
import { type RouteSectionProps } from "@solidjs/router";
import { compareVersions, postEvent, type UnionKeys } from "@telegram-apps/sdk";
import {
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Component,
} from "solid-js";
import { Portal } from "solid-js/web";
import { BottomDialog } from "./BottomDialog";
import { getSelfUserId } from "./idUtils";
import { useNavigationReady } from "./navigation";
import { OnboardingContent, createOnboarding } from "./onboarding";
import {
  usePageTransitionFinished,
  usePageTransitionsCount,
} from "./pageTransitions";
import {
  isApple,
  launchParams,
  mainButton,
  platform,
  userHasPremium,
} from "./telegramIntegration";

interface CreateParams<
  Params = never,
  VersionedParam extends UnionKeys<Params> = never,
> {
  params: Params;
  versionedParams: VersionedParam;
}
declare module "@telegram-apps/sdk" {
  interface MiniAppsMethods {
    web_app_share_to_story: CreateParams<WepAppShareStory>;
  }
}

type WepAppShareStory = {
  media_url: string;
  text?: string;
  widget_link?: {
    url: string;
    name?: string;
  };
};

const randomInt = (start: number, endExclusive: number) => {
  assertOk((start | 0) === start);
  assertOk((endExclusive | 0) === endExclusive);
  assertOk(endExclusive >= start);

  const diff = endExclusive - start;
  return (start + diff * Math.random()) | 0;
};

const useStories = (shouldShowMainButton: () => boolean) => {
  const pageTransitionFinished = usePageTransitionFinished();
  onCleanup(
    mainButton.on("click", () => {
      const mediaUrl =
        import.meta.env.VITE_SELF_WEBAPP_URL +
        `/assets/stories/${randomInt(1, 6)}${userHasPremium ? "-premium" : ""}.webp`;

      const postLink =
        import.meta.env.VITE_SELF_BOT_WEBAPP_URL +
        "?startapp=id" +
        getSelfUserId();
      postEvent(
        "web_app_share_to_story",
        userHasPremium
          ? {
              media_url: mediaUrl,
              widget_link: {
                url: postLink,
                name: "OPEN APP",
              },
            }
          : {
              media_url: mediaUrl,
              text: postLink,
            },
      );
    }),
  );

  createEffect(
    on(shouldShowMainButton, (shouldShow) => {
      if (!shouldShow) return;
      const showButton = () => {
        mainButton.setParams({
          isVisible: true,
          text: "Share to Stories",
          isEnabled: true,
        });
      };
      const hideButton = () => {
        mainButton.hide();
      };

      if (!pageTransitionFinished) {
        showButton();
        onCleanup(hideButton);
        return;
      }

      // we need to have some timeout to do not break view transition
      pageTransitionFinished().finally(() => {
        if (mainButton.isVisible) return;
        showButton();
      });

      onCleanup(() => {
        if (!mainButton.isVisible) return;
        pageTransitionFinished().finally(() => {
          if (!mainButton.isVisible) return;
          // don't need to hide
          if (shouldShowMainButton()) return;
          hideButton();
        });
      });
    }),
  );
};
export const PageLayout: Component<RouteSectionProps> = (props) => {
  const canPostStories = platform === "ios" || platform === "android";

  const [shouldShowOnboarding, onOnboardingClose] = createOnboarding();
  // sharing stories supported from 7.8 version
  if (canPostStories && compareVersions(launchParams.version, "7.8") >= 0) {
    useStories(
      () =>
        !shouldShowOnboarding() &&
        props.location.pathname.includes("/board") &&
        props.params.idWithoutPrefix === getSelfUserId(),
    );
  }

  const transitionsCount = usePageTransitionsCount();
  // skipping page load transition
  const [finishedTransition, setFinishedTransition] = createSignal<number>(0);

  return (
    <>
      {props.children}

      <BottomDialog
        when={useNavigationReady()() && shouldShowOnboarding()}
        onClose={onOnboardingClose}
      >
        {() => <OnboardingContent onClose={onOnboardingClose} />}
      </BottomDialog>
      <Show when={isApple()}>
        <Portal>
          <Show keyed when={transitionsCount()}>
            {(count) => (
              <div
                onAnimationEnd={() => {
                  setFinishedTransition(count);
                }}
                class="pointer-events-none fixed inset-x-0 bottom-0 origin-left animate-transition-indicator bg-accent will-change-[transform,opacity]"
                style={{
                  height: mainButton.isVisible ? "1.5px" : "3.2px",
                }}
                classList={{
                  hidden: finishedTransition() === count,
                }}
              />
            )}
          </Show>
        </Portal>
      </Show>
    </>
  );
};
