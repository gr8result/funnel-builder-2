[CmdletBinding()]
param(
  [ValidateSet('Plan', 'DryRun', 'Apply')]
  [string]$Mode = 'Plan',
  [string]$CredentialPath = 'C:\Users\grant\.gr8result\staging-db.xml',
  [string]$Confirmation = '',
  [switch]$BackupConfirmed
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationNames = @(
  '20260813085900_landing_pages_legacy_baseline.sql',
  '20260813090100_account_onboarding_gate.sql',
  '20260813090300_workspace_part1_tables.sql',
  '20260813090400_workspace_part2_security.sql',
  '20260813090500_workspace_crm_refactor.sql',
  '20260813090550_landing_pages_storage_buckets.sql',
  '20260813090600_business_profile_vault.sql',
  '20261014000100_landing_page_campaigns.sql',
  '20261028000100_workspace_members_rls_recursion_fix.sql',
  '20261101000100_funnel_master_templates.sql',
  '20261101000200_crm_lead_notes_access.sql',
  '20261101000300_campaign_master_templates.sql',
  '20261101000400_funnel_form_crm.sql',
  '20261101000500_landing_pages_security_hardening.sql'
)

$migrationManifest = foreach ($name in $migrationNames) {
  $path = Join-Path $repositoryRoot "supabase\migrations\$name"
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required migration is missing: $name"
  }
  [PSCustomObject]@{
    Name = $name
    Sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}

Write-Output "Landing Pages staging bootstrap plan ($($migrationNames.Count) migrations):"
$migrationManifest | ForEach-Object {
  Write-Output "  $($_.Name) sha256=$($_.Sha256)"
}

if ($Mode -eq 'Plan') {
  Write-Output 'PLAN_ONLY: no credential loaded and no database connection made.'
  exit 0
}

if (-not (Test-Path -LiteralPath $CredentialPath)) {
  throw 'The DPAPI staging credential file is unavailable.'
}
if ($Mode -eq 'Apply' -and (-not $BackupConfirmed -or $Confirmation -cne 'APPLY gr8-result-staging')) {
  throw 'Apply requires -BackupConfirmed and -Confirmation "APPLY gr8-result-staging".'
}

$credential = Import-Clixml -LiteralPath $CredentialPath
$userText = $credential.UserName
$protectedText = $credential.GetNetworkCredential().Password
$uriText = if ($protectedText -match '^postgres(ql)?://') {
  $protectedText
} elseif ($userText -match '^postgres(ql)?://') {
  $builder = [UriBuilder]::new($userText)
  $builder.Password = $protectedText
  $builder.Uri.AbsoluteUri
} else {
  throw 'The protected credential does not contain a PostgreSQL URI.'
}

$uri = [Uri]$uriText
$userInfo = [Uri]::UnescapeDataString($uri.UserInfo).Split(':', 2)
if ($userInfo.Count -ne 2 -or -not $userInfo[0].StartsWith('postgres.')) {
  throw 'The protected URI is not a Supabase pooler identity.'
}
if ($uri.AbsolutePath.Trim('/') -ne 'postgres') {
  throw 'The protected URI does not target the expected postgres database.'
}
$projectRef = $userInfo[0].Substring(9)
$databasePassword = $userInfo[1]

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $projectJson = & supabase projects list --output json 2>$null
  $projectListExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}
if ($projectListExitCode -ne 0) {
  throw 'Supabase project identity lookup failed.'
}
$projects = ($projectJson -join [Environment]::NewLine) | ConvertFrom-Json
$project = @($projects) |
  Where-Object { $_.id -eq $projectRef } |
  Select-Object -First 1
if (-not $project -or $project.name -ne 'gr8-result-staging' -or $project.region -ne 'ap-southeast-2') {
  throw 'Refusing to continue: the credential does not resolve to the approved Sydney staging project.'
}
Write-Output "TARGET_VERIFIED: project=$($project.name) region=$($project.region) database=postgres"
if ($Mode -eq 'DryRun') {
  Write-Warning 'Supabase CLI dry-run may initialize empty supabase_migrations metadata tables.'
}

$workdir = Join-Path $env:TEMP "gr8-landing-pages-staging-bootstrap-$PID"
$supabaseDir = Join-Path $workdir 'supabase'
$migrationDir = Join-Path $supabaseDir 'migrations'
if (Test-Path -LiteralPath $workdir) {
  throw 'Refusing to overwrite an existing bootstrap work directory.'
}

try {
  New-Item -ItemType Directory -Path $migrationDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'supabase\config.toml') -Destination (Join-Path $supabaseDir 'config.toml')
  foreach ($name in $migrationNames) {
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "supabase\migrations\$name") -Destination (Join-Path $migrationDir $name)
  }

  $env:SUPABASE_DB_PASSWORD = $databasePassword
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & supabase link --project-ref $projectRef --workdir $workdir --yes
    $linkExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($linkExitCode -ne 0) {
    throw 'Supabase staging link failed.'
  }

  $pushArgs = @('db', 'push', '--include-all', '--workdir', $workdir, '--yes')
  if ($Mode -eq 'DryRun') {
    $pushArgs += '--dry-run'
  }
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & supabase @pushArgs
    $pushExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($pushExitCode -ne 0) {
    throw "Supabase staging $Mode failed."
  }
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $databasePassword = $null
  $uriText = $null
  $protectedText = $null
  $credential = $null
  if (Test-Path -LiteralPath $workdir) {
    Remove-Item -LiteralPath $workdir -Recurse -Force
  }
}
