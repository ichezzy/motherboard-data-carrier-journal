/**
 * Entschlüsseln (Phase 3), Spielerseite: Knopf → Daggerheart-Wurf (Trait und Difficulty der Seite)
 * → der GM prüft den Wurf selbst nach und trägt das Ergebnis ein (anfragen.mjs).
 * Einmal pro Datenträger. Das Ergebnis sieht zuerst nur der Würfelnde; er kann es freigeben.
 */
import { QUERY } from "./konstanten.mjs";
import { antwortGM } from "./anfragen.mjs";
import { versuchVon, zustandVon, wurfVon } from "./seite.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Darf dieser Benutzer gerade entschlüsseln? Gibt den Grund zurück, wenn nicht. */
export function entschluesselnSperre(page, user = game.user) {
  if (user.isGM) return "gm";
  if (!user.character) return "keinCharakter";
  if (zustandVon(page).zerstoert) return "zerstoert";
  if (versuchVon(page)) return "versucht";
  return null;
}

export async function entschluesseln(page) {
  const sperre = entschluesselnSperre(page);
  if (sperre === "keinCharakter") return ui.notifications.warn("DATENTRAEGER.Entschluesseln.KeinCharakter", { localize: true });
  if (sperre) return;
  const gm = antwortGM();
  if (!gm) return ui.notifications.warn("DATENTRAEGER.Anfrage.KeinGM", { localize: true });

  const actor = game.user.character;
  const { trait, difficulty } = wurfVon(page);
  let ergebnis;
  try {
    ergebnis = await actor.rollTrait(trait, {
      title: F("DATENTRAEGER.Entschluesseln.WurfTitel", { name: page.name }),
      roll: { type: "trait", trait, difficulty }
    });
  } catch (err) {
    console.error("motherboard-data-carrier-journal | Roll failed", err);
    return ui.notifications.error("DATENTRAEGER.Entschluesseln.WurfFehler", { localize: true });
  }
  const nachricht = ergebnis?.message;
  if (!nachricht) return; // Dialog abgebrochen

  try {
    const antwort = await gm.query(QUERY.entschluesseln, { uuid: page.uuid, messageId: nachricht.id }, { timeout: 20000 });
    ui.notifications.info(F(`DATENTRAEGER.Entschluesseln.Ergebnis.${antwort.folge ?? "lesbar"}`, { stufe: antwort.stufe }));
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

export async function freigeben(page) {
  const gm = antwortGM();
  if (!gm) return ui.notifications.warn("DATENTRAEGER.Anfrage.KeinGM", { localize: true });
  try {
    await gm.query(QUERY.freigeben, { uuid: page.uuid }, { timeout: 15000 });
    ui.notifications.info("DATENTRAEGER.Entschluesseln.Freigegeben", { localize: true });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

/** Eigene Sicht vom GM holen (Geheimmodus). */
export async function sichtVomGM(page) {
  const gm = antwortGM();
  if (!gm) throw new Error(L("DATENTRAEGER.Anfrage.KeinGM"));
  return gm.query(QUERY.sicht, { uuid: page.uuid }, { timeout: 15000 });
}
