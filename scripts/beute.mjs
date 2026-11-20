/**
 * Item „Datenträger“ als Beute (Phase 3): ein Daggerheart-Loot-Item, das auf seine Seite zeigt.
 * Im Item-Bogen erscheint der Knopf „Read Data Carrier“.
 *
 * Freischalten (0.5.2): Niemand bekommt das ganze Journal. Wer einen Datenträger einsteckt oder
 * liest, bekommt genau diese Seite (Observer) und das Journal nur „Limited“ – andere Seiten im
 * selben Journal bleiben zu. Der Browser des GM prüft vorher, ob der Spieler ihn wirklich hat.
 */
import { MODUL_ID, SEITEN_TYP, QUERY } from "./konstanten.mjs";
import { geheimmodusAn, istFund } from "./geheim.mjs";
import { escapeHtml } from "./syntax.mjs";
import { ordnerId } from "./ordner.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Eigene Icons je Art (Comic-Stil; die weißen Silhouetten liegen in assets/icons/weiss/). */
const SYMBOL = {
  anthanen: `modules/${MODUL_ID}/assets/icons/anthanen.webp`,
  signal: `modules/${MODUL_ID}/assets/icons/signal.webp`,
  modul: `modules/${MODUL_ID}/assets/icons/modul.webp`
};

/** Icon der Art (für Item und Tile auf der Karte). */
export function symbolFuer(art) {
  return SYMBOL[art] ?? "icons/svg/book.svg";
}

/** Item-Typ für Beute: Daggerheart „loot“, sonst der erste, den das System kennt. */
export function lootTyp() {
  const typen = CONFIG.Item.dataModels ?? {};
  return "loot" in typen ? "loot" : Object.keys(typen)[0];
}

/** Daten für das Loot-Item, das auf die Seite zeigt – gleich für Beute-Knopf und Einstecken auf der Karte. */
export function beuteDaten(page) {
  return {
    name: page.name,
    type: lootTyp(),
    img: page.system.bild || symbolFuer(page.system.art),
    system: { description: `<p>${escapeHtml(L(`DATENTRAEGER.Beute.Beschreibung.${page.system.art}`))}</p><p>@UUID[${page.uuid}]{${escapeHtml(page.name)}}</p>` },
    flags: { [MODUL_ID]: { seite: page.uuid } }
  };
}

/** Ohne Geheimmodus kann ein Spieler den ganzen Text über die Konsole lesen – daran erinnern. */
export function warneOhneGeheimmodus() {
  if (!geheimmodusAn()) ui.notifications.warn("DATENTRAEGER.Beute.OhneGeheimmodus", { localize: true });
}

/**
 * Einem Spieler genau diese Seite freischalten (nur GM): Seite „Observer“, Journal mindestens „Limited“.
 * @returns {Promise<boolean>}  true, wenn sich etwas geändert hat
 */
export async function freischalten(page, user) {
  if (!game.user.isGM || !page || !user || user.isGM) return false;
  const { LIMITED, OBSERVER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const journal = page.parent;
  let neu = false;
  if (journal.getUserLevel(user) < LIMITED) {
    await journal.update({ [`ownership.${user.id}`]: LIMITED });
    neu = true;
  }
  if (page.getUserLevel(user) < OBSERVER) {
    await page.update({ [`ownership.${user.id}`]: OBSERVER });
    neu = true;
  }
  if (neu) ui.notifications.info(F("DATENTRAEGER.Freischalten.Gm", { name: user.name, seite: page.name }));
  return neu;
}

/**
 * Seite öffnen. Fehlt dem Spieler das Recht, fragt sein Browser erst den GM (der prüft nach).
 * @param {{name: string, daten: object}|null} anfrage
 */
export async function seiteOeffnen(page, anfrage = null) {
  if (!page.testUserPermission(game.user, "OBSERVER") && anfrage) {
    const gm = game.users.activeGM;
    if (!gm) return ui.notifications.warn("DATENTRAEGER.Anfrage.KeinGM", { localize: true });
    try {
      await gm.query(anfrage.name, anfrage.daten, { timeout: 15000 });
    } catch (err) {
      return ui.notifications.error(err.message);
    }
  }
  page.parent.sheet.render({ force: true, pageId: page.id });
}

/** Beim GM: Hat ein Charakter dieses Spielers das Loot-Item zu dieser Seite? Dann freischalten. */
async function beantworteLesenBeute({ uuid }, { user }) {
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Anfrage.NurGM"));
  const page = await fromUuid(uuid);
  if (page?.documentName !== "JournalEntryPage" || page.type !== SEITEN_TYP || istFund(page)) {
    throw new Error(L("DATENTRAEGER.Anfrage.KeineSeite"));
  }
  const besitzer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const hat = game.actors.some(a => a.testUserPermission(user, besitzer)
    && a.items.some(i => i.getFlag(MODUL_ID, "seite") === uuid));
  if (!hat) throw new Error(L("DATENTRAEGER.Freischalten.NichtDein"));
  await freischalten(page, user);
  return { ok: true };
}

/** Legt das Beute-Item an (nur GM), im eingestellten Ordner, und öffnet es. */
export async function beuteAnlegen(page) {
  if (!game.user.isGM) return;
  const item = await CONFIG.Item.documentClass.create({ ...beuteDaten(page), folder: ordnerId("Item") });
  warneOhneGeheimmodus();
  item?.sheet?.render({ force: true });
  return item;
}

/** Knopf „Read Data Carrier“ in Item-Bögen, deren Item auf eine Seite zeigt. */
export function registriereBeute() {
  CONFIG.queries[QUERY.lesenBeute] = beantworteLesenBeute;
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
      await seiteOeffnen(page, { name: QUERY.lesenBeute, daten: { uuid } });
    });
    const ziel = element.querySelector(".window-content") ?? element;
    ziel.prepend(knopf);
  });
}
