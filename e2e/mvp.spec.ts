import fs from "node:fs/promises";
import {
  chromium,
  expect,
  test,
  type APIResponse,
  type Page,
} from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid";
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const rotatedAdminPassword = process.env.E2E_NEW_ADMIN_PASSWORD;
const runBudgetTest = process.env.E2E_RUN_BUDGET_TEST === "true";
const runLiveKitUiTest = process.env.E2E_RUN_LIVEKIT_UI_TEST === "true";
const runSonioxUiTest = process.env.E2E_RUN_SONIOX_UI_TEST === "true";
const fakeAudioFile = process.env.E2E_FAKE_AUDIO_FILE;

function sonioxExpectedText() {
  return new RegExp(process.env.E2E_SONIOX_EXPECTED_TEXT ?? "Brooklyn", "i");
}

function sonioxExpectedTexts() {
  const values = process.env.E2E_SONIOX_EXPECTED_TEXTS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values?.length
    ? values.map((value) => new RegExp(value, "i"))
    : [sonioxExpectedText()];
}

function sonioxSessionTitle() {
  return (
    process.env.E2E_SONIOX_SESSION_TITLE ?? `Soniox UI session ${Date.now()}`
  );
}

function sonioxRecordSeconds() {
  const parsed = Number(process.env.E2E_SONIOX_RECORD_SECONDS ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function signIn(page: Page) {
  const passwords = [rotatedAdminPassword, adminPassword].filter(
    (value): value is string => Boolean(value),
  );

  for (const password of passwords) {
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(password);
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
    const loginResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/auth/login") &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      )
      .catch(() => null);
    await signInButton.click();
    const loginResponse = await loginResponsePromise;

    const destination = await Promise.race([
      page
        .waitForURL(/\/(dashboard|account\/password)(\?|$)/, {
          timeout: 15_000,
        })
        .then(() => "signed-in" as const)
        .catch(() => null),
      page
        .getByText("Sign-in failed. Check your credentials and try again.")
        .waitFor({ timeout: 5_000 })
        .then(() => "failed" as const)
        .catch(() => null),
    ]);

    if (destination === "signed-in" || loginResponse?.ok()) {
      if (!page.url().match(/\/(dashboard|account\/password)(\?|$)/)) {
        await page.goto("/dashboard");
        await page.waitForURL(/\/(dashboard|account\/password)(\?|$)/, {
          timeout: 15_000,
        });
      }
      if (page.url().includes("/account/password")) {
        if (!rotatedAdminPassword) {
          throw new Error(
            "E2E_NEW_ADMIN_PASSWORD must be set when password rotation is required.",
          );
        }
        await page.getByLabel("Current password").fill(password);
        await page
          .getByLabel("New password", { exact: true })
          .fill(rotatedAdminPassword);
        await page
          .getByLabel("Confirm new password")
          .fill(rotatedAdminPassword);
        await page.getByRole("button", { name: /update password/i }).click();
        await page.waitForURL("**/dashboard");
      }
      return;
    }
  }

  throw new Error("Unable to sign in with the provided E2E credentials.");
}

type SeedBackupChunkStatus = "local_only" | "uploaded" | "failed";

async function seedBackupChunk(
  page: Page,
  input: {
    sessionId: string;
    chunkIndex: number;
    status: SeedBackupChunkStatus;
  },
) {
  await page.evaluate(async ({ sessionId, chunkIndex, status }) => {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.open("babbledeck-audio-backup", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("chunks")) {
          const store = database.createObjectStore("chunks", {
            keyPath: "id",
          });
          store.createIndex("sessionId", "sessionId");
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("chunks", "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.objectStore("chunks").put({
          id: `${sessionId}:${chunkIndex}`,
          sessionId,
          chunkIndex,
          startedAt: new Date().toISOString(),
          durationMs: 1000,
          mimeType: "audio/webm",
          blob: new Blob([`retry smoke chunk ${chunkIndex}`], {
            type: "audio/webm",
          }),
          status,
        });
      };
    });
  }, input);
}

