import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("accessibility source contracts", () => {
  it("keeps a single main landmark and a zoomable viewport", async () => {
    const html = await source("client/index.html");
    const home = await source("client/src/pages/Home.tsx");
    const layout = await source("client/src/components/DashboardLayout.tsx");
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain("maximum-scale=1");
    expect(home).toContain("<main className=\"login-screen\">");
    expect(layout).toContain("id=\"main-content\"");
  });

  it("keeps visible keyboard focus and reduced-motion support", async () => {
    const css = await source("client/src/index.css");
    expect(css).toContain(":focus-visible");
    expect(css).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    expect(css).toContain("scroll-margin");
  });

  it("keeps dynamic errors and controls exposed to assistive technology", async () => {
    const home = await source("client/src/pages/Home.tsx");
    expect(home).toMatch(/role=\"alert\"|aria-live=/);
    expect(home).toMatch(/aria-label=\"[^\"]+\"/);
    expect(home).toContain("aria-invalid");
  });
});
