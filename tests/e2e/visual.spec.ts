import { expect, test } from "@playwright/test";
for (const viewport of [
  { width: 1586, height: 992 },
  { width: 390, height: 844 },
]) {
  test(`four design pages at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const apiCalls: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        apiCalls.push(request.url());
    });
    for (const [path, selector, name] of [
      ["/today", ".today-hero", "today"],
      ["/books", ".library-grid", "library"],
      ["/learn", ".memory-title", "memory"],
      ["/dictation", ".spelling-field", "dictation"],
    ]) {
      await page.goto(path!);
      await expect(page.locator(selector!)).toBeVisible();
      await page.waitForTimeout(850);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/v2-${name}-${viewport.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(apiCalls).toEqual([]);
  });
}
test("keyboard memory, native spelling and preferences", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.locator(".memory-title h1")).toHaveText("abandon");
  await page.keyboard.press("3");
  await expect(page.locator(".recall-known")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".memory-title h1")).toHaveText("absorb");
  await page.goto("/dictation");
  await page.getByLabel("输入英文拼写").fill("abandon");
  await expect(page.locator(".spelling-correct")).toBeVisible();
  await page.getByRole("button", { name: "下一个词" }).click();
  await expect(page.locator(".dictation-meaning")).toContainText("吸收");
  await page.getByRole("button", { name: "打开偏好设置" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("reduced motion and library empty state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/books");
  await page.getByRole("searchbox", { name: "搜索词书" }).fill("不存在的词书");
  await expect(page.locator(".library-empty")).toBeVisible();
  const duration = await page
    .locator(".main-nav")
    .evaluate(
      (element) =>
        getComputedStyle(element.querySelector(".nav-indicator")!)
          .transitionDuration,
    );
  expect(parseFloat(duration)).toBeLessThan(0.01);
});
