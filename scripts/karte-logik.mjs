/**
 * Reine Geometrie für Datenträger auf der Karte – ohne Foundry, damit sie testbar bleibt.
 * Rechtecke in Pixeln: { links, oben, rechts, unten }.
 */

/** Tile-Rechteck. In v14 ist x/y der Ankerpunkt des Tiles (Standard: die Mitte). */
export function tileRechteck({ x, y, width, height, anchorX = 0.5, anchorY = 0.5 }) {
  const links = x - width * anchorX;
  const oben = y - height * anchorY;
  return { links, oben, rechts: links + width, unten: oben + height };
}

/** Token-Rechteck. Bei Tokens ist x/y weiterhin die linke obere Ecke. */
export function tokenRechteck({ x, y, width, height }) {
  return { links: x, oben: y, rechts: x + width, unten: y + height };
}

/** Liegt der Punkt im Rechteck (Rand eingeschlossen)? */
export function enthaelt(r, { x, y }) {
  return x >= r.links && x <= r.rechts && y >= r.oben && y <= r.unten;
}

/** Lücke zwischen zwei Rechtecken in Pixeln – 0, wenn sie sich berühren oder überlappen. */
export function abstand(a, b) {
  const dx = Math.max(0, a.links - b.rechts, b.links - a.rechts);
  const dy = Math.max(0, a.oben - b.unten, b.oben - a.unten);
  return Math.hypot(dx, dy);
}

/**
 * Sind zwei Rechtecke nah genug beieinander?
 * @param {object} skala  groesse = Pixel pro Feld, distanz = Einheiten pro Feld, reichweite = erlaubte Einheiten
 */
export function inReichweite(a, b, { groesse, distanz, reichweite }) {
  if (!(groesse > 0) || !(distanz > 0)) return false;
  return (abstand(a, b) / groesse) * distanz <= reichweite + 1e-6;
}
