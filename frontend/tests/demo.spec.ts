import { test, expect, Page } from "@playwright/test";

const errs: string[] = [];
test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => errs.push(e.message));
});
test.afterEach(() => {
  expect(errs, errs.join("\n")).toHaveLength(0);
  errs.length = 0;
});

async function shot(page: Page, name: string) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-shots/${name}.png` });
}

// ---- ACT 1: NowCast — tap a trigger, build cart, order --------------------
test("Act 1 — NowCast triggers build the cart, then order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("3 things we lined up for you")).toBeVisible();
  await expect(page.getByText("For tonight's dinner party")).toBeVisible();
  await shot(page, "act1-01-nowcast");

  // open the dinner-party trigger and add its items
  await page.getByRole("button", { name: /Prepare cart/ }).click();
  await expect(page.getByRole("button", { name: /Add \d+ items to cart/ })).toBeVisible();
  await shot(page, "act1-02-expanded");
  await page.getByRole("button", { name: /Add \d+ items to cart/ }).click();
  await expect(page.getByText(/Added \d+ items to cart/)).toBeVisible();
  await shot(page, "act1-03-added");

  // go to cart via the floating bar
  await page.getByRole("button", { name: /View cart/ }).click();
  await expect(page).toHaveURL(/checkout/);
  await expect(page.getByText(/Arriving in/)).toBeVisible();
  await shot(page, "act1-04-checkout");

  await page.getByRole("button", { name: /Pay .* Face ID/ }).click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 8000 });
  await expect(page.getByText("Order confirmed!")).toBeVisible();
  await shot(page, "act1-05-confirmed");
});

// ---- ACT 2: NowSpeak — vegan guest intent ---------------------------------
test("Act 2 — NowSpeak resolves a novel intent", async ({ page }) => {
  await page.goto("/nowspeak");
  await expect(page.getByText("What do you need?")).toBeVisible();
  await shot(page, "act2-01-speak-empty");

  await page.getByRole("button", { name: /vegan/ }).click();
  // streamed reply + result card with add-all
  await expect(page.getByText(/Vegan ✓/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /Add all/ })).toBeVisible();
  await shot(page, "act2-02-speak-result");
});

test("Act 2b — NowSpeak carbonara recipe scaling", async ({ page }) => {
  await page.goto("/nowspeak");
  await page.getByRole("button", { name: /carbonara/ }).click();
  await expect(page.getByRole("button", { name: /Add all/ })).toBeVisible({ timeout: 10000 });
  await shot(page, "act2-03-carbonara");
});

// ---- Group cart: create → family fills live → checkout together -----------
test("Group cart — create, family joins live, combine", async ({ page }) => {
  await page.goto("/group");
  await expect(page.getByText("One cart, the whole family")).toBeVisible();
  await shot(page, "group-01-entry");

  await page.getByRole("button", { name: /Create & invite/ }).click();
  await expect(page).toHaveURL(/\/group\/FAM/);
  // share sheet auto-opens
  await expect(page.getByText(/Cart code/)).toBeVisible();
  await shot(page, "group-02-share");
  await page.locator(".bg-black\\/50").click({ position: { x: 10, y: 10 } });

  // family members stream in and the cart fills
  await page.waitForTimeout(7500);
  await expect(page.getByText("Mom", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Checkout together/ })).toBeVisible();
  await shot(page, "group-03-filled");

  await page.getByRole("button", { name: /Checkout together/ }).click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 8000 });
  await expect(page.getByText("Order confirmed!")).toBeVisible();
  await shot(page, "group-04-confirmed");
});

// ---- Supporting: recipes + search -----------------------------------------
test("Recipes gallery + scaling", async ({ page }) => {
  await page.goto("/recipes");
  await expect(page.getByText("Cook something tonight")).toBeVisible();
  await shot(page, "extra-01-recipes");
  await page.locator("a[href^='/recipe/']").first().click();
  await expect(page.getByText(/Ingredients · scaled/)).toBeVisible({ timeout: 8000 });
  await shot(page, "extra-02-recipe-detail");
});

test("Search + category", async ({ page }) => {
  await page.goto("/search?category=medicine_health");
  await expect(page.getByText(/items/)).toBeVisible();
  await shot(page, "extra-03-search");
});
