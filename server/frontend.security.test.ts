import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const browserRoots = [
  join(projectRoot, "client", "src"),
  join(projectRoot, "client", "public"),
  join(projectRoot, "dist", "public"),
];

function readBrowserFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (!path.endsWith(".map")) files.push(path);
    }
  };
  visit(root);
  return files;
}

describe("frontend security surface", () => {
  it("does not expose provider secrets or browser session-token forwarding", () => {
    const forbidden = [
      /BUILT_IN_FORGE_API_KEY/,
      /VITE_FRONTEND_FORGE_API_KEY/,
      /JWT_SECRET/,
      /OAUTH_SERVER_URL/,
      /sessionStorage\.getItem\([\"']manus-cookie/,
      /Authorization\s*:\s*[\"']Bearer/,
      /import\.meta\.env\.VITE_[A-Z0-9_]*(KEY|SECRET|TOKEN)/,
    ];
    const violations: string[] = [];
    for (const root of browserRoots) {
      for (const file of readBrowserFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const pattern of forbidden) {
          if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
