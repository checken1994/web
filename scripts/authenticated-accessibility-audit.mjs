import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

const baseUrl = process.env.A11Y_BASE_URL ?? "http://127.0.0.1:3000";
const storageState = process.env.A11Y_STORAGE_STATE;
const outputPath = process.env.A11Y_OUTPUT ?? "reports/accessibility/authenticated.json";
const routes = ["overview", "sessions", "agents", "models", "artifacts", "jobs", "audit"];

if (!storageState) {
  throw new Error("A11Y_STORAGE_STATE is required; refusing to claim authenticated coverage without an external session state.");
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const section of routes) {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?section=${section}`, { waitUntil: "networkidle" });
    await page.locator("#main-content").waitFor({ state: "attached" });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const focus = await page.evaluate(() => {
      const controls = [...document.querySelectorAll("a,button,input,select,textarea,[tabindex]")]
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("tabindex") !== "-1" && Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length));
      const unnamed = controls.filter((element) => {
        const labelled = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.textContent?.trim() || element.getAttribute("placeholder");
        if (element instanceof HTMLInputElement && element.id) {
          return !labelled && !document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        }
        return !labelled;
      });
      const positiveTabIndex = controls.filter((element) => element.tabIndex > 0);
      return { tabbableCount: controls.length, unnamedCount: unnamed.length, positiveTabIndexCount: positiveTabIndex.length };
    });
    const reducedMotion = await page.evaluate(() => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      return { mediaMatches: media.matches, hasReducedMotionRule: [...document.styleSheets].some((sheet) => { try { return [...sheet.cssRules].some((rule) => rule.conditionText?.includes("prefers-reduced-motion")); } catch { return false; } }) };
    });
    results.push({ section, violations: axe.violations, incomplete: axe.incomplete, passes: axe.passes.length, focus, reducedMotion });
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.mkdir(new URL(".", `file://${process.cwd()}/${outputPath}`).pathname, { recursive: true }).catch(() => {});
await fs.writeFile(outputPath, JSON.stringify({ baseUrl, routes, results }, null, 2));
const failures = results.flatMap(({ section, violations, focus }) => [
  ...violations.map((violation) => `${section}: axe ${violation.id}`),
  ...(focus.unnamedCount ? [`${section}: unnamed=${focus.unnamedCount}`] : []),
  ...(focus.positiveTabIndexCount ? [`${section}: positiveTabIndex=${focus.positiveTabIndexCount}`] : []),
]);
if (failures.length) throw new Error(`Authenticated accessibility audit failed: ${failures.join(", ")}`);
console.log(JSON.stringify({ routes: results.length, failures: 0, outputPath }));
