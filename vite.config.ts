import { defineConfig, loadEnv, type Plugin } from "vite";

import { rm } from "node:fs/promises";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import terminal from "vite-plugin-terminal";
import tsconfigPaths from "vite-tsconfig-paths";
import { z } from "zod";

import solid from "vite-plugin-solid";

const tonConnectPlugin = (webAppUrl: string): Plugin[] => {
  const fileName = "tonconnect-manifest.json";
  const fileContent = JSON.stringify({
    url: webAppUrl,
    name: "BILFT",
    iconUrl: "https://ton.vote/logo.png",
  });

  return [
    {
      name: "vite-plugin-inject-tonconnect-manifest/build",
      apply: "build",
      buildStart() {
        this.emitFile({
          type: "asset",
          fileName: fileName,
          source: fileContent,
        });
      },
    },
    {
      name: "vite-plugin-inject-tonconnect-manifest/serve",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url || req.method !== "GET") {
            return next();
          }
          if (req.url.slice(1) !== fileName) {
            return next();
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json").write(fileContent);
          res.end();
        });
      },
    },
  ];
};

const envSchema = z.object({
  VITE_BACKEND_URL: z.string().min(1).url(),
  VITE_SELF_WEBAPP_URL: z.string().min(1).url(),
});

export default defineConfig(async ({ mode, command }) => {
  const env = envSchema.parse(loadEnv(mode, "."));

  console.log("app looking to domain", env.VITE_BACKEND_URL);
  console.log("tonconnect-manifest is looking to", env.VITE_SELF_WEBAPP_URL);

  if (command === "build") {
    await rm("./docs", {
      force: true,
      recursive: true,
    });
  }

  return {
    server: {
      port: 1234,
    },
    plugins: [
      command !== "build" &&
        terminal({
          console: "terminal",
          output: ["console", "terminal"],
        }),
      tonConnectPlugin(env.VITE_SELF_WEBAPP_URL),
      solid(),
      tsconfigPaths(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        exclude: ["http"],
      }),
    ],
    define: {
      "process.env": {},
    },
    build: {
      outDir: "docs",
    },
  };
});
