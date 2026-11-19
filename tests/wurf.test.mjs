import { test } from "node:test";
import assert from "node:assert/strict";
import { stufeAusWurf } from "../scripts/wurf.mjs";
import { baueSicht, kannLesen } from "../scripts/sicht.mjs";
import { luecken } from "../scripts/syntax.mjs";
import { STUFEN } from "../scripts/konstanten.mjs";

test("Duality-Wurf → Lesestufe", () => {
  assert.deepEqual(stufeAusWurf({ kritisch: true, erfolg: false, hope: false }), { stufe: "Critical Success", sicher: true });
  assert.deepEqual(stufeAusWurf({ kritisch: false, erfolg: true, hope: true }), { stufe: "Success with Hope", sicher: true });
  assert.deepEqual(stufeAusWurf({ kritisch: false, erfolg: true, hope: false }), { stufe: "Success with Fear", sicher: true });
  assert.deepEqual(stufeAusWurf({ kritisch: false, erfolg: false, hope: true }), { stufe: "Failure with Hope", sicher: true });
  assert.deepEqual(stufeAusWurf({ kritisch: false, erfolg: false, hope: false }), { stufe: "Failure with Fear", sicher: true });
});

test("ohne Difficulty: Erfolg geraten, Hope/Fear stimmt", () => {
  assert.deepEqual(stufeAusWurf({ kritisch: false, hope: false }), { stufe: "Success with Fear", sicher: false });
});

test("jede Stufe ist eine der fünf", () => {
  for (const kritisch of [true, false]) for (const erfolg of [true, false, undefined]) for (const hope of [true, false]) {
    assert.ok(STUFEN.includes(stufeAusWurf({ kritisch, erfolg, hope }).stufe));
  }
});

test("Lesestufe: ab dem gewählten Ergebnis lesbar, für jeden", () => {
  const [l] = luecken("{{unübersetzt | Success with Hope: Bergung nach Bedarf}}");
  const leser = stufe => ({ gm: false, ancestries: new Set(), namen: new Set(), stufe });
  assert.equal(kannLesen(l, leser(null)), false);
  assert.equal(kannLesen(l, leser("Success with Fear")), false);
  assert.equal(kannLesen(l, leser("Success with Hope")), true);
  assert.equal(kannLesen(l, leser("Critical Success")), true);
  assert.ok(baueSicht("{{unübersetzt | Success with Hope: Bergung}}", leser("Critical Success")).html.includes("Bergung"));
});
