/**
 * Feste Werte des Moduls. Diese Datei hängt nicht von Foundry ab,
 * damit Parser und Sicht auch in Node getestet werden können.
 */

export const MODUL_ID = "motherboard-data-carrier-journal";

/** Arbeitstitel bis 19.11.2026 – Seiten und Flags von damals zieht umzug.mjs um. */
export const ALTE_MODUL_ID = "datentraeger";

/** Unter-Typ der Journal-Seite: Module bekommen ihre ID als Präfix. */
export const SEITEN_TYP = `${MODUL_ID}.datentraeger`;

/** Kanal für den Modul-Socket (braucht "socket": true in module.json). */
export const SOCKET = `module.${MODUL_ID}`;

/** Die drei Arten von Datenträgern. */
export const ARTEN = ["anthanen", "signal", "modul"];

/** Welche Lücken zu welcher Art gehören (Reihenfolge = Reihenfolge im Dialog). */
export const LUECKEN = {
  anthanen: ["unübersetzt", "zerfallen", "befallen"],
  signal: ["verrauscht", "übersprochen", "abgerissen", "fremd"],
  modul: ["gesperrt", "geschwärzt", "überschrieben", "beschädigt"]
};

export const ALLE_LUECKEN = Object.values(LUECKEN).flat();

/**
 * Das englische Wort jeder Lücke – so steht sie im Text und in der Oberfläche.
 * Intern bleiben die deutschen Namen (CSS, Flags); der Parser versteht beide.
 */
export const LUECKEN_WORT = {
  "unübersetzt": "untranslated",
  zerfallen: "decayed",
  befallen: "infested",
  verrauscht: "static",
  "übersprochen": "crosstalk",
  abgerissen: "cutoff",
  fremd: "foreign",
  gesperrt: "locked",
  "geschwärzt": "redacted",
  "überschrieben": "overwritten",
  "beschädigt": "corrupted"
};

/** Anzeige-Wort einer Lücke (unbekannte bleiben, wie sie sind). */
export function lueckenWort(art) {
  return LUECKEN_WORT[art] ?? art;
}

/** Lücken, bei denen hinter `>>` ein Ersatztext stehen kann. */
export const MIT_ERSATZ = new Set(["übersprochen", "überschrieben", "gesperrt", "befallen"]);

/** Lücken, die für alle fehlen – Leser-Regeln werden ignoriert. */
export const OHNE_LESER = new Set(["zerfallen"]);

/** Lücken, die auch ohne markierten Text Sinn ergeben: `{{abgerissen}}`, `{{zerfallen}}`. */
export const OHNE_TEXT = new Set(["abgerissen", "zerfallen"]);

/** Ersatztext, wenn keiner angegeben ist. */
export const STANDARD_ERSATZ = {
  gesperrt: "Version 3.0 required",
  übersprochen: "♪ … ♪"
};

/**
 * Die fünf Ergebnisse eines Duality-Wurfs, aufsteigend.
 * Eine Stelle mit Lesestufe ist sichtbar, wenn das gezeigte Ergebnis mindestens so gut ist (Phase 2).
 */
export const STUFEN = [
  "Failure with Fear",
  "Failure with Hope",
  "Success with Fear",
  "Success with Hope",
  "Critical Success"
];

/** Vorbelegung im Markier-Dialog. */
export const STANDARD_ANCESTRY = "Clank";

/** Die Ancestry Clank im SRD-Kompendium von Daggerheart 2.12.9 (Foundryborne). */
export const CLANK_UUID = "Compendium.daggerheart.ancestries.Item.ed8BoLR4SHOpeV00";

/* -------------------------------------------- */
/*  Phase 3: Geheimmodus und Entschlüsseln      */
/* -------------------------------------------- */

/** Anfragen an den GM (Foundry User#query – der Server leitet sie nur an ihn weiter). */
export const QUERY = {
  sicht: `${MODUL_ID}.sicht`,
  entschluesseln: `${MODUL_ID}.entschluesseln`,
  freigeben: `${MODUL_ID}.freigeben`,
  einstecken: `${MODUL_ID}.einstecken`
};

/** Daggerheart-Traits (Schlüssel wie im System). */
export const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];

/** Welcher Trait zum Entschlüsseln passt, wenn die Seite nichts anderes sagt. */
export const STANDARD_TRAIT = { anthanen: "knowledge", signal: "instinct", modul: "finesse" };

export const STANDARD_DIFFICULTY = 12;

/** Wie lange ein Wurf im Chat für das Entschlüsseln gilt. */
export const WURF_GUELTIG_MS = 10 * 60 * 1000;
