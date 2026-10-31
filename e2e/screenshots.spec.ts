import { test, type Page } from "@playwright/test";
import { login } from "./helpers";

const OUT = "docs/screenshots";
async function snap(page: Page, path: string, name: string, h = 900) {
  await page.setViewportSize({ width: 1440, height: h });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test("capture review screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await snap(page, "/", "01-dashboard", 1100);
  await page.goto("/leads?q=Seneca");
  const href = await page.locator("tbody tr a").first().getAttribute("href");
  await snap(page, href!, "02-property-detail", 1500);
  await snap(page, "/leads", "03-leads");
  await page.locator("tbody tr").nth(2).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-lead-drawer.png` });
  await snap(page, "/pipeline", "05-pipeline");
  await snap(page, "/underwriting", "06-underwriting");
  await snap(page, "/conversations", "07-conversations-planned");
  await snap(page, "/contracts", "08-contracts-planned");
  await snap(page, "/transactions", "09-transactions");
  await snap(page, "/settings", "10-settings", 1100);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/11-mobile-dashboard.png` });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/12-mobile-navigation.png` });
  await page.goto(href!, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/13-mobile-property.png` });
  await page.context().addCookies([{ name: "aos_theme", value: "light", url: "http://localhost:3100" }]);
  await snap(page, "/", "14-dashboard-light", 1100);
});
