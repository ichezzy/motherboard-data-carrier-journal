/**
 * Journal „Funde“ (Phase 3): füllt sich mit dem, was die Gruppe tatsächlich gesehen hat.
 *
 * Eine Seite pro Datenträger, angelegt oder aktualisiert, wenn der GM eine Seite allen zeigt
 * oder ein Spieler sein Entschlüsseln für alle freigibt. Gespeichert wird die gemeinsame Sicht
 * der Gruppe – was nur Clank lesen kann, steht dort nicht (Erinys kann es erzählen).
 * Cordex steht als Platzhalter darin, nie das Wort dahinter; diese Seiten sind nicht verschlüsselt.
 */
import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";
import { niemand } from "./sicht.mjs";
import { sichtFuer, versuchVon } from "./seite.mjs";
import { escapeHtml } from "./syntax.mjs";

const L = key => game.i18n.localize(key);

export function registriereFundeEinstellung() {
  game.settings.register(MODUL_ID, "fundeJournal", { scope: "world", config: false, type: String, default: "" });
}

/** Das Journal „Funde“ (wird beim ersten Fund angelegt, für Spieler lesbar). */
async function fundeJournal() {
  const id = game.settings.get(MODUL_ID, "fundeJournal");
  const vorhanden = (id && game.journal.get(id)) || game.journal.find(j => j.getFlag(MODUL_ID, "funde"));
  if (vorhanden) return vorhanden;
  const journal = await CONFIG.JournalEntry.documentClass.create({
    name: L("DATENTRAEGER.Funde.Name"),
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    flags: { [MODUL_ID]: { funde: true } }
  });
  await game.settings.set(MODUL_ID, "fundeJournal", journal.id);
  return journal;
}

/** Die gemeinsame Sicht der Gruppe ins Journal „Funde“ schreiben (nur GM). */
export async function fundeAktualisieren(page) {
  if (!game.user.isGM || page.type !== SEITEN_TYP) return;
  try {
    // Gruppe: keine Ancestry- oder Charakter-Regeln, nur Ergebnisse, die für alle gelten
    // (vom GM gezeigt oder freigegeben – samt Hinweis nach Failure with Hope).
    const versuch = versuchVon(page);
    const sicht = await sichtFuer(page, null, { archiv: true, leser: niemand() });
    let html = sicht.html;
    if (sicht.hinweis) html += `<aside class="dt-hinweis">${sicht.hinweis}</aside>`;
    const quelle = versuch?.geteilt
      ? `<p class="dt-fund-quelle">${escapeHtml(game.i18n.format("DATENTRAEGER.Funde.Entschluesselt", { name: versuch.actorName, stufe: versuch.stufe }))}</p>`
      : "";

    const journal = await fundeJournal();
    const daten = {
      name: page.name,
      type: SEITEN_TYP,
      title: { show: true, level: 1 },
      system: {
        art: page.system.art,
        text: quelle + html,
        audio: page.system.audio,
        bild: page.system.bild,
        rauschen: page.system.rauschen,
        gmNotiz: "", preis: "", hinweis: "", geheim: ""
      },
      flags: { [MODUL_ID]: { fund: { quelle: page.uuid, zeit: Date.now() } } }
    };
    const alt = journal.pages.find(p => p.getFlag(MODUL_ID, "fund")?.quelle === page.uuid);
    if (alt) await alt.update(daten);
    else await journal.createEmbeddedDocuments("JournalEntryPage", [daten]);
  } catch (err) {
    console.error(`${MODUL_ID} | Could not update the Findings journal`, err);
    ui.notifications.warn("DATENTRAEGER.Funde.Fehler", { localize: true });
  }
}
