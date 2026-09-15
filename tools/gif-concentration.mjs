// Fabrique assets/temps-de-concentration.gif à partir de la figure du chapitre 3.
// Une seule source : src/cours-ch3-concentration.js. Le GIF montre les deux
// panneaux ensemble — les gouttes qui descendent vers l'exutoire à gauche, le
// débit qui monte à droite — parce que c'est leur simultanéité qui explique tc.
//
//   python3 -m http.server 8765 &
//   node tools/gif-concentration.mjs
import { chromium } from "/tmp/claude-0/node_modules/playwright/index.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const URL_PAGE = process.env.PAGE || "http://localhost:8765/cours.html";
const N = 40;
const dossier = mkdtempSync(join(tmpdir(), "tc-"));

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
await page.goto(URL_PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
await page.evaluate(() => document.getElementById("tcPlay").click());   // on fige la lecture
const tc = await page.evaluate(() => parseFloat(document.getElementById("tcTemps").max) / 1.6);

for (let k = 0; k < N; k++) {
  const t = (k / (N - 1)) * tc * 1.6;
  await page.evaluate((v) => {
    const s = document.getElementById("tcTemps");
    s.value = String(v);
    s.dispatchEvent(new Event("input", { bubbles: true }));
  }, t);
  await page.waitForTimeout(45);
  await page.locator("#calcConcentration .duo")
    .screenshot({ path: join(dossier, `tc-${String(k).padStart(3, "0")}.png`) });
}
await nav.close();

execFileSync("python3", [new URL("frames-to-gif.py", import.meta.url).pathname, dossier,
  "tc:temps-de-concentration.gif"], { stdio: "inherit" });
rmSync(dossier, { recursive: true, force: true });
