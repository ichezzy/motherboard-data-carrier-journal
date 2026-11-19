<#
  Motherboard Data Carrier Journal auf den Foundry-Server kopieren (Hetzner, SSH-Eintrag „aetherion“).

  Aufruf aus dem Repo-Ordner:
    powershell -ExecutionPolicy Bypass -File tools\deploy.ps1

  Das Ziel steht in tools\ziel.txt (nicht im Git), z. B.
    aetherion:/srv/foundry/Data/modules/motherboard-data-carrier-journal
  Der letzte Ordnername muss die Modul-ID aus module.json sein.

  Ablauf: Tests → nur die Moduldateien in einen Zwischenordner →
  per scp in einen Ordner neben dem Ziel → alten Ordner austauschen →
  Besitzer wie der Ordner „modules“ setzen.
#>
param(
  [string]$Ziel
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$manifest = Get-Content module.json -Raw -Encoding UTF8 | ConvertFrom-Json
$modulId = $manifest.id
if (-not $Ziel) {
  $zielDatei = Join-Path $PSScriptRoot "ziel.txt"
  if (-not (Test-Path $zielDatei)) { throw "Kein Ziel. Lege tools\ziel.txt an (z. B. aetherion:/pfad/Data/modules/$modulId)." }
  $Ziel = (Get-Content $zielDatei -TotalCount 1).Trim()
}
if ($Ziel -notmatch ('^([^:]+):(/.+/modules/' + [regex]::Escape($modulId) + ')$')) { throw "Ziel muss so aussehen: host:/…/modules/$modulId – ist: $Ziel" }
$hostName = $Matches[1]
$pfad = $Matches[2]
$eltern = $pfad.Substring(0, $pfad.LastIndexOf('/'))   # Linux-Pfad, nicht Split-Path (das macht Backslashes)

Write-Host "Tests …"
node --test
if ($LASTEXITCODE -ne 0) { throw "Tests sind fehlgeschlagen – nichts kopiert." }

$version = $manifest.version
$zwischen = Join-Path ([System.IO.Path]::GetTempPath()) "$modulId-deploy"
if (Test-Path $zwischen) { Remove-Item $zwischen -Recurse -Force }
New-Item -ItemType Directory $zwischen | Out-Null
foreach ($teil in @("module.json", "scripts", "templates", "styles", "lang", "assets")) {
  if (Test-Path $teil) { Copy-Item $teil -Destination $zwischen -Recurse }
}

Write-Host "Kopiere Version $version nach ${hostName}:$pfad …"
ssh $hostName "rm -rf '$pfad.neu' && mkdir -p '$pfad.neu'"
if ($LASTEXITCODE -ne 0) { throw "SSH fehlgeschlagen." }
foreach ($eintrag in Get-ChildItem $zwischen) {
  scp -r -q $eintrag.FullName "${hostName}:$pfad.neu/"
  if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen bei $($eintrag.Name)." }
}
ssh $hostName "set -e; cd '$eltern'; rm -rf '$pfad.alt'; if [ -d '$pfad' ]; then mv '$pfad' '$pfad.alt'; fi; mv '$pfad.neu' '$pfad'; rm -rf '$pfad.alt'; chown -R --reference=. '$pfad'; chmod -R u=rwX,g=rX,o= '$pfad'"
if ($LASTEXITCODE -ne 0) { throw "Austausch auf dem Server fehlgeschlagen." }

Remove-Item $zwischen -Recurse -Force
Write-Host "Fertig: $($manifest.title) $version liegt auf dem Server."
Write-Host "Erstes Mal: Foundry neu starten (oder zurück ins Setup), dann das Modul in der Welt aktivieren."
Write-Host "Danach reicht meist F5 in der Welt."
