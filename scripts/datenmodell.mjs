import { ARTEN } from "./konstanten.mjs";

const { HTMLField, StringField, FilePathField } = foundry.data.fields;

/**
 * Daten einer Journal-Seite vom Typ „Datenträger“.
 * Der Titel ist der normale Seitenname (`page.name`).
 */
export class DatentraegerDaten extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["DATENTRAEGER.Daten"];

  static defineSchema() {
    return {
      art: new StringField({
        required: true,
        blank: false,
        initial: "anthanen",
        choices: Object.fromEntries(ARTEN.map(a => [a, `DATENTRAEGER.Art.${a}`]))
      }),
      // Rohtext mit Markierungen {{…}}. Wird vom Server gesäubert (htmlFields in module.json).
      text: new HTMLField({ required: true, blank: true, initial: "" }),
      audio: new FilePathField({ categories: ["AUDIO"], base64: false, required: false, nullable: true, initial: null }),
      bild: new FilePathField({ categories: ["IMAGE"], base64: false, required: false, nullable: true, initial: null }),
      // Sieht kein Spieler in der Ansicht. Phase 1: liegt trotzdem im Browser der Spieler (siehe README).
      gmNotiz: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}
