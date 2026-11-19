// Erzeugt eine HTML-Vorschau aller 40 Cordex-Zeichen und einiger Beispielwörter.
// Aufruf: node tools/cordex-vorschau.mjs > cordex-vorschau.html
import { ANZAHL_ZEICHEN, zeichenPfad, cordexHtml } from "../scripts/cordex.mjs";

const zeichen = Array.from({ length: ANZAHL_ZEICHEN }, (_, i) =>
  `<figure><svg viewBox="-1 0 12 18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${zeichenPfad(i)}"/></svg><figcaption>${i}</figcaption></figure>`).join("");
const saetze = [
  "MELDUNG · Kreischer 7 an Station 4",
  "Front aus drei. Verschüttet: 4.",
  "Bergung: 1 (helle Halle). 3 (dunkle Halle) – nach Bedarf.",
  "Melder unterwegs. Antwort erbeten. Mast, Mast, Mast."
];
console.log(`<!doctype html><meta charset="utf-8"><title>Cordex-Vorschau</title>
<style>
  body { background:#0b1512; color:#cfeee0; font:16px/1.6 system-ui, sans-serif; margin:2rem; }
  h2 { font-weight:500; letter-spacing:.08em; text-transform:uppercase; font-size:.8rem; color:#8fd1a8; }
  .raster { display:flex; flex-wrap:wrap; gap:.75rem; }
  figure { margin:0; text-align:center; } figure svg { width:30px; height:54px; filter:drop-shadow(0 0 3px #7fffd0aa); }
  figcaption { font-size:.7rem; opacity:.6; }
  p { font-size:1.6rem; } p small { display:block; font-size:.8rem; opacity:.6; }
  .dt-cordex-wort { height:1em; vertical-align:-.15em; filter:drop-shadow(0 0 2px #7fffd0aa); }
</style>
<h2>Die 40 Zeichen</h2><div class="raster">${zeichen}</div>
<h2>Beispiele</h2>${saetze.map(s => `<p>${cordexHtml(s)}<small>${s}</small></p>`).join("")}`);
