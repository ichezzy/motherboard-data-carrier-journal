/**
 * Geheimmodus (Phase 3): Was Spieler nicht lesen dürfen, liegt nur verschlüsselt in der Welt.
 *
 * - Foundry 14 schickt jedem Benutzer alle Journale – Rechte verstecken nichts.
 * - Darum: text, gmNotiz, preis, hinweis verschlüsselt in `system.geheim` (AES-GCM).
 * - Der Schlüssel kommt aus dem Geheimwort des GM. Es liegt nur in seinem Browser
 *   (Client-Einstellung) und erreicht nie den Server. In der Welt stehen nur Salz und
 *   ein Prüfwert.
 * - Spieler fragen den GM (anfragen.mjs) und bekommen nur ihre eigene Sicht.
 */
import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";
import { GEHEIME_FELDER } from "./datenmodell.mjs";
import {
  kryptoVerfuegbar, neuesSalz, schluesselAus, verschluessele, entschluessele, probeErstellen, probeBestanden
} from "./krypto.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

let schluessel = null;
let laden = null;

/* -------------------------------------------- */
/*  Einstellungen                               */
/* -------------------------------------------- */

export function registriereGeheimEinstellungen(GeheimFenster) {
  game.settings.register(MODUL_ID, "geheimSalz", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODUL_ID, "geheimProbe", { scope: "world", config: false, type: String, default: "" });
  // Nur in diesem Browser (localStorage), nie auf dem Server.
  game.settings.register(MODUL_ID, "geheimWort", { scope: "client", config: false, type: String, default: "" });
  game.settings.registerMenu(MODUL_ID, "geheim", {
    name: "DATENTRAEGER.Geheim.Name",
    label: "DATENTRAEGER.Geheim.Label",
    hint: "DATENTRAEGER.Geheim.Hint",
    icon: "fa-solid fa-key",
    type: GeheimFenster,
    restricted: true
  });
}

/** Ist der Geheimmodus in dieser Welt eingerichtet? Dann wird beim Speichern verschlüsselt. */
export function geheimmodusAn() {
  return Boolean(game.settings.get(MODUL_ID, "geheimSalz") && game.settings.get(MODUL_ID, "geheimProbe"));
}

/** Schlüssel aus dem gespeicherten Geheimwort laden (nur beim GM). */
export function ladeSchluessel() {
  laden = (async () => {
    schluessel = null;
    if (!game.user.isGM || !geheimmodusAn() || !kryptoVerfuegbar()) return null;
    const wort = game.settings.get(MODUL_ID, "geheimWort");
    if (!wort) return null;
    const k = await schluesselAus(wort, game.settings.get(MODUL_ID, "geheimSalz"));
    if (await probeBestanden(k, game.settings.get(MODUL_ID, "geheimProbe"))) schluessel = k;
    else ui.notifications.error("DATENTRAEGER.Geheim.WortFalsch", { localize: true, permanent: true });
    return schluessel;
  })();
  return laden;
}

export async function schluesselBereit() {
  if (laden) await laden;
  return Boolean(schluessel);
}

export function istVerschluesselt(page) {
  return Boolean(page?.system?.geheim);
}

export function istFund(page) {
  return Boolean(page?.getFlag?.(MODUL_ID, "fund"));
}

/* -------------------------------------------- */
/*  Öffnen und Verschließen                     */
/* -------------------------------------------- */

/**
 * Der lesbare Inhalt einer Seite: {text, gmNotiz, preis, hinweis}.
 * Verschlüsselte Seiten kann nur der GM mit Schlüssel öffnen.
 */
export async function oeffne(page) {
  const system = page.system;
  if (!system.geheim) return Object.fromEntries(GEHEIME_FELDER.map(f => [f, system[f] ?? ""]));
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Geheim.NurGM"));
  if (!(await schluesselBereit())) throw new Error(L("DATENTRAEGER.Geheim.KeinSchluessel"));
  const daten = await entschluessele(schluessel, system.geheim);
  return Object.fromEntries(GEHEIME_FELDER.map(f => [f, daten[f] ?? ""]));
}

/**
 * Inhalt in ein Update übersetzen: im Geheimmodus verschlüsselt, sonst offen.
 * @param {{text?: string, gmNotiz?: string, preis?: string, hinweis?: string}} daten  vollständiger Inhalt
 * @returns {Promise<object>}  Werte für `system.*`
 */
