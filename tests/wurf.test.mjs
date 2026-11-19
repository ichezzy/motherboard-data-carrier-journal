import { test } from "node:test";
import assert from "node:assert/strict";
import { stufeAusWurf } from "../scripts/wurf.mjs";
import { baueSicht, kannLesen, gmLeser } from "../scripts/sicht.mjs";
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

import { wirksameStufe, hoehereStufe, zerfallStelle } from "../scripts/wurf.mjs";

test("hoehereStufe", () => {
  assert.equal(hoehereStufe(null, "Failure with Hope"), "Failure with Hope");
  assert.equal(hoehereStufe("Critical Success", "Success with Fear"), "Critical Success");
  assert.equal(hoehereStufe(null, null), null);
});

test("wirksameStufe: eigener Versuch nur für sich, freigegeben für alle", () => {
  const versuch = { stufe: "Success with Hope", userId: "u1", actorId: "a1", geteilt: false };
  assert.equal(wirksameStufe({ versuch }, { userId: "u1" }), "Success with Hope");
  assert.equal(wirksameStufe({ versuch }, { userId: "u2", actorId: "a1" }), "Success with Hope", "gleicher Charakter");
  assert.equal(wirksameStufe({ versuch }, { userId: "u2", actorId: "a2" }), null);
  assert.equal(wirksameStufe({ versuch: { ...versuch, geteilt: true } }, { userId: "u2" }), "Success with Hope");
  assert.equal(wirksameStufe({ gruppe: "Critical Success", versuch }, { userId: "u2" }), "Critical Success");
});

test("zerfallStelle: nie das Bruchstück, nie zweimal, nie abgerissen", () => {
  const ls = luecken("{{unübersetzt | Failure with Hope: Bruchstück}} {{unübersetzt: a}} {{abgerissen}} {{zerfallen: b}} {{geschwärzt: c}}");
  const nrs = new Set();
  for (let i = 0; i < 50; i++) nrs.add(zerfallStelle(ls, "Failure with Hope", [], () => i / 50));
  assert.deepEqual([...nrs].sort(), [1, 4]);
  assert.equal(zerfallStelle(ls, "Failure with Hope", [1, 4]), null);
});

test("Sicht: zerfallene Stelle fehlt für alle, auch für Leser", () => {
  const roh = "<p>{{unübersetzt | Clank: Bergung}} und {{unübersetzt: Halle}}</p>";
  const erinys = { gm: false, ancestries: new Set(["clank"]), namen: new Set(), stufe: null };
  const { html } = baueSicht(roh, erinys, {}, { zerfallen: [0] });
  assert.ok(!html.includes("Bergung"));
  assert.ok(html.includes("dt-zerfallen"));
  const gm = baueSicht(roh, gmLeser(), {}, { zerfallen: [0] }).html;
  assert.ok(gm.includes("Bergung") && gm.includes("dt-gm-zerfallen"), "GM sieht es noch, markiert");
});

test("Sicht: zerstört – nichts Lesbares, auch kein normaler Text", () => {
  const roh = "<p>MELDUNG an Station {{unübersetzt | Clank: Westhalde}}</p><p>Front aus drei.</p>";
  const erinys = { gm: false, ancestries: new Set(["clank"]), namen: new Set(), stufe: "Critical Success" };
  const s = baueSicht(roh, erinys, {}, { zerstoert: true, art: "anthanen" });
  assert.equal(s.zerstoert, true);
  for (const wort of ["MELDUNG", "Station", "Westhalde", "Front", "drei"]) assert.ok(!s.html.includes(wort), wort);
  assert.equal((s.html.match(/<p>/g) ?? []).length, 2, "Zeilen bleiben als Zeilen erkennbar");
  assert.ok(baueSicht(roh, gmLeser(), {}, { zerstoert: true }).html.includes("Westhalde"));
});

test("Sicht im Archiv: Cordex als Platzhalter ohne Wort und ohne SVG", () => {
  const vanya = { gm: false, ancestries: new Set(), namen: new Set(), stufe: null };
  const { html } = baueSicht("<p>{{unübersetzt: Westhalde}}</p>", vanya, {}, { archiv: true });
  assert.ok(html.includes('data-cordex="'));
  assert.ok(!html.includes("<svg") && !html.includes("Westhalde"));
});
