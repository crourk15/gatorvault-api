# Build server/data/roster/players.json from UF 2026 Spring roster markdown export.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$src = Join-Path $root 'server\data\roster\uf-spring-2026-source.md'
$out = Join-Path $root 'server\data\roster\players.json'

if (-not (Test-Path $src)) { Write-Error "Missing source file: $src" }

function Slugify([string]$name) {
    $s = $name.ToLower() -replace "['']", '' -replace '[^a-z0-9]+', '-' -replace '(^-+|-+$)', ''
    return $s
}

function PosUnit([string]$pos) {
    if ($pos -in @('QB','RB','WR','TE','OL')) { return 'offense' }
    if ($pos -in @('P','K','LS')) { return 'special' }
    return 'defense'
}

function HeightNorm([string]$h) {
    if ($h -match "(\d+)'\s*(\d+)") { return "$($matches[1])-$($matches[2])" }
    return $h
}

function DepthTier([int]$rating) {
    if ($rating -ge 84) { return 'starter' }
    if ($rating -ge 76) { return 'rotation' }
    return 'developmental'
}

$overrides = @{
    'jayden-woods' = 90; 'cormani-mcclain' = 89; 'jadan-baugh' = 88; 'eric-singleton-jr' = 87
    'vernell-brown-iii' = 86; 'dallas-wilson' = 86; 'tramell-jones-jr' = 85; 'dijon-johnson' = 86
    'myles-graham' = 86; 'lacota-dippre' = 84; 'aaron-philo' = 84; 'jaden-robinson' = 85
    'bryce-thornton' = 85; 'kanye-clark' = 83; 'cam-dooley' = 82; 'evan-pryor' = 81
    'tj-shanahan-jr' = 80; 'eagan-boyer' = 79; 'harrison-moore' = 79; 'brendan-bett' = 82
    'lj-mccray' = 80; 'jeramiah-mccloud' = 78; 'patrick-durkin' = 74
}

