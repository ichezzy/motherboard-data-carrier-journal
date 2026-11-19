/**
 * Cordex – die Schrift der Anthanen, wie sie im Fenster erscheint.
 *
 * Ein Wort wird als Ganzes zu 2–5 Zeichen – keine Buchstaben-Ersetzung, also nicht zu knacken.
 * Gleiches Wort → immer dieselben Zeichen, auf jeder Seite und in jeder Sitzung,
 * damit Spieler wiederkehrende Wörter wiedererkennen.
 *
 * Phase 2: eigene Zeichen als SVG. Jedes Zeichen setzt sich aus Bausteinen zusammen
 * (5 Grundstriche × 4 Kopfzeichen × 2 Seitenstriche = 40 Zeichen) – eine eigene,
 * baukastenartige Schrift wie eingravierte Sygillen, kein vorhandenes Alphabet.
 * Die Unicode-Platzhalter aus Phase 1 bleiben als Rückfall (cordexText).
 */
import { falte, escapeHtml } from "./syntax.mjs";

export const ANZAHL_ZEICHEN = 40;

/** Rückfall: Unicode-Platzhalter, gleiche Reihenfolge wie die SVG-Zeichen. */
const UNICODE = Array.from("◇◈◆○◎●◐◑◒◓◔◕◖◗△▲▽▼◁▷◢◣◤◥□▣▤▥▦▧▨▩◫◩◪◬◭◮⌬◌");

/* -------------------------------------------- */
/*  Bausteine (Raster 10 × 16)                  */
/* -------------------------------------------- */

const STAEMME = [
  "M5 4V12.6M5 14.4v.2",              // Stab mit abgesetztem Punkt
  "M3 4V11Q3 15 8 15",                // Stab, der in den Fuß ausläuft
  "M8 4.5H4.5L2 9.5L4.5 14.5H8",      // eckige Klammer
  "M3 4V15M7 7.5V15",                 // ungleiches Paar
  "M2 4L5 15L8 9"                     // gebrochene Kerbe
];

const KOEPFE = [
  "",                                                // ohne
  "M4.2 1.6a.8 .8 0 1 0 1.6 0a.8 .8 0 1 0-1.6 0",    // Punkt
  "M2 1.8H8",                                        // Balken
  "M3.6 1.8a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0" // Ring
];

const SEITEN = [
  "",          // ohne
  "M5 9.5H9.5" // Strich nach rechts
];

/** Pfad eines Zeichens (0 … 39). */
export function zeichenPfad(index) {
  const i = ((index % ANZAHL_ZEICHEN) + ANZAHL_ZEICHEN) % ANZAHL_ZEICHEN;
  const stamm = STAEMME[i % 5];
  const kopf = KOEPFE[Math.floor(i / 5) % 4];
  const seite = SEITEN[Math.floor(i / 20) % 2];
  return [stamm, kopf, seite].filter(Boolean).join("");
}

/* -------------------------------------------- */
/*  Wort → Zeichen                              */
/* -------------------------------------------- */

/** FNV-1a, 32 Bit – kurz, stabil, leicht in andere Sprachen zu übertragen. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Kleiner, deterministischer Zufallsgenerator (mulberry32). */
export function zufall(saat) {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Die Zeichen eines Worts als Nummern (0 … 39). */
export function cordexIndizes(wort) {
  const f = falte(wort);
  const z = zufall(fnv1a(f));
  const anzahl = Math.min(5, Math.max(2, Math.ceil(f.length / 2.5)));
  return Array.from({ length: anzahl }, () => Math.floor(z() * ANZAHL_ZEICHEN));
}

/** Ein Wort in Unicode-Platzhaltern. */
export function cordexWort(wort) {
  return cordexIndizes(wort).map(i => UNICODE[i]).join("");
}

/** Jeden Wortteil ersetzen (Unicode); Leerzeichen und Satzzeichen bleiben. */
export function cordexText(text) {
  return String(text ?? "").replace(/[\p{L}\p{N}]+/gu, w => cordexWort(w));
}

/** Ein Wort als SVG. */
export function cordexSvg(wort, label = "Cordex") {
  const indizes = cordexIndizes(wort);
  const breite = indizes.length * 12 - 2;
  const pfade = indizes
    .map((i, n) => `<path transform="translate(${n * 12} 0)" d="${zeichenPfad(i)}"/>`)
    .join("");
  // Feine Leiterbahn unter dem Wort – hält die Zeichen eines Worts zusammen.
  const bahn = `<path class="dt-cordex-bahn" d="M0 17.2H${breite}" stroke-width=".5" opacity=".55"/>`;
  return `<svg class="dt-cordex-wort" viewBox="-0.5 0 ${breite + 1} 18" style="width:${((breite + 1) / 18).toFixed(3)}em"`
    + ` fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"`
    + ` role="img" aria-label="${escapeHtml(label)}">${pfade}${bahn}</svg>`;
}

/** Text in Cordex-HTML: Wörter als SVG, alles andere bleibt (escaped). */
export function cordexHtml(text, label = "Cordex") {
  return String(text ?? "")
    .split(/([\p{L}\p{N}]+)/u)
    .map((teil, i) => (i % 2 ? cordexSvg(teil, label) : escapeHtml(teil)))
    .join("");
}
