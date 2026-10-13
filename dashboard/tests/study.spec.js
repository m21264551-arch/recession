import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const study = JSON.parse(fs.readFileSync("public/api/study.json", "utf8"));
test("historical estimates and metrics match the snapshot, incomplete horizons stay unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Selected month", {exact:true}).fill("2019-08");
  const row = study.rows.find((r) => r.date === "2019-08-01");
  await expect(page.locator(".selected h2")).toHaveText(
    `${(row.prediction.scores.logistic * 100).toFixed(1)}%`,
  );
  await page
    .getByLabel("Selected month", {exact:true})
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
  await page.getByRole("link", {name:"How to use",exact:true}).click();
  await expect(page.getByRole("heading", {name:"How to use Yield Curve Study",exact:true})).toBeVisible();
});
for (const width of [1440, 390])
  test(`historical study accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByLabel("Selected month", {exact:true}).waitFor();
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

test("guide navigation keeps the current selection", async ({page})=>{
  await page.goto("/?source=portfolio");
  await page.getByLabel("Selected month",{exact:true}).fill("2007-08");
  await page.getByRole("link",{name:"How to use",exact:true}).click();
  await expect(page.getByRole("heading",{name:"How to use Yield Curve Study",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Back to tool ↑"}).click();
  expect(new URL(page.url()).search).toBe("?source=portfolio");
  await expect(page.getByLabel("Selected month",{exact:true})).toHaveValue("2007-08");
});

test("dragging and keyboard inspection keep both markers aligned",async({page})=>{
 await page.goto('/'); const input=page.getByLabel('Selected month',{exact:true}); await input.waitFor();
 const chart=page.getByRole('img',{name:/10-year minus/}); const box=await chart.boundingBox();
 await page.mouse.move(box.x+100,box.y+70);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+70,{steps:8});await page.mouse.up();
 const date=await input.inputValue(); const row=study.rows.find(r=>r.date===date+'-01');
 await expect(page.locator('.selected h2')).toHaveText(`${(row.prediction.scores.logistic*100).toFixed(1)}%`);
 const markers=await page.locator('.date-marker > line').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('x1')));
 expect(markers[0]).toBe(markers[1]);
 await chart.press('ArrowRight');await expect(input).not.toHaveValue(date);
 const before=await input.inputValue();
 await chart.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:5,clientX:box.x+100,clientY:box.y+70});
 await chart.dispatchEvent('pointermove',{pointerType:'touch',pointerId:5,clientX:box.x+103,clientY:box.y+120});
 await chart.dispatchEvent('pointerup',{pointerType:'touch',pointerId:5,clientX:box.x+103,clientY:box.y+120});
 await expect(input).toHaveValue(before);
 expect(await chart.evaluate(el=>getComputedStyle(el).touchAction)).toBe('pan-y');
});

test("an error month opens its chart without changing the model",async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Results',exact:true}).click();
 await page.getByLabel('Inspect model').selectOption('boosting');
 await page.getByText('Inspect false-alarm months',{exact:true}).click();
 const date=study.errors.boosting.falseAlarmMonths[0];
 const label=new Date(date+'T00:00:00Z').toLocaleDateString('en-AU',{month:'short',year:'numeric',timeZone:'UTC'});
 await page.getByRole('button',{name:label,exact:true}).click();
 await expect(page.getByLabel('Selected month',{exact:true})).toHaveValue(date.slice(0,7));
 await expect(page.getByRole('combobox',{name:'Model',exact:true})).toHaveValue('boosting');
 await expect(page.getByRole('combobox',{name:'Chart period',exact:true})).toHaveValue('1953');
 await expect(page.getByLabel('Selected month',{exact:true})).toBeFocused();
});

for(const [width,height] of [[1280,720],[800,900],[390,844]]) test(`selected estimate and chart at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');await page.getByLabel('Selected month',{exact:true}).waitFor();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 const chart=await page.locator('.history svg').first().boundingBox();expect(chart.y).toBeLessThan(height-120);
 if(width<760) expect((await page.locator('.selected').boundingBox()).y).toBeLessThan(chart.y);
 await page.screenshot({path:`../../../outputs/refined-yieldcurve-${width}.png`});
});
