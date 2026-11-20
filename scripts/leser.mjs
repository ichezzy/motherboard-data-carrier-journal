/**
 * Wer liest was – die Brücke zwischen Foundry (User, Actor, Items) und sicht.mjs.
 *
 * Clank-Regel, robust in drei Stufen (eine reicht):
 *   1. Name der Ancestry enthält „Clank“ – auch bei Mixed Ancestry („Clank/Elf“)
 *   2. Die Ancestry stammt vom SRD-Clank im Kompendium (hält auch nach Umbenennen)
 *   3. Häkchen am Actor (Flag „clank“: auto · ja · nein), gesetzt im Fenster „Leser“
 * Es zählt nur der zugewiesene Charakter eines Spielers.
 */
import { MODUL_ID, CLANK_UUID, STANDARD_ANCESTRY } from "./konstanten.mjs";
import { falte } from "./syntax.mjs";
import { niemand, gmLeser } from "./sicht.mjs";
import { zugangskartenVon } from "./karten.mjs";

const CLANK = falte(STANDARD_ANCESTRY);

/** Ancestry-Items eines Charakters (Daggerheart: eingebettete Items vom Typ „ancestry“). */
export function ancestryItems(actor) {
  return actor?.items?.filter(i => i.type === "ancestry") ?? [];
}

/** Ancestries, die das Modul ohne Häkchen erkennt (gefaltete Namen). */
export function erkannteAncestries(actor) {
  const set = new Set();
  for (const item of ancestryItems(actor)) {
    for (const teil of item.name.split("/")) if (teil.trim()) set.add(falte(teil));
    const quelle = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    if (quelle === CLANK_UUID) set.add(CLANK);
  }
  return set;
}

/** Das Häkchen am Actor: "auto" · "ja" · "nein". */
export function clankSchalter(actor) {
  const wert = actor?.getFlag?.(MODUL_ID, "clank");
  return ["ja", "nein"].includes(wert) ? wert : "auto";
}

/** Alle Ancestries, mit denen dieser Charakter liest – inklusive Häkchen. */
export function ancestriesVon(actor) {
  const set = erkannteAncestries(actor);
  const schalter = clankSchalter(actor);
  if (schalter === "ja") set.add(CLANK);
  else if (schalter === "nein") set.delete(CLANK);
  return set;
}

/** Leser für einen Charakter. `@Erinys` passt auf „Erinys“ und auf „Erinys Vael“. */
export function leserFuerActor(actor) {
  if (!actor) return niemand();
  const voll = falte(actor.name);
  return {
    gm: false,
    ancestries: ancestriesVon(actor),
    namen: new Set([voll, voll.split(" ")[0]]),
    stufe: null,
    total: null,
    zugang: zugangskartenVon(actor)
  };
}

/** Leser für einen Benutzer: GM sieht alles, Spieler lesen mit ihrem zugewiesenen Charakter. */
export function leserFuerUser(user) {
  if (!user) return niemand();
  if (user.isGM) return gmLeser();
  return leserFuerActor(user.character);
}

/** Spielercharaktere der Welt (für Dialog, Prüfliste und Fenster „Leser“). */
export function spielerCharaktere() {
  return game.actors
    .filter(a => a.type === "character")
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}
