import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

async function estimate(page: Page, name: string) {
  await page.goto("/prospecting");
  await page.getByRole("tab", { name: "Search · paid" }).click();
  await page.locator("#ib-zip").fill("67213");
  await page.keyboard.press("Enter");
  await page.fill("#ib-name", name);
  await page.fill("#ib-max", "40");
  await page.getByRole("button", { name: "Count & estimate" }).click();
  await expect(page.getByText(/40 matching · up to 40 credits/)).toBeVisible();
  return page.locator("tr", { hasText: name });
}

test("paid search requires paid mode, owner approval, then imports with credit tracking", async ({ page, request }) => {
  await request.get("http://localhost:4010/__reset");
  await login(page);
  await page.goto("/prospecting");
  await expect(page.getByText("DealMachine connected")).toBeVisible();

  const row = await estimate(page, "Vacant SFR test");
  await expect(row.getByText("Awaiting approval")).toBeVisible();
  await row.getByRole("button", { name: "Approve 40 credits" }).click();
  await expect(page.getByText("Paid DealMachine requests are switched off")).toBeVisible();

  await page.getByLabel("Paid requests").selectOption("true");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Paid requests enabled within budget")).toBeVisible();

  await row.getByRole("button", { name: "Approve 40 credits" }).click();
  await expect(row.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("40 new");
  await expect(row).toContainText("40 / 40");
  await page.reload();
  await expect(page.getByText("Spent by this app").locator("..")).toContainText("40");
});

test("re-running the same search is idempotent and DealMachine dedupes credits", async ({ page }) => {
  await login(page);
  const row = await estimate(page, "Vacant SFR rerun");
  await row.getByRole("button", { name: "Approve 40 credits" }).click();
  await expect(row.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("0 new");
  await expect(row).toContainText("40 updated");
  await expect(row).toContainText("0 / 40");
});

test("saved list import is free and creates leads for review", async ({ page }) => {
  await login(page);
  await page.goto("/prospecting");
  await page.getByLabel("DealMachine list").selectOption({ label: "🔥 Mock BRRRR list · 12" });
  await page.getByRole("button", { name: "Prepare import" }).click();
  await expect(page.getByText("List import ready — no credits required")).toBeVisible();
  const row = page.locator("tr", { hasText: "List · 🔥 Mock BRRRR list" });
  await row.getByRole("button", { name: "Start import" }).click();
  await expect(row.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText("12 new");
  await page.goto("/leads?q=2200+E+Lincoln");
  await expect(page.locator("tbody tr").first()).toContainText("New");
});

test("enrich and comps on a property, then apply comps ARV to the scenario", async ({ page }) => {
  await login(page);
  await page.goto("/properties?q=1800+S+Millwood");
  await page.getByRole("link", { name: /1800 S Millwood St/ }).first().click();
  const panel = page.locator("#dealmachine");
  await panel.getByRole("button", { name: /Enrich|Refresh/ }).click();
  await page.getByRole("button", { name: "Use 1 credit" }).click();
  await expect(page.getByText(/^Enriched/).first()).toBeVisible();
  await panel.getByRole("button", { name: "Pull comps" }).click();
  await page.getByRole("button", { name: "Use 1 credit" }).click();
  await expect(page.getByText("6 comparables loaded")).toBeVisible();
  await expect(panel.getByText("Comps-based ARV")).toBeVisible();
  await panel.getByRole("button", { name: "Use as ARV" }).click();
  await expect(page.locator("#an-arv")).not.toHaveValue("");
  await expect(page.getByText("Unsaved scenario")).toBeVisible();
});

test("webhook rejects bad signatures and processes each event once", async ({ request }) => {
  const body = JSON.stringify({
    events: [{ id: "evt_e2e_1", type: "prospect.added", occurred_at: new Date().toISOString(), data: { prospect: { record_type: "property", record_id: "prop_90300", record: { address: "3000 S Webhook St", city: "Wichita", state: "KS", zip: "67213" } } } }],
  });
  const bad = await request.post("/api/webhooks/dealmachine", { data: body, headers: { "content-type": "application/json", "x-dealmachine-signature": "deadbeef" } });
  expect(bad.status()).toBe(401);
  const sig = createHmac("sha256", "whsec_test").update(body).digest("hex");
  const ok = await request.post("/api/webhooks/dealmachine", { data: body, headers: { "content-type": "application/json", "x-dealmachine-signature": sig } });
  expect(await ok.json()).toMatchObject({ ok: true, stored: 1, processed: 1 });
  const again = await request.post("/api/webhooks/dealmachine", { data: body, headers: { "content-type": "application/json", "x-dealmachine-signature": sig } });
  expect(await again.json()).toMatchObject({ ok: true, stored: 0, duplicates: 1 });
});