async function seedPendingBackupChunk(
  page: Page,
  input: { sessionId: string; chunkIndex: number },
) {
  await seedBackupChunk(page, { ...input, status: "failed" });
}

async function downloadExport(
  page: Page,
  input: { name: RegExp; extension: string },
) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: input.name }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    new RegExp(`\\.${input.extension}$`),
  );
  const downloadPath = await download.path();
  if (!downloadPath)
    throw new Error(`${input.extension} download path missing.`);
  return fs.readFile(downloadPath, "utf8");
}

async function expectUnauthenticated(response: APIResponse) {
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: expect.objectContaining({ code: "UNAUTHENTICATED" }),
  });
}

test.describe("BabbleDeck MVP browser flow", () => {
  test.skip(
    !adminPassword,
    "E2E_ADMIN_PASSWORD must be set for browser login.",
  );

  test("anonymous users cannot access admin surfaces", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Protected route coverage runs once on desktop.",
    );

    for (const path of ["/dashboard", "/sessions/new", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(
        page.getByRole("heading", { name: /sign in to babbledeck/i }),
      ).toBeVisible();
    }

    await expectUnauthenticated(await page.request.get("/api/auth/me"));
    await expectUnauthenticated(await page.request.get("/api/settings"));
    await expectUnauthenticated(await page.request.get("/api/sessions"));
    await expectUnauthenticated(
      await page.request.post("/api/sessions", {
        data: {
          title: "Anonymous denied session",
          targetLanguage: "zh",
          providerName: "mock",
        },
      }),
    );
  });

  test("admin creates a live session, viewer receives captions, and export downloads", async ({
    browser,
    page,
  }, testInfo) => {
    const title = `Playwright session ${Date.now()}`;

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /live multilingual captions/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /settings/i }).click();
    await expect(
      page.getByRole("heading", { name: /provider and safety status/i }),
    ).toBeVisible();
    const defaultSessionSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Default session" }),
    });
    const defaultTargetLanguage = defaultSessionSection.getByLabel(
      "Default target language",
    );
    const defaultBudgetCap =
      defaultSessionSection.getByLabel("Default budget cap");
    await defaultTargetLanguage.selectOption(
      await defaultTargetLanguage.inputValue(),
    );
    await defaultBudgetCap.fill((await defaultBudgetCap.inputValue()) || "1.5");
    await defaultSessionSection
      .getByRole("button", { name: /^save$/i })
      .click();
    await expect(defaultSessionSection.getByText("Saved.")).toBeVisible();

    const retentionInput = page.getByLabel("Raw audio retention");
    await expect(retentionInput).toBeVisible();
    await retentionInput.fill((await retentionInput.inputValue()) || "30");
    const retentionForm = page.locator("form").filter({ has: retentionInput });
    await retentionForm.getByRole("button", { name: /^save$/i }).click();
    await expect(retentionForm.getByText("Saved.")).toBeVisible();

    const glossarySection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Glossary" }),
    });
    const glossarySource = `Playwright glossary ${Date.now()}`;
    await glossarySection.getByLabel("Source term").fill(glossarySource);
    await glossarySection.getByLabel("Preferred translation").fill("剧场词条");
    await glossarySection.locator("#newTargetLanguage").fill("zh");
    await glossarySection.getByRole("button", { name: /^add$/i }).click();
    await expect(glossarySection.getByText("Glossary term added.")).toBeVisible(
      { timeout: 12_000 },
    );
    const deleteGlossaryButton = glossarySection.getByRole("button", {
      name: `Delete ${glossarySource}`,
    });
    await expect(deleteGlossaryButton).toBeVisible();
    const glossaryRow = deleteGlossaryButton.locator("xpath=ancestor::form");
    await glossaryRow.getByLabel("Enabled").uncheck();
    await glossaryRow.getByRole("button", { name: /^save$/i }).click();
    await expect(glossarySection.getByText("Glossary term saved.")).toBeVisible(
      { timeout: 12_000 },
    );
    await deleteGlossaryButton.click();
    await expect(
      glossarySection.getByText("Glossary term deleted."),
    ).toBeVisible({ timeout: 12_000 });
    await expect(deleteGlossaryButton).toHaveCount(0);

    await page.reload();
    const auditLogSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Audit log" }),
    });
    await expect(
      auditLogSection.getByText("settings.glossary_term_deleted").first(),
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    const titleInput = page.getByLabel("Title");
    const retryWorkspaceButton = page.getByRole("button", { name: /^retry$/i });
    if (
      await retryWorkspaceButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
    ) {
      await retryWorkspaceButton.click();
    }
    await expect(titleInput).toBeVisible({ timeout: 20_000 });
    await titleInput.fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    const createButton = page.getByRole("button", { name: /create session/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    const recorderUrl = page.url();
    expect(recorderUrl).toContain("recorder=");
    const sessionId = new URL(recorderUrl).pathname.split("/")[2];
    await expect(page.getByText("Viewer link", { exact: true })).toBeVisible();
    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    await page.getByRole("link", { name: /history/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("link", { name: /open recorder/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const restoredViewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(restoredViewerUrl).toBe(viewerUrl);

    const recorderContext = await browser.newContext({
      viewport:
        testInfo.project.name === "chromium-mobile"
          ? { width: 390, height: 844 }
          : { width: 900, height: 900 },
      permissions: ["microphone"],
    });
    const recorder = await recorderContext.newPage();
    await recorder.route("**/api/sessions/**/livekit-token", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "PROVIDER_NOT_CONFIGURED" },
        }),
      }),
    );
    await recorder.goto(recorderUrl);
    await expect(recorder.getByRole("heading", { name: title })).toBeVisible();
    await expect(recorder.getByRole("link", { name: /history/i })).toHaveCount(
      0,
    );
    await expect(recorder.getByLabel("Microphone input")).toBeVisible();
    await expect(recorder.getByLabel("Microphone input")).toBeEnabled();
    await expect(
      recorder.locator("aside p").filter({ hasText: "/s/" }),
    ).toHaveText(viewerUrl ?? "");
    await seedPendingBackupChunk(recorder, {
      sessionId,
      chunkIndex: 900000,
    });
    await recorder.getByRole("button", { name: /reconnect backup/i }).click();
    await expect(recorder.getByText("1 pending")).toBeVisible();
    await recorder.getByRole("button", { name: /retry pending/i }).click();
    await expect(
      recorder.getByText("Pending backup chunks uploaded."),
    ).toBeVisible({ timeout: 12_000 });
    await expect(recorder.getByText("1/1 uploaded")).toBeVisible();

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const viewer = await viewerContext.newPage();
    await viewer.route("**/api/viewer/session/**/livekit-token", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "PROVIDER_NOT_CONFIGURED" },
        }),
      }),
    );
    await viewer.goto(viewerUrl ?? "");
    await expect(
      viewer.getByRole("heading", { name: "Live captions" }),
    ).toBeVisible();
    await expect(viewer.getByText("SSE live")).toBeVisible({
      timeout: 25_000,
    });
    await expect(viewer.getByText("Audio off")).toBeVisible({
      timeout: 12_000,
    });

    await recorder.getByRole("button", { name: /test microphone/i }).click();
    await expect(recorder.getByText("granted")).toBeVisible({
      timeout: 10_000,
    });

    await recorder.getByRole("button", { name: /start recording/i }).click();
    await expect(recorder.getByText("Mock realtime")).toBeVisible();
    await expect(
      recorder.getByText("Not configured", { exact: true }),
    ).toBeVisible({ timeout: 12_000 });
    await expect(recorder.getByLabel("Microphone input")).toBeDisabled();
    await expect(
      recorder.getByText(/[1-9][0-9]*\/[1-9][0-9]* uploaded/),
    ).toBeVisible({
      timeout: 12_000,
    });
    await expect(recorder.getByText("WebSocket backup")).toBeVisible();
    await expect(viewer.getByText("欢迎使用 BabbleDeck")).toBeVisible({
      timeout: 12_000,
    });
    await expect(viewer.getByText(/final segments/i)).toBeVisible();
    await viewer.getByRole("button", { name: /original only/i }).click();
    await expect(
      viewer.getByText("Welcome to BabbleDeck. The recorder is now live."),
    ).toBeVisible();
    await expect(viewer.getByText("欢迎使用 BabbleDeck")).toHaveCount(0);
    await viewer.getByRole("button", { name: /^both$/i }).click();
    await expect(viewer.getByText("欢迎使用 BabbleDeck")).toBeVisible();
    await expect(
      viewer.getByText("Welcome to BabbleDeck. The recorder is now live."),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: /copy visible transcript/i })
      .click();
    await expect(viewer.getByText("Copied.")).toBeVisible();
    const copiedTranscript = await viewer.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(copiedTranscript).toContain("Welcome to BabbleDeck");
    expect(copiedTranscript).toContain("欢迎使用 BabbleDeck");
    await viewer.getByRole("button", { name: /translation only/i }).click();
    await expect(viewer.getByText("欢迎使用 BabbleDeck")).toBeVisible();
    await expect(
      viewer.getByText("Welcome to BabbleDeck. The recorder is now live."),
    ).toHaveCount(0);
    await viewer.getByRole("button", { name: /toggle caption size/i }).click();
    await viewer
      .getByRole("button", { name: /switch to light theme/i })
      .click();
    await expect(
      viewer.getByRole("button", { name: /switch to dark theme/i }),
    ).toBeVisible();

    await recorder.getByRole("button", { name: /stop recording/i }).click();
    await expect(
      recorder.getByRole("button", { name: /start recording/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      recorder.getByText(/[1-9][0-9]*\/[1-9][0-9]* uploaded/),
    ).toBeVisible({ timeout: 12_000 });
    await recorder.getByRole("button", { name: /clean uploaded/i }).click();
    await expect(
      recorder.getByText("Uploaded local backup cleaned."),
    ).toBeVisible({ timeout: 12_000 });
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    const correctedOriginal = "Corrected Playwright original.";
    const correctedTranslation = "修正后的字幕。";
    const firstSegment = page
      .locator("article")
      .filter({ hasText: "Segment 1" });
    await firstSegment.getByRole("button", { name: /^edit$/i }).click();
    await firstSegment.getByLabel("Original").fill(correctedOriginal);
    await firstSegment.getByLabel("Translation").fill(correctedTranslation);
    await firstSegment.getByRole("button", { name: /^save$/i }).click();
    await expect(firstSegment.getByText(correctedOriginal)).toBeVisible();
    await expect(firstSegment.getByText(correctedTranslation)).toBeVisible();
    await page.getByLabel("Legal hold").check();
    await page
      .locator("form")
      .filter({ hasText: "Legal hold" })
      .getByRole("button", { name: /^save$/i })
      .click();
    await expect(page.getByText("Raw audio protected.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Transcript timeline" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);
    await expect(
      page.getByText("Audio processed").locator("xpath=.."),
    ).toContainText(/0:0[1-9]|0:[1-9][0-9]|[1-9][0-9]*:/);
    await expect(page.getByText(correctedTranslation)).toBeVisible();

    const markdownContent = await downloadExport(page, {
      name: /markdown/i,
      extension: "markdown",
    });
    expect(markdownContent).toContain(correctedOriginal);
    expect(markdownContent).toContain(correctedTranslation);

    const txtContent = await downloadExport(page, {
      name: /^txt$/i,
      extension: "txt",
    });
    expect(txtContent).toContain(correctedOriginal);
    expect(txtContent).toContain(correctedTranslation);

    const jsonContent = await downloadExport(page, {
      name: /^json$/i,
      extension: "json",
    });
    const exportJson = JSON.parse(jsonContent) as {
      title: string;
      segments: Array<{ originalText: string; translationText: string | null }>;
    };
    expect(exportJson.title).toBe(title);
    expect(
      exportJson.segments.some(
        (segment) =>
          segment.originalText === correctedOriginal &&
          segment.translationText === correctedTranslation,
      ),
    ).toBe(true);

    const srtContent = await downloadExport(page, {
      name: /^srt$/i,
      extension: "srt",
    });
    expect(srtContent).toContain("00:00:");
    expect(srtContent).toContain(correctedOriginal);
    expect(srtContent).toContain(correctedTranslation);

    const vttContent = await downloadExport(page, {
      name: /^vtt$/i,
      extension: "vtt",
    });
    expect(vttContent).toMatch(/^WEBVTT/);
    expect(vttContent).toContain(correctedOriginal);
    expect(vttContent).toContain(correctedTranslation);

    await recorderContext.close();
    await viewerContext.close();
  });

  test("recorder cleans uploaded local backup chunks without deleting pending recovery", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Local backup cleanup coverage runs once on desktop.",
    );

    const title = `Playwright session cleanup ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const recorderUrl = page.url();
    const sessionId = new URL(recorderUrl).pathname.split("/")[2];

    await seedBackupChunk(page, {
      sessionId,
      chunkIndex: 910001,
      status: "uploaded",
    });
    await seedBackupChunk(page, {
      sessionId,
      chunkIndex: 910002,
      status: "uploaded",
    });
    await seedBackupChunk(page, {
      sessionId,
      chunkIndex: 910003,
      status: "failed",
    });

    await page.reload();
    await expect(page.getByText("2/3 uploaded")).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText("1 pending · 1 failed")).toBeVisible();

    const cleanUploadedButton = page.getByRole("button", {
      name: /clean uploaded/i,
    });
    await expect(cleanUploadedButton).toBeEnabled();
    await cleanUploadedButton.click();
    await expect(page.getByText("Uploaded local backup cleaned.")).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText("0/1 uploaded")).toBeVisible();
    await expect(page.getByText("1 pending · 1 failed")).toBeVisible();
    await expect(cleanUploadedButton).toBeDisabled();
  });

  test("recorder shows recovery guidance when microphone access is blocked", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Microphone denied coverage runs once on desktop.",
    );

    const title = `Playwright session mic denied ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const recorderUrl = page.url();

    const deniedBrowser = await chromium.launch({
      headless: true,
      args: ["--use-fake-device-for-media-stream"],
    });
    try {
      const deniedContext = await deniedBrowser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const recorder = await deniedContext.newPage();
      await recorder.goto(recorderUrl);
      await expect(
        recorder.getByRole("heading", { name: title }),
      ).toBeVisible();

      await recorder.getByRole("button", { name: /test microphone/i }).click();
      await expect(recorder.getByText("denied", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        recorder.getByText(/Microphone access is blocked/i),
      ).toBeVisible();
      await expect(
        recorder.getByRole("button", { name: /start recording/i }),
      ).toBeVisible();
      await deniedContext.close();
    } finally {
      await deniedBrowser.close();
    }
  });

  test("recorder shows microphone input health warnings", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Input health coverage runs once on desktop.",
    );

    const title = `Playwright session mic health ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const recorderUrl = page.url();

    async function openRecorderWithInput(mode: "silent" | "clipping") {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        permissions: ["microphone"],
      });
      await context.addInitScript((inputMode) => {
        const mediaDevices = navigator.mediaDevices ?? {};
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: mediaDevices,
        });
        Object.defineProperty(mediaDevices, "enumerateDevices", {
          configurable: true,
          value: async () => [
            {
              deviceId: `mock-${inputMode}`,
              groupId: "mock",
              kind: "audioinput",
              label:
                inputMode === "silent"
                  ? "Silent test microphone"
                  : "Clipping test microphone",
              toJSON() {
                return this;
              },
            },
          ],
        });
        Object.defineProperty(mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            const AudioContextCtor =
              window.AudioContext ||
              (window as Window & { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (!AudioContextCtor) throw new Error("AudioContext missing.");
            const audioContext = new AudioContextCtor();
            const destination = audioContext.createMediaStreamDestination();
            const nodes: AudioNode[] = [];
            if (inputMode === "clipping") {
              const oscillator = audioContext.createOscillator();
              const gain = audioContext.createGain();
              oscillator.frequency.value = 440;
              gain.gain.value = 20;
              oscillator.connect(gain);
              gain.connect(destination);
              oscillator.start();
              nodes.push(oscillator, gain);
            }
            await audioContext.resume();
            (
              window as Window & {
                __babbledeckMockAudio?: {
                  audioContext: AudioContext;
                  nodes: AudioNode[];
                };
              }
            ).__babbledeckMockAudio = { audioContext, nodes };
            return destination.stream;
          },
        });
      }, mode);
      const recorder = await context.newPage();
      await recorder.goto(recorderUrl);
      await expect(
        recorder.getByRole("heading", { name: title }),
      ).toBeVisible();
      return { context, recorder };
    }

    const silent = await openRecorderWithInput("silent");
    await silent.recorder
      .getByRole("button", { name: /test microphone/i })
      .click();
    await expect(silent.recorder.getByText("granted")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      silent.recorder.getByText("No input detected", { exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      silent.recorder.getByText(/make sure it is not muted/i),
    ).toBeVisible();
    await silent.context.close();

    const clipping = await openRecorderWithInput("clipping");
    await clipping.recorder
      .getByRole("button", { name: /test microphone/i })
      .click();
    await expect(clipping.recorder.getByText("granted")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      clipping.recorder.getByText("Clipping detected", { exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      clipping.recorder.getByText(/lower the input gain/i),
    ).toBeVisible();
    await clipping.context.close();
  });

  test("viewer shows provider error events without blocking local backup", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Provider error UI coverage runs once on desktop.",
    );

    const title = `Playwright session provider error ${Date.now()}`;
    const providerErrorText =
      "Realtime provider test error. Local backup continues.";

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const recorderUrl = page.url();
    const sessionId = new URL(recorderUrl).pathname.split("/")[2];
    const recorderToken = new URL(recorderUrl).searchParams.get("recorder");
    if (!recorderToken) throw new Error("Recorder token missing from URL.");
    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const viewer = await viewerContext.newPage();
    await viewer.goto(viewerUrl ?? "");
    await expect(
      viewer.getByRole("heading", { name: "Live captions" }),
    ).toBeVisible();
    await expect(viewer.getByText("SSE live")).toBeVisible({
      timeout: 25_000,
    });

    const response = await page.evaluate(
      async ({ sessionId, recorderToken, providerErrorText }) => {
        return fetch(`/api/sessions/${sessionId}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BabbleDeck-Recorder-Token": recorderToken,
          },
          body: JSON.stringify({
            events: [
              {
                type: "provider_error",
                text: providerErrorText,
                isFinal: true,
              },
            ],
          }),
        }).then(async (result) => ({
          ok: result.ok,
          body: await result.text(),
        }));
      },
      { sessionId, recorderToken, providerErrorText },
    );
    expect(response.ok, response.body).toBe(true);

    await expect(viewer.getByText("Provider issue")).toBeVisible({
      timeout: 12_000,
    });
    await expect(viewer.getByText(providerErrorText)).toBeVisible();

    await viewerContext.close();
  });

  test("viewer falls back to polling when the SSE stream is unavailable", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Viewer polling fallback coverage runs once on desktop.",
    );

    const title = `Playwright session polling fallback ${Date.now()}`;
    const originalText = "Polling fallback original.";
    const translationText = "轮询降级字幕。";

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const recorderUrl = page.url();
    const sessionId = new URL(recorderUrl).pathname.split("/")[2];
    const recorderToken = new URL(recorderUrl).searchParams.get("recorder");
    if (!recorderToken) throw new Error("Recorder token missing from URL.");
    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await viewerContext.route("**/api/viewer/session/**/stream**", (route) =>
      route.abort("failed"),
    );
    const viewer = await viewerContext.newPage();
    await viewer.goto(viewerUrl ?? "");
    await expect(
      viewer.getByRole("heading", { name: "Live captions" }),
    ).toBeVisible();
    await expect(viewer.getByText("Polling")).toBeVisible({
      timeout: 12_000,
    });

    const response = await page.evaluate(
      async ({ sessionId, recorderToken, originalText, translationText }) => {
        return fetch(`/api/sessions/${sessionId}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BabbleDeck-Recorder-Token": recorderToken,
          },
          body: JSON.stringify({
            events: [
              {
                type: "final_transcript",
                text: originalText,
                language: "en",
                targetLanguage: "zh",
                isFinal: true,
                segmentIndex: 0,
                startMs: 0,
                endMs: 1200,
              },
              {
                type: "final_translation",
                text: translationText,
                language: "en",
                targetLanguage: "zh",
                isFinal: true,
                segmentIndex: 0,
                startMs: 0,
                endMs: 1200,
              },
            ],
          }),
        }).then(async (result) => ({
          ok: result.ok,
          body: await result.text(),
        }));
      },
      { sessionId, recorderToken, originalText, translationText },
    );
    expect(response.ok, response.body).toBe(true);

    await expect(viewer.getByText(translationText)).toBeVisible({
      timeout: 12_000,
    });
    await expect(viewer.getByText(originalText)).toBeVisible();

    await viewerContext.close();
  });

  test("viewer and recorder show network reconnect states", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Network interruption coverage runs once on desktop.",
    );

    const title = `Playwright session network recovery ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByRole("button", { name: /create session/i }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });

    try {
      const viewer = await viewerContext.newPage();
      await viewer.goto(viewerUrl ?? "");
      await expect(
        viewer.getByRole("heading", { name: "Live captions" }),
      ).toBeVisible();
      await expect(viewer.getByText("SSE live")).toBeVisible({
        timeout: 12_000,
      });

      await viewerContext.setOffline(true);
      await expect(viewer.getByText("Offline", { exact: true })).toBeVisible({
        timeout: 5_000,
      });
      await expect(viewer.getByText(/captions will reconnect/i)).toBeVisible();

      await viewerContext.setOffline(false);
      await expect(viewer.getByText(/SSE live|Polling/)).toBeVisible({
        timeout: 12_000,
      });

      await page.context().setOffline(true);
      await expect(
        page.getByText(/local backup will stay on this device/i),
      ).toBeVisible({ timeout: 5_000 });

      await page.context().setOffline(false);
      await expect(
        page.getByText(/local backup will stay on this device/i),
      ).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await page.context().setOffline(false);
      await viewerContext.setOffline(false);
      await viewerContext.close();
    }
  });

  test("budget cap marks provider degraded while audio backup continues", async ({
    page,
  }) => {
    test.skip(
      !runBudgetTest,
      "Set E2E_RUN_BUDGET_TEST=true to run budget-cap coverage.",
    );

    const title = `Budget cap session ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("soniox");
    await page.getByLabel("Budget cap").fill("0.0001");
    await page.getByRole("button", { name: /create session/i }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Soniox realtime")).toBeVisible();

    await page.getByRole("button", { name: /test microphone/i }).click();
    await expect(page.getByText("granted")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(
      page.getByText("provider degraded", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Local backup continues\./)).toBeVisible();
    await expect(
      page.getByText(/[1-9][0-9]*\/[1-9][0-9]* uploaded/),
    ).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByText("WebSocket backup")).toBeVisible();

    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("provider degraded", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("soniox", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);
    await expect(page.getByText("Cost").locator("xpath=..")).toContainText(
      /\$0\.000[1-9]|\$0\.00[1-9]|\$0\.[1-9]/,
    );
  });

  test("livekit room audio connects recorder and viewer", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      !runLiveKitUiTest,
      "Set E2E_RUN_LIVEKIT_UI_TEST=true to run real LiveKit UI coverage.",
    );
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Real LiveKit UI smoke only runs once on desktop.",
    );

    const title = `LiveKit UI session ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    await page.getByLabel("Budget cap").fill("1.50");
    await page.getByRole("button", { name: /create session/i }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Mock realtime")).toBeVisible();
    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const viewer = await viewerContext.newPage();
    await viewer.goto(viewerUrl ?? "");
    await expect(
      viewer.getByRole("heading", { name: "Live captions" }),
    ).toBeVisible();
    await expect(viewer.getByText("SSE live")).toBeVisible({
      timeout: 25_000,
    });
    await expect(viewer.getByText(/Audio (ready|checking)/)).toBeVisible({
      timeout: 25_000,
    });

    await page.getByRole("button", { name: /test microphone/i }).click();
    await expect(page.getByText("granted")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(page.getByText("Publishing", { exact: true })).toBeVisible({
      timeout: 35_000,
    });
    await expect(viewer.getByText("Audio live")).toBeVisible({
      timeout: 60_000,
    });
    await expect(viewer.getByText(/final segments/i)).toBeVisible({
      timeout: 12_000,
    });

    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);

    await viewerContext.close();
  });

  test("soniox provider streams fake microphone speech into live captions", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      !runSonioxUiTest,
      "Set E2E_RUN_SONIOX_UI_TEST=true to run real Soniox UI coverage.",
    );
    test.skip(
      !fakeAudioFile,
      "Set E2E_FAKE_AUDIO_FILE to a WAV file for fake microphone capture.",
    );
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Real Soniox UI smoke only runs once on desktop.",
    );

    const title = sonioxSessionTitle();
    const expectedTexts = sonioxExpectedTexts();
    const recordSeconds = sonioxRecordSeconds();

    await page.goto("/");
    await page.getByRole("link", { name: /open portal/i }).click();
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Live sessions" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("soniox");
    await page.getByLabel("Budget cap").fill("1.50");
    await page.getByRole("button", { name: /create session/i }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Soniox realtime")).toBeVisible();
    const viewerUrl = await page
      .locator("aside p")
      .filter({ hasText: "/s/" })
      .textContent();
    expect(viewerUrl).toContain("/s/");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const viewer = await viewerContext.newPage();
    await viewer.goto(viewerUrl ?? "");
    await expect(
      viewer.getByRole("heading", { name: "Live captions" }),
    ).toBeVisible();
    await expect(viewer.getByText("SSE live")).toBeVisible({
      timeout: 25_000,
    });

    await page.getByRole("button", { name: /test microphone/i }).click();
    await expect(page.getByText("granted")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /start recording/i }).click();
    await expect(page.getByText("WebSocket backup")).toBeVisible({
      timeout: 15_000,
    });
    for (const expectedText of expectedTexts) {
      await expect(page.getByText(expectedText).first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(viewer.getByText(expectedText).first()).toBeVisible({
        timeout: 60_000,
      });
    }

    if (recordSeconds > 0) {
      await page.waitForTimeout(recordSeconds * 1000);
    }

    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    for (const expectedText of expectedTexts) {
      await expect(page.getByText(expectedText).first()).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);

    await viewerContext.close();
  });
});
