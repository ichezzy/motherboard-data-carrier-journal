import { ARTEN, TRAITS, STANDARD_DIFFICULTY } from "./konstanten.mjs";

const { HTMLField, StringField, FilePathField, NumberField, SchemaField } = foundry.data.fields;

/** Felder, die im Geheimmodus nur verschlüsselt (in `geheim`) gespeichert werden. */
export const GEHEIME_FELDER = ["text", "gmNotiz", "preis", "hinweis"];

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
      // Im Geheimmodus leer – der Inhalt steht dann verschlüsselt in `geheim`.
      text: new HTMLField({ required: true, blank: true, initial: "" }),
      audio: new FilePathField({ categories: ["AUDIO"], base64: false, required: false, nullable: true, initial: null }),
      bild: new FilePathField({ categories: ["IMAGE"], base64: false, required: false, nullable: true, initial: null }),
      // Rauschteppich unter dem Audio, 0 = aus. min/max/step → Foundry zeigt einen Schieberegler.
      rauschen: new NumberField({ required: true, nullable: false, min: 0, max: 1, step: 0.05, initial: 0 }),
      // Sieht kein Spieler. Im Geheimmodus verschlüsselt.
      gmNotiz: new HTMLField({ required: true, blank: true, initial: "" }),

      // Entschlüsseln (Phase 3): welcher Trait, welche Difficulty
      entschluesseln: new SchemaField({
        trait: new StringField({
          required: true,
          blank: true,
          initial: "",
          choices: Object.fromEntries(["", ...TRAITS].map(t => [t, t ? `DATENTRAEGER.Trait.${t}` : "DATENTRAEGER.Trait.standard"]))
        }),
        difficulty: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 30, initial: STANDARD_DIFFICULTY })
      }),
      // Success with Fear: Was der Zugriff kostet (nur der GM liest es)
      preis: new HTMLField({ required: true, blank: true, initial: "" }),
      // Failure with Hope: Was man bräuchte, um mehr zu lesen (bekommt der Würfelnde)
      hinweis: new HTMLField({ required: true, blank: true, initial: "" }),

      // Geheimmodus: text, gmNotiz, preis und hinweis verschlüsselt (krypto.mjs). Leer = offen.
      geheim: new StringField({ required: true, blank: true, initial: "" })
    };
  }
}
