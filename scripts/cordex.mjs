/**
 * Cordex-Platzhalter (Phase 1).
 *
 * Ein Wort wird als Ganzes zu 2–5 Zeichen – keine Buchstaben-Ersetzung, also nicht zu knacken.
 * Gleiches Wort → immer dieselben Zeichen, auf jeder Seite und in jeder Sitzung,
 * damit Spieler wiederkehrende Wörter wiedererkennen.
 * Die Zeichen sind geometrische Unicode-Formen, kein bekanntes Fantasy- oder Film-Alphabet.
 * Phase 2 ersetzt sie durch eigene Zeichen (SVG oder Schrift) – die Zuordnung bleibt.
 */
import { falte } from "./syntax.mjs";

const ZEICHEN = Array.from("◇◈◆○◎●◐◑◒◓◔◕◖◗△▲▽▼◁▷◢◣◤◥□▣▤▥▦▧▨▩◫◩◪◬◭◮⌬");

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

/** Ein Wort in Cordex-Zeichen. */
export function cordexWort(wort) {
  const f = falte(wort);
  const z = zufall(fnv1a(f));
  const anzahl = Math.min(5, Math.max(2, Math.ceil(f.length / 2.5)));
  let out = "";
  for (let i = 0; i < anzahl; i++) out += ZEICHEN[Math.floor(z() * ZEICHEN.length)];
  return out;
}

/** Jeden Wortteil (Buchstaben und Ziffern) ersetzen; Leerzeichen und Satzzeichen bleiben. */
export function cordexText(text) {
  return String(text ?? "").replace(/[\p{L}\p{N}]+/gu, w => cordexWort(w));
}
