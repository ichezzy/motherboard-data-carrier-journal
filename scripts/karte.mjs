/**
 * Datenträger auf der Karte (0.4.0).
 *
 *  Hinlegen   – Der GM zieht eine Datenträger-Seite oder ihr Beute-Item auf die Karte. Es entsteht
 *               ein Tile mit dem Icon der Art, zuerst versteckt (Rechtsklick → Auge deckt es auf).
 *  Finden     – Ein Spieler doppelklickt das aufgedeckte Tile. Er muss es sehen können und sein
 *               Token muss in Reichweite Very Close stehen (Daggerheart-Einstellung der Szene).
 *  Lesen      – öffnet die Seite (Entschlüsseln usw. wie gewohnt).
 *  Einstecken – fragt den GM; dessen Browser prüft alles selbst nach, legt das Beute-Item beim
 *               Charakter an und nimmt das Tile von der Karte.
 */
import { MODUL_ID, SEITEN_TYP, QUERY } from "./konstanten.mjs";
import { istFund } from "./geheim.mjs";
import { escapeHtml } from "./syntax.mjs";
import { symbolFuer, beuteDaten, fuerSpielerOeffnen } from "./beute.mjs";
import { tileRechteck, tokenRechteck, enthaelt, inReichweite } from "./karte-logik.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Tiles, die der GM gerade an einen Spieler übergibt (gegen doppeltes Einstecken). */
const inArbeit = new Set();

export function registriereKarte() {
  CONFIG.queries[QUERY.einstecken] = beantworteEinstecken;
  Hooks.on("dropCanvasData", beimAblegen);
  // Das Spielfeld (#board) bleibt beim Szenenwechsel dasselbe – ein Listener genügt.
  Hooks.once("canvasReady", () => {
    document.getElementById("board")?.addEventListener("dblclick", event => {
      beimDoppelklick(event).catch(err => console.error(`${MODUL_ID} | Doppelklick`, err));
    });
  });
}

/* -------------------------------------------- */
/*  Hilfen                                      */
/* -------------------------------------------- */

function traegerUuid(tile) {
  return tile?.getFlag?.(MODUL_ID, "traeger") ?? null;
}

function rechteckVonTile(tile) {
  return tileRechteck({
    x: tile.x, y: tile.y, width: tile.width, height: tile.height,
    anchorX: tile.texture?.anchorX ?? 0.5, anchorY: tile.texture?.anchorY ?? 0.5
  });
}

function rechteckVonToken(tokenDoc) {
  const { width, height } = tokenDoc.getSize();
  return tokenRechteck({ x: tokenDoc.x, y: tokenDoc.y, width, height });
}

/** Very Close in Einheiten der Szene – so wie Daggerheart es selbst auflöst (Szene vor Welt). */
function reichweite(scene) {
  const r = scene.rangeSettings?.veryClose;
  return Number.isFinite(r) && r > 0 ? r : 3 * (scene.grid?.distance ?? 5);
}

function nahGenug(tokenDoc, tile) {
  const scene = tile.parent;
  return inReichweite(rechteckVonToken(tokenDoc), rechteckVonTile(tile), {
    groesse: scene.grid?.size, distanz: scene.grid?.distance, reichweite: reichweite(scene)
  });
}

function seiteSync(uuid) {
  try { return fromUuidSync(uuid); } catch { return null; }
}

function istTraegerSeite(page) {
  return page?.documentName === "JournalEntryPage" && page.type === SEITEN_TYP && !istFund(page);
}

/* -------------------------------------------- */
/*  Hinlegen (GM)                               */
/* -------------------------------------------- */

/** Hook „dropCanvasData“ – muss synchron false liefern, damit Foundry keine Notiz anlegt. */
function beimAblegen(_canvas, data, event) {
  if (!game.user.isGM || !data?.uuid) return;
  let page = null;
  if (data.type === "JournalEntryPage") page = seiteSync(data.uuid);
  else if (data.type === "Item") {
    const uuid = seiteSync(data.uuid)?.getFlag?.(MODUL_ID, "seite");
    if (!uuid) return;
    page = seiteSync(uuid);
    if (!page) {
      ui.notifications.warn("DATENTRAEGER.Beute.Fehlt", { localize: true });
      return false;
    }
  } else return;
  if (!istTraegerSeite(page)) return;
  traegerHinlegen(page, { x: data.x, y: data.y }, { einrasten: !event?.shiftKey })
    .catch(err => { console.error(`${MODUL_ID} | Hinlegen`, err); ui.notifications.error(err.message); });
  return false;
}

/** Legt den Datenträger als Tile auf die aktuelle Szene (zuerst versteckt). */
export async function traegerHinlegen(page, { x, y }, { einrasten = true, versteckt = true } = {}) {
  if (!game.user.isGM || !canvas?.ready || !istTraegerSeite(page)) return null;
  const groesse = canvas.dimensions.size;
  if (einrasten) ({ x, y } = canvas.grid.getSnappedPoint({ x, y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER }));
  if (!canvas.dimensions.rect.contains(x, y)) return null;

  const [tile] = await canvas.scene.createEmbeddedDocuments("Tile", [{
    name: page.name,
    texture: { src: symbolFuer(page.system.art), anchorX: 0.5, anchorY: 0.5 },
    x: Math.round(x), y: Math.round(y), width: groesse, height: groesse,
    hidden: versteckt,
    sort: Math.max(canvas.tiles.getMaxSort() + 1, 0),
    flags: { [MODUL_ID]: { traeger: page.uuid } }
  }]);
  await fuerSpielerOeffnen(page);
  ui.notifications.info(F(versteckt ? "DATENTRAEGER.Karte.HingelegtVersteckt" : "DATENTRAEGER.Karte.Hingelegt", { name: page.name }));
  return tile;
}

