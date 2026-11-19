import { MODUL_ID, LUECKEN } from "./konstanten.mjs";

const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

/** Text mit Foundry-Verweisen (@UUID, [[/r]] …) anreichern. */
function anreichern(html, document, secrets) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: document, secrets });
}

/**
 * Ein Sheet, zwei Modi – wie bei Foundrys eigenen Seiten:
 * Ansicht direkt im Journal, Bearbeiten im eigenen Fenster.
 */
export class DatentraegerSheet extends JournalEntryPageHandlebarsSheet {
  static DEFAULT_OPTIONS = {
    classes: ["datentraeger"],
    window: { icon: "fa-solid fa-compact-disc" },
    position: { width: 680, height: 760 }
  };

  static EDIT_PARTS = {
    header: super.EDIT_PARTS.header,
    inhalt: {
      template: `modules/${MODUL_ID}/templates/bearbeiten.hbs`,
      classes: ["standard-form"],
      scrollable: [""]
    },
    footer: super.EDIT_PARTS.footer
  };

  static VIEW_PARTS = {
    content: {
      root: true,
      template: `modules/${MODUL_ID}/templates/ansicht.hbs`
    }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    Object.assign(context, {
      system,
      systemFields: system.schema.fields,
      istGM: game.user.isGM,
      artLabel: game.i18n.localize(`DATENTRAEGER.Art.${system.art}`),
      ueberschrift: Math.min(Math.max(Number(this.document.title?.level) || 1, 1), 6)
    });
    if (this.isView) await this._bereiteAnsicht(context);
    else this._bereiteBearbeiten(context);
    return context;
  }

  /** Kontext für die Ansicht im Journal. */
  async _bereiteAnsicht(context) {
    const system = this.document.system;
    context.ansicht = await anreichern(system.text, this.document, this.document.isOwner);
    context.gmNotiz = game.user.isGM && system.gmNotiz
      ? await anreichern(system.gmNotiz, this.document, true)
      : null;
    context.audio = system.audio || null;
    context.bild = system.bild || null;
  }

  /** Kontext für das Bearbeiten-Fenster. */
  _bereiteBearbeiten(context) {
    const art = this.document.system.art;
    context.lueckenHilfe = (LUECKEN[art] ?? []).join(" · ");
  }
}
