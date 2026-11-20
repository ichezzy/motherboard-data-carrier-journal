import { MODUL_ID, LUECKEN, OHNE_LESER, OHNE_TEXT, STANDARD_ANCESTRY, lueckenWort } from "./konstanten.mjs";
import { luecken, htmlZuText, falte } from "./syntax.mjs";
import { beschreibeRegel } from "./sicht.mjs";
import { spielerCharaktere, erkannteAncestries } from "./leser.mjs";
import { LeserFenster } from "./leser-fenster.mjs";
import { markiereAuswahl } from "./markieren.mjs";
import { fuerAlleAbspielen, fuerAlleStoppen, laeuftFuerAlle, markierePlayer } from "./audio.mjs";
import { stufenOptionen, zeigenDialog } from "./zeigen.mjs";
import { stufeVon, setzeStufe, versuchVon, zustandVon, wurfVon, zuruecksetzen, sichtFuer } from "./seite.mjs";
import { starteAufbau } from "./animation.mjs";
import { starteRauschen, setzeRauschStaerke, stoppeRauschen } from "./rauschen.mjs";
import { fnv1a, cordexAufloesen } from "./cordex.mjs";
import { GEHEIME_FELDER } from "./datenmodell.mjs";
import { oeffne, istVerschluesselt, istFund, geheimmodusAn, schluesselBereit, speicherWerte } from "./geheim.mjs";
import { entschluesseln, entschluesselnSperre, freigeben, sichtVomGM } from "./entschluesseln.mjs";
import { beuteAnlegen } from "./beute.mjs";

const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Text mit Foundry-Verweisen (@UUID, [[/r]] …) anreichern. */
function anreichern(html, document, secrets) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: document, secrets });
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

/** Alle offenen Ansichten neu zeichnen (z. B. wenn der GM online kommt). */
export function ansichtenNeuZeichnen() {
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof DatentraegerSheet && app.isView && app.rendered) app.render();
  }
}

/**
 * Ein Sheet, zwei Modi – wie bei Foundrys eigenen Seiten:
 * Ansicht direkt im Journal, Bearbeiten im eigenen Fenster.
 */
export class DatentraegerSheet extends JournalEntryPageHandlebarsSheet {
  static DEFAULT_OPTIONS = {
    classes: ["datentraeger"],
    window: { icon: "fa-solid fa-compact-disc" },
    position: { width: 700, height: 780 }
  };

  static EDIT_PARTS = {
    header: super.EDIT_PARTS.header,
    inhalt: {
      template: `modules/${MODUL_ID}/templates/bearbeiten.hbs`,
      // „scrollable“ als Klasse: Foundry schneidet den Inhalt von Seitensheets sonst ab
      classes: ["standard-form", "scrollable"],
      scrollable: [""]
    },
    footer: super.EDIT_PARTS.footer
  };

  /**
   * Kein `root: true`: Damit übernimmt Foundry nur die Kinder des Templates und das
   * <article class="datentraeger-ansicht"> (an dem Skin und Animation hängen) fiele weg.
   */
  static VIEW_PARTS = {
    content: {
      template: `modules/${MODUL_ID}/templates/ansicht.hbs`
    }
  };

  /** GM: Ansicht als dieser Benutzer (leer = GM sieht alles). */
  #ansichtAls = "";

  /** Der ProseMirror-Editor des Haupttexts (nur im Bearbeiten-Modus). */
  #editorView = null;

