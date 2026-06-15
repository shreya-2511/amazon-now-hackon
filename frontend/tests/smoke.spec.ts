import { test, expect } from "@playwright/test";

test("home / NowCast renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("NowCast")).toBeVisible();
  await expect(page.getByText("3 things we lined up for you")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /Prepare cart/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-shots/01-home.png", fullPage: true });
  expect(errors, errors.join("\n")).toHaveLength(0);
});
