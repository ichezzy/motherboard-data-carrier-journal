/**
 * Wer sieht was. Ohne Foundry – dieselbe Funktion läuft in Phase 1 im Browser des Spielers
 * und in Phase 3 beim GM, der dann nur das Ergebnis über den Socket schickt.
 */
import { zerlege, htmlZuText, escapeHtml, falte } from "./syntax.mjs";
import { cordexText, fnv1a, zufall } from "./cordex.mjs";
import { STUFEN, STANDARD_ERSATZ, OHNE_LESER, OHNE_TEXT } from "./konstanten.mjs";

/**
 * @typedef {object} Leser
 * @property {boolean} gm                 Sieht alles, mit Hervorhebung
 * @property {Set<string>} ancestries     Gefaltete Ancestry-Namen, z. B. "clank"
 * @property {Set<string>} namen          Gefaltete Charakternamen (voll und Vorname)
 * @property {string|null} stufe          Gezeigtes Duality-Ergebnis (Phase 2)
 */

/** Ein Leser ohne Charakter: liest keine Lücke. */
export function niemand() {
  return { gm: false, ancestries: new Set(), namen: new Set(), stufe: null };
}

export function gmLeser() {
  return { gm: true, ancestries: new Set(), namen: new Set(), stufe: null };
}

/** Darf dieser Leser die Lücke im Klartext sehen? Eine passende Regel reicht. */
export function kannLesen(luecke, leser) {
  if (leser.gm) return true;
  if (!luecke.gueltig || OHNE_LESER.has(luecke.art)) return false;
  return luecke.leser.some(regel => {
    switch (regel.art) {
      case "ancestry": return leser.ancestries.has(falte(regel.name));
      case "charakter": return leser.namen.has(falte(regel.name));
      case "stufe": return Boolean(leser.stufe) && STUFEN.indexOf(leser.stufe) >= STUFEN.indexOf(regel.wert);
      default: return false;
    }
  });
}

/** Eine Leser-Regel für Menschen lesbar. */
export function beschreibeRegel(regel) {
  if (regel.art === "charakter") return `@${regel.name}`;
  if (regel.art === "stufe") return regel.wert;
  return regel.name;
}

const LEERE_ELEMENTE = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Offene Tags am Ende schließen – nötig, wenn „abgerissen“ mitten im Absatz abschneidet. */
export function schliesseTags(html) {
  const offen = [];
  for (const [, zu, name, selbst] of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
    const n = name.toLowerCase();
    if (LEERE_ELEMENTE.has(n) || selbst) continue;
    if (zu) {
      const i = offen.lastIndexOf(n);
      if (i >= 0) offen.splice(i);
    } else offen.push(n);
  }
  return html + offen.reverse().map(n => `</${n}>`).join("");
}

/* -------------------------------------------- */
/*  Was Nicht-Leser sehen                       */
/* -------------------------------------------- */

function span(klasse, inhalt, art) {
  return `<span class="dt-luecke dt-${klasse}" data-art="${escapeHtml(art ?? "")}">${inhalt}</span>`;
}

/** Ungefähre Länge, damit Lücken so lang aussehen wie der Text dahinter. */
function laenge(text, min = 3, max = 60) {
  return Math.min(max, Math.max(min, text.trim().length));
}

/** befallen: Wörter wiederholen sich, das letzte bricht ab. */
function stottern(text, z) {
  const woerter = text.split(/\s+/).filter(Boolean);
  if (!woerter.length) return "…";
  const out = [];
  for (const w of woerter) {
    out.push(w);
    if (z() < 0.4) out.push(w);
  }
  const letztes = woerter.at(-1);
  out.push(`${letztes.slice(0, Math.max(1, Math.ceil(letztes.length / 2)))}—`);
  return out.join(" ");
}

/** verrauscht: Rauschen statt Buchstaben, Wortgrenzen bleiben. */
function rauschen(text, z) {
  const zeichen = "░▒▓";
  return text.replace(/\S/g, () => zeichen[Math.floor(z() * zeichen.length)]);
}

/** beschädigt: Zeichensalat. Keine Zeichen, die Foundry-Syntax bilden könnten ([ ] { } @). */
function salat(text, z) {
  const zeichen = "#%&$*!?~^/\\|=+<>§¤";
  return text.replace(/\S/g, () => zeichen[Math.floor(z() * zeichen.length)]);
}

