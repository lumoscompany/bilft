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
import { getSelfUserId } from "./idUtils";
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
        `/assets/stories/${randomInt(1, 8)}${userHasPremium ? "-premium" : ""}.webp`;

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
    on(shouldShowMainButton, (isSelf) => {
      if (!isSelf) return;
      const showButton = () => {
        mainButton.setParams({
          isVisible: true,
          text: "Share to stories",
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
  // sharing stories supported from 7.8 version
  if (canPostStories && compareVersions(launchParams.version, "7.8") >= 0) {
    useStories(
      () =>
        props.location.pathname.includes("/board") &&
        props.params.idWithoutPrefix === getSelfUserId(),
    );
  }

  const transitionsCount = usePageTransitionsCount();
  const [finishedTransition, setFinishedTransition] = createSignal<
    null | number
  >(null);

  return (
    <>
      {props.children}
      <Show when={isApple()}>
        <Portal>
          <Show keyed when={transitionsCount() !== 0 && transitionsCount()}>
            {(count) => (
              <div
                onAnimationEnd={() => {
                  setFinishedTransition(count);
                }}
                class="animate-transition-indicator pointer-events-none fixed inset-x-0 bottom-0 h-[2px] origin-left bg-accent will-change-[transform,opacity]"
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