  /** Stand beim letzten Aufbau – nur bei Änderung neu animieren. */
  #aufbauSchluessel = null;

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
      ueberschrift: Math.min(Math.max(Number(this.document.title?.level) || 1, 1), 6),
      audio: system.audio || null,
      bild: system.bild || null
    });
    if (this.isView) await this._bereiteAnsicht(context);
    else await this._bereiteBearbeiten(context);
    return context;
  }

  /** Kontext für die Ansicht im Journal: jeder sieht die Seite so, wie sein Charakter sie lesen kann. */
  async _bereiteAnsicht(context) {
    const page = this.document;
    const istGM = game.user.isGM;

    // Seiten im Journal „Funde“: gespeicherte Sicht der Gruppe, ohne Markierungen.
    if (istFund(page)) {
      context.fund = true;
      context.ansicht = await anreichern(page.system.text, page, false);
      return;
    }

    const alsUser = istGM && this.#ansichtAls ? game.users.get(this.#ansichtAls) : null;
    let sicht = null;
    try {
      if (istGM) sicht = await sichtFuer(page, alsUser ?? game.user);
      else if (istVerschluesselt(page)) sicht = await sichtVomGM(page); // Geheimmodus: nur der GM kennt den Text
      else sicht = await sichtFuer(page, game.user);
    } catch (err) {
      context.fehler = err.message;
    }
    if (sicht) {
      context.ansicht = await anreichern(sicht.html, page, istGM && !alsUser && page.isOwner);
      context.hinweis = sicht.hinweis ? await anreichern(sicht.hinweis, page, false) : null;
    }

    const versuch = versuchVon(page);
    const zustand = zustandVon(page);
    const { trait, difficulty } = wurfVon(page);
    context.zerstoert = zustand.zerstoert;
    context.wurf = { trait: L(`DATENTRAEGER.Trait.${trait}`), difficulty };

    if (!istGM) {
      const eigener = Boolean(versuch && (versuch.userId === game.user.id || versuch.actorId === game.user.character?.id));
      context.entschluesselnMoeglich = !entschluesselnSperre(page);
      context.freigebenMoeglich = eigener && !versuch.geteilt && !zustand.zerstoert;
      if (versuch) {
        context.versuchText = eigener
          ? F("DATENTRAEGER.Entschluesseln.StatusEigen", { stufe: versuch.stufe })
          : versuch.geteilt
            ? F("DATENTRAEGER.Entschluesseln.StatusGeteilt", { name: versuch.actorName, stufe: versuch.stufe })
            : F("DATENTRAEGER.Entschluesseln.StatusFremd", { name: versuch.actorName });
      }
      context.entschluesselnLeiste = Boolean(
        context.entschluesselnMoeglich || context.freigebenMoeglich || context.versuchText || context.zerstoert
      );
      return;
    }

    // Nur GM
    if (!alsUser) {
      try {
        const daten = await oeffne(page);
        context.gmNotiz = daten.gmNotiz ? await anreichern(daten.gmNotiz, page, true) : null;
      } catch { /* kein Schlüssel – Hinweis steht schon in context.fehler */ }
    }
    const stufe = stufeVon(page);
    context.spielerListe = game.users
      .filter(u => !u.isGM)
      .map(u => ({
        id: u.id,
        name: u.name,
        charakter: u.character?.name ?? L("DATENTRAEGER.Ansicht.KeinCharakter"),
        gewaehlt: u.id === this.#ansichtAls
      }));
    context.stufen = stufenOptionen(stufe);
    context.geheimSymbol = istVerschluesselt(page) ? "fa-lock" : "fa-lock-open";
    context.geheimTip = L(istVerschluesselt(page) ? "DATENTRAEGER.Geheim.SeiteZu" : "DATENTRAEGER.Geheim.SeiteOffen");
    context.zuruecksetzbar = Boolean(versuch || zustand.zerstoert || zustand.zerfallen.length || stufe);
    if (versuch) {
      context.versuchText = F("DATENTRAEGER.Entschluesseln.StatusGM", {
        name: versuch.actorName, stufe: versuch.stufe, total: versuch.total, difficulty: versuch.difficulty
      }) + (versuch.geteilt ? ` · ${L("DATENTRAEGER.Entschluesseln.Geteilt")}` : "");
    }
    if (sicht?.gesamt) {
      context.lesestand = `${alsUser ? F("DATENTRAEGER.Ansicht.SoSiehtEs", { name: alsUser.name }) + " · " : ""}`
        + `${sicht.lesbar}/${sicht.gesamt} ${L("DATENTRAEGER.Ansicht.Lesbar")}`;
    }
  }

  /** Kontext für das Bearbeiten-Fenster: Inhalt (entschlüsselt), Hilfe, Prüfliste. */
  async _bereiteBearbeiten(context) {
    const page = this.document;
    const system = page.system;
    let daten;
    try {
      daten = await oeffne(page);
    } catch (err) {
      context.geheimFehlt = err.message;
      daten = Object.fromEntries(GEHEIME_FELDER.map(f => [f, ""]));
    }
    context.edit = daten;
    context.geheimAn = geheimmodusAn();
    context.lueckenHilfe = (LUECKEN[system.art] ?? []).map(lueckenWort).join(" · ");

    const charaktere = spielerCharaktere();
    const namen = new Set(charaktere.flatMap(a => {
      const f = falte(a.name);
      return [f, f.split(" ")[0]];
    }));
    const ancestries = new Set([falte(STANDARD_ANCESTRY), ...charaktere.flatMap(a => [...erkannteAncestries(a)])]);

    context.markierungen = luecken(daten.text).map(l => ({
      nr: l.nr + 1,
      art: l.art ?? l.artRoh,
      wort: l.art ? lueckenWort(l.art) : l.artRoh,
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
    }
    return w;
  }

  /* -------------------------------------------- */
  /*  Speichern                                   */
  /* -------------------------------------------- */

  /**
   * Im Geheimmodus nie Klartext speichern: text, gmNotiz, preis und hinweis werden vor dem
   * Update verschlüsselt. Ohne Schlüssel bleiben sie unangetastet (nichts wird überschrieben).
   * @inheritDoc
   */
  async _processSubmitData(event, form, submitData, options) {
    const sys = submitData.system;
    const page = this.document;
    if (sys && GEHEIME_FELDER.some(f => f in sys) && (geheimmodusAn() || istVerschluesselt(page))) {
      if (!(await schluesselBereit())) {
        for (const f of GEHEIME_FELDER) delete sys[f];
        ui.notifications.error("DATENTRAEGER.Geheim.KeinSchluessel", { localize: true });
      } else {
        const alt = await oeffne(page);
        const neu = Object.fromEntries(GEHEIME_FELDER.map(f => [f, f in sys ? sys[f] : alt[f]]));
        Object.assign(sys, await speicherWerte(neu));
      }
    }
    return super._processSubmitData(event, form, submitData, options);
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
   * Jeder <prose-mirror> feuert „plugins“, bevor sein Editor entsteht. In 14.365 hört das
   * Basis-Fenster nicht darauf – Foundrys eigenes Text-Sheet hängt den Listener selbst an.
   * Wir auch, unter eigenem Namen, damit es in späteren Versionen nicht doppelt läuft.
   * @inheritDoc
   */
  _attachFrameListeners() {
    super._attachFrameListeners();
    this.element.addEventListener("plugins", event => this._editorPlugins(event));
  }

  /**
   * Ein kleines Plugin merkt sich den Editor des Haupttexts,
   * damit der Knopf „Lücke markieren“ an die Auswahl kommt.
   * @param {Event & {plugins: Record<string, object>}} event
   */
  _editorPlugins(event) {
    const name = event.target?.getAttribute?.("name") ?? event.target?.name;
    if (name !== "system.text" || !event.plugins) return;
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
    const page = this.document;
    const klick = (aktion, fn) => el.querySelector(`[data-dt-aktion='${aktion}']`)?.addEventListener("click", event => {
      event.preventDefault();
      fn(event);
    });

    cordexAufloesen(el, L("DATENTRAEGER.Ansicht.Cordex"));

    el.querySelector("select[data-dt-ansicht]")?.addEventListener("change", event => {
      this.#ansichtAls = event.currentTarget.value;
      this.render();
    });
    el.querySelector("select[data-dt-stufe]")?.addEventListener("change", event => {
      setzeStufe(page, event.currentTarget.value);
    });
    klick("leser", () => oeffneLeserFenster());
    klick("zeigen", () => zeigenDialog(page));
    klick("entschluesseln", () => entschluesseln(page));
    klick("freigeben", () => freigeben(page));
    klick("beute", () => beuteAnlegen(page));
    klick("zuruecksetzen", async () => {
      const ja = await foundry.applications.api.DialogV2.confirm({
        window: { title: L("DATENTRAEGER.Entschluesseln.ZuruecksetzenTitel") },
        content: `<p>${L("DATENTRAEGER.Entschluesseln.ZuruecksetzenFrage")}</p>`
      });
      if (ja) zuruecksetzen(page);
    });

    // Rauschteppich: Regler gilt nur für diesen Client, Startwert kommt von der Seite.
    const regler = el.querySelector("input[data-dt-rauschen]");
    const audio = el.querySelector(".dt-audio audio");
    const staerke = () => Number(regler?.value ?? page.system.rauschen) || 0;
    const art = page.system.art;
    regler?.addEventListener("input", () => setzeRauschStaerke(staerke()));
    // Der Player stoppt nur das Rauschen, das er selbst gestartet hat – nicht das von „Für alle“.
    let vomPlayer = false;
    markierePlayer(el.querySelector(".dt-audio"));
    if (audio) {
      audio.addEventListener("play", () => {
        // Während der GM für alle abspielt, bleibt der eigene Player stumm.
        if (laeuftFuerAlle()) {
          audio.pause();
          return;
        }
        vomPlayer = true;
        starteRauschen(staerke(), art);
      });
      const ende = () => {
        if (!vomPlayer) return;
        vomPlayer = false;
        stoppeRauschen();
      };
      audio.addEventListener("pause", ende);
      audio.addEventListener("ended", ende);
    }
    klick("fuer-alle", () => {
      if (!page.system.audio) return ui.notifications.warn("DATENTRAEGER.Audio.KeineDatei", { localize: true });
      vomPlayer = false;
      if (audio && !audio.paused) audio.pause();
      fuerAlleAbspielen(page.system.audio, { rauschen: staerke(), art });
    });
    klick("stopp-alle", () => fuerAlleStoppen());

    const ansicht = el.querySelector(".datentraeger-ansicht") ?? el;
    klick("neu", () => starteAufbau(ansicht));

    // Aufbau beim ersten Anzeigen und wenn sich Text, Ergebnis oder Zustand ändern –
    // nicht, wenn der GM nur die Ansicht umschaltet.
    const versuch = versuchVon(page);
    const zustand = zustandVon(page);
    const schluessel = [
      fnv1a(page.system.geheim || page.system.text || ""), stufeVon(page) ?? "",
      versuch?.stufe ?? "", versuch?.geteilt ?? "", zustand.zerstoert, zustand.zerfallen.length
    ].join("|");
    if (schluessel !== this.#aufbauSchluessel) {
      this.#aufbauSchluessel = schluessel;
      starteAufbau(ansicht);
    }
  }
}
