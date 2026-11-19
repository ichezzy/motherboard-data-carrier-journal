/**
 * Audio für alle: Der GM schickt über den Modul-Socket „abspielen“ oder „stopp“,
 * jeder Client spielt die Datei über Foundrys AudioHelper – mit Rauschteppich darunter.
 * Solange das läuft, ist der eigene Player im Fenster bei allen gesperrt.
 * (Sonst spielt jeder im Fenster über den normalen <audio>-Player für sich.)
 */
import { SOCKET } from "./konstanten.mjs";
import { starteRauschen, stoppeRauschen } from "./rauschen.mjs";

let laufend = null;
let fuerAlle = false;

/** Läuft gerade eine Wiedergabe „für alle“? */
export function laeuftFuerAlle() {
  return fuerAlle;
}

/** Player in einem .dt-audio-Block sperren oder freigeben (passend zum Zustand). */
export function markierePlayer(block) {
  if (!block) return;
  block.classList.toggle("dt-fuer-alle", fuerAlle);
  const player = block.querySelector("audio");
  if (!player) return;
  if (fuerAlle) {
    if (!player.paused) player.pause();
    player.setAttribute("tabindex", "-1");
    player.setAttribute("aria-disabled", "true");
  } else {
    player.removeAttribute("tabindex");
    player.removeAttribute("aria-disabled");
  }
}

function setzeFuerAlle(wert) {
  fuerAlle = wert;
  for (const block of document.querySelectorAll(".datentraeger-ansicht .dt-audio")) markierePlayer(block);
}

async function spieleLokal(src, { rauschen = 0, art = "signal" } = {}) {
  stoppeLokal({ freigeben: false });
  setzeFuerAlle(true);
  try {
    const sound = await foundry.audio.AudioHelper.play({ src, volume: 0.8, loop: false }, false);
    if (!sound) throw new Error("Kein Sound");
    laufend = sound;
    starteRauschen(rauschen, art);
    // Rauschen und Sperre enden mit der Aufnahme
    const ende = () => {
      if (laufend !== sound) return;
      laufend = null;
      stoppeRauschen();
      setzeFuerAlle(false);
    };
    sound.addEventListener?.("end", ende, { once: true });
    sound.addEventListener?.("stop", ende, { once: true });
  } catch (err) {
    console.error("Motherboard Data Carrier Journal | Audio konnte nicht abgespielt werden", src, err);
    setzeFuerAlle(false);
  }
}

function stoppeLokal({ freigeben = true } = {}) {
  const sound = laufend;
  laufend = null;
  try {
    sound?.stop?.();
  } catch (err) {
    console.warn("Motherboard Data Carrier Journal | Audio ließ sich nicht stoppen", err);
  }
  stoppeRauschen();
  if (freigeben) setzeFuerAlle(false);
}

/** Nur der GM: Datei bei allen abspielen (auch bei sich selbst). */
export function fuerAlleAbspielen(src, { rauschen = 0, art = "signal" } = {}) {
  if (!game.user.isGM || !src) return;
  game.socket.emit(SOCKET, { aktion: "abspielen", src, rauschen, art, von: game.user.id });
  return spieleLokal(src, { rauschen, art });
}

/** Nur der GM: bei allen stoppen. */
export function fuerAlleStoppen() {
  if (!game.user.isGM) return;
  game.socket.emit(SOCKET, { aktion: "stopp", von: game.user.id });
  stoppeLokal();
}

export function registriereSocket() {
  game.socket.on(SOCKET, daten => {
    // Nur Befehle vom GM annehmen.
    if (!game.users.get(daten?.von)?.isGM) return;
    if (daten.aktion === "abspielen" && daten.src) spieleLokal(daten.src, daten);
    else if (daten.aktion === "stopp") stoppeLokal();
  });
}
