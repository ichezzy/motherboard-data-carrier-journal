/**
 * Publishes the current version to GitHub (started from "Modul veröffentlichen.bat"):
 * tests → clean working tree? → summary → ask → module.json download URL → package (dist/) →
 * push → GitHub release with module.json + ZIP. Foundry then finds the update by itself.
 *
 * The version comes from module.json – raise it before publishing. Console text stays German
 * (it is for the GM on this PC); everything that ends up on GitHub is English.
 */
import { execFileSync } from "node:child_process";
import readline from "node:readline/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "./zip.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "ichezzy/motherboard-data-carrier-journal";
const MODULE_PARTS = ["module.json", "scripts", "templates", "styles", "lang", "assets"];
const DIST = path.join(ROOT, "dist");

function run(prog, args, { quiet = true } = {}) {
  try {
    return execFileSync(prog, args, { cwd: ROOT, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" })?.trim() ?? "";
  } catch (error) {
    const text = (error.stderr || error.stdout || error.message || "").toString().trim();
    throw new Error(`„${prog} ${args.join(" ")}“ ist fehlgeschlagen:\n${text}`);
  }
}

function tryRun(prog, args) {
  try { return run(prog, args); } catch { return null; }
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function writeManifest(manifest) {
  // Same compact layout as before: one-line authors/languages.
  return JSON.stringify(manifest, null, 2)
    .replace(/\{\n\s+"name": "([^"]+)"\n\s+\}/g, '{ "name": "$1" }')
    .replace(/\{\n\s+"lang": "(\w+)",\n\s+"name": "([^"]+)",\n\s+"path": "([\w/.]+)"\n\s+\}/g, '{ "lang": "$1", "name": "$2", "path": "$3" }') + "\n";
}

async function ask(text) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(text)).trim().toLowerCase();
  rl.close();
  return answer === "j" || answer === "ja" || answer === "y" || answer === "yes";
}

function releaseNotes(previousTag, version) {
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const subjects = run("git", ["log", "--format=%s", range])
    .split("\n").map(s => s.trim()).filter(s => s && !/^Release \d/.test(s));
  const lines = [previousTag ? `Changes since ${previousTag}:` : "First public release.", ""];
  if (previousTag) lines.push(...subjects.map(s => `- ${s}`));
  lines.push("", `Install in Foundry: Add-on Modules → Install Module → Manifest URL`,
    `https://github.com/${REPO}/releases/latest/download/module.json`);
  return lines.join("\n");
}

async function main() {
  const manifestPath = path.join(ROOT, "module.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const version = manifest.version;
  const tag = `v${version}`;
  console.log(`Motherboard: Data Carrier Journal – Version ${version}\n`);

  console.log("Tests …");
  run("node", ["--test"]);
  console.log("Tests bestanden.");

  if (run("git", ["status", "--porcelain"])) {
    throw new Error("Es gibt Änderungen, die noch nicht committet sind. Erst committen, dann veröffentlichen.");
  }
  if (tryRun("gh", ["release", "view", tag, "--repo", REPO])) {
    throw new Error(`Version ${version} ist schon veröffentlicht. Erst die Versionsnummer in module.json erhöhen.`);
  }

  tryRun("git", ["fetch", "--tags", "--quiet", "origin"]);
  const previousTag = tryRun("git", ["describe", "--tags", "--abbrev=0"]);
  const commits = run("git", ["log", "--oneline", previousTag ? `${previousTag}..HEAD` : "HEAD"]).split("\n").filter(Boolean);
  console.log(previousTag ? `Seit ${previousTag}: ${commits.length} Commit(s)` : `Erste Veröffentlichung: ${commits.length} Commit(s)`);
  for (const line of commits.slice(0, 15)) console.log(`  ${line}`);
  if (commits.length > 15) console.log(`  … und ${commits.length - 15} weitere`);
  console.log("");

  if (!(await ask(`Version ${version} jetzt auf GitHub veröffentlichen? (j/n) `))) {
    console.log("Nichts veröffentlicht.");
    return;
  }

  // module.json: url/manifest/download for this version (committed, so the repo matches the release)
  const urls = {
    url: `https://github.com/${REPO}`,
    manifest: `https://github.com/${REPO}/releases/latest/download/module.json`,
    download: `https://github.com/${REPO}/releases/download/${tag}/${manifest.id}.zip`
  };
  if (Object.entries(urls).some(([k, v]) => manifest[k] !== v)) {
    Object.assign(manifest, urls);
    fs.writeFileSync(manifestPath, writeManifest(manifest), "utf8");
    run("git", ["add", "module.json"]);
    run("git", ["commit", "-q", "-m", `Release ${version}: set download URL`]);
  }

  // Package: module.json at the archive root, as Foundry expects.
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  const files = [];
  for (const part of MODULE_PARTS) {
    const full = path.join(ROOT, part);
    if (!fs.existsSync(full)) continue;
    const list = fs.statSync(full).isDirectory() ? listFiles(full) : [full];
    for (const file of list.sort()) {
      files.push({ name: path.relative(ROOT, file).split(path.sep).join("/"), data: fs.readFileSync(file) });
    }
  }
  const zipPath = path.join(DIST, `${manifest.id}.zip`);
  fs.writeFileSync(zipPath, createZip(files));
  fs.copyFileSync(manifestPath, path.join(DIST, "module.json"));
  const notesPath = path.join(DIST, "release.md");
  fs.writeFileSync(notesPath, releaseNotes(previousTag, version), "utf8");
  console.log(`Paket: ${files.length} Dateien, ${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB`);

  console.log("Lade hoch …");
  run("git", ["push", "-q", "origin", "HEAD:main"]);
  run("gh", ["release", "create", tag, path.join(DIST, "module.json"), zipPath,
    "--repo", REPO, "--title", `Version ${version}`, "--notes-file", notesPath, "--target", "main"]);
  tryRun("git", ["fetch", "--tags", "--quiet", "origin"]);

  console.log("");
  console.log(`Fertig: Version ${version} ist veröffentlicht – https://github.com/${REPO}/releases/tag/${tag}`);
  console.log("In Foundry: Setup → Add-on Modules → „Nach Updates suchen“ → bei „Motherboard: Data Carrier Journal“ aktualisieren.");
}

try {
  await main();
} catch (error) {
  console.error("\nVERÖFFENTLICHEN IST ABGEBROCHEN:\n" + (error?.message ?? error));
  process.exitCode = 1;
}
