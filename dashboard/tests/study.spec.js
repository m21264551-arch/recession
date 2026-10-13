import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const study = JSON.parse(fs.readFileSync("public/api/study.json", "utf8"));
test("historical estimates and metrics match the snapshot, incomplete horizons stay unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Selected month").fill("2019-08");
  const row = study.rows.find((r) => r.date === "2019-08-01");
  await expect(page.locator(".selected h2")).toHaveText(
    `${(row.prediction.scores.logistic * 100).toFixed(1)}%`,
  );
  await page
    .getByLabel("Selected month")
    .fill(study.rows.at(-1).date.slice(0, 7));
  await expect(
    page.getByRole("heading", { name: "Estimate unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("cell", {
        name: "Spread-only logistic",
        exact: true,
      }),
    }),
  ).toContainText(study.models.logistic.metrics.brier.toFixed(3));
  await page.getByLabel("Inspect model").selectOption("boosting");
  await page.getByText("Inspect false-alarm months").click();
  await expect(
    page.getByRole("heading", { name: /False alarms and misses/ }),
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
    await page.getByLabel("Selected month").waitFor();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Results", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

test("month input, buttons, keyboard cursor and chart pointer share one selection", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Selected month", { exact: true });
  await input.fill("2019-08");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(input).toHaveValue("2019-09");
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(input).toHaveValue("2019-08");
  await page.getByLabel("Inspect historical month").press("ArrowLeft");
  await expect(input).toHaveValue("2019-07");
  await page
    .getByRole("img", { name: /10-year minus/ })
    .click({ position: { x: 150, y: 80 } });
  await expect(input).not.toHaveValue("2019-07");
  const selected = await input.inputValue();
  const row = study.rows.find((r) => r.date === selected + "-01");
  await expect(page.locator(".selected h2")).toHaveText(
    `${(row.prediction.scores.logistic * 100).toFixed(1)}%`,
  );
  await input.fill(study.rows.at(-1).date.slice(0, 7));
  await expect(
    page.getByRole("button", { name: "Next month", exact: true }),
  ).toBeDisabled();
});
