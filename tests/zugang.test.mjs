import { test } from "node:test";
import assert from "node:assert/strict";
import { leseLeser, luecken, markierungsRahmen } from "../scripts/syntax.mjs";
import { baueSicht, niemand, gmLeser } from "../scripts/sicht.mjs";

const mitKarten = (...karten) => ({ ...niemand(), zugang: karten });

test("„Level n“ und „Aussteller Level n“ sind Leser-Regeln", () => {
  assert.deepEqual(leseLeser("Level 2"), [{ art: "zugang", level: 2, aussteller: null }]);
  assert.deepEqual(leseLeser("CTC Level 3, DC 20"), [{ art: "zugang", level: 3, aussteller: "CTC" }, { art: "dc", wert: 20 }]);
  assert.deepEqual(leseLeser("Netz Pfeiler level1"), [{ art: "zugang", level: 1, aussteller: "Netz Pfeiler" }]);
  assert.deepEqual(leseLeser("Level 4"), [{ art: "ancestry", name: "Level 4" }], "nur Level 1–3");
});

test("Markier-Knopf schreibt die Karte", () => {
  assert.equal(markierungsRahmen({ art: "gesperrt", zugang: { level: 2, aussteller: "CTC" } }).vor, "{{locked | CTC Level 2: ");
  assert.equal(markierungsRahmen({ art: "gesperrt", dc: 18, zugang: { level: 1, aussteller: "" } }).vor, "{{locked | DC 18, Level 1: ");
  assert.equal(markierungsRahmen({ art: "gesperrt", zugang: null }).vor, "{{locked: ");
});

test("Karte öffnet ab ihrem Level, Aussteller muss passen", () => {
  const roh = "<p>{{locked | Level 2: Lager}} · {{locked | CTC Level 3: Vorstand}} · {{redacted | ctc level 1: Kantine}}</p>";
  const zustand = { difficulty: 30 }; // Wurf hilft hier nicht
  const sieht = (leser, wort) => baueSicht(roh, leser, {}, zustand).html.includes(wort);
  assert.ok(!sieht(mitKarten(), "Lager"), "ohne Karte zu");
  assert.ok(!sieht(mitKarten({ level: 1, aussteller: "CTC" }), "Lager"), "Level 1 reicht nicht für Level 2");
  assert.ok(sieht(mitKarten({ level: 2, aussteller: "Kreischer" }), "Lager"), "„Level 2“ nimmt jeden Aussteller");
  assert.ok(!sieht(mitKarten({ level: 3, aussteller: "Kreischer" }), "Vorstand"), "fremder Aussteller öffnet „CTC Level 3“ nicht");
  assert.ok(sieht(mitKarten({ level: 3, aussteller: "ctc" }), "Vorstand"), "CTC Level 3, Groß/klein egal");
  assert.ok(sieht(mitKarten({ level: 3, aussteller: "CTC" }), "Kantine"), "höheres Level öffnet niedrigere Stellen");
  assert.ok(!sieht(mitKarten({ level: 3, aussteller: null }), "Kantine"), "Karte ohne Aussteller öffnet keine CTC-Stelle");
});

test("Karte und Wurf: eine Regel reicht", () => {
  const roh = "{{locked | DC 20, Level 2: Tresor}}";
  assert.ok(baueSicht(roh, { ...mitKarten(), total: 20 }, {}, {}).html.includes("Tresor"), "per Wurf");
  assert.ok(baueSicht(roh, mitKarten({ level: 2, aussteller: null }), {}, {}).html.includes("Tresor"), "per Karte");
});

test("GM sieht die Karten-Regel im Tooltip", () => {
  const { html } = baueSicht("{{locked | CTC Level 2: a}}", gmLeser(), {}, { difficulty: 12 });
  assert.ok(html.includes("CTC Level 2"), html);
  const [l] = luecken("{{locked | CTC Level 2: a}}");
  assert.equal(l.leser[0].art, "zugang");
});
