import { MODUL_ID, LUECKEN, OHNE_LESER, OHNE_TEXT, STANDARD_ANCESTRY } from "./konstanten.mjs";
import { luecken, htmlZuText, falte } from "./syntax.mjs";
import { baueSicht, beschreibeRegel } from "./sicht.mjs";
import { leserFuerUser, spielerCharaktere, erkannteAncestries } from "./leser.mjs";
import { LeserFenster } from "./leser-fenster.mjs";
import { markiereAuswahl } from "./markieren.mjs";

const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Text mit Foundry-Verweisen (@UUID, [[/r]] …) anreichern. */
function anreichern(html, document, secrets) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: document, secrets });
}

/** Übersetzte Beschriftungen für sicht.mjs. */
function sichtTexte() {
  return {
    signalVerloren: L("DATENTRAEGER.Ansicht.SignalVerloren"),
    fuerDichLesbar: L("DATENTRAEGER.Ansicht.FuerDichLesbar"),
    lesbar: L("DATENTRAEGER.Ansicht.Lesbar"),
    niemand: L("DATENTRAEGER.Bearbeiten.Niemand"),
    abgerissen: L("DATENTRAEGER.Ansicht.Abgerissen")
  };
}

function kurz(text, max = 70) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Zu welcher Art eine Lücke gehört. */
function artVonLuecke(luecke) {
  return Object.keys(LUECKEN).find(a => LUECKEN[a].includes(luecke)) ?? null;
}

