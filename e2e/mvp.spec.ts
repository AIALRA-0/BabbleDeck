import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid";
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const rotatedAdminPassword = process.env.E2E_NEW_ADMIN_PASSWORD;

async function signIn(page: Page) {
  const passwords = [adminPassword, rotatedAdminPassword].filter(
    (value): value is string => Boolean(value),
  );

  for (const password of passwords) {
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(password);
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
    await signInButton.click();

    const destination = await Promise.race([
      page
        .waitForURL(/\/(dashboard|account\/password)(\?|$)/, {
          timeout: 5_000,
        })
        .then(() => "signed-in" as const)
        .catch(() => null),
      page
        .getByText("Sign-in failed. Check your credentials and try again.")
        .waitFor({ timeout: 5_000 })
        .then(() => "failed" as const)
        .catch(() => null),
    ]);

    if (destination === "signed-in") {
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
    await expect(page.getByText("Viewer link", { exact: true })).toBeVisible();
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
    await expect(page.getByText("Mock realtime")).toBeVisible();
    await expect(
      page.getByText(/[1-9][0-9]*\/[1-9][0-9]* uploaded/),
    ).toBeVisible({
      timeout: 12_000,
    });
    await expect(viewer.getByText("欢迎使用 BabbleDeck")).toBeVisible({
      timeout: 12_000,
    });
    await expect(viewer.getByText(/final segments/i)).toBeVisible();

    await page.getByRole("button", { name: /stop recording/i }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 20_000 });
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

    await viewerContext.close();
  });
});
