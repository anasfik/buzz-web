import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`Nusuk welcome ${colorScheme} at ${width}px`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/config.json", (route) =>
        route.fulfill({
          json: { communityName: "Nusuk Buzz", relayUrl: "wss://relay.example.com", agents: [] },
        }),
      );
      await page.goto("/");
      await expect(page).toHaveTitle("Nusuk Buzz");
      await expect(page.getByRole("heading", { name: "Nusuk Buzz" })).toBeVisible();
      await expect(
        page.getByText("A calm place for your circles. Your key, your identity."),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveClass(colorScheme);
      await expect(page.getByRole("button", { name: "Use NIP-07 extension" })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Use NIP-07 extension" })).toBeFocused();
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Create a Nusuk Buzz identity" }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath("welcome-create.png"), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [320, 390]) {
  test(`Nusuk welcome remains reachable at ${width}x480`, async ({ page }) => {
    await page.setViewportSize({ width, height: 480 });
    await page.route("**/config.json", (route) =>
      route.fulfill({
        json: { communityName: "Nusuk Buzz", relayUrl: "wss://relay.example.com", agents: [] },
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page
        .locator(".nusuk-identity-surface > main")
        .evaluate((el) => el.getBoundingClientRect().top),
    ).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole("heading", { name: "Nusuk Buzz", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("Nusuk welcome preserves Chinese copy on mobile", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.route("**/config.json", (route) =>
    route.fulfill({
      json: { communityName: "Nusuk Buzz", relayUrl: "wss://relay.example.com", agents: [] },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("让圈子安心交流。密钥在手，身份自主。")).toBeVisible();
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await expect(page.getByRole("heading", { name: "创建 Nusuk Buzz 身份" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
