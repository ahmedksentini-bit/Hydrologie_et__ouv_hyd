// Fabrique les deux GIF du chapitre 3 — pluviomètre et pluviographe — à partir
// de la figure interactive elle-même. Les deux supports montrent donc exactement
// le même dessin : il n'y a qu'une source, src/cours-ch3-pluvio.js.
//
//   python3 -m http.server 8765 &
//   node tools/gifs-pluvio.mjs
//
// Les images vont dans assets/pluviometre.gif et assets/pluviographe.gif.
//
// Le pas de temps n'est PAS uniforme : la demi-heure d'orage porte le tiers des
// images alors qu'elle ne fait que 2 % de la journée. À pas constant, elle
// passerait en une image et le sujet du dessin serait invisible.
import { chromium } from "/tmp/claude-0/node_modules/playwright/index.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const URL_PAGE = process.env.PAGE || "http://localhost:8765/cours.html";
const instants = [];
for (let t = 0; t < 10.5; t += 0.75) instants.push(t);
for (let t = 10.5; t < 11.02; t += 0.05) instants.push(t);
for (let t = 11.1; t <= 24.001; t += 0.65) instants.push(t);
instants.push(24);

const dossier = mkdtempSync(join(tmpdir(), "pluvio-"));
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.goto(URL_PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.evaluate(() => document.getElementById("pvPlay").click());   // on fige la lecture

for (const [k, t] of instants.entries()) {
  await page.evaluate((v) => {
    const s = document.getElementById("pvTemps");
    s.value = String(v);
    s.dispatchEvent(new Event("input", { bubbles: true }));
  }, t);
  await page.waitForTimeout(60);
  const n = String(k).padStart(3, "0");
  await page.locator("#pvMetre").screenshot({ path: join(dossier, `metre-${n}.png`) });
  await page.locator("#pvGraphe").screenshot({ path: join(dossier, `graphe-${n}.png`) });
}
await nav.close();

execFileSync("python3", [new URL("frames-to-gif.py", import.meta.url).pathname, dossier],
  { stdio: "inherit" });
rmSync(dossier, { recursive: true, force: true });
console.log(`${instants.length} images par GIF.`);
