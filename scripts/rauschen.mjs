/**
 * Rauschteppich (Phase 2): leises, gefiltertes Rauschen unter dem Audio – Web Audio, ohne Datei.
 * Klang je Art: Anthanen tief und weich, Signal mittig wie ein Funkkanal, Modul hell und dünn.
 */

let kontext = null;
let puffer = null;
let laufend = null;

const FILTER = {
  anthanen: { frequenz: 700, q: 0.6 },
  signal: { frequenz: 1800, q: 0.9 },
  modul: { frequenz: 3400, q: 1.2 }
};

/** Foundrys Lautstärke für Oberflächen-Klänge, falls vorhanden. */
function grundLautstaerke() {
  try {
    const wert = game.settings.get("core", "globalInterfaceVolume");
    return Number.isFinite(wert) ? wert : 1;
  } catch {
    return 1;
  }
}

function holeKontext() {
  kontext ??= new AudioContext();
  if (kontext.state === "suspended") kontext.resume();
  return kontext;
}

/** Zwei Sekunden rosa Rauschen, in Schleife abgespielt. */
function rauschPuffer(ctx) {
  const laenge = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, laenge, ctx.sampleRate);
  const daten = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < laenge; i++) {
    const weiss = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + weiss * 0.099046;
    b1 = 0.963 * b1 + weiss * 0.2965164;
    b2 = 0.57 * b2 + weiss * 1.0526913;
    daten[i] = (b0 + b1 + b2 + weiss * 0.1848) * 0.16;
  }
  return buffer;
}

function zielPegel(staerke) {
  return Math.max(0, Math.min(1, Number(staerke) || 0)) * 0.35 * grundLautstaerke();
}

/** Rauschen starten (ersetzt ein laufendes). staerke 0 … 1. */
export function starteRauschen(staerke, art = "signal") {
  stoppeRauschen();
  if (!(Number(staerke) > 0)) return;
  try {
    const ctx = holeKontext();
    puffer ??= rauschPuffer(ctx);
    const quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = (FILTER[art] ?? FILTER.signal).frequenz;
    filter.Q.value = (FILTER[art] ?? FILTER.signal).q;
    const pegel = ctx.createGain();
    pegel.gain.setValueAtTime(0, ctx.currentTime);
    pegel.gain.linearRampToValueAtTime(zielPegel(staerke), ctx.currentTime + 0.6);
    quelle.connect(filter).connect(pegel).connect(ctx.destination);
    quelle.start();
    laufend = { quelle, pegel };
  } catch (err) {
    console.warn("motherboard-data-carrier-journal | Noise bed not available", err);
  }
}

/** Lautstärke eines laufenden Rauschens ändern. */
export function setzeRauschStaerke(staerke) {
  if (!laufend || !kontext) return;
  if (!(Number(staerke) > 0)) return stoppeRauschen();
  laufend.pegel.gain.setTargetAtTime(zielPegel(staerke), kontext.currentTime, 0.1);
}

export function rauschenLaeuft() {
  return Boolean(laufend);
}

/** Sanft ausblenden und beenden. */
export function stoppeRauschen() {
  if (!laufend || !kontext) return;
  const { quelle, pegel } = laufend;
  laufend = null;
  try {
    pegel.gain.setTargetAtTime(0, kontext.currentTime, 0.15);
    quelle.stop(kontext.currentTime + 0.8);
  } catch { /* schon gestoppt */ }
}