function Get-Enriched {
    param([string]$Slug)
    switch ($Slug) {
        'jayden-woods' { return @{ bio='Best player on the defense. JACK in Brad White''s 3-3-5 - the edge pressure package runs through him.'; stats='Scheme centerpiece at JACK - sets the edge and rushes the passer.'; stars=4; strengths=@('Explosive first step off the edge','High motor and finish rate as a pass rusher','Versatile enough to drop into short zones'); weaknesses=@('Can be sealed on power runs without length leverage','Still refining counter moves vs. elite tackles'); projection='All-SEC caliber edge defender with NFL draft ceiling if he stays healthy through 2026.'; schemeFit='Ideal JACK in Brad White''s 3-3-5 - primary blitzer and edge setter in the odd front.' } }
        'cormani-mcclain' { return @{ bio='Lakeland product and former #1 CB recruit nationally. Portal addition who returns as the starting LCB.'; stats='Elite lockdown corner and boundary defender.'; stars=5; strengths=@('Rare length and twitch for the position','Ball skills and recovery speed in phase'); weaknesses=@('Physicality vs. bigger receivers can waver','Penalty discipline needs consistency'); projection='First-round NFL corner projection if he re-establishes top-tier form in 2026.'; schemeFit='Press-man boundary corner - perfect fit for aggressive single-high looks.' } }
        'jadan-baugh' { return @{ bio='Workhorse three-down back. Must-win games run through his ability to control time of possession.'; stats='Workhorse starter - 3-down back.'; stars=4; strengths=@('Vision and patience between the tackles','Reliable hands and pass protection'); weaknesses=@('Lacks elite breakaway speed','Durability through a heavy workload is the question'); projection='SEC starter with 1,000-yard season upside in a balanced offense.'; schemeFit='Every-down back in a pro-style/run-first scheme - early-down and short-yardage hammer.' } }
        'eric-singleton-jr' { return @{ bio='Auburn transfer and clear WR1. Go-to weapon on early downs and in the red zone.'; stats='Auburn transfer - WR1 - Go-to weapon.'; stars=4; strengths=@('Route nuance and separation at all three levels','Reliable hands in traffic'); weaknesses=@('Not a pure vertical burner','Contested catch rate vs. length can vary'); projection='1,000-yard receiver and primary target for the new staff in 2026.'; schemeFit='Move-the-chains X/slot hybrid - early-down and red-zone focal point.' } }
        'vernell-brown-iii' { return @{ bio='Gainesville legacy and starting F/slot receiver. Quickness and vision make him the top return option.'; stats='Slot weapon at F - Versatile route runner.'; stars=4 } }
        'dallas-wilson' { return @{ bio='Tampa Bay Tech product and projected X receiver with size to win on the boundary.'; stats='X receiver - Projected starter.'; stars=4 } }
        'tramell-jones-jr' { return @{ bio='Jacksonville product and dual-threat spring starter candidate with game experience.'; stats='Spring starter candidate - Dual-threat QB.'; stars=4 } }
        'dijon-johnson' { return @{ bio='Press-man corner with physical coverage skills. Rotates with McClain in the secondary.'; stats='Press-man corner - Physical coverage.'; stars=4 } }
        'myles-graham' { return @{ bio='Gainesville native and All-SEC candidate with speed and instinct in space.'; stats='All-SEC candidate - Second-level communicator.'; stars=4 } }
        'lacota-dippre' { return @{ bio='James Madison transfer and starting Y tight end. Legitimate vertical weapon in the offense.'; stats='Starting Y tight end - Red-zone threat.'; stars=3 } }
        'aaron-philo' { return @{ bio='Georgia Tech transfer with a cleaner pro-style delivery. Strong on third downs in spring work.'; stats='GT transfer - Rhythm passer in QB battle.'; stars=4 } }
        'jaden-robinson' { return @{ bio='Lake City native and MIKE linebacker. Communication and pre-snap reads anchor the defense.'; stats='Field general - MIKE linebacker.'; stars=4 } }
        'bryce-thornton' { return @{ bio='Strong safety enforcer and physical leader in the secondary.'; stats='SS enforcer - Physical leader in secondary.'; stars=3 } }
        'kanye-clark' { return @{ bio='UCLA transfer projected as the starting STAR/nickel in the 3-3-5.'; stats='Starting STAR - Nickel fit in 3-3-5.'; stars=3 } }
        'cam-dooley' { return @{ bio='Kentucky transfer who projects as a starting safety in the new scheme.'; stats='Portal safety - Starter candidate.'; stars=3 } }
        'evan-pryor' { return @{ bio='Ohio State/Cincinnati transfer RB who adds experienced depth behind Baugh.'; stats='Veteran RB depth - Change-of-pace back.'; stars=3 } }
        'tj-shanahan-jr' { return @{ bio='Penn State/TAMU transfer competing for a starting guard spot on the rebuilt OL.'; stats='Portal RG - Dead heat for starting job.'; stars=3 } }
        'eagan-boyer' { return @{ bio='Penn State transfer with length at tackle. Push for RT or swing tackle role.'; stats='Portal OL - RT depth/push.'; stars=3 } }
        'harrison-moore' { return @{ bio='Southlake Carroll transfer who projects as the starting center.'; stats='Starting center - OL anchor.'; stars=3 } }
        'brendan-bett' { return @{ bio='Baylor transfer nose tackle - key piece in Brad White''s 3-3-5 front.'; stats='Starting nose - Run-stuffer in 3-3-5.'; stars=3 } }
        default { return $null }
    }
}

function EstimateRating($pos, $class, $transfer, $name) {
    $slug = Slugify $name
    if ($overrides.ContainsKey($slug)) { return $overrides[$slug] }
    $base = 68
    if ($class -match '^R-Sr|^Gr') { $base += 6 }
    elseif ($class -match '^Sr') { $base += 8 }
    elseif ($class -match '^Jr') { $base += 6 }
    elseif ($class -match '^So') { $base += 4 }
    elseif ($class -match '^Fr') { $base += 2 }
    if ($transfer) { $base += 3 }
    if ($pos -in @('QB','JACK','ILB','WR','CB','STAR')) { $base += 2 }
    if ($base -gt 88) { $base = 88 }
    if ($base -lt 62) { $base = 62 }
    return $base
}

