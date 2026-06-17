import { expect, test, type Page } from "@playwright/test";

async function openLogin(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("landing page links to the public sign-in page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Email, distilled/ })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator("form").getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("sign-in form validates credentials without a network call", async ({ page }) => {
  await openLogin(page);
  const email = page.getByPlaceholder("you@company.com");
  await email.fill("not-an-email");
  expect(await email.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);

  await email.fill("user@example.com");
  await page.getByPlaceholder("••••••••").fill("short");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});

test("account creation validates password confirmation", async ({ page }) => {
  await openLogin(page);
  await page.getByRole("tab", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByPlaceholder("you@company.com").fill("user@example.com");
  await page.getByPlaceholder("••••••").first().fill("password-one");
  await page.getByPlaceholder("••••••").last().fill("password-two");
  await page.getByRole("button", { name: "Create account" }).last().click();

  await expect(page.getByText("Passwords do not match")).toBeVisible();
});
