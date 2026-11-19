/**
 * Verschlüsselung für den Geheimmodus – WebCrypto, ohne Foundry (in Node testbar).
 *
 * Foundry 14 schickt jedem Benutzer alle Journale, Einstellungen und Kompendien.
 * Was Spieler nicht lesen dürfen, liegt deshalb nur verschlüsselt in der Welt:
 * AES-GCM 256, Schlüssel per PBKDF2 aus dem Geheimwort des GM. Das Geheimwort
 * bleibt im Browser des GM und erreicht nie den Server.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
export const ITERATIONEN = 250000;

function nachBase64(bytes) {
  let s = "";
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function ausBase64(text) {
  const s = atob(text);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export function kryptoVerfuegbar() {
  return Boolean(globalThis.crypto?.subtle);
}

/** Zufälliges Salz (öffentlich, liegt in der Welt). */
export function neuesSalz() {
  return nachBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Schlüssel aus Geheimwort und Salz. */
export async function schluesselAus(geheimwort, salz, iterationen = ITERATIONEN) {
  const roh = await crypto.subtle.importKey("raw", enc.encode(geheimwort), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ausBase64(salz), iterations: iterationen, hash: "SHA-256" },
    roh,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Objekt → verschlüsseltes Paket (als JSON-String, passt in ein StringField). */
export async function verschluessele(schluessel, objekt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const daten = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, schluessel, enc.encode(JSON.stringify(objekt)));
  return JSON.stringify({ v: 1, iv: nachBase64(iv), daten: nachBase64(daten) });
}

/** Paket → Objekt. Wirft bei falschem Schlüssel oder beschädigten Daten. */
export async function entschluessele(schluessel, paket) {
  const { v, iv, daten } = typeof paket === "string" ? JSON.parse(paket) : paket;
  if (v !== 1) throw new Error(`Unbekannte Paketversion ${v}`);
  const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ausBase64(iv) }, schluessel, ausBase64(daten));
  return JSON.parse(dec.decode(klar));
}

/** Prüfwert, um ein Geheimwort zu bestätigen, ohne es zu speichern. */
export const PROBE = "motherboard-data-carrier-journal:ok";

export async function probeErstellen(schluessel) {
  return verschluessele(schluessel, PROBE);
}

export async function probeBestanden(schluessel, probe) {
  try {
    return (await entschluessele(schluessel, probe)) === PROBE;
  } catch {
    return false;
  }
}
