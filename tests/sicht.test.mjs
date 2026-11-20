import { test } from "node:test";
import assert from "node:assert/strict";
import { baueSicht, kannLesen, niemand, gmLeser, schliesseTags } from "../scripts/sicht.mjs";
import { luecken } from "../scripts/syntax.mjs";
import { cordexHtml } from "../scripts/cordex.mjs";

const erinys = { gm: false, ancestries: new Set(["clank"]), namen: new Set(["erinys"]), stufe: null };
const vanya = { gm: false, ancestries: new Set(["human"]), namen: new Set(["vanya"]), stufe: null };

// Abnahme Phase 1: drei Stellen unübersetzt, eine davon für Clank lesbar.
const ABNAHME = "<p>{{unübersetzt: Front aus drei}}. Verschüttet: 4.</p>"
  + "<p>{{unübersetzt | Clank: Bergung nach Bedarf}}.</p>"
  + "<p>Melder {{unübersetzt: unterwegs}}.</p>";

test("Abnahme: Erinys (Clank) liest genau die eine Stelle", () => {
  const { html, gesamt, lesbar } = baueSicht(ABNAHME, erinys);
  assert.equal(gesamt, 3);
  assert.equal(lesbar, 1);
  assert.ok(html.includes("Bergung nach Bedarf"));
  assert.ok(!html.includes("Front aus drei"));
  assert.ok(!html.includes("unterwegs"));
  assert.ok(html.includes(cordexHtml("Front aus drei")));
  assert.ok(html.includes("dt-cordex-wort"));
});

test("Abnahme: Vanya sieht nur Zeichen", () => {
  const { html, lesbar } = baueSicht(ABNAHME, vanya);
  assert.equal(lesbar, 0);
  for (const geheim of ["Front aus drei", "Bergung nach Bedarf", "unterwegs"]) assert.ok(!html.includes(geheim));
  assert.ok(html.includes("Verschüttet: 4."), "Text außerhalb der Markierungen bleibt");
});

test("Abnahme: GM sieht alles, mit Hervorhebung", () => {
  const { html, lesbar } = baueSicht(ABNAHME, gmLeser());
  assert.equal(lesbar, 3);
  for (const t of ["Front aus drei", "Bergung nach Bedarf", "unterwegs"]) assert.ok(html.includes(t));
  assert.ok(html.includes("class=\"dt-gm\""));
  assert.ok(!html.includes("{{"), "keine Rohsyntax in der Ansicht");
});

test("Spieler ohne Charakter liest nichts", () => {
  assert.equal(baueSicht(ABNAHME, niemand()).lesbar, 0);
});

test("Charakter-Regel", () => {
  const [l] = luecken("{{geschwärzt | @Vanya: Kontostand}}");
  assert.equal(kannLesen(l, vanya), true);
  assert.equal(kannLesen(l, erinys), false);
});

test("zerfallen fehlt für alle, auch mit Leser-Regel", () => {
  const [l] = luecken("{{zerfallen | Clank: weg}}");
  assert.equal(kannLesen(l, erinys), false);
  assert.ok(!baueSicht("{{zerfallen | Clank: weg}}", erinys).html.includes("weg"));
});

test("unbekannte Art: Spieler sehen nichts davon", () => {
  const { html } = baueSicht("<p>{{unübersezt | Clank: geheim}}</p>", erinys);
  assert.ok(!html.includes("geheim"));
  assert.ok(html.includes("dt-zerfallen"));
});

test("übersprochen: Nicht-Leser hören den Jingle, Leser das Original", () => {
  const roh = "{{übersprochen | Clank: Treffpunkt am Mast &gt;&gt; ♪ Ticker ♪}}";
  assert.ok(baueSicht(roh, vanya).html.includes("♪ Ticker ♪"));
  assert.ok(!baueSicht(roh, vanya).html.includes("Treffpunkt"));
  assert.ok(baueSicht(roh, erinys).html.includes("Treffpunkt am Mast"));
  const gm = baueSicht(roh, gmLeser()).html;
  assert.ok(gm.includes("Treffpunkt am Mast") && gm.includes("♪ Ticker ♪"), "GM sieht beide");
});

test("überschrieben: unauffälliger Ersatz", () => {
  const { html } = baueSicht("<p>Schuld {{überschrieben: beglichen &gt;&gt; offen: 340 Kn}}.</p>", vanya);
  assert.equal(html, "<p>Schuld offen: 340 Kn.</p>");
});

test("gesperrt ohne Ersatz nutzt die Standardmeldung", () => {
  assert.ok(baueSicht("{{gesperrt: Kontostand}}", vanya).html.includes("Version 3.0 required"));
});

test("abgerissen schneidet ab und schließt die Tags", () => {
  const roh = "<p>Melder unterwegs. Antwort erb{{abgerissen}}eten.</p><p>Geheimer Rest</p>";
  const { html, abgeschnitten } = baueSicht(roh, vanya);
  assert.equal(abgeschnitten, true);
  assert.ok(!html.includes("eten") && !html.includes("Geheimer Rest"));
  assert.ok(html.startsWith("<p>Melder unterwegs. Antwort erb"));
  assert.ok(html.endsWith("</p>"));
});

test("abgerissen mit Leser: Clank hört weiter", () => {
  const roh = "<p>Antwort erb{{abgerissen | Clank}}eten.</p><p>Rest</p>";
  assert.ok(baueSicht(roh, erinys).html.includes("Rest"));
});

test("geschwärzt, verrauscht, beschädigt verraten den Text nicht", () => {
  for (const art of ["geschwärzt", "verrauscht", "beschädigt", "zerfallen", "unübersetzt", "fremd"]) {
    const { html } = baueSicht(`<p>{{${art}: Rook schuldet 340}}</p>`, vanya);
    assert.ok(!html.includes("Rook") && !html.includes("schuldet"), art);
  }
});

test("beschädigt erzeugt keine Foundry-Syntax", () => {
  const { html } = baueSicht("{{beschädigt: " + "x".repeat(400) + "}}", vanya);
  assert.ok(!/[[\]{}@]/.test(html.replace(/<[^>]*>/g, "")));
});

test("Ansicht ist stabil (gleiche Eingabe, gleiche Ausgabe)", () => {
  const roh = "{{befallen: Bleib, bleib, bleib im Takt}} {{beschädigt: Datei}}";
  assert.equal(baueSicht(roh, vanya).html, baueSicht(roh, vanya).html);
});

test("schliesseTags", () => {
  assert.equal(schliesseTags("<p>a <em>b"), "<p>a <em>b</em></p>");
  assert.equal(schliesseTags("<p>a<br>b</p><p>c"), "<p>a<br>b</p><p>c</p>");
});
