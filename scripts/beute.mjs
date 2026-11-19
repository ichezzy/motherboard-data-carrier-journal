/**
 * Item „Datenträger“ als Beute (Phase 3): ein Daggerheart-Loot-Item, das auf seine Seite zeigt.
 * Im Item-Bogen erscheint der Knopf „Datenträger lesen“.
 */
import { MODUL_ID } from "./konstanten.mjs";
import { geheimmodusAn } from "./geheim.mjs";
import { escapeHtml } from "./syntax.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

const SYMBOL = {
  anthanen: "icons/svg/sun.svg",
  signal: "icons/svg/sound.svg",
  modul: "icons/svg/book.svg"
};

/** Legt das Beute-Item an (nur GM) und öffnet es. */
export async function beuteAnlegen(page) {
  if (!game.user.isGM) return;
  const typ = "loot" in (CONFIG.Item.dataModels ?? {}) ? "loot" : Object.keys(CONFIG.Item.dataModels ?? {})[0];
  const item = await CONFIG.Item.documentClass.create({
    name: page.name,
    type: typ,
    img: page.system.bild || SYMBOL[page.system.art] || "icons/svg/book.svg",
    system: { description: `<p>${escapeHtml(L(`DATENTRAEGER.Beute.Beschreibung.${page.system.art}`))}</p><p>@UUID[${page.uuid}]{${escapeHtml(page.name)}}</p>` },
    flags: { [MODUL_ID]: { seite: page.uuid } }
  });

  // Damit Spieler die Seite öffnen können, braucht ihr Journal mindestens „Beobachter“.
  const journal = page.parent;
  const beobachter = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  if ((journal.ownership.default ?? 0) < beobachter) {
    await journal.update({ "ownership.default": beobachter });
    ui.notifications.info(F("DATENTRAEGER.Beute.Freigegeben", { journal: journal.name }));
  }
  if (!geheimmodusAn()) ui.notifications.warn("DATENTRAEGER.Beute.OhneGeheimmodus", { localize: true });

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
