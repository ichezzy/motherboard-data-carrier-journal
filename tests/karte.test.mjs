import { test } from "node:test";
import assert from "node:assert/strict";
import { tileRechteck, tokenRechteck, enthaelt, abstand, inReichweite } from "../scripts/karte-logik.mjs";

const skala = { groesse: 100, distanz: 5, reichweite: 15 }; // 100 px pro Feld, 5 ft pro Feld, Very Close = 15 ft

test("Tile: x/y ist die Mitte (Anker 0.5), Anker 0 ist die Ecke", () => {
  assert.deepEqual(tileRechteck({ x: 250, y: 350, width: 100, height: 100 }), { links: 200, oben: 300, rechts: 300, unten: 400 });
  assert.deepEqual(tileRechteck({ x: 200, y: 300, width: 100, height: 100, anchorX: 0, anchorY: 0 }), { links: 200, oben: 300, rechts: 300, unten: 400 });
});

test("Token: x/y ist die linke obere Ecke", () => {
  assert.deepEqual(tokenRechteck({ x: 0, y: 0, width: 200, height: 100 }), { links: 0, oben: 0, rechts: 200, unten: 100 });
});

test("Treffer im Tile, daneben nicht", () => {
  const r = tileRechteck({ x: 250, y: 350, width: 100, height: 100 });
  assert.equal(enthaelt(r, { x: 250, y: 350 }), true);
  assert.equal(enthaelt(r, { x: 200, y: 300 }), true);
  assert.equal(enthaelt(r, { x: 199, y: 350 }), false);
});

test("Abstand: Nachbarfeld 0, ein Feld dazwischen 100 px, schräg nach Pythagoras", () => {
  const tile = tileRechteck({ x: 150, y: 50, width: 100, height: 100 });           // Feld (1,0)
  assert.equal(abstand(tokenRechteck({ x: 0, y: 0, width: 100, height: 100 }), tile), 0);
  assert.equal(abstand(tokenRechteck({ x: 300, y: 0, width: 100, height: 100 }), tile), 100);
  assert.equal(abstand(tokenRechteck({ x: 300, y: 200, width: 100, height: 100 }), tile), Math.hypot(100, 100));
  assert.equal(abstand(tokenRechteck({ x: 100, y: 0, width: 100, height: 100 }), tile), 0); // Token steht drauf
});

test("Very Close (15 ft): bis drei Felder Lücke geradeaus, vier nicht", () => {
  const tile = tileRechteck({ x: 50, y: 50, width: 100, height: 100 });
  const tokenBei = felder => tokenRechteck({ x: 100 + felder * 100, y: 0, width: 100, height: 100 });
  assert.equal(inReichweite(tokenBei(0), tile, skala), true);
  assert.equal(inReichweite(tokenBei(3), tile, skala), true);
  assert.equal(inReichweite(tokenBei(4), tile, skala), false);
});

test("Ohne gültiges Raster ist nichts in Reichweite", () => {
  const a = tokenRechteck({ x: 0, y: 0, width: 100, height: 100 });
  assert.equal(inReichweite(a, a, { groesse: 0, distanz: 5, reichweite: 15 }), false);
});
