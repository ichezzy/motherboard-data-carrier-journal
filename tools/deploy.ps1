<#
  Datenträger auf den Foundry-Server kopieren (Hetzner, SSH-Eintrag „aetherion“).

  Aufruf aus dem Repo-Ordner:
    powershell -ExecutionPolicy Bypass -File tools\deploy.ps1

  Das Ziel steht in tools\ziel.txt (nicht im Git), z. B.
    aetherion:/root/foundrydata/Data/modules/datentraeger

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

if (-not $Ziel) {
  $zielDatei = Join-Path $PSScriptRoot "ziel.txt"
  if (-not (Test-Path $zielDatei)) { throw "Kein Ziel. Lege tools\ziel.txt an (z. B. aetherion:/pfad/Data/modules/datentraeger)." }
  $Ziel = (Get-Content $zielDatei -TotalCount 1).Trim()
}
if ($Ziel -notmatch '^([^:]+):(/.+/modules/datentraeger)$') { throw "Ziel muss so aussehen: host:/…/modules/datentraeger – ist: $Ziel" }
$hostName = $Matches[1]
$pfad = $Matches[2]
$eltern = $pfad.Substring(0, $pfad.LastIndexOf('/'))   # Linux-Pfad, nicht Split-Path (das macht Backslashes)

Write-Host "Tests …"
node --test
if ($LASTEXITCODE -ne 0) { throw "Tests sind fehlgeschlagen – nichts kopiert." }

$version = (Get-Content module.json -Raw | ConvertFrom-Json).version
$zwischen = Join-Path ([System.IO.Path]::GetTempPath()) "datentraeger-deploy"
if (Test-Path $zwischen) { Remove-Item $zwischen -Recurse -Force }
New-Item -ItemType Directory $zwischen | Out-Null
foreach ($teil in @("module.json", "scripts", "templates", "styles", "lang")) {
  Copy-Item $teil -Destination $zwischen -Recurse
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
Write-Host "Fertig: Datenträger $version liegt auf dem Server."
Write-Host "Erstes Mal: Foundry neu starten (oder zurück ins Setup), dann das Modul in der Welt aktivieren."
Write-Host "Danach reicht meist F5 in der Welt."
