/**
 * Zustand einer Datenträger-Seite (Flags) und die Sicht für einen Benutzer.
 * Läuft beim GM (für sich, für „Ansicht als …“ und als Antwort auf Anfragen)
 * und bei Spielern für offene Seiten (ohne Geheimmodus).
 */
import { MODUL_ID, STUFEN, STANDARD_TRAIT } from "./konstanten.mjs";
import { baueSicht } from "./sicht.mjs";
import { wirksameStufe } from "./wurf.mjs";
import { leserFuerUser } from "./leser.mjs";
import { oeffne } from "./geheim.mjs";

const L = key => game.i18n.localize(key);

/** Übersetzte Beschriftungen für sicht.mjs. */
export function sichtTexte() {
  return {
    signalVerloren: L("DATENTRAEGER.Ansicht.SignalVerloren"),
    fuerDichLesbar: L("DATENTRAEGER.Ansicht.FuerDichLesbar"),
    lesbar: L("DATENTRAEGER.Ansicht.Lesbar"),
    niemand: L("DATENTRAEGER.Bearbeiten.Niemand"),
    abgerissen: L("DATENTRAEGER.Ansicht.Abgerissen"),
    cordex: L("DATENTRAEGER.Ansicht.Cordex"),
    zerfallenFehlschlag: L("DATENTRAEGER.Entschluesseln.ZerfallenTip"),
    kaputt: {
      anthanen: L("DATENTRAEGER.Entschluesseln.Kaputt.anthanen"),
      signal: L("DATENTRAEGER.Entschluesseln.Kaputt.signal"),
      modul: L("DATENTRAEGER.Entschluesseln.Kaputt.modul")
    }
  };
}

/* -------------------------------------------- */
/*  Flags                                       */
/* -------------------------------------------- */

/** Vom GM gewähltes Ergebnis („Ergebnis“ / „Zeigen…“), gilt für alle. */
export function stufeVon(page) {
  const wert = page?.getFlag?.(MODUL_ID, "stufe");
  return STUFEN.includes(wert) ? wert : null;
}

export async function setzeStufe(page, stufe) {
  if (STUFEN.includes(stufe)) await page.setFlag(MODUL_ID, "stufe", stufe);
  else await page.unsetFlag(MODUL_ID, "stufe");
}

/** Der eine Entschlüsseln-Versuch an diesem Träger (oder null). */
export function versuchVon(page) {
  const v = page?.getFlag?.(MODUL_ID, "versuch");
  return v && STUFEN.includes(v.stufe) ? v : null;
}

/** Was mit dem Träger passiert ist: zerstört (Failure with Fear), zerfallene Stellen (Failure with Hope). */
export function zustandVon(page) {
  return {
    zerstoert: Boolean(page?.getFlag?.(MODUL_ID, "zerstoert")),
    zerfallen: page?.getFlag?.(MODUL_ID, "zerfallen") ?? [],
    art: page?.system?.art ?? "modul"
  };
}

/** Trait und Difficulty fürs Entschlüsseln. */
export function wurfVon(page) {
  const e = page?.system?.entschluesseln ?? {};
  return {
    trait: e.trait || STANDARD_TRAIT[page?.system?.art] || "knowledge",
    difficulty: e.difficulty ?? 12
  };
}

/** Alles zurück auf Anfang (nur GM): Ergebnis, Versuch, Schäden. */
export async function zuruecksetzen(page) {
  // v14: Löschen mit ForcedDeletion (das alte "-="-Präfix ist veraltet) – so wie unsetFlag es macht.
  const weg = globalThis._del ?? new foundry.data.operators.ForcedDeletion();
  await page.update({ flags: { [MODUL_ID]: { stufe: weg, versuch: weg, zerstoert: weg, zerfallen: weg } } });
}

/* -------------------------------------------- */
/*  Sicht                                       */
/* -------------------------------------------- */

/**
 * Die Seite so, wie dieser Benutzer sie sieht – samt Hinweis nach Failure with Hope.
 * @param {JournalEntryPage} page
 * @param {User} user
 * @param {{archiv?: boolean, leser?: object}} [optionen]  leser: fertiger Leser statt aus dem Benutzer
 */
export async function sichtFuer(page, user, { archiv = false, leser = null } = {}) {
  const daten = await oeffne(page);
  const l = leser ?? leserFuerUser(user);
  const versuch = versuchVon(page);
  if (!l.gm) {
    l.stufe = wirksameStufe(
      { gruppe: stufeVon(page), versuch },
      { userId: user?.id ?? null, actorId: user?.character?.id ?? null }
    );
  }
  const sicht = baueSicht(daten.text, l, sichtTexte(), { ...zustandVon(page), archiv });
  const eigener = versuch && user && (versuch.userId === user.id || versuch.actorId === user.character?.id);
  sicht.hinweis = !l.gm && versuch?.stufe === "Failure with Hope" && (versuch.geteilt || eigener) && daten.hinweis
    ? daten.hinweis
    : null;
  return sicht;
}
