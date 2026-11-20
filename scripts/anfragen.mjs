/**
 * Anfragen an den GM (Foundry User#query). Der Server leitet sie nur an den angefragten
 * Benutzer weiter und nennt ihm, wer fragt – ein Spieler kann sich nicht als jemand
 * anderes ausgeben. Die Antwort geht nur an den Fragenden zurück.
 *
 *  sicht          – „Wie sieht diese Seite für mich aus?“ (Geheimmodus)
 *  entschluesseln – „Hier ist mein Wurf“ – der GM prüft ihn selbst nach und trägt ein
 *  freigeben      – „Zeig allen, was ich entschlüsselt habe“
 */
import { MODUL_ID, SEITEN_TYP, QUERY, WURF_GUELTIG_MS } from "./konstanten.mjs";
import { luecken } from "./syntax.mjs";
import { stufeAusWurf, zerfallStelle } from "./wurf.mjs";
import { oeffne, istFund } from "./geheim.mjs";
import { sichtFuer, versuchVon, zustandVon, wurfVon } from "./seite.mjs";
import { fundeAktualisieren } from "./funde.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

export function registriereAnfragen() {
  CONFIG.queries[QUERY.sicht] = beantworteSicht;
  CONFIG.queries[QUERY.entschluesseln] = beantworteEntschluesseln;
  CONFIG.queries[QUERY.freigeben] = beantworteFreigeben;
}

/** Der GM, der Anfragen beantwortet (oder null). */
export function antwortGM() {
  return game.users.activeGM ?? null;
}

async function seiteAus(uuid) {
  const page = await fromUuid(uuid);
  if (page?.documentName !== "JournalEntryPage" || page.type !== SEITEN_TYP || istFund(page)) {
    throw new Error(L("DATENTRAEGER.Anfrage.KeineSeite"));
  }
  return page;
}

function nurGM() {
  if (!game.user.isGM) throw new Error(L("DATENTRAEGER.Anfrage.NurGM"));
}

/* -------------------------------------------- */
/*  Beim GM                                     */
/* -------------------------------------------- */

async function beantworteSicht({ uuid }, { user }) {
  nurGM();
  const page = await seiteAus(uuid);
  let s;
  try {
    s = await sichtFuer(page, user);
  } catch (err) {
    console.warn(`${MODUL_ID} | Could not build the view for ${user.name}`, err);
    throw new Error(L("DATENTRAEGER.Anfrage.GmOhneSchluessel"));
  }
  return { html: s.html, gesamt: s.gesamt, lesbar: s.lesbar, abgeschnitten: s.abgeschnitten, zerstoert: s.zerstoert, hinweis: s.hinweis };
}

/** Den Duality-Wurf eines Spielers selbst nachprüfen – dem Spieler-Client wird nichts geglaubt. */
function pruefeWurf(messageId, user) {
  const nachricht = game.messages.get(messageId);
  if (!nachricht || nachricht.author?.id !== user.id) throw new Error(L("DATENTRAEGER.Entschluesseln.WurfFehlt"));
  if (Date.now() - (nachricht.timestamp ?? 0) > WURF_GUELTIG_MS) throw new Error(L("DATENTRAEGER.Entschluesseln.WurfAlt"));
  const DualityRoll = game.system?.api?.dice?.DualityRoll;
  const wurf = (nachricht.rolls ?? []).find(r => (DualityRoll ? r instanceof DualityRoll : "withHope" in r));
  if (!wurf?._evaluated) throw new Error(L("DATENTRAEGER.Entschluesseln.WurfFehlt"));
  const verbraucht = game.journal.contents.some(e => e.pages.some(p => p.getFlag(MODUL_ID, "versuch")?.messageId === messageId));
  if (verbraucht) throw new Error(L("DATENTRAEGER.Entschluesseln.WurfVerbraucht"));
  return wurf;
}

async function beantworteEntschluesseln({ uuid, messageId }, { user }) {
  nurGM();
  const page = await seiteAus(uuid);
  if (versuchVon(page)) throw new Error(L("DATENTRAEGER.Entschluesseln.SchonVersucht"));
  const zustand = zustandVon(page);
  if (zustand.zerstoert) throw new Error(L("DATENTRAEGER.Entschluesseln.Zerstoert"));
  const actor = user.character;
  if (!actor) throw new Error(L("DATENTRAEGER.Entschluesseln.KeinCharakter"));

  const wurf = pruefeWurf(messageId, user);
  const { difficulty } = wurfVon(page);
  const erfolg = wurf.isCritical || wurf.total >= difficulty;
  const { stufe } = stufeAusWurf({ kritisch: wurf.isCritical, erfolg, hope: wurf.withHope });

  const versuch = {
    stufe, userId: user.id, actorId: actor.id, actorName: actor.name,
    messageId, total: wurf.total, difficulty, zeit: Date.now(), geteilt: false
  };
  const flags = { versuch };
  let folge = null;
  const daten = await oeffne(page);

  if (stufe === "Failure with Fear") {
    flags.zerstoert = true;
    folge = "zerstoert";
  } else if (stufe === "Failure with Hope") {
    const nr = zerfallStelle(luecken(daten.text), stufe, zustand.zerfallen);
    if (nr !== null) {
      flags.zerfallen = [...zustand.zerfallen, nr];
      folge = "zerfallen";
    }
  } else if (stufe === "Success with Fear") {
    folge = "preis";
  }
  await page.update({ flags: { [MODUL_ID]: flags } });
  meldeGM(page, versuch, folge, daten);
  return { stufe, folge };
}

async function beantworteFreigeben({ uuid }, { user }) {
  nurGM();
  const page = await seiteAus(uuid);
  const versuch = versuchVon(page);
  if (!versuch || (versuch.userId !== user.id && versuch.actorId !== user.character?.id)) {
    throw new Error(L("DATENTRAEGER.Entschluesseln.NichtDein"));
  }
  if (!versuch.geteilt) {
    await page.setFlag(MODUL_ID, "versuch", { ...versuch, geteilt: true });
    await fundeAktualisieren(page);
  }
  return { geteilt: true };
}

/** Nur auf dem Schirm des GM: was passiert ist und – bei Success with Fear – der Preis. */
function meldeGM(page, versuch, folge, daten) {
  const kopf = F("DATENTRAEGER.Entschluesseln.GmMeldung", { name: versuch.actorName, seite: page.name, stufe: versuch.stufe, total: versuch.total, difficulty: versuch.difficulty });
  if (folge === "preis") {
    const preis = daten.preis?.trim() ? daten.preis : `<p>${L(`DATENTRAEGER.Entschluesseln.Preis.${page.system.art}`)}</p>`;
    foundry.applications.api.DialogV2.prompt({
      window: { title: L("DATENTRAEGER.Entschluesseln.PreisTitel"), icon: "fa-solid fa-skull" },
      content: `<p><strong>${kopf}</strong></p>${preis}`,
      ok: { label: L("DATENTRAEGER.Entschluesseln.Verstanden") },
      rejectClose: false
    });
    return;
  }
  const zusatz = folge ? ` ${L(`DATENTRAEGER.Entschluesseln.Folge.${folge}`)}` : "";
  ui.notifications.info(kopf + zusatz, { permanent: folge === "zerstoert" });
}
