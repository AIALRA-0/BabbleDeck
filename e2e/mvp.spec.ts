import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid";
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const rotatedAdminPassword = process.env.E2E_NEW_ADMIN_PASSWORD;
const runBudgetTest = process.env.E2E_RUN_BUDGET_TEST === "true";
const runSonioxUiTest = process.env.E2E_RUN_SONIOX_UI_TEST === "true";
const fakeAudioFile = process.env.E2E_FAKE_AUDIO_FILE;

function sonioxExpectedText() {
  return new RegExp(process.env.E2E_SONIOX_EXPECTED_TEXT ?? "Brooklyn", "i");
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

test.describe("BabbleDeck MVP browser flow", () => {
  test.skip(
    !adminPassword,
    "E2E_ADMIN_PASSWORD must be set for browser login.",
  );

  test("admin creates a live session, viewer receives captions, and export downloads", async ({
    browser,
    page,
  }) => {
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

    await page
      .getByRole("link", { name: /new live session/i })
      .first()
      .click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Target language").selectOption("zh");
    await page.getByLabel("Provider").selectOption("mock");
    const createButton = page.getByRole("button", { name: /create session/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
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
      viewport: { width: 900, height: 900 },
      permissions: ["microphone"],
    });
    const recorder = await recorderContext.newPage();
    await recorder.goto(recorderUrl);
    await expect(recorder.getByRole("heading", { name: title })).toBeVisible();
    await expect(recorder.getByRole("link", { name: /history/i })).toHaveCount(
      0,
    );
    await expect(
      recorder.locator("aside p").filter({ hasText: "/s/" }),
    ).toHaveText(viewerUrl ?? "");

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

    await recorder.getByRole("button", { name: /test microphone/i }).click();
    await expect(recorder.getByText("granted")).toBeVisible({
      timeout: 10_000,
    });

    await recorder.getByRole("button", { name: /start recording/i }).click();
    await expect(recorder.getByText("Mock realtime")).toBeVisible();
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

    await recorder.getByRole("button", { name: /stop recording/i }).click();
    await expect(
      recorder.getByRole("button", { name: /start recording/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Transcript timeline" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);
    await expect(
      page.getByText("Audio processed").locator("xpath=.."),
    ).toContainText(/0:0[1-9]|0:[1-9][0-9]|[1-9][0-9]*:/);
    await expect(page.getByText("欢迎使用 BabbleDeck")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /markdown/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.markdown$/);

    await recorderContext.close();
    await viewerContext.close();
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

    const title = `Soniox UI session ${Date.now()}`;
    const expectedText = sonioxExpectedText();

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
    await expect(page.getByText(expectedText).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(viewer.getByText(expectedText).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(expectedText).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("Backup chunks").locator("xpath=.."),
    ).toContainText(/[1-9]/);

    await viewerContext.close();
  });
});
