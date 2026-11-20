/**
 * Item „Datenträger“ als Beute (Phase 3): ein Daggerheart-Loot-Item, das auf seine Seite zeigt.
 * Im Item-Bogen erscheint der Knopf „Datenträger lesen“.
 */
import { MODUL_ID } from "./konstanten.mjs";
import { geheimmodusAn } from "./geheim.mjs";
import { escapeHtml } from "./syntax.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Eigene Icons je Art (weiße Silhouetten wie die Foundry-Standard-Icons). */
const SYMBOL = {
  anthanen: `modules/${MODUL_ID}/assets/icons/anthanen.webp`,
  signal: `modules/${MODUL_ID}/assets/icons/signal.webp`,
  modul: `modules/${MODUL_ID}/assets/icons/modul.webp`
};

/** Icon der Art (für Item und Tile auf der Karte). */
export function symbolFuer(art) {
  return SYMBOL[art] ?? "icons/svg/book.svg";
}

/** Daten für das Loot-Item, das auf die Seite zeigt – gleich für Beute-Knopf und Einstecken auf der Karte. */
export function beuteDaten(page) {
  const typ = "loot" in (CONFIG.Item.dataModels ?? {}) ? "loot" : Object.keys(CONFIG.Item.dataModels ?? {})[0];
  return {
    name: page.name,
    type: typ,
    img: page.system.bild || symbolFuer(page.system.art),
    system: { description: `<p>${escapeHtml(L(`DATENTRAEGER.Beute.Beschreibung.${page.system.art}`))}</p><p>@UUID[${page.uuid}]{${escapeHtml(page.name)}}</p>` },
    flags: { [MODUL_ID]: { seite: page.uuid } }
  };
}

/**
 * Damit Spieler die Seite öffnen können, braucht ihr Journal mindestens „Beobachter“.
 * Warnt außerdem, wenn der Geheimmodus aus ist.
 */
export async function fuerSpielerOeffnen(page, { warnen = true } = {}) {
  const journal = page.parent;
  const beobachter = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  if ((journal.ownership.default ?? 0) < beobachter) {
    await journal.update({ "ownership.default": beobachter });
    ui.notifications.info(F("DATENTRAEGER.Beute.Freigegeben", { journal: journal.name }));
  }
  if (warnen && !geheimmodusAn()) ui.notifications.warn("DATENTRAEGER.Beute.OhneGeheimmodus", { localize: true });
}

/** Legt das Beute-Item an (nur GM) und öffnet es. */
export async function beuteAnlegen(page) {
  if (!game.user.isGM) return;
  const item = await CONFIG.Item.documentClass.create(beuteDaten(page));
  await fuerSpielerOeffnen(page);
  item?.sheet?.render({ force: true });
  return item;
}

/** Knopf „Datenträger lesen“ in Item-Bögen, deren Item auf eine Seite zeigt. */
export function registriereBeute() {
  Hooks.on("renderItemSheetV2", (app, element) => {
    const uuid = app.document?.getFlag?.(MODUL_ID, "seite");
    if (!uuid || element.querySelector(".dt-beute-lesen")) return;
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "dt-beute-lesen";
    knopf.innerHTML = `<i class="fa-solid fa-compact-disc" inert></i> ${escapeHtml(L("DATENTRAEGER.Beute.Lesen"))}`;
    knopf.addEventListener("click", async event => {
      event.preventDefault();
      const page = await fromUuid(uuid);
      if (!page) return ui.notifications.warn("DATENTRAEGER.Beute.Fehlt", { localize: true });
      page.parent.sheet.render({ force: true, pageId: page.id });
    });
    const ziel = element.querySelector(".window-content") ?? element;
    ziel.prepend(knopf);
  });
}
