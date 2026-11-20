/**
 * Die Markierungs-Syntax – ohne Foundry, damit sie in Node testbar ist
 * und später auch ein Obsidian-Plugin sie nutzen kann.
 *
 *   {{Art: Text}}
 *   {{Art | Leser, Leser: Text}}
 *   {{Art | Leser: Text >> Ersatz}}
 *   {{abgerissen}}  {{abgerissen | Leser}}
 *
 * Leser: `Clank` = Ancestry · `@Erinys` = Charakter · `Success with Hope` = Lesestufe (Phase 2).
 */
import { ALLE_LUECKEN, LUECKEN_WORT, MIT_ERSATZ, STUFEN, OHNE_TEXT, lueckenWort } from "./konstanten.mjs";

/**
 * @typedef {{art: "ancestry", name: string} | {art: "charakter", name: string} | {art: "stufe", wert: string}} LeserRegel
 *
 * @typedef {object} Luecke
 * @property {"luecke"} typ
 * @property {number} nr            Laufende Nummer in der Seite (ab 0)
 * @property {string|null} art      Erkannte Lücke, z. B. "unübersetzt"; null = unbekannt
 * @property {string} artRoh        Wie die Art im Text steht
 * @property {LeserRegel[]} leser
 * @property {string} inhalt        HTML des markierten Texts
 * @property {string|null} ersatz   HTML hinter `>>`, falls die Lücke Ersatz kennt
 * @property {string} roh           Die ganze Markierung, wie sie im Text steht
 * @property {boolean} ueberBlock   Geht über eine Absatzgrenze
 * @property {boolean} gueltig
 *
 * @typedef {{typ: "text", html: string}} TextStueck
 */

/** Für Vergleiche: klein, Umlaute als ae/oe/ue, ß als ss, Leerraum vereinheitlicht. */
export function falte(s) {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

// Beide Schreibweisen: englisch (Standard) und die alten deutschen Wörter.
const LUECKE_NACH_FALTE = new Map([
  ...ALLE_LUECKEN.map(l => [falte(l), l]),
  ...Object.entries(LUECKEN_WORT).map(([intern, wort]) => [falte(wort), intern])
]);
const STUFE_NACH_FALTE = new Map(STUFEN.map(s => [falte(s), s]));

/** "Untranslated" oder "Unuebersetzt" → "unübersetzt" (intern); unbekannt → null. */
export function erkenneLuecke(wort) {
  return LUECKE_NACH_FALTE.get(falte(wort)) ?? null;
}

/** HTML-Tags entfernen und die üblichen Entities auflösen. */
export function htmlZuText(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BLOCK_TAG = /<\/?(p|h[1-6]|li|ul|ol|div|blockquote|table|thead|tbody|tr|td|th|section|aside|article|pre|hr|figure|details|summary)\b/i;

/** Position von `nadel` in `s`, aber nicht innerhalb eines HTML-Tags. */
function findeAusserhalbTags(s, nadel) {
  let inTag = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inTag) {
      if (c === ">") inTag = false;
      continue;
    }
    if (c === "<") { inTag = true; continue; }
    if (s.startsWith(nadel, i)) return i;
  }
  return -1;
}

/**
 * Ende einer Markierung finden: das erste `}}`, das nicht zu einem inneren `{…}` gehört
 * (z. B. `@UUID[…]{Halle}` im markierten Text). Ein neues `{{` davor macht die Markierung ungültig.
 */
function findeEnde(s, ab) {
  let tiefe = 0;
  for (let i = ab; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {
      if (tiefe === 0 && s[i + 1] === "{") return -1;
      tiefe++;
    } else if (c === "}") {
      if (tiefe > 0) tiefe--;
      else if (s[i + 1] === "}") return i;
    }
  }
  return -1;
}

