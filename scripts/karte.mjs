/**
 * Fundstücke auf der Karte (0.4.0, Gegenstände seit 0.5.2).
 *
 *  Hinlegen   – Der GM zieht eine Datenträger-Seite, ihr Loot-Item oder eine Zugangskarte auf die
 *               Karte. Es entsteht ein Tile mit dem Icon, zuerst versteckt (Rechtsklick → Auge).
 *  Finden     – Ein Spieler doppelklickt das aufgedeckte Tile. Er muss es sehen können und sein
 *               Token muss in Reichweite Very Close stehen (Daggerheart-Einstellung der Szene).
 *  Lesen      – nur Datenträger: Der GM schaltet dem Spieler die Seite frei, dann öffnet sie sich.
 *  Einstecken – fragt den GM; dessen Browser prüft alles selbst nach, legt das Item beim
 *               Charakter an, schaltet die Seite frei und nimmt das Tile von der Karte.
 */
import { MODUL_ID, SEITEN_TYP, QUERY } from "./konstanten.mjs";
import { istFund } from "./geheim.mjs";
import { escapeHtml } from "./syntax.mjs";
import { symbolFuer, beuteDaten, freischalten, warneOhneGeheimmodus, seiteOeffnen } from "./beute.mjs";
import { tileRechteck, tokenRechteck, enthaelt, inReichweite } from "./karte-logik.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/** Tiles, die der GM gerade an einen Spieler übergibt (gegen doppeltes Einstecken). */
const inArbeit = new Set();

export function registriereKarte() {
  CONFIG.queries[QUERY.einstecken] = beantworteEinstecken;
  CONFIG.queries[QUERY.lesenKarte] = beantworteLesenKarte;
  game.settings.register(MODUL_ID, "kartenGroesse", {
    name: "DATENTRAEGER.Einstellung.KartenGroesse.Name",
    hint: "DATENTRAEGER.Einstellung.KartenGroesse.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "0.25": "DATENTRAEGER.Einstellung.KartenGroesse.viertel",
      "0.5": "DATENTRAEGER.Einstellung.KartenGroesse.halb",
      "0.75": "DATENTRAEGER.Einstellung.KartenGroesse.dreiviertel",
      "1": "DATENTRAEGER.Einstellung.KartenGroesse.ganz"
    },
    default: "0.5"
  });
  Hooks.on("dropCanvasData", beimAblegen);
  Hooks.once("ready", haengeDoppelklickEin);
}

/** Größe eines Fundstücks auf der Karte, als Anteil eines Feldes. */
function kartenGroesse() {
  const f = Number(game.settings.get(MODUL_ID, "kartenGroesse"));
  return [0.25, 0.5, 0.75, 1].includes(f) ? f : 0.5;
}

/**
 * Doppelklick auf die Karte. Foundry wertet ihn selbst aus und meldet ihn der aktiven Ebene –
 * für Spieler ist das die Token-Ebene. Dort hängen wir uns ein (so macht es auch Monk's Active
 * Tiles); ein eigener Listener am Spielfeld kommt nicht zuverlässig an.
 */
function haengeDoppelklickEin() {
  const vorher = event => {
    const punkt = event?.getLocalPosition?.(canvas.stage) ?? event?.interactionData?.origin;
    if (!punkt || !Number.isFinite(punkt.x) || !Number.isFinite(punkt.y)) return;
    beimDoppelklick({ x: punkt.x, y: punkt.y }).catch(err => console.error(`${MODUL_ID} | Double-click`, err));
  };
  const pfad = "foundry.canvas.layers.TokenLayer.prototype._onClickLeft2";
  if (globalThis.libWrapper) {
    libWrapper.register(MODUL_ID, pfad, function (wrapped, ...args) {
      vorher(args[0]);
      return wrapped(...args);
    }, "WRAPPER");
    return;
  }
  const proto = foundry.canvas?.layers?.TokenLayer?.prototype;
  if (!proto) return;
  const original = proto._onClickLeft2;
  proto._onClickLeft2 = function (event) {
    vorher(event);
    return original.call(this, event);
  };
}

/* -------------------------------------------- */
/*  Hilfen                                      */
/* -------------------------------------------- */

/** Datenträger-Tile: zeigt auf eine Seite. */
function traegerUuid(tile) {
  return tile?.getFlag?.(MODUL_ID, "traeger") ?? null;
}

/** Gegenstand-Tile (z. B. Zugangskarte): zeigt auf ein Item in der Seitenleiste. */
function gegenstandUuid(tile) {
  return tile?.getFlag?.(MODUL_ID, "gegenstand") ?? null;
}

