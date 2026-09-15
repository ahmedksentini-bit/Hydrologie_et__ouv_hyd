// Fabrique assets/courbe-idf.gif à partir de la figure du chapitre 3.
// Une image par position de fenêtre, pour les dix durées : on voit la fenêtre
// balayer l'enregistrement et le point se planter sur la courbe.
//
//   python3 -m http.server 8765 &
//   node tools/gif-idf.mjs
import { chromium } from "/tmp/claude-0/node_modules/playwright/index.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const dossier = mkdtempSync(join(tmpdir(), "idf-"));
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(process.env.PAGE || "http://localhost:8765/cours.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => document.getElementById("idfPlay").click());   // figé

// Trois positions de balayage par durée, puis le résultat : assez pour lire le
// mécanisme sans faire un GIF de deux cents images.
let k = 0;
for (let e = 0; e < 10; e++) {
  for (const a of [0.15, 0.45, 0.75, 1]) {
    await page.evaluate(([etape, avance]) => window.__idfPoser(etape, avance), [e, a]);
    await page.waitForTimeout(40);
    await page.locator("#calcIdfConstruction .figures")
      .screenshot({ path: join(dossier, `idf-${String(k++).padStart(3, "0")}.png`) });
  }
}
await nav.close();
execFileSync("python3", [new URL("frames-to-gif.py", import.meta.url).pathname, dossier,
  "idf:courbe-idf.gif"], { stdio: "inherit" });
rmSync(dossier, { recursive: true, force: true });