/* -------------------------------------------- */
/*  Finden (Spieler)                            */
/* -------------------------------------------- */

/** Das Token, mit dem der Spieler handelt: ausgewählt, sonst das seines Charakters, sonst irgendein eigenes. */
function meinToken() {
  const eigene = canvas.tokens.placeables.filter(t => t.document.isOwner);
  const ausgewaehlt = canvas.tokens.controlled.find(t => t.document.isOwner);
  const charakter = game.user.character;
  return ausgewaehlt
    ?? eigene.find(t => charakter && t.document.actorId === charakter.id)
    ?? eigene[0]
    ?? null;
}

async function beimDoppelklick(event) {
  if (game.user.isGM || !canvas?.ready || !canvas.scene) return;
  const punkt = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  const tile = canvas.scene.tiles.contents
    .filter(t => traegerUuid(t) && !t.hidden && enthaelt(rechteckVonTile(t), punkt))
    .sort((a, b) => b.sort - a.sort)[0];
  if (!tile) return;

  // Was der Spieler nicht sieht (Nebel, Wände), kann er auch nicht anklicken.
  if (canvas.scene.tokenVision
      && !canvas.visibility.testVisibility({ x: tile.x, y: tile.y }, { tolerance: tile.width / 4 })) return;

  const token = meinToken();
  if (!token) return ui.notifications.warn("DATENTRAEGER.Karte.KeinToken", { localize: true });
  if (!nahGenug(token.document, tile)) return ui.notifications.warn("DATENTRAEGER.Karte.ZuWeit", { localize: true });

  const page = await fromUuid(traegerUuid(tile));
  if (!istTraegerSeite(page)) return ui.notifications.warn("DATENTRAEGER.Beute.Fehlt", { localize: true });

  const wahl = await foundry.applications.api.DialogV2.wait({
    window: { title: L("DATENTRAEGER.Karte.Gefunden"), icon: "fa-solid fa-compact-disc" },
    content: `<p>${escapeHtml(L(`DATENTRAEGER.Beute.Beschreibung.${page.system.art}`))}</p>`,
    buttons: [
      { action: "lesen", label: L("DATENTRAEGER.Karte.Lesen"), icon: "fa-solid fa-eye", default: true },
      { action: "einstecken", label: L("DATENTRAEGER.Karte.Einstecken"), icon: "fa-solid fa-hand" }
    ],
    rejectClose: false
  });
  if (wahl === "lesen") page.parent.sheet.render({ force: true, pageId: page.id });
  else if (wahl === "einstecken") await einstecken(tile, token);
}

async function einstecken(tile, token) {
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn("DATENTRAEGER.Anfrage.KeinGM", { localize: true });
  try {
    const antwort = await gm.query(QUERY.einstecken, { tileUuid: tile.uuid, tokenUuid: token.document.uuid }, { timeout: 20000 });
    ui.notifications.info(F("DATENTRAEGER.Karte.Eingesteckt", antwort));
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

/* -------------------------------------------- */
/*  Einstecken (beim GM)                        */
/* -------------------------------------------- */

/** Der GM prüft alles selbst nach – dem Spieler-Client wird nichts geglaubt. */
async function beantworteEinstecken({ tileUuid, tokenUuid }, { user }) {
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Anfrage.NurGM"));
  if (inArbeit.has(tileUuid)) throw new Error(L("DATENTRAEGER.Karte.Weg"));
  inArbeit.add(tileUuid);
  try {
    const tile = await fromUuid(tileUuid);
    if (tile?.documentName !== "Tile" || !traegerUuid(tile) || tile.hidden) throw new Error(L("DATENTRAEGER.Karte.Weg"));
    const page = await fromUuid(traegerUuid(tile));
    if (!istTraegerSeite(page)) throw new Error(L("DATENTRAEGER.Beute.Fehlt"));

    const tokenDoc = await fromUuid(tokenUuid);
    const besitzer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    if (tokenDoc?.documentName !== "Token" || tokenDoc.parent !== tile.parent || !tokenDoc.testUserPermission(user, besitzer)) {
      throw new Error(L("DATENTRAEGER.Karte.KeinToken"));
    }
    if (!nahGenug(tokenDoc, tile)) throw new Error(L("DATENTRAEGER.Karte.ZuWeit"));

    // Wer dort steht, bekommt es – bei verknüpften Tokens der Charakter dahinter.
    const actor = (tokenDoc.actorLink && tokenDoc.actor) || user.character;
    if (!actor || !actor.testUserPermission(user, besitzer)) throw new Error(L("DATENTRAEGER.Entschluesseln.KeinCharakter"));

    const [item] = await actor.createEmbeddedDocuments("Item", [beuteDaten(page)]);
    await tile.delete();
    await fuerSpielerOeffnen(page, { warnen: false });
    const antwort = { name: item?.name ?? page.name, actor: actor.name };
    ui.notifications.info(F("DATENTRAEGER.Karte.GmEingesteckt", antwort));
    return antwort;
  } finally {
    inArbeit.delete(tileUuid);
  }
}
