/**
 * Standard-Ordner (0.5.2): Wohin legt das Modul, was es selbst anlegt?
 *  - Items: Loot-Items vom Knopf „Loot“ und Zugangskarten
 *  - Journale: das Journal „Findings“
 * In den Moduleinstellungen wählbar; die Liste zeigt immer die aktuellen Ordner.
 */
import { MODUL_ID } from "./konstanten.mjs";

const L = key => game.i18n.localize(key);

const EINSTELLUNG = { Item: "ordnerItems", JournalEntry: "ordnerJournale" };

/** Ordner eines Typs als Auswahl: „Eltern / Kind“, alphabetisch; leer = oberste Ebene. */
function ordnerAuswahl(typ) {
  const ordner = game.folders?.filter?.(f => f.type === typ) ?? [];
  const pfad = f => {
    const teile = [];
    for (let o = f; o; o = o.folder) teile.unshift(o.name);
    return teile.join(" / ");
  };
  const eintraege = ordner.map(f => [f.id, pfad(f)]).sort((a, b) => a[1].localeCompare(b[1], game.i18n?.lang));
  return { "": L("DATENTRAEGER.Einstellung.Ordner.Keiner"), ...Object.fromEntries(eintraege) };
}

export function registriereOrdnerEinstellungen() {
  for (const [typ, schluessel] of Object.entries(EINSTELLUNG)) {
    game.settings.register(MODUL_ID, schluessel, {
      name: `DATENTRAEGER.Einstellung.Ordner.${typ}.Name`,
      hint: `DATENTRAEGER.Einstellung.Ordner.${typ}.Hint`,
      scope: "world",
      config: true,
      type: String,
      // Als Funktion: Foundry fragt die Liste beim Öffnen der Einstellungen neu ab.
      choices: () => ordnerAuswahl(typ),
      default: ""
    });
  }
}

/** Der eingestellte Ordner (ID) – oder null, wenn keiner gewählt ist oder er gelöscht wurde. */
export function ordnerId(typ) {
  const id = game.settings.get(MODUL_ID, EINSTELLUNG[typ]);
  const ordner = id ? game.folders?.get(id) : null;
  return ordner?.type === typ ? ordner.id : null;
}
