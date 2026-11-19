/**
 * Audio für alle: Der GM schickt über den Modul-Socket „abspielen“ oder „stopp“,
 * jeder Client spielt die Datei über Foundrys AudioHelper – mit Rauschteppich darunter.
 * (Im Fenster selbst spielt jeder über den normalen <audio>-Player für sich.)
 */
import { SOCKET } from "./konstanten.mjs";
import { starteRauschen, stoppeRauschen } from "./rauschen.mjs";

let laufend = null;

async function spieleLokal(src, { rauschen = 0, art = "signal" } = {}) {
  stoppeLokal();
  try {
    const sound = await foundry.audio.AudioHelper.play({ src, volume: 0.8, loop: false }, false);
    laufend = sound;
    starteRauschen(rauschen, art);
    // Rauschen endet mit der Aufnahme
    const ende = () => {
      if (laufend === sound) {
        laufend = null;
        stoppeRauschen();
      }
    };
    sound?.addEventListener?.("end", ende, { once: true });
    sound?.addEventListener?.("stop", ende, { once: true });
  } catch (err) {
    console.error("Motherboard Data Carrier Journal | Audio konnte nicht abgespielt werden", src, err);
  }
}

function stoppeLokal() {
  const sound = laufend;
  laufend = null;
  try {
    sound?.stop?.();
  } catch (err) {
    console.warn("Motherboard Data Carrier Journal | Audio ließ sich nicht stoppen", err);
  }
  stoppeRauschen();
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
