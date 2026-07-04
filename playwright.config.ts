import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const parsedBaseURL = new URL(baseURL);
const shouldStartWebServer =
  baseURL.startsWith("http://127.0.0.1") ||
  baseURL.startsWith("http://localhost");
const webServerPort =
  parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80");
const recorderWsPort = String(Number(webServerPort) + 1);
const fakeAudioFile = process.env.E2E_FAKE_AUDIO_FILE;
const browserArgs = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
  ...(fakeAudioFile
    ? [`--use-file-for-fake-audio-capture=${fakeAudioFile}`]
    : []),
];
const localWebServerCommand = [
  "env -u NO_COLOR NODE_ENV=development",
  `NEXT_PUBLIC_RECORDER_WS_URL=ws://${parsedBaseURL.hostname}:${recorderWsPort}/ws/recorder`,
  "bash -lc",
  JSON.stringify(
    [
      `pnpm --filter @babbledeck/web dev --hostname ${parsedBaseURL.hostname} --port ${webServerPort} & web_pid=$!`,
      `RECORDER_WS_HOST=${parsedBaseURL.hostname} RECORDER_WS_PORT=${recorderWsPort} pnpm tsx scripts/recorder-ws-server.ts & ws_pid=$!`,
      "trap 'kill $web_pid $ws_pid 2>/dev/null || true' EXIT",
      "wait $web_pid",
    ].join("; "),
  ),
].join(" ");

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["github"]] : [["list"], ["html"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    launchOptions: {
      args: browserArgs,
    },
  },
  webServer: shouldStartWebServer
    ? {
        command: localWebServerCommand,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
