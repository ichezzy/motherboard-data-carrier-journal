/**
 * Umzug vom Arbeitstitel „datentraeger“ zum Motherboard: Data Carrier Journal.
 *
 * Seiten vom alten Typ `datentraeger.datentraeger` sind ohne das alte Modul „ungültig“:
 * Foundry behält ihre Rohdaten (im _source des Journals), zeigt sie aber nicht an.
 * Hier entsteht aus jeder eine neue Seite mit gleichem Inhalt, danach wird die alte gelöscht.
 * Läuft nur beim aktiven GM und nur, wenn es etwas umzuziehen gibt.
 */
import { MODUL_ID, ALTE_MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";

const ALTER_TYP = `${ALTE_MODUL_ID}.datentraeger`;

/** Rohdaten einer alten Seite → Daten für eine neue. */
function neueSeite(alt) {
  const daten = foundry.utils.deepClone(alt);
  delete daten._id;
  delete daten._stats;
  daten.type = SEITEN_TYP;
  if (daten.flags?.[ALTE_MODUL_ID]) {
    daten.flags[MODUL_ID] = daten.flags[ALTE_MODUL_ID];
    delete daten.flags[ALTE_MODUL_ID];
  }
  return daten;
}

export async function zieheAlteDatenUm() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;

  let seiten = 0;
  let haekchen = 0;
  const fehler = [];

  for (const entry of game.journal) {
    const alte = (entry._source.pages ?? []).filter(p => p.type === ALTER_TYP);
    if (!alte.length) continue;
    try {
      await entry.createEmbeddedDocuments("JournalEntryPage", alte.map(neueSeite));
      await entry.deleteEmbeddedDocuments("JournalEntryPage", alte.map(p => p._id));
      seiten += alte.length;
    } catch (err) {
      console.error(`${MODUL_ID} | Migration failed in journal “${entry.name}”`, err);
      fehler.push(entry.name);
    }
  }

  // Häkchen „liest wie Clank“: nur kopieren, das alte Flag stört nicht.
  for (const actor of game.actors) {
    const alt = actor._source.flags?.[ALTE_MODUL_ID]?.clank;
    if (alt && actor.getFlag(MODUL_ID, "clank") === undefined) {
      await actor.setFlag(MODUL_ID, "clank", alt);
      haekchen++;
    }
  }

  if (seiten || haekchen) {
    ui.notifications.info(game.i18n.format("DATENTRAEGER.Umzug.Fertig", { seiten, haekchen }));
  }
  if (fehler.length) {
    ui.notifications.error(game.i18n.format("DATENTRAEGER.Umzug.Fehler", { journale: fehler.join(", ") }), { permanent: true });
  }
}
