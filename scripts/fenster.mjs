/**
 * Das Journalfenster selbst als Hologramm.
 *
 * Zeigt ein Journal eine Datenträger-Seite, bekommt sein Fenster die Klasse „mdcj-holo“:
 * durchsichtig, Licht statt Pergament, Abtastlinien. Einstellung „Journalfenster“:
 *   art    – nur bei Anthanen (Licht in der Luft ist alt; heutige Technik zeigt auf Schirmen)
 *   holo   – bei allen Datenträgern
 *   normal – nie
 */
import { MODUL_ID, SEITEN_TYP } from "./konstanten.mjs";

/** Welche Seite das Journal gerade zeigt (oder null, wenn es keine Datenträger-Seite ist). */
function gezeigteSeite(app) {
  const pages = app.document?.pages;
  if (!pages?.size) return null;
  if (app.isMultiple) {
    // Mehrere Seiten untereinander: nur, wenn alle Datenträger sind.
    const alle = pages.contents.sort((a, b) => a.sort - b.sort);
    return alle.every(p => p.type === SEITEN_TYP) ? alle[0] : null;
  }
  const seite = pages.get(app.pageId);
  return seite?.type === SEITEN_TYP ? seite : null;
}

function stil() {
  try {
    return game.settings.get(MODUL_ID, "fenster");
  } catch {
    return "art";
  }
}

/** Fensterklasse setzen oder entfernen. */
export function markiereJournalFenster(app) {
  const element = app?.element;
  if (!element?.classList) return;
  const seite = gezeigteSeite(app);
  const art = seite?.system?.art ?? null;
  const modus = stil();
  const holo = Boolean(seite) && (modus === "holo" || (modus === "art" && art === "anthanen"));
  element.classList.toggle("mdcj-holo", holo);
  if (art) element.dataset.mdcjArt = art;
  else delete element.dataset.mdcjArt;
}

export function aktualisiereOffeneJournale() {
  for (const app of foundry.applications.instances.values()) {
    if (app.document?.documentName === "JournalEntry") markiereJournalFenster(app);
  }
}

export function registriereFenster() {
  Hooks.on("renderJournalEntrySheet", app => markiereJournalFenster(app));
  // Art einer Seite geändert → offene Journale anpassen
  Hooks.on("updateJournalEntryPage", page => {
    if (page.type === SEITEN_TYP) aktualisiereOffeneJournale();
  });
}
