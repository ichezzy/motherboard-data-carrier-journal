import { MODUL_ID, STANDARD_ANCESTRY } from "./konstanten.mjs";
import { falte } from "./syntax.mjs";
import { ancestryItems, erkannteAncestries, clankSchalter, ancestriesVon, spielerCharaktere } from "./leser.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Übersicht für den GM: welcher Charakter liest wie Clank – erkannt oder von Hand gesetzt.
 */
export class LeserFenster extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "datentraeger-leser",
    classes: ["datentraeger-leser"],
    window: { title: "DATENTRAEGER.Leser.Titel", icon: "fa-solid fa-glasses", resizable: true },
    position: { width: 620, height: "auto" }
  };

  static PARTS = {
    liste: { template: `modules/${MODUL_ID}/templates/leser.hbs` }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const clank = falte(STANDARD_ANCESTRY);
    context.zeilen = spielerCharaktere().map(actor => {
      const schalter = clankSchalter(actor);
      return {
        id: actor.id,
        name: actor.name,
        spieler: game.users.filter(u => !u.isGM && u.character?.id === actor.id).map(u => u.name).join(", ") || "–",
        ancestry: ancestryItems(actor).map(i => i.name).join(", ") || "–",
        erkannt: erkannteAncestries(actor).has(clank),
        liest: ancestriesVon(actor).has(clank),
        optionen: ["auto", "ja", "nein"].map(wert => ({
          wert,
          label: game.i18n.localize(`DATENTRAEGER.Leser.${wert === "auto" ? "Auto" : wert === "ja" ? "Ja" : "Nein"}`),
          gewaehlt: wert === schalter
        }))
      };
    });
    return context;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const select of this.element.querySelectorAll("select[data-actor-id]")) {
      select.addEventListener("change", async event => {
        const actor = game.actors.get(select.dataset.actorId);
        if (!actor) return;
        const wert = event.currentTarget.value;
        if (wert === "auto") await actor.unsetFlag(MODUL_ID, "clank");
        else await actor.setFlag(MODUL_ID, "clank", wert);
        this.render();
      });
    }
  }
}
