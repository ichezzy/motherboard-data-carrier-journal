/**
 * Audio für alle: Der GM schickt über den Modul-Socket „abspielen“ oder „stopp“,
 * jeder Client spielt die Datei über Foundrys AudioHelper.
 * (Im Fenster selbst spielt jeder über den normalen <audio>-Player für sich.)
 */
import { SOCKET } from "./konstanten.mjs";

let laufend = null;

async function spieleLokal(src) {
  stoppeLokal();
  try {
    laufend = await foundry.audio.AudioHelper.play({ src, volume: 0.8, loop: false }, false);
  } catch (err) {
    console.error("Datenträger | Audio konnte nicht abgespielt werden", src, err);
  }
}

function stoppeLokal() {
  try {
    laufend?.stop?.();
  } catch (err) {
    console.warn("Datenträger | Audio ließ sich nicht stoppen", err);
  }
  laufend = null;
}

/** Nur der GM: Datei bei allen abspielen (auch bei sich selbst). */
export function fuerAlleAbspielen(src) {
  if (!game.user.isGM || !src) return;
  game.socket.emit(SOCKET, { aktion: "abspielen", src, von: game.user.id });
  return spieleLokal(src);
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
    if (daten.aktion === "abspielen" && daten.src) spieleLokal(daten.src);
    else if (daten.aktion === "stopp") stoppeLokal();
  });
}
