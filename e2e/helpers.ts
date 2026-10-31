import type { Page } from "@playwright/test";
export async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "owner@homebuyersict.test");
  await page.fill("#password", "acquisition-os-dev");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}
