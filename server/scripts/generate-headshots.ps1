# Generate SVG placeholder headshots + headshots.json from players.json
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$rosterPath = Join-Path $root 'server\data\roster\players.json'
$headshotsDir = Join-Path $root 'server\headshots'
$mapPath = Join-Path $root 'server\data\roster\headshots.json'

function Get-Initials([string]$name) {
    $clean = $name -replace '\s+(Jr\.|Sr\.|III|II|IV)$', ''
    $parts = $clean.Trim().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts.Count -eq 1) { return $parts[0].Substring(0,1).ToUpper() }
    return ($parts[0].Substring(0,1) + $parts[$parts.Count-1].Substring(0,1)).ToUpper()
}

function Get-Svg([string]$name, [string]$ini) {
    $safe = [System.Security.SecurityElement]::Escape($name)
    return @"
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="$safe">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#001a4d"/><stop offset="100%" stop-color="#003087"/></linearGradient></defs>
  <rect width="400" height="400" fill="#030712"/>
  <circle cx="200" cy="200" r="168" fill="url(#g)" stroke="#FA4616" stroke-width="6"/>
  <text x="200" y="228" text-anchor="middle" fill="#FA4616" font-family="Oswald,Arial,sans-serif" font-size="96" font-weight="700">$ini</text>
</svg>
"@
}

$players = Get-Content $rosterPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $headshotsDir | Out-Null
$map = @{}
foreach ($p in $players) {
    $slug = $p.slug
    $file = "$slug.svg"
    $svg = Get-Svg $p.name (Get-Initials $p.name)
    [System.IO.File]::WriteAllText((Join-Path $headshotsDir $file), $svg, [System.Text.UTF8Encoding]::new($false))
    $map[$slug] = "/headshots/$file"
}
($map | ConvertTo-Json -Depth 3) + "`n" | Set-Content $mapPath -Encoding UTF8
Write-Host "Generated $($players.Count) headshots"
