import { ARTEN } from "./konstanten.mjs";

const { HTMLField, StringField, FilePathField, NumberField } = foundry.data.fields;

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
      // Rauschteppich unter dem Audio, 0 = aus. min/max/step → Foundry zeigt einen Schieberegler.
      rauschen: new NumberField({ required: true, nullable: false, min: 0, max: 1, step: 0.05, initial: 0 }),
      // Sieht kein Spieler in der Ansicht. Bis Phase 3: liegt trotzdem im Browser der Spieler (siehe README).
      gmNotiz: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}
