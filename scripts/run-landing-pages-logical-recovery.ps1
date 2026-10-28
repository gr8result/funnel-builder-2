param([switch]$UseDatabasePassword, [string]$RestoreFrom)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$source = 'C:\Users\grant\AppData\Local\GR8Result\Recovery\20261015T220106Z-37eb966e'
$script = Join-Path (Get-Location) 'scripts\landing-pages-logical-recovery.mjs'
if (-not (Test-Path -LiteralPath (Join-Path $source 'key.dpapi'))) { throw 'The current-user DPAPI backup key is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $source 'verified-ca\root-ca.crt'))) { throw 'The verified Supabase project CA is missing.' }

if ($RestoreFrom) {
  # Restore a completed encrypted backup into a network-isolated local container and validate the Landing Pages migration.
  $key = $null
  try {
    $key = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $source 'key.dpapi')), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $env:GR8_RECOVERY_KEY = [Convert]::ToBase64String($key)
    $ErrorActionPreference = 'Continue'
    & node (Join-Path (Get-Location) 'scripts\landing-pages-isolated-restore.mjs') $RestoreFrom
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Isolated restore or migration validation did not pass; see the report above.' }
  } finally {
    Remove-Item Env:GR8_RECOVERY_KEY -ErrorAction SilentlyContinue
    if ($key) { [Array]::Clear($key, 0, $key.Length) }
  }
  return
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$directory = Join-Path $source ('authorized-logical-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))
[IO.Directory]::CreateDirectory($directory) | Out-Null
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($identity)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
Set-Acl -LiteralPath $directory -AclObject $acl
Copy-Item -LiteralPath (Join-Path $source 'key.dpapi') -Destination (Join-Path $directory 'key.dpapi')
Copy-Item -LiteralPath (Join-Path $source 'verified-ca\root-ca.crt') -Destination (Join-Path $directory 'root-ca.crt')

$key = $null
$secret = $null
$plain = [IntPtr]::Zero
try {
  $key = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $directory 'key.dpapi')), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $env:GR8_RECOVERY_KEY = [Convert]::ToBase64String($key)
  if ($UseDatabasePassword) {
    # Supabase CLI's documented SUPABASE_DB_PASSWORD handoff: the CLI then pairs it with postgres.<project-ref> instead of minting
    # its temporary cli_login_postgres role. It lives only in this process environment (never argv, history or logs).
    $secret = Read-Host -AsSecureString 'Enter the funnel-builder-db PostgreSQL database password (Dashboard > Database settings; input is hidden)'
    $plain = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secret)
    $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringUni($plain)
    Write-Output 'Starting TLS-verified read-only logical export as postgres.<project-ref> using the supplied database password.'
  } else {
    Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
    Write-Output 'Starting TLS-verified read-only logical export using the Supabase CLI temporary login role (cli_login_postgres). No password prompt, plaintext backup, or production write is used.'
  }
  # Node reports retries on stderr; under 'Stop' Windows PowerShell would turn a redirected stderr line into a terminating error.
  $ErrorActionPreference = 'Continue'
  & node $script backup $directory
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted logical export did not complete; inspect its redacted status and encrypted diagnostic artifact.' }
  Write-Output ('Encrypted backup location: ' + $directory)
} finally {
  Remove-Item Env:GR8_RECOVERY_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  if ($plain -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($plain) }
  if ($secret) { $secret.Dispose() }
  if ($key) { [Array]::Clear($key, 0, $key.Length) }
}
