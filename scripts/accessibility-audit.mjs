import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.A11Y_URL ?? "http://127.0.0.1:3000/";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
try {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  const results = await new AxeBuilder({ page }).analyze();
  const report = {
    url,
    title: await page.title(),
    capturedAt: new Date().toISOString(),
    violationCount: results.violations.length,
    violations: results.violations.map(({ id, impact, help, helpUrl, nodes }) => ({
      id,
      impact,
      help,
      helpUrl,
      nodeCount: nodes.length,
      targets: nodes.map((node) => node.target),
    })),
    note: "This automated run uses the unauthenticated preview surface unless A11Y_URL is provided with an authenticated test harness.",
  };
  await mkdir("docs/verification", { recursive: true });
  await writeFile("docs/verification/axe-result.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (results.violations.some((violation) => violation.impact === "critical" || violation.impact === "serious")) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
