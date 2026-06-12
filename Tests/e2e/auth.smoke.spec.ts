import { expect, test } from "@playwright/test";

test("root redirects to the public sign-in page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("sign-in form validates credentials without a network call", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByPlaceholder("you@company.com");
  await email.fill("not-an-email");
  expect(await email.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);

  await email.fill("user@example.com");
  await page.getByPlaceholder("••••••••").fill("short");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});

test("account creation validates password confirmation", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Create account" }).first().click();
  await page.getByPlaceholder("you@company.com").fill("user@example.com");
  await page.getByPlaceholder("••••••").first().fill("password-one");
  await page.getByPlaceholder("••••••").last().fill("password-two");
  await page.getByRole("button", { name: "Create account" }).last().click();

  await expect(page.getByText("Passwords do not match")).toBeVisible();
});