/** Führenden und abschließenden Leerraum (auch &nbsp;) entfernen. */
function trimHtml(html) {
  return html.replace(/^(?:\s|&nbsp;|&#160;)+/, "").replace(/(?:\s|&nbsp;|&#160;)+$/, "");
}

/** Die Leser-Liste hinter `|` lesen. */
export function leseLeser(text) {
  return String(text ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => {
      if (t.startsWith("@")) return { art: "charakter", name: t.slice(1).trim() };
      const stufe = STUFE_NACH_FALTE.get(falte(t));
      if (stufe) return { art: "stufe", wert: stufe };
      return { art: "ancestry", name: t };
    })
    .filter(r => r.art === "stufe" || r.name);
}

/** Inneres einer Markierung (zwischen `{{` und `}}`) lesen. */
function leseMarkierung(innen, roh, nr) {
  const doppelpunkt = findeAusserhalbTags(innen, ":");
  const kopf = htmlZuText(doppelpunkt < 0 ? innen : innen.slice(0, doppelpunkt));
  let inhalt = doppelpunkt < 0 ? "" : innen.slice(doppelpunkt + 1);

  const strich = kopf.indexOf("|");
  const artRoh = (strich < 0 ? kopf : kopf.slice(0, strich)).trim();
  const art = erkenneLuecke(artRoh);
  const leser = strich < 0 ? [] : leseLeser(kopf.slice(strich + 1));

  let ersatz = null;
  if (art && MIT_ERSATZ.has(art)) {
    let pfeil = findeAusserhalbTags(inhalt, "&gt;&gt;");
    let laenge = 8;
    if (pfeil < 0) { pfeil = findeAusserhalbTags(inhalt, ">>"); laenge = 2; }
    if (pfeil >= 0) {
      ersatz = trimHtml(inhalt.slice(pfeil + laenge)) || null;
      inhalt = inhalt.slice(0, pfeil);
    }
  }

  return {
    typ: "luecke",
    nr,
    art,
    artRoh,
    leser,
    inhalt: trimHtml(inhalt),
    ersatz,
    roh,
    ueberBlock: BLOCK_TAG.test(innen),
    gueltig: Boolean(art)
  };
}

/**
 * Den Rohtext (HTML aus dem Editor) in Text- und Lücken-Stücke zerlegen.
 * Eine Markierung mit unbekannter Art bleibt eine (ungültige) Lücke: Spieler sehen dort nichts.
 * @param {string} html
 * @returns {Array<TextStueck|Luecke>}
 */
export function zerlege(html) {
  const quelle = String(html ?? "");
  const stuecke = [];
  let pos = 0;
  let textStart = 0;
  let nr = 0;
  while (pos < quelle.length) {
    const start = quelle.indexOf("{{", pos);
    if (start < 0) break;
    const ende = findeEnde(quelle, start + 2);
    if (ende < 0) { pos = start + 2; continue; }
    if (start > textStart) stuecke.push({ typ: "text", html: quelle.slice(textStart, start) });
    stuecke.push(leseMarkierung(quelle.slice(start + 2, ende), quelle.slice(start, ende + 2), nr++));
    textStart = pos = ende + 2;
  }
  if (textStart < quelle.length) stuecke.push({ typ: "text", html: quelle.slice(textStart) });
  return stuecke;
}

/** Nur die Lücken einer Seite. */
export function luecken(html) {
  return zerlege(html).filter(s => s.typ === "luecke");
}

/**
 * Text, der vor und hinter die Auswahl kommt (für den Markier-Knopf).
 * @param {{art: string, ancestries?: string[], charaktere?: string[], stufen?: string[], ersatz?: string}} daten
 * @returns {{vor: string, nach: string, ohneText: string}}
 */
export function markierungsRahmen({ art, ancestries = [], charaktere = [], stufen = [], ersatz = "" }) {
  const leser = [
    ...ancestries.map(a => a.trim()).filter(Boolean),
    ...charaktere.map(c => c.trim()).filter(Boolean).map(c => `@${c}`),
    ...stufen
  ];
  const kopf = lueckenWort(art) + (leser.length ? ` | ${leser.join(", ")}` : "");
  const e = MIT_ERSATZ.has(art) && ersatz?.trim() ? ` >> ${ersatz.trim()}` : "";
  return {
    vor: `{{${kopf}: `,
    nach: `${e}}}`,
    ohneText: OHNE_TEXT.has(art) ? `{{${kopf}}}` : `{{${kopf}:${e}}}`
  };
}