function EstimateStars($rating, $transfer, $slug) {
    $e = Get-Enriched $slug
    if ($e -and $e.stars) { return $e.stars }
    if ($rating -ge 88) { return 4 }
    if ($rating -ge 82) { if ($transfer) { return 4 } else { return 3 } }
    if ($rating -ge 76) { return 3 }
    return $null
}

function RoleSummary($pos, $class, $transferInfo, $slug) {
    $e = Get-Enriched $slug
    if ($e -and $e.stats) { return $e.stats }
    $posLabel = switch ($pos) { 'JACK' { 'hybrid edge' } 'STAR' { 'STAR/nickel' } 'ILB' { 'linebacker' } default { $pos.ToLower() } }
    if ($transferInfo) { return "$transferInfo - $posLabel on the 2026 spring roster." }
    return "$posLabel - $class on the 2026 spring roster."
}

function BioText($name, $pos, $class, $hometown, $transferInfo, $slug) {
    $e = Get-Enriched $slug
    if ($e -and $e.bio) { return $e.bio }
    $ht = if ($hometown) { " from $hometown" } else { '' }
    $tr = if ($transferInfo) { " $transferInfo." } else { '' }
    return "$name is a $class $pos$ht.$tr Spring roster profile for the 2026 Gators."
}

$detailRe = "^([A-Z-]+)\s+(R-Fr\.|R-So\.|R-Jr\.|R-Sr\.|Fr\.|So\.|Jr\.|Sr\.|Gr\.)\s+(\d+'\s+\d+'')\s+(\d+)\s*lbs"

$raw = Get-Content $src -Raw
$lines = $raw -split "`r?`n"
$players = @()
$seen = @{}
$i = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i].Trim()
    if ($line -eq 'Coaching Staff') { break }
    if ($line -match '^### (.+)$') {
        $name = $matches[1].Trim()
        $detail = if ($i + 2 -lt $lines.Count) { $lines[$i + 2].Trim() } else { '' }
        $locLine = if ($i + 4 -lt $lines.Count) { $lines[$i + 4].Trim() } else { '' }
        if ($detail -match $detailRe) {
            $pos = $matches[1]
            $class = $matches[2]
            $height = HeightNorm $matches[3]
            $weight = $matches[4]
            $transferInfo = $null
            $hometown = $locLine
            if ($locLine -match ' Previous School: ') {
                $parts = $locLine -split ' Previous School: ', 2
                $hometown = $parts[0].Trim()
                $transferInfo = "Transfer from $($parts[1].Trim())"
            }
            $slug = Slugify $name
            if (-not $seen.ContainsKey($slug)) {
                $seen[$slug] = $true
                $rating = EstimateRating $pos $class ([bool]$transferInfo) $name
                $stars = EstimateStars $rating ([bool]$transferInfo) $slug
                $player = [ordered]@{
                    slug = $slug; name = $name; pos = $pos; year = $class; class = $class
                    height = $height; weight = $weight; hometown = $hometown; jersey = $null
                    unit = (PosUnit $pos); transferInfo = $transferInfo; stars = $stars; rank = $null
                    rating = $rating; ratingOverride = $null; headshotUrl = $null
                    bio = (BioText $name $pos $class $hometown $transferInfo $slug)
                    stats = (RoleSummary $pos $class $transferInfo $slug)
                    injury = 'green'; depthChartTier = (DepthTier $rating)
                }
                $e = Get-Enriched $slug
                if ($e) {
                    if ($e.strengths) { $player.strengths = $e.strengths }
                    if ($e.weaknesses) { $player.weaknesses = $e.weaknesses }
                    if ($e.projection) { $player.projection = $e.projection }
                    if ($e.schemeFit) { $player.schemeFit = $e.schemeFit }
                }
                $players += $player
            }
        }
    }
    $i++
}

$players = $players | Sort-Object { -$_.rating }, name
$json = $players | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($out, $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($players.Count) players to $out"