/** Öffnet das Fenster „Leser“ (nur eins gleichzeitig). */
export function oeffneLeserFenster() {
  const offen = foundry.applications.instances.get("datentraeger-leser");
  if (offen) return offen.render({ force: true });
  return new LeserFenster().render({ force: true });
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

  /** GM: Ansicht als dieser Benutzer (leer = GM sieht alles). */
  #ansichtAls = "";

  /** Der ProseMirror-Editor des Haupttexts (nur im Bearbeiten-Modus). */
  #editorView = null;

  /* -------------------------------------------- */
  /*  Kontext                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    Object.assign(context, {
      system,
      systemFields: system.schema.fields,
      istGM: game.user.isGM,
      artLabel: L(`DATENTRAEGER.Art.${system.art}`),
      ueberschrift: Math.min(Math.max(Number(this.document.title?.level) || 1, 1), 6)
    });
    if (this.isView) await this._bereiteAnsicht(context);
    else this._bereiteBearbeiten(context);
    return context;
  }

  /** Kontext für die Ansicht im Journal: jeder sieht die Seite so, wie sein Charakter sie lesen kann. */
  async _bereiteAnsicht(context) {
    const system = this.document.system;
    const istGM = game.user.isGM;
    const alsUser = istGM && this.#ansichtAls ? game.users.get(this.#ansichtAls) : null;
    const leser = leserFuerUser(alsUser ?? game.user);
    const sicht = baueSicht(system.text, leser, sichtTexte());

    context.ansicht = await anreichern(sicht.html, this.document, leser.gm && this.document.isOwner);
    context.audio = system.audio || null;
    context.bild = system.bild || null;
    context.gmNotiz = istGM && !alsUser && system.gmNotiz
      ? await anreichern(system.gmNotiz, this.document, true)
      : null;

    if (istGM) {
      context.spielerListe = game.users
        .filter(u => !u.isGM)
        .map(u => ({
          id: u.id,
          name: u.name,
          charakter: u.character?.name ?? L("DATENTRAEGER.Ansicht.KeinCharakter"),
          gewaehlt: u.id === this.#ansichtAls
        }));
      context.lesestand = sicht.gesamt
        ? `${alsUser ? F("DATENTRAEGER.Ansicht.SoSiehtEs", { name: alsUser.name }) + " · " : ""}${sicht.lesbar}/${sicht.gesamt} ${L("DATENTRAEGER.Ansicht.Lesbar")}`
        : "";
    }
  }

  /** Kontext für das Bearbeiten-Fenster: Hilfe und Prüfliste der Markierungen. */
  _bereiteBearbeiten(context) {
    const system = this.document.system;
    context.lueckenHilfe = (LUECKEN[system.art] ?? []).join(" · ");

    const charaktere = spielerCharaktere();
    const namen = new Set(charaktere.flatMap(a => {
      const f = falte(a.name);
      return [f, f.split(" ")[0]];
    }));
    const ancestries = new Set([falte(STANDARD_ANCESTRY), ...charaktere.flatMap(a => [...erkannteAncestries(a)])]);

    context.markierungen = luecken(system.text).map(l => ({
      nr: l.nr + 1,
      art: l.art ?? l.artRoh,
      gueltig: l.gueltig,
      leser: OHNE_LESER.has(l.art) ? "–" : (l.leser.map(beschreibeRegel).join(", ") || L("DATENTRAEGER.Bearbeiten.Niemand")),
      text: kurz(htmlZuText(l.inhalt)),
      ersatz: l.ersatz ? kurz(htmlZuText(l.ersatz)) : null,
      warnungen: this._pruefe(l, system.art, namen, ancestries)
    }));
  }

  /** Hinweise zu einer Markierung – Tippfehler fallen so vor dem Spielabend auf. */
  _pruefe(l, seitenArt, namen, ancestries) {
    const w = [];
    if (!l.gueltig) w.push(F("DATENTRAEGER.Warnung.UnbekannteArt", { art: l.artRoh }));
    if (l.ueberBlock) w.push(L("DATENTRAEGER.Warnung.UeberAbsatz"));
    if (l.gueltig && !l.inhalt && !OHNE_TEXT.has(l.art)) w.push(L("DATENTRAEGER.Warnung.LeerText"));
    if (l.gueltig && !LUECKEN[seitenArt]?.includes(l.art)) {
      w.push(F("DATENTRAEGER.Warnung.AndereArt", { art: L(`DATENTRAEGER.Art.${artVonLuecke(l.art)}`) }));
    }
    if (OHNE_LESER.has(l.art) && l.leser.length) w.push(L("DATENTRAEGER.Warnung.ZerfallenOhneLeser"));
    for (const regel of l.leser) {
      if (regel.art === "charakter" && !namen.has(falte(regel.name))) w.push(F("DATENTRAEGER.Warnung.UnbekannterCharakter", { name: regel.name }));
      if (regel.art === "ancestry" && !ancestries.has(falte(regel.name))) w.push(F("DATENTRAEGER.Warnung.UnbekannteAncestry", { name: regel.name }));
      if (regel.art === "stufe") w.push(F("DATENTRAEGER.Warnung.StufePhase2", { stufe: regel.wert }));
    }
    return w;
  }

  /* -------------------------------------------- */
  /*  Rendern und Bedienung                       */
  /* -------------------------------------------- */

  /**
   * Eigene Listener statt `actions`: In der Ansicht steckt das Sheet im Journal,
   * nicht in einem eigenen Fenster – so funktionieren die Knöpfe in beiden Modi gleich.
   * @inheritDoc
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.isView) this._aktiviereAnsicht();
    else this._aktiviereBearbeiten();
  }

  /**
   * Foundry ruft das für jeden <prose-mirror> im Sheet auf, bevor der Editor entsteht.
   * Ein kleines Plugin merkt sich dabei den Editor des Haupttexts, damit der Knopf
   * „Lücke markieren“ an die Auswahl kommt.
   * @inheritDoc
   */
  _onConfigurePlugins(event) {
    super._onConfigurePlugins(event);
    const name = event.target?.getAttribute?.("name") ?? event.target?.name;
    if (name && name !== "system.text") return;
    const { Plugin } = foundry.prosemirror ?? globalThis.ProseMirror;
    event.plugins.datentraegerEditor = new Plugin({
      view: editorView => {
        this.#editorView = editorView;
        return {
          destroy: () => {
            if (this.#editorView === editorView) this.#editorView = null;
          }
        };
      }
    });
  }

  _aktiviereBearbeiten() {
    const knopf = this.element.querySelector("[data-dt-aktion='markieren']");
    if (!knopf) return;
    // Mousedown nicht weitergeben, damit der Editor seine Auswahl behält.
    knopf.addEventListener("mousedown", event => event.preventDefault());
    knopf.addEventListener("click", event => {
      event.preventDefault();
      if (!this.#editorView || this.#editorView.isDestroyed) {
        ui.notifications.warn("DATENTRAEGER.Markieren.KeinEditor", { localize: true });
        return;
      }
      const art = this.element.querySelector("[name='system.art']")?.value || this.document.system.art;
      markiereAuswahl(this.#editorView, art);
    });
  }

  _aktiviereAnsicht() {
    const el = this.element;
    el.querySelector("select[data-dt-ansicht]")?.addEventListener("change", event => {
      this.#ansichtAls = event.currentTarget.value;
      this.render();
    });
    el.querySelector("[data-dt-aktion='leser']")?.addEventListener("click", event => {
      event.preventDefault();
      oeffneLeserFenster();
    });
  }
}