export async function speicherWerte(daten) {
  if (geheimmodusAn()) {
    if (!(await schluesselBereit())) throw new Error(L("DATENTRAEGER.Geheim.KeinSchluessel"));
    const leer = Object.fromEntries(GEHEIME_FELDER.map(f => [f, ""]));
    return { ...leer, geheim: await verschluessele(schluessel, daten) };
  }
  return { ...Object.fromEntries(GEHEIME_FELDER.map(f => [f, daten[f] ?? ""])), geheim: "" };
}

/** Alle Datenträger-Seiten der Welt (ohne Funde). */
function alleSeiten() {
  return game.journal.contents.flatMap(e => e.pages.contents.filter(p => p.type === SEITEN_TYP && !istFund(p)));
}

/** Zählt offene und verschlüsselte Seiten. */
export function geheimStand() {
  const seiten = alleSeiten();
  const zu = seiten.filter(istVerschluesselt).length;
  return { gesamt: seiten.length, verschluesselt: zu, offen: seiten.length - zu };
}

/** Alle Seiten in einen Zustand bringen: verschlüsselt (geheimmodusAn) oder offen. */
async function alleUmschreiben(verschluesseln) {
  let n = 0;
  const nachJournal = new Map();
  for (const page of alleSeiten()) {
    if (istVerschluesselt(page) === verschluesseln) continue;
    const daten = await oeffne(page);
    const werte = verschluesseln
      ? { ...Object.fromEntries(GEHEIME_FELDER.map(f => [f, ""])), geheim: await verschluessele(schluessel, daten) }
      : { ...daten, geheim: "" };
    if (!nachJournal.has(page.parent)) nachJournal.set(page.parent, []);
    nachJournal.get(page.parent).push({ _id: page.id, system: werte });
    n++;
  }
  for (const [journal, updates] of nachJournal) await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
  return n;
}

/* -------------------------------------------- */
/*  Einrichten, entsperren, ausschalten         */
/* -------------------------------------------- */

export async function einrichten(wort) {
  if (!game.user.isGM) return;
  if (!kryptoVerfuegbar()) throw new Error(L("DATENTRAEGER.Geheim.KeinKrypto"));
  const salz = neuesSalz();
  const k = await schluesselAus(wort, salz);
  await game.settings.set(MODUL_ID, "geheimSalz", salz);
  await game.settings.set(MODUL_ID, "geheimProbe", await probeErstellen(k));
  await game.settings.set(MODUL_ID, "geheimWort", wort);
  schluessel = k;
  laden = Promise.resolve(k);
  const n = await alleUmschreiben(true);
  ui.notifications.info(F("DATENTRAEGER.Geheim.Eingerichtet", { n }));
}

/** Geheimwort auf einem weiteren Gerät eingeben. */
export async function entsperren(wort) {
  const k = await schluesselAus(wort, game.settings.get(MODUL_ID, "geheimSalz"));
  if (!(await probeBestanden(k, game.settings.get(MODUL_ID, "geheimProbe")))) {
    throw new Error(L("DATENTRAEGER.Geheim.WortFalsch"));
  }
  await game.settings.set(MODUL_ID, "geheimWort", wort);
  schluessel = k;
  laden = Promise.resolve(k);
  ui.notifications.info("DATENTRAEGER.Geheim.Entsperrt", { localize: true });
}

/** Offene Seiten nachträglich verschlüsseln (z. B. per Makro oder Import angelegt). */
export async function offeneVerschluesseln() {
  if (!(await schluesselBereit())) throw new Error(L("DATENTRAEGER.Geheim.KeinSchluessel"));
  const n = await alleUmschreiben(true);
  ui.notifications.info(F("DATENTRAEGER.Geheim.Verschluesselt", { n }));
}

/** Geheimmodus aus: alles entschlüsseln, Salz und Probe löschen. */
export async function ausschalten() {
  if (!(await schluesselBereit())) throw new Error(L("DATENTRAEGER.Geheim.KeinSchluessel"));
  const n = await alleUmschreiben(false);
  await game.settings.set(MODUL_ID, "geheimSalz", "");
  await game.settings.set(MODUL_ID, "geheimProbe", "");
  await game.settings.set(MODUL_ID, "geheimWort", "");
  schluessel = null;
  laden = null;
  ui.notifications.info(F("DATENTRAEGER.Geheim.Ausgeschaltet", { n }));
}

/** Geheimwort aus diesem Browser löschen (die Welt bleibt verschlüsselt). */
export async function vergessen() {
  await game.settings.set(MODUL_ID, "geheimWort", "");
  schluessel = null;
  laden = null;
}
