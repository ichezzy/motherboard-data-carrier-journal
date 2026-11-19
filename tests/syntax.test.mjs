import { test } from "node:test";
import assert from "node:assert/strict";
import { zerlege, luecken, erkenneLuecke, leseLeser, markierungsRahmen, falte } from "../scripts/syntax.mjs";

test("Umlaute und Schreibweisen der Lücken", () => {
  assert.equal(erkenneLuecke("unübersetzt"), "unübersetzt");
  assert.equal(erkenneLuecke("Unuebersetzt"), "unübersetzt");
  assert.equal(erkenneLuecke("  GESCHWAERZT "), "geschwärzt");
  assert.equal(erkenneLuecke("beschaedigt"), "beschädigt");
  assert.equal(erkenneLuecke("unübersezt"), null);
});

test("einfache Markierung ohne Leser", () => {
  const [l] = luecken("<p>Front {{unübersetzt: ist gefallen}}.</p>");
  assert.equal(l.art, "unübersetzt");
  assert.equal(l.inhalt, "ist gefallen");
  assert.deepEqual(l.leser, []);
  assert.equal(l.gueltig, true);
  assert.equal(l.ueberBlock, false);
});

test("Text davor und danach bleibt erhalten", () => {
  const stuecke = zerlege("<p>A {{zerfallen: B}} C</p>");
  assert.deepEqual(stuecke.map(s => s.typ), ["text", "luecke", "text"]);
  assert.equal(stuecke[0].html, "<p>A ");
  assert.equal(stuecke[2].html, " C</p>");
});

test("Leser: Ancestry, Charakter, Lesestufe", () => {
  const [l] = luecken("{{unübersetzt | Clank, @Erinys, Success with Hope: Bergung nach Bedarf}}");
  assert.deepEqual(l.leser, [
    { art: "ancestry", name: "Clank" },
    { art: "charakter", name: "Erinys" },
    { art: "stufe", wert: "Success with Hope" }
  ]);
  assert.equal(l.inhalt, "Bergung nach Bedarf");
});

test("Ersatz hinter >> – so wie ProseMirror es speichert (&gt;&gt;)", () => {
  const [l] = luecken("<p>{{übersprochen | Clank: Treffpunkt am Mast &gt;&gt; ♪ Der Ticker hält dich wach! ♪}}</p>");
  assert.equal(l.inhalt, "Treffpunkt am Mast");
  assert.equal(l.ersatz, "♪ Der Ticker hält dich wach! ♪");
});

test("Ersatz auch als rohes >> (Obsidian)", () => {
  const [l] = luecken("{{gesperrt: Kontostand 12 Kn >> Version 3.0 erforderlich}}");
  assert.equal(l.ersatz, "Version 3.0 erforderlich");
});

test(">> bei Lücken ohne Ersatz bleibt Teil des Texts", () => {
  const [l] = luecken("{{unübersetzt: a &gt;&gt; b}}");
  assert.equal(l.ersatz, null);
  assert.equal(l.inhalt, "a &gt;&gt; b");
});

test("Foundry-Verweise im markierten Text", () => {
  const [l] = luecken("{{unübersetzt | Clank: siehe @UUID[JournalEntry.abc]{Halle} und [[/r 1d6]]}}");
  assert.equal(l.inhalt, "siehe @UUID[JournalEntry.abc]{Halle} und [[/r 1d6]]");
});

test("Doppelpunkt im Text ist Teil des Inhalts", () => {
  const [l] = luecken("{{geschwärzt: Konto: 340 Kn}}");
  assert.equal(l.inhalt, "Konto: 340 Kn");
});

test("Formatierung im markierten Text", () => {
  const [l] = luecken("<p>{{unübersetzt | Clank: <em>Front</em> aus <a href=\"https://x.y\">drei</a>}}</p>");
  assert.equal(l.inhalt, "<em>Front</em> aus <a href=\"https://x.y\">drei</a>");
});

test("abgerissen ohne Text", () => {
  const [l] = luecken("<p>Melder unterwegs. Antwort erb{{abgerissen}}eten.</p>");
  assert.equal(l.art, "abgerissen");
  assert.equal(l.inhalt, "");
});

test("unbekannte Art bleibt eine (ungültige) Lücke", () => {
  const [l] = luecken("{{unübersezt: geheim}}");
  assert.equal(l.gueltig, false);
  assert.equal(l.art, null);
  assert.equal(l.artRoh, "unübersezt");
});

test("über Absatzgrenzen", () => {
  const [l] = luecken("<p>{{zerfallen: eins</p><p>zwei}}</p>");
  assert.equal(l.ueberBlock, true);
});

test("ohne schließende Klammern ist es keine Markierung", () => {
  const stuecke = zerlege("<p>{{unübersetzt: offen</p>");
  assert.deepEqual(stuecke, [{ typ: "text", html: "<p>{{unübersetzt: offen</p>" }]);
});

test("mehrere Markierungen werden durchnummeriert", () => {
  const ls = luecken("{{zerfallen: a}} x {{befallen: b}} y {{unübersetzt: c}}");
  assert.deepEqual(ls.map(l => l.nr), [0, 1, 2]);
});

test("leseLeser ignoriert Leeres", () => {
  assert.deepEqual(leseLeser(" , Clank ,, @ "), [{ art: "ancestry", name: "Clank" }]);
});

test("Rahmen für den Markier-Knopf", () => {
  const r = markierungsRahmen({ art: "unübersetzt", ancestries: ["Clank"], charaktere: ["Erinys"] });
  assert.equal(r.vor, "{{unübersetzt | Clank, @Erinys: ");
  assert.equal(r.nach, "}}");
  const g = markierungsRahmen({ art: "gesperrt", ersatz: "Version 3.0 erforderlich" });
  assert.equal(g.vor + "Kontostand" + g.nach, "{{gesperrt: Kontostand >> Version 3.0 erforderlich}}");
  assert.equal(markierungsRahmen({ art: "abgerissen", ancestries: ["Clank"] }).ohneText, "{{abgerissen | Clank}}");
});

test("Rahmen und Parser passen zusammen", () => {
  const r = markierungsRahmen({ art: "überschrieben", charaktere: ["Vanya"], ersatz: "Schuld offen" });
  const [l] = luecken(`<p>${r.vor}Schuld beglichen${r.nach.replace(">>", "&gt;&gt;")}</p>`);
  assert.equal(l.art, "überschrieben");
  assert.equal(l.inhalt, "Schuld beglichen");
  assert.equal(l.ersatz, "Schuld offen");
  assert.deepEqual(l.leser, [{ art: "charakter", name: "Vanya" }]);
});

test("falte", () => {
  assert.equal(falte("  Erinys   Vael "), "erinys vael");
  assert.equal(falte("Größe"), "groesse");
});
