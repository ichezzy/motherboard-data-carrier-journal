/**
 * Duality-Wurf → Lesestufe, und wer welche Stufe hat. Ohne Foundry, damit es testbar bleibt.
 */
import { STUFEN, OHNE_TEXT, OHNE_LESER, DC_STANDARD } from "./konstanten.mjs";

/**
 * @param {{kritisch: boolean, erfolg?: boolean, hope: boolean}} wurf
 *        erfolg fehlt, wenn der Wurf keine Difficulty hatte.
 * @returns {{stufe: string, sicher: boolean}}  sicher = false: Erfolg/Misserfolg ist geraten
 */
export function stufeAusWurf({ kritisch, erfolg, hope }) {
  if (kritisch) return { stufe: "Critical Success", sicher: true };
  const mit = hope ? "Hope" : "Fear";
  if (typeof erfolg !== "boolean") return { stufe: `Success with ${mit}`, sicher: false };
  return { stufe: `${erfolg ? "Success" : "Failure"} with ${mit}`, sicher: true };
}

/** Die bessere von zwei Stufen (null zählt als keine). */
export function hoehereStufe(a, b) {
  const ia = STUFEN.indexOf(a);
  const ib = STUFEN.indexOf(b);
  if (ia < 0) return ib < 0 ? null : b;
  if (ib < 0) return a;
  return ia >= ib ? a : b;
}

/**
 * Welche Stufe gilt für diesen Leser?
 * - gruppe: vom GM gewählt („Ergebnis“ / „Zeigen…“), gilt für alle
 * - versuch: das Entschlüsseln eines Spielers – gilt für ihn, nach „Für alle freigeben“ für alle
 * @param {{gruppe?: string|null, versuch?: {stufe: string, userId: string, actorId?: string, geteilt?: boolean}|null}} seite
 * @param {{userId?: string|null, actorId?: string|null}} leser
 */
export function wirksameStufe({ gruppe = null, versuch = null } = {}, { userId = null, actorId = null } = {}) {
  let stufe = STUFEN.includes(gruppe) ? gruppe : null;
  if (versuch && STUFEN.includes(versuch.stufe)) {
    const eigener = (userId && versuch.userId === userId) || (actorId && versuch.actorId === actorId);
    if (versuch.geteilt || eigener) stufe = hoehereStufe(stufe, versuch.stufe);
  }
  return stufe;
}

/** Ergebnisse, die als Erfolg zählen (Wurf mindestens so hoch wie die Difficulty). */
export function istErfolg(stufe) {
  return stufe === "Critical Success" || stufe === "Success with Hope" || stufe === "Success with Fear";
}

/**
 * Welcher DC gilt für diese Lücke? Der niedrigste „DC n“ an der Stelle; sonst bei
 * locked, redacted, static, crosstalk die Difficulty der Seite; sonst keiner (null).
 */
export function dcVon(luecke, difficulty = null) {
  if (!luecke?.gueltig || OHNE_LESER.has(luecke.art)) return null;
  const eigene = (luecke.leser ?? []).filter(r => r.art === "dc").map(r => r.wert);
  if (eigene.length) return Math.min(...eigene);
  return DC_STANDARD.has(luecke.art) && Number.isFinite(difficulty) ? difficulty : null;
}

/**
 * Welcher Wurf-Gesamtwert gilt für diesen Leser? Der höhere aus
 * - gruppe: vom GM beim Zeigen gesetzt (gilt für alle)
 * - versuch.total: eigenes Entschlüsseln, nach „Für alle freigeben“ für alle
 */
export function wirksamerTotal({ gruppe = null, versuch = null } = {}, { userId = null, actorId = null } = {}) {
  let total = Number.isFinite(gruppe) ? gruppe : null;
  if (versuch && Number.isFinite(versuch.total)) {
    const eigener = (userId && versuch.userId === userId) || (actorId && versuch.actorId === actorId);
    if (versuch.geteilt || eigener) total = total === null ? versuch.total : Math.max(total, versuch.total);
  }
  return total;
}

/** Ist diese Lücke allein über ihre Lesestufe bei `stufe` lesbar? */
function perStufeLesbar(luecke, stufe) {
  const i = STUFEN.indexOf(stufe);
  if (i < 0) return false;
  return luecke.leser.some(r => r.art === "stufe" && STUFEN.indexOf(r.wert) <= i);
}

/**
 * Failure with Hope: Ein Stück des Trägers zerfällt. Welche Stelle?
 * Nicht das Bruchstück, das bei dieser Stufe lesbar bleibt, und nichts, was schon fehlt.
 * @param {Array} luecken   Ergebnis von syntax.luecken()
 * @param {string} stufe
 * @param {number[]} schonZerfallen
 * @param {() => number} zufall  0 … 1
 * @param {{total?: number|null, difficulty?: number|null}} [wurf]  Was dieser Wurf per DC öffnet, bleibt auch
 * @returns {number|null}  Nummer der Lücke
 */
export function zerfallStelle(luecken, stufe, schonZerfallen = [], zufall = Math.random, { total = null, difficulty = null } = {}) {
  const weg = new Set(schonZerfallen);
  const perDcLesbar = l => {
    const dc = dcVon(l, difficulty);
    return dc !== null && Number.isFinite(total) && total >= dc;
  };
  const kandidaten = luecken.filter(l =>
    l.gueltig && !OHNE_TEXT.has(l.art) && !weg.has(l.nr) && !perStufeLesbar(l, stufe) && !perDcLesbar(l));
  if (!kandidaten.length) return null;
  return kandidaten[Math.floor(zufall() * kandidaten.length)].nr;
}