function verdeckt(luecke, texte) {
  const text = htmlZuText(luecke.inhalt);
  const z = zufall(fnv1a(luecke.roh));
  const ersatz = luecke.ersatz ?? (STANDARD_ERSATZ[luecke.art] ? escapeHtml(STANDARD_ERSATZ[luecke.art]) : null);
  switch (luecke.art) {
    case "unübersetzt":
    case "fremd":
      return span("cordex", escapeHtml(cordexText(text)), luecke.art);
    case "befallen":
      return span("befallen", luecke.ersatz ?? escapeHtml(stottern(text, z)), luecke.art);
    case "verrauscht":
      return span("rauschen", rauschen(text, z), luecke.art);
    case "übersprochen":
      return span("uebersprochen", ersatz, luecke.art);
    case "abgerissen":
      return span("abgerissen", escapeHtml(texte.signalVerloren), luecke.art);
    case "gesperrt":
      return span("gesperrt", `<i class="fa-solid fa-lock" inert></i> ${ersatz}`, luecke.art);
    case "geschwärzt":
      return span("geschwaerzt", text.replace(/\S/g, "█"), luecke.art);
    case "überschrieben":
      // Unauffällig: Wer nicht lesen kann, merkt nicht, dass hier etwas anderes stand.
      return luecke.ersatz ?? "";
    case "beschädigt":
      return span("beschaedigt", escapeHtml(salat(text, z)), luecke.art);
    case "zerfallen":
    default:
      // Auch unbekannte Lücken: lieber zu als offen.
      return span("zerfallen", " ".repeat(laenge(text)), luecke.art ?? "zerfallen");
  }
}

/* -------------------------------------------- */
/*  Was Leser und GM sehen                      */
/* -------------------------------------------- */

function gelesen(luecke, texte) {
  if (luecke.ueberBlock) return luecke.inhalt;
  const tip = `${texte.fuerDichLesbar} (${luecke.art})`;
  return `<span class="dt-gelesen" data-art="${escapeHtml(luecke.art)}" data-tooltip="${escapeHtml(tip)}">${luecke.inhalt}</span>`;
}

function gmAnsicht(luecke, texte) {
  const art = luecke.art ?? "unbekannt";
  const leser = luecke.leser.length ? luecke.leser.map(beschreibeRegel).join(", ") : texte.niemand;
  const info = luecke.gueltig
    ? `${art} · ${texte.lesbar}: ${OHNE_LESER.has(art) ? "–" : leser}`
    : `? „${luecke.artRoh}“`;
  const klassen = ["dt-gm", luecke.gueltig ? "" : "dt-gm-fehler"].filter(Boolean).join(" ");
  const attr = `class="${klassen}" data-art="${escapeHtml(art)}" data-tooltip="${escapeHtml(info)}"`;

  if (OHNE_TEXT.has(art) && !luecke.inhalt) {
    const zeichen = art === "abgerissen" ? `✂ ${texte.abgerissen}` : "▒▒▒";
    return `<span ${attr}><span class="dt-gm-marke">${escapeHtml(zeichen)}</span></span>`;
  }

  let ersatz = luecke.ersatz;
  if (ersatz == null && STANDARD_ERSATZ[art]) ersatz = escapeHtml(STANDARD_ERSATZ[art]);
  const ersatzHtml = ersatz ? `<span class="dt-gm-ersatz">${ersatz}</span>` : "";
  if (luecke.ueberBlock) return `<span ${attr}><span class="dt-gm-marke">⚠</span></span>${luecke.inhalt}${ersatzHtml}`;
  return `<span ${attr}>${luecke.inhalt}${ersatzHtml}</span>`;
}

/* -------------------------------------------- */

const STANDARD_TEXTE = {
  signalVerloren: "– Signal verloren –",
  fuerDichLesbar: "Für dich lesbar",
  lesbar: "lesbar",
  niemand: "nur GM",
  abgerissen: "abgerissen – ab hier fehlt alles"
};

/**
 * Die Seite so bauen, wie dieser Leser sie sieht.
 * @param {string} rohHtml       Text mit Markierungen
 * @param {Leser} leser
 * @param {Partial<typeof STANDARD_TEXTE>} [texte]  Übersetzte Beschriftungen
 * @returns {{html: string, gesamt: number, lesbar: number, abgeschnitten: boolean}}
 */
export function baueSicht(rohHtml, leser, texte = {}) {
  const t = { ...STANDARD_TEXTE, ...texte };
  let html = "";
  let gesamt = 0;
  let lesbar = 0;
  let abgeschnitten = false;

  for (const stueck of zerlege(rohHtml)) {
    if (stueck.typ === "text") {
      html += stueck.html;
      continue;
    }
    gesamt++;
    if (leser.gm) {
      lesbar++;
      html += gmAnsicht(stueck, t);
      continue;
    }
    const kann = kannLesen(stueck, leser);
    if (kann) lesbar++;
    if (stueck.art === "abgerissen" && !kann) {
      html += verdeckt(stueck, t);
      abgeschnitten = true;
      break;
    }
    html += kann ? gelesen(stueck, t) : verdeckt(stueck, t);
  }

  if (abgeschnitten) html = schliesseTags(html);
  return { html, gesamt, lesbar, abgeschnitten };
}
