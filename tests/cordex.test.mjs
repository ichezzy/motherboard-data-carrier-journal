import { test } from "node:test";
import assert from "node:assert/strict";
import { cordexWort, cordexText } from "../scripts/cordex.mjs";

test("gleiches Wort, gleiche Zeichen – unabhängig von Groß-/Kleinschreibung", () => {
  assert.equal(cordexWort("Bergung"), cordexWort("bergung"));
  assert.equal(cordexWort("Bergung"), cordexWort("BERGUNG"));
});

test("verschiedene Wörter, (fast immer) verschiedene Zeichen", () => {
  const woerter = ["Front", "Bergung", "Halle", "Melder", "Station", "Kreischer", "Mast", "Bedarf"];
  const zeichen = new Set(woerter.map(cordexWort));
  assert.equal(zeichen.size, woerter.length);
});

test("2 bis 5 Zeichen pro Wort", () => {
  for (const w of ["a", "ab", "Mast", "Bergung", "Verschüttungsprotokoll"]) {
    const n = Array.from(cordexWort(w)).length;
    assert.ok(n >= 2 && n <= 5, `${w}: ${n}`);
  }
});

test("Satzzeichen und Leerzeichen bleiben, Buchstaben verschwinden", () => {
  const t = cordexText("Front aus drei. Verschüttet: 4!");
  assert.ok(!/[A-Za-zäöüÄÖÜß0-9]/.test(t));
  assert.equal((t.match(/ /g) ?? []).length, 4);
  assert.ok(t.includes(".") && t.includes(":") && t.endsWith("!"));
});

test("wiederkehrendes Wort ist im Satz wiederzuerkennen", () => {
  const t = cordexText("Mast und Mast");
  const [a, , c] = t.split(" ");
  assert.equal(a, c);
});
