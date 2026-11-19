/**
 * Aufbau-Animationen der drei Skins. Das CSS macht die Bewegung,
 * hier werden nur Zeilen und Wörter nummeriert und die Klasse gesetzt.
 */
import { MODUL_ID } from "./konstanten.mjs";

const MAX_WOERTER = 400;

/** Bewegung an? Einstellung „Bewegung“ und prefers-reduced-motion. */
export function bewegungErlaubt() {
  let wert = "system";
  try {
    wert = game.settings.get(MODUL_ID, "bewegung");
  } catch { /* Einstellung noch nicht registriert */ }
  if (wert === "an") return true;
  if (wert === "aus") return false;
  return !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Signal: jedes Wort in ein <span class="dt-wort">, damit es einzeln aus dem Rauschen steigen kann. */
function woerterEinwickeln(text) {
  if (text.dataset.dtWoerter) return Number(text.dataset.dtWoerter);
  const knoten = [];
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest("svg, .dt-wort") || !n.nodeValue.trim())
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  while (walker.nextNode()) knoten.push(walker.currentNode);

  let nr = 0;
  for (const k of knoten) {
    if (nr >= MAX_WOERTER) break;
    const teile = k.nodeValue.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    for (const teil of teile) {
      if (!teil) continue;
      if (/^\s+$/.test(teil) || nr >= MAX_WOERTER) {
        fragment.append(teil);
        continue;
      }
      const span = document.createElement("span");
      span.className = "dt-wort";
      span.style.setProperty("--dt-w", String(nr++));
      span.textContent = teil;
      fragment.append(span);
    }
    k.replaceWith(fragment);
  }
  // Cordex-Wörter (SVG) steigen mit auf
  for (const svg of text.querySelectorAll("svg.dt-cordex-wort")) {
    if (svg.parentElement?.classList.contains("dt-wort")) continue;
    const span = document.createElement("span");
    span.className = "dt-wort";
    span.style.setProperty("--dt-w", String(Math.min(nr++, MAX_WOERTER)));
    svg.replaceWith(span);
    span.append(svg);
  }
  text.dataset.dtWoerter = String(nr);
  return nr;
}

/**
 * Animation (neu) starten.
 * @param {HTMLElement} ansicht  Das <article class="datentraeger-ansicht">
 */
export function starteAufbau(ansicht) {
  if (!ansicht) return;
  ansicht.classList.remove("dt-animiert");
  if (!bewegungErlaubt()) return;

  const art = ansicht.dataset.art;
  const text = ansicht.querySelector(".dt-text");
  if (text) {
    const zeilen = Array.from(text.children);
    zeilen.forEach((z, i) => z.style.setProperty("--dt-i", String(i)));
    // Lange Texte schneller aufbauen: höchstens etwa 5 Sekunden.
    ansicht.style.setProperty("--dt-schritt", `${Math.min(0.35, 5 / Math.max(zeilen.length, 1)).toFixed(3)}s`);
    if (art === "signal") {
      const woerter = woerterEinwickeln(text);
      ansicht.style.setProperty("--dt-wschritt", `${Math.min(0.07, 6 / Math.max(woerter, 1)).toFixed(3)}s`);
    }
  }
  ansicht.querySelectorAll(".dt-baender i").forEach((band, n) => band.style.setProperty("--n", String(n)));

  void ansicht.offsetWidth; // Reflow, damit die Animation neu beginnt
  ansicht.classList.add("dt-animiert");
}
