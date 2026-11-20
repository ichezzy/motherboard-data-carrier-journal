import { test } from "node:test";
import assert from "node:assert/strict";
import { leseLeser, luecken, markierungsRahmen } from "../scripts/syntax.mjs";
import { baueSicht, niemand, gmLeser } from "../scripts/sicht.mjs";
import { dcVon, wirksamerTotal, zerfallStelle, istErfolg } from "../scripts/wurf.mjs";

const leser = total => ({ ...niemand(), total });

test("„DC n“ ist eine Leser-Regel", () => {
  assert.deepEqual(leseLeser("DC 18, Clank"), [{ art: "dc", wert: 18 }, { art: "ancestry", name: "Clank" }]);
  assert.deepEqual(leseLeser("dc12"), [{ art: "dc", wert: 12 }]);
  const [l] = luecken("{{locked | DC 15, @Vanya: Kontostand}}");
  assert.deepEqual(l.leser, [{ art: "dc", wert: 15 }, { art: "charakter", name: "Vanya" }]);
});

test("Markier-Knopf schreibt den DC vorne hin", () => {
  const r = markierungsRahmen({ art: "geschwärzt", dc: 18, ancestries: ["Clank"] });
  assert.equal(r.vor, "{{redacted | DC 18, Clank: ");
  assert.equal(markierungsRahmen({ art: "gesperrt", dc: null }).vor, "{{locked: ");
});

test("Welcher DC gilt", () => {
  const [eigen, standard, nie, zerfallen, zwei] = luecken(
    "{{locked | DC 20: a}} {{static: b}} {{corrupted: c}} {{decayed | DC 5: d}} {{redacted | DC 18, DC 14: e}}");
  assert.equal(dcVon(eigen, 12), 20, "eigener DC schlägt die Seite");
  assert.equal(dcVon(standard, 12), 12, "static ohne DC: Difficulty der Seite");
  assert.equal(dcVon(standard, null), null, "ohne Difficulty kein Standard");
  assert.equal(dcVon(nie, 12), null, "corrupted geht nie per Wurf auf");
  assert.equal(dcVon(zerfallen, 12), null, "decayed fehlt immer, auch mit DC");
  assert.equal(dcVon(zwei, 12), 14, "mehrere DCs: der niedrigste");
});

test("Sicht: Gesamtwert gegen den DC jeder Stelle", () => {
  const roh = "<p>{{locked: Kontostand 340}} · {{redacted | DC 18: Auftraggeber}} · {{corrupted: Rest}}</p>";
  const zustand = { difficulty: 12 };
  const bei = total => baueSicht(roh, leser(total), {}, zustand).html;
  assert.ok(!bei(null).includes("Kontostand"), "ohne Wurf: zu");
  assert.ok(!bei(11).includes("Kontostand"), "11 gegen Difficulty 12: zu");
  assert.ok(bei(12).includes("Kontostand"), "12: locked auf");
  assert.ok(!bei(17).includes("Auftraggeber"), "17 gegen DC 18: redacted zu");
  assert.ok(bei(18).includes("Auftraggeber"), "18: redacted auf");
  assert.ok(!bei(30).includes("Rest"), "corrupted nie");
  assert.equal(baueSicht(roh, leser(18), {}, zustand).lesbar, 2);
});

test("GM sieht den geltenden DC im Tooltip", () => {
  const { html } = baueSicht("{{locked: a}} {{redacted | DC 18: b}}", gmLeser(), {}, { difficulty: 12 });
  assert.ok(html.includes("locked · readable: DC 12"), html);
  assert.ok(html.includes("redacted · readable: DC 18"), html);
});

test("Welcher Gesamtwert gilt für wen", () => {
  const versuch = { total: 17, userId: "u1", actorId: "a1", geteilt: false };
  assert.equal(wirksamerTotal({ versuch }, { userId: "u1" }), 17, "eigener Wurf");
  assert.equal(wirksamerTotal({ versuch }, { userId: "u2" }), null, "fremder, nicht freigegeben");
  assert.equal(wirksamerTotal({ versuch: { ...versuch, geteilt: true } }, { userId: "u2" }), 17, "freigegeben");
  assert.equal(wirksamerTotal({ gruppe: 20, versuch }, { userId: "u1" }), 20, "der höhere zählt");
  assert.equal(wirksamerTotal({}, {}), null);
});

test("istErfolg", () => {
  assert.equal(istErfolg("Success with Fear"), true);
  assert.equal(istErfolg("Critical Success"), true);
  assert.equal(istErfolg("Failure with Hope"), false);
  assert.equal(istErfolg(null), false);
});

test("Failure with Hope: Was der Wurf per DC öffnet, zerfällt nicht", () => {
  const ls = luecken("{{locked | DC 8: offen}} {{locked: zu}}");
  for (let i = 0; i < 20; i++) {
    const nr = zerfallStelle(ls, "Failure with Hope", [], () => i / 20, { total: 10, difficulty: 12 });
    assert.equal(nr, 1, "nur die zweite Stelle (DC 12) kann zerfallen");
  }
});
