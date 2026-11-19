import { MODUL_ID } from "./konstanten.mjs";
import { kryptoVerfuegbar } from "./krypto.mjs";
import {
  geheimmodusAn, schluesselBereit, geheimStand, einrichten, entsperren, offeneVerschluesseln, ausschalten, vergessen
} from "./geheim.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const L = key => game.i18n.localize(key);

/** Fenster „Geheimmodus“ (Einstellungen → Motherboard Data Carrier Journal). */
export class GeheimFenster extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "datentraeger-geheim",
    classes: ["datentraeger-geheim"],
    window: { title: "DATENTRAEGER.Geheim.Name", icon: "fa-solid fa-key", resizable: true },
    position: { width: 520, height: "auto" }
  };

  static PARTS = {
    inhalt: { template: `modules/${MODUL_ID}/templates/geheim.hbs` }
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const an = geheimmodusAn();
    Object.assign(context, {
      krypto: kryptoVerfuegbar(),
      an,
      bereit: an && (await schluesselBereit()),
      stand: geheimStand()
    });
    return context;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const el = this.element;
    const wert = name => el.querySelector(`[name='${name}']`)?.value ?? "";
    const aktion = (name, fn) => el.querySelector(`[data-dt-aktion='${name}']`)?.addEventListener("click", async event => {
      event.preventDefault();
      try {
        await fn();
      } catch (err) {
        ui.notifications.error(err.message);
      }
      this.render();
    });

    aktion("einrichten", async () => {
      const wort = wert("wort");
      if (wort.length < 8) throw new Error(L("DATENTRAEGER.Geheim.ZuKurz"));
      if (wort !== wert("wiederholung")) throw new Error(L("DATENTRAEGER.Geheim.Ungleich"));
      await einrichten(wort);
    });
    aktion("entsperren", () => entsperren(wert("wort")));
    aktion("verschluesseln", () => offeneVerschluesseln());
    aktion("vergessen", () => vergessen());
    aktion("ausschalten", async () => {
      const ja = await DialogV2.confirm({
        window: { title: L("DATENTRAEGER.Geheim.AusschaltenTitel") },
        content: `<p>${L("DATENTRAEGER.Geheim.AusschaltenFrage")}</p>`
      });
      if (ja) await ausschalten();
    });
  }
}
