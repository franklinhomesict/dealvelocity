import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("redirects unauthenticated users and rejects bad passwords", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/);
  await page.fill("#email", "owner@homebuyersict.test");
  await page.fill("#password", "wrong-password");
  await page.click("button[type=submit]");
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("dashboard shows real metrics, attention items and pipeline", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Active leads", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs your attention")).toBeVisible();
  await expect(page.getByText(/waiting for a callback/).first()).toBeVisible();
  await expect(page.getByText("Acquisition pipeline")).toBeVisible();
  await expect(page.getByText("Recent opportunities")).toBeVisible();
});

test("completing an attention item removes it", async ({ page }) => {
  await login(page);
  const item = page.locator("li", { hasText: "Harold Jennings is waiting for a callback" });
  await item.getByRole("button", { name: "Mark called" }).click();
  await expect(page.getByText("Callback marked complete")).toBeVisible();
  await expect(item).toHaveCount(0);
});

test("command palette searches properties and navigates", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog", { name: "Command menu" }).getByLabel("Search").fill("Seneca");
  await page.getByRole("option", { name: /1418 S Seneca St/ }).click();
  await expect(page.getByRole("heading", { name: "1418 S Seneca St" })).toBeVisible();
});

test("quick add creates a property and dedupes the address", async ({ page }) => {
  await login(page);
  for (const expectExisting of [false, true]) {
    await page.goto("/");
    await page.getByRole("button", { name: "Add property" }).click();
    await page.fill("#qa-street", "999 N Testing Ave");
    await page.fill("#qa-zip", "67203");
    await page.fill("#qa-seller", "Test Seller");
    await page.fill("#qa-ask", "80000");
    await page.getByRole("button", { name: "Add property" }).last().click();
    await expect(page.getByRole("heading", { name: "999 N Testing Ave" })).toBeVisible();
    if (expectExisting) await expect(page.getByText("already exists")).toBeVisible();
  }
});

test("leads table filters, sorts and opens the slide-out drawer", async ({ page }) => {
  await login(page);
  await page.goto("/leads");
  await page.getByRole("button", { name: "Hot", exact: true }).first().click();
  await expect(page).toHaveURL(/temp=hot/);
  await page.getByLabel("Filter leads").fill("Funston");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").first().click();
  const drawer = page.getByRole("dialog", { name: /Lead 4515 E Funston St/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Max allowable offer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

test("inline edit of asking price persists", async ({ page }) => {
  await login(page);
  await page.goto("/leads?q=Funston");
  await page.locator("tbody tr").first().click();
  await page.getByRole("button", { name: "Edit asking price" }).click();
  await page.getByLabel("asking price").fill("71500");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText("$71,500");
});

test("stage change is blocked to contract without approved offer", async ({ page }) => {
  await login(page);
  await page.goto("/leads?q=Kinkaid");
  await page.locator("tbody tr").first().getByRole("button", { name: /New/ }).click();
  await page.getByRole("menuitem", { name: "Under contract" }).click();
  await expect(page.getByText("requires an owner-approved offer")).toBeVisible();
  await page.locator("tbody tr").first().getByRole("button", { name: /New/ }).click();
  await page.getByRole("menuitem", { name: "Contacting" }).click();
  await expect(page.getByText("Moved to Contacting")).toBeVisible();
});

test("underwriting scenario recalculates live and saves a versioned analysis", async ({ page }) => {
  await login(page);
  await page.goto("/leads?q=Seneca");
  await page.locator("tbody tr").first().getByRole("link").click();
  const mao = page.locator("text=Max allowable offer").locator("..").locator("div").nth(1);
  const before = await mao.textContent();
  await page.fill("#an-arv", "160,000");
  await expect(mao).not.toHaveText(before!);
  await expect(page.getByText("Unsaved scenario")).toBeVisible();
  await page.getByRole("button", { name: "Save analysis" }).click();
  await expect(page.getByText("Analysis saved")).toBeVisible();
  await expect(page.getByText(/Underwriting saved/).first()).toBeVisible();
});

test("owner approves a pending offer", async ({ page }) => {
  await login(page);
  await page.goto("/offers");
  await page.getByRole("link", { name: /2231 N Volutsia Ave/ }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Offer approved (not sent)")).toBeVisible();
});

test("notes are added to the activity timeline", async ({ page }) => {
  await login(page);
  await page.goto("/leads?q=Laura");
  await page.locator("tbody tr").first().getByRole("link").click();
  await page.getByLabel("New note").fill("Seller confirmed roof replaced in 2019.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Seller confirmed roof replaced in 2019.")).toBeVisible();
});

test("future-phase screens are clearly marked unavailable", async ({ page }) => {
  await login(page);
  await page.goto("/conversations");
  await expect(page.getByText("Phase 4 · not yet available")).toBeVisible();
});

test("health endpoint reports database status", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBeTruthy();
  expect((await r.json()).db).toBe("ok");
});
