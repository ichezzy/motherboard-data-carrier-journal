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

/** Lücken, bei denen hinter `>>` ein Ersatztext stehen kann. */
export const MIT_ERSATZ = new Set(["übersprochen", "überschrieben", "gesperrt", "befallen"]);

/** Lücken, die für alle fehlen – Leser-Regeln werden ignoriert. */
export const OHNE_LESER = new Set(["zerfallen"]);

/** Lücken, die auch ohne markierten Text Sinn ergeben: `{{abgerissen}}`, `{{zerfallen}}`. */
export const OHNE_TEXT = new Set(["abgerissen", "zerfallen"]);

/** Ersatztext, wenn keiner angegeben ist. */
export const STANDARD_ERSATZ = {
  gesperrt: "Version 3.0 erforderlich",
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
