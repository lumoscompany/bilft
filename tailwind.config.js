// @ts-check
import animated from "tailwindcss-animated";
import plugin from "tailwindcss/plugin";

const contentVisibilityPlugin = plugin(({ addUtilities }) => {
  addUtilities({
    ".content-auto": {
      "content-visibility": "auto",
    },
    ".content-hidden": {
      "content-visibility": "hidden",
    },
    ".content-visible": {
      "content-visibility": "visible",
    },
  });
});

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./source/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        roboto: ["Roboto", "Inter Variable", "Inter", "sans-serif"],
        inter: ["Inter Variable", "Inter", "sans-serif"],
        apple: ["ui-rounded", "sans-serif"],
      },
      colors: {
        bg: "var(--tg-theme-bg-color,#181818)",
        "secondary-bg": "var(--tg-theme-secondary-bg-color,#0F0F0F)",
        "section-bg": "var(--tg-theme-section-bg-color,#0F0F0F)",
        hint: "var(--tg-theme-hint-color,#AAA)",
        text: "var(--tg-theme-text-color,#FFF)",
        "text-opposite": "var(--theme-text-opposite-color,#000)",
        // button-text should be used on accent elements
        "button-text": "var(--tg-theme-button-text-color,#FFF)",
        "destructive-text": "var(--tg-theme-destructive-text-color,#FF4530)",
        subtitle: "var(--tg-theme-subtitle-text-color,#AAA)",
        accent: "var(--tg-theme-accent-text-color,#FF375F)",
        separator: "#545458A6",
      },
      height: {
        separator: "0.4px",
      },
      keyframes: {
        "fade-out": {
          "0%": {
            opacity: "1",
          },
          "100%": {
            opacity: "0",
          },
        },
        scale: {
          "0%": {
            transform: "scale(0)",
          },
          "100%": {
            transform: "scale(1)",
          },
        },
        "transition-indicator": {
          "0%": {
            transform: "scaleX(0)",
          },
          "70%": {
            transform: "scaleX(1)",
            opacity: "1",
          },
          "100%": {
            opacity: "0",
          },
        },
      },
      animation: {
        "fade-out":
          "fade-out var(--tw-animate-duration, 1s) var(--tw-animate-easing, ease) var(--tw-animate-delay, 0s) var(--tw-animate-iteration, 1) var(--tw-animate-fill, both)",
        ripple:
          "scale var(--tw-animate-duration, 0.3s) var(--tw-animate-easing, ease-out) var(--tw-animate-delay, 0s) var(--tw-animate-iteration, 1) var(--tw-animate-fill, both)",
        "transition-indicator":
          "transition-indicator var(--tw-animate-duration, 0.3s) var(--tw-animate-easing, ease) var(--tw-animate-delay, 0s) var(--tw-animate-iteration, 1) var(--tw-animate-fill, both)",
      },
    },
  },
  plugins: [animated, contentVisibilityPlugin],
};
