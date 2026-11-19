import { test } from "node:test";
import assert from "node:assert/strict";
import {
  neuesSalz, schluesselAus, verschluessele, entschluessele, probeErstellen, probeBestanden
} from "../scripts/krypto.mjs";

// Weniger Iterationen, damit der Test schnell bleibt – das Verfahren ist dasselbe.
const IT = 1000;

test("Hin und zurück, Umlaute und lange Texte", async () => {
  const salz = neuesSalz();
  const k = await schluesselAus("Mast am Rand der Deadband", salz, IT);
  const inhalt = { text: "<p>{{unübersetzt | Clank: Bergung nach Bedarf}}</p>".repeat(2000), gmNotiz: "Größe ✓" };
  const paket = await verschluessele(k, inhalt);
  assert.ok(!paket.includes("Bergung"), "kein Klartext im Paket");
  assert.deepEqual(await entschluessele(k, paket), inhalt);
});

test("Falsches Geheimwort scheitert", async () => {
  const salz = neuesSalz();
  const richtig = await schluesselAus("richtig", salz, IT);
  const falsch = await schluesselAus("falsch", salz, IT);
  const paket = await verschluessele(richtig, { text: "x" });
  await assert.rejects(() => entschluessele(falsch, paket));
});

test("Gleicher Inhalt ergibt jedes Mal ein anderes Paket", async () => {
  const k = await schluesselAus("w", neuesSalz(), IT);
  assert.notEqual(await verschluessele(k, { a: 1 }), await verschluessele(k, { a: 1 }));
});

test("Probe erkennt das richtige Geheimwort", async () => {
  const salz = neuesSalz();
  const k = await schluesselAus("eins", salz, IT);
  const probe = await probeErstellen(k);
  assert.equal(await probeBestanden(k, probe), true);
  assert.equal(await probeBestanden(await schluesselAus("zwei", salz, IT), probe), false);
});
