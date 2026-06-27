import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const study = JSON.parse(fs.readFileSync("public/api/study.json", "utf8"));
test("historical estimates and metrics match the snapshot, incomplete horizons stay unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Selected historical month").selectOption("2019-08-01");
  const row = study.rows.find((r) => r.date === "2019-08-01");
  await expect(page.locator(".selected h2")).toHaveText(
    `${(row.prediction.scores.logistic * 100).toFixed(1)}%`,
  );
  await page
    .getByLabel("Selected historical month")
    .selectOption(study.rows.at(-1).date);
  await expect(
    page.getByRole("heading", { name: "Estimate unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Backtest", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", {
          name: "Spread-only logistic",
          exact: true,
        }),
      }),
  ).toContainText(study.models.logistic.metrics.brier.toFixed(3));
  await page.getByLabel("Inspect model").selectOption("boosting");
  await page.getByText("Inspect false-alarm months").click();
  await expect(
    page.getByRole("heading", { name: /Failures are part/ }),
  ).toBeVisible();
});
test("missing snapshot produces an explicit recovery state", async ({
  page,
}) => {
  await page.route("**/api/study.json", (r) => r.abort());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Retry snapshot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Estimate unavailable" }),
  ).toHaveCount(0);
});
for (const width of [1440, 390])
  test(`historical study accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByLabel("Selected historical month").waitFor();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Backtest", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
