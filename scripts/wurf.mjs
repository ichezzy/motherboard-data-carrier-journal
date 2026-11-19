/**
 * Duality-Wurf → Lesestufe. Ohne Foundry, damit es testbar bleibt.
 */

/**
 * @param {{kritisch: boolean, erfolg?: boolean, hope: boolean}} wurf
 *        erfolg fehlt, wenn der Wurf keine Difficulty hatte.
 * @returns {{stufe: string, sicher: boolean}}  sicher = false: Erfolg/Misserfolg ist geraten
 */
export function stufeAusWurf({ kritisch, erfolg, hope }) {
  if (kritisch) return { stufe: "Critical Success", sicher: true };
  const mit = hope ? "Hope" : "Fear";
  if (typeof erfolg !== "boolean") return { stufe: `Success with ${mit}`, sicher: false };
  return { stufe: `${erfolg ? "Success" : "Failure"} with ${mit}`, sicher: true };
}