function istFundstueck(tile) {
  return Boolean(traegerUuid(tile) || gegenstandUuid(tile));
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

function sync(uuid) {
  try { return fromUuidSync(uuid); } catch { return null; }
}

function istTraegerSeite(page) {
  return page?.documentName === "JournalEntryPage" && page.type === SEITEN_TYP && !istFund(page);
}

/** Zugangskarte (oder anderes Modul-Item, das man aufheben kann)? */
function istGegenstand(item) {
  return item?.documentName === "Item" && Boolean(item.getFlag?.(MODUL_ID, "zugang"));
}

/* -------------------------------------------- */
/*  Hinlegen (GM)                               */
/* -------------------------------------------- */

/** Hook „dropCanvasData“ – muss synchron false liefern, damit Foundry keine Notiz anlegt. */
function beimAblegen(_canvas, data, event) {
  if (!game.user.isGM || !data?.uuid) return;
  const punkt = { x: data.x, y: data.y };
  const optionen = { einrasten: !event?.shiftKey };
  const fehler = err => { console.error(`${MODUL_ID} | Placing on the map`, err); ui.notifications.error(err.message); };

  if (data.type === "JournalEntryPage") {
    const page = sync(data.uuid);
    if (!istTraegerSeite(page)) return;
    traegerHinlegen(page, punkt, optionen).catch(fehler);
    return false;
  }
  if (data.type !== "Item") return;
  const item = sync(data.uuid);
  if (istGegenstand(item)) {
    gegenstandHinlegen(item, punkt, optionen).catch(fehler);
    return false;
  }
  const uuid = item?.getFlag?.(MODUL_ID, "seite");
  if (!uuid) return;
  const page = sync(uuid);
  if (!istTraegerSeite(page)) {
    ui.notifications.warn("DATENTRAEGER.Beute.Fehlt", { localize: true });
    return false;
  }
  traegerHinlegen(page, punkt, optionen).catch(fehler);
  return false;
}

/** Tile anlegen: eingerastet auf die Feldmitte, so groß wie eingestellt, zuerst versteckt. */
async function tileAnlegen({ name, src, flags }, { x, y }, { einrasten = true, versteckt = true } = {}) {
  if (!game.user.isGM || !canvas?.ready) return null;
  const groesse = Math.max(8, Math.round(canvas.dimensions.size * kartenGroesse()));
  if (einrasten) ({ x, y } = canvas.grid.getSnappedPoint({ x, y }, { mode: CONST.GRID_SNAPPING_MODES.CENTER }));
  if (!canvas.dimensions.rect.contains(x, y)) return null;
  const [tile] = await canvas.scene.createEmbeddedDocuments("Tile", [{
    name,
    texture: { src, anchorX: 0.5, anchorY: 0.5 },
    x: Math.round(x), y: Math.round(y), width: groesse, height: groesse,
    hidden: versteckt,
    sort: Math.max(canvas.tiles.getMaxSort() + 1, 0),
    flags: { [MODUL_ID]: flags }
  }]);
  ui.notifications.info(F(versteckt ? "DATENTRAEGER.Karte.HingelegtVersteckt" : "DATENTRAEGER.Karte.Hingelegt", { name }));
  return tile;
}

/** Legt den Datenträger als Tile auf die aktuelle Szene (zuerst versteckt). */
export async function traegerHinlegen(page, punkt, optionen = {}) {
  if (!istTraegerSeite(page)) return null;
  const tile = await tileAnlegen({ name: page.name, src: symbolFuer(page.system.art), flags: { traeger: page.uuid } }, punkt, optionen);
  if (tile) warneOhneGeheimmodus();
  return tile;
}

/** Legt einen Gegenstand (z. B. Zugangskarte) als Tile auf die aktuelle Szene. */
export async function gegenstandHinlegen(item, punkt, optionen = {}) {
  if (!istGegenstand(item)) return null;
  return tileAnlegen({ name: item.name, src: item.img, flags: { gegenstand: item.uuid } }, punkt, optionen);
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

/** @param {{x: number, y: number}} punkt  Stelle auf der Karte (Canvas-Koordinaten) */
async function beimDoppelklick(punkt) {
  if (game.user.isGM || !canvas?.ready || !canvas.scene) return;
  const tile = canvas.scene.tiles.contents
    .filter(t => istFundstueck(t) && !t.hidden && enthaelt(rechteckVonTile(t), punkt))
    .sort((a, b) => b.sort - a.sort)[0];
  if (!tile) return;

  // Was der Spieler nicht sieht (Nebel, Wände), kann er auch nicht anklicken.
  if (canvas.scene.tokenVision
      && !canvas.visibility.testVisibility({ x: tile.x, y: tile.y }, { tolerance: tile.width / 4 })) return;

  const token = meinToken();
  if (!token) return ui.notifications.warn("DATENTRAEGER.Karte.KeinToken", { localize: true });
  if (!nahGenug(token.document, tile)) return ui.notifications.warn("DATENTRAEGER.Karte.ZuWeit", { localize: true });

  // Gegenstand: nur einstecken.
  if (gegenstandUuid(tile)) {
    const wahl = await foundry.applications.api.DialogV2.wait({
      window: { title: L("DATENTRAEGER.Karte.GefundenGegenstand"), icon: "fa-solid fa-id-card" },
      content: `<p><strong>${escapeHtml(tile.name ?? "")}</strong></p>`,
      buttons: [{ action: "einstecken", label: L("DATENTRAEGER.Karte.Einstecken"), icon: "fa-solid fa-hand", default: true }],
      rejectClose: false
    });
    if (wahl === "einstecken") await einstecken(tile, token);
    return;
  }

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
  if (wahl === "lesen") {
    await seiteOeffnen(page, { name: QUERY.lesenKarte, daten: { tileUuid: tile.uuid, tokenUuid: token.document.uuid } });
  } else if (wahl === "einstecken") await einstecken(tile, token);
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
/*  Beim GM                                     */
/* -------------------------------------------- */

/**
 * Der GM prüft alles selbst nach – dem Spieler-Client wird nichts geglaubt:
 * Tile da und aufgedeckt, Token gehört dem Spieler, steht auf derselben Szene und nah genug.
 */
async function pruefeFund({ tileUuid, tokenUuid }, user) {
  const tile = await fromUuid(tileUuid);
  if (tile?.documentName !== "Tile" || !istFundstueck(tile) || tile.hidden) throw new Error(L("DATENTRAEGER.Karte.Weg"));
  const tokenDoc = await fromUuid(tokenUuid);
  const besitzer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  if (tokenDoc?.documentName !== "Token" || tokenDoc.parent !== tile.parent || !tokenDoc.testUserPermission(user, besitzer)) {
    throw new Error(L("DATENTRAEGER.Karte.KeinToken"));
  }
  if (!nahGenug(tokenDoc, tile)) throw new Error(L("DATENTRAEGER.Karte.ZuWeit"));
  return { tile, tokenDoc };
}

async function beantworteLesenKarte(daten, { user }) {
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Anfrage.NurGM"));
  const { tile } = await pruefeFund(daten, user);
  const page = await fromUuid(traegerUuid(tile));
  if (!istTraegerSeite(page)) throw new Error(L("DATENTRAEGER.Beute.Fehlt"));
  await freischalten(page, user);
  return { ok: true };
}

async function beantworteEinstecken({ tileUuid, tokenUuid }, { user }) {
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Anfrage.NurGM"));
  if (inArbeit.has(tileUuid)) throw new Error(L("DATENTRAEGER.Karte.Weg"));
  inArbeit.add(tileUuid);
  try {
    const { tile, tokenDoc } = await pruefeFund({ tileUuid, tokenUuid }, user);

    // Was dort liegt: Datenträger (Loot-Item zur Seite) oder Gegenstand (Kopie des Items).
    let itemDaten;
    let page = null;
    if (traegerUuid(tile)) {
      page = await fromUuid(traegerUuid(tile));
      if (!istTraegerSeite(page)) throw new Error(L("DATENTRAEGER.Beute.Fehlt"));
      itemDaten = beuteDaten(page);
    } else {
      const vorlage = await fromUuid(gegenstandUuid(tile));
      if (!istGegenstand(vorlage)) throw new Error(L("DATENTRAEGER.Karte.Weg"));
      itemDaten = vorlage.toObject();
      for (const k of ["_id", "folder", "sort", "ownership", "_stats"]) delete itemDaten[k];
    }

    // Wer dort steht, bekommt es – bei verknüpften Tokens der Charakter dahinter.
    const besitzer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const actor = (tokenDoc.actorLink && tokenDoc.actor) || user.character;
    if (!actor || !actor.testUserPermission(user, besitzer)) throw new Error(L("DATENTRAEGER.Entschluesseln.KeinCharakter"));

    const [item] = await actor.createEmbeddedDocuments("Item", [itemDaten]);
    await tile.delete();
    if (page) await freischalten(page, user);
    const antwort = { name: item?.name ?? itemDaten.name, actor: actor.name };
    ui.notifications.info(F("DATENTRAEGER.Karte.GmEingesteckt", antwort));
    return antwort;
  } finally {
    inArbeit.delete(tileUuid);
  }
}
