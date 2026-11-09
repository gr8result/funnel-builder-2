import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function assertWindowsTestMemory() {
  if (process.platform !== "win32") return;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference = 'Stop'; $c = Get-Counter '\\Memory\\Committed Bytes','\\Memory\\Commit Limit'; $used = ($c.CounterSamples | Where-Object { $_.Path -like '*\\committed bytes' }).CookedValue; $limit = ($c.CounterSamples | Where-Object { $_.Path -like '*\\commit limit' }).CookedValue; $os = Get-CimInstance Win32_OperatingSystem; [pscustomobject]@{ commitHeadroomMB = [math]::Floor(($limit - $used) / 1MB); freePhysicalMB = [math]::Floor($os.FreePhysicalMemory / 1024) } | ConvertTo-Json -Compress",
  ], { windowsHide: true });
  const memory = JSON.parse(stdout);
  if (!Number.isFinite(memory.commitHeadroomMB) || !Number.isFinite(memory.freePhysicalMB)) {
    throw new Error("Cannot verify Windows memory; refusing to launch the isolated test stack.");
  }
  console.log(`Windows memory: ${memory.commitHeadroomMB} MB commit headroom; ${memory.freePhysicalMB} MB physical memory available.`);
  if (memory.commitHeadroomMB < 8192 || memory.freePhysicalMB < 4096) {
    throw new Error("Insufficient Windows memory. This test requires at least 8192 MB commit headroom and 4096 MB available physical memory; no test server or browser was launched.");
  }
}

function processEnv(pid, { port, workspace }) {
  return {
    ...process.env,
    LP_TEST_PID: String(pid),
    LP_TEST_NODE_EXE: process.execPath,
    LP_TEST_WORKSPACE: path.resolve(workspace),
    LP_TEST_PORT: String(port),
  };
}

export async function captureOwnedProcessIdentity(child, options) {
  if (!child?.pid) throw new Error("The test process was not spawned.");
  if (process.platform !== "win32") return { pid: child.pid };

  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference = 'Stop'; $p = Get-CimInstance Win32_Process -Filter \"ProcessId = $env:LP_TEST_PID\"; if (-not $p) { throw 'Spawned Next process is not running.' }; [pscustomobject]@{ processId = [int]$p.ProcessId; parentProcessId = [int]$p.ParentProcessId; executablePath = $p.ExecutablePath; commandLine = $p.CommandLine; createdUtc = $p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress",
  ], { windowsHide: true, env: processEnv(child.pid, options) });
  const identity = JSON.parse(stdout);
  if (identity.processId !== child.pid) throw new Error("The captured process id did not match the test-owned child.");
  return identity;
}

export async function terminateOwnedProcessTree(child, identity, options) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for the test-owned process to exit.")), 10_000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    return;
  }
  if (!identity || identity.processId !== child.pid || !identity.createdUtc) {
    throw new Error("Cannot verify ownership of the spawned process; refusing to terminate any process.");
  }

  const script = `
$ErrorActionPreference = 'Stop'
$rootPid = [int]$env:LP_TEST_PID
$root = Get-CimInstance Win32_Process -Filter "ProcessId = $rootPid"
if (-not $root) { Write-Output 'The captured test process already exited.'; exit 0 }
$expectedExe = [IO.Path]::GetFullPath($env:LP_TEST_NODE_EXE)
$actualExe = [IO.Path]::GetFullPath($root.ExecutablePath)
$createdUtc = $root.CreationDate.ToUniversalTime().ToString('o')
$command = ([string]$root.CommandLine).Replace('/', '\\')
if ($actualExe -ine $expectedExe -or $createdUtc -cne $env:LP_TEST_CREATED_UTC -or
    $command -notmatch '(?i)node_modules\\\\next\\\\dist\\\\bin\\\\next' -or
    $command -notmatch ('(?i)dev\\s+-p\\s+' + [regex]::Escape($env:LP_TEST_PORT))) {
  throw 'The captured process identity no longer matches this test run; refusing to terminate it.'
}

$all = @(Get-CimInstance Win32_Process)
$owned = [System.Collections.Generic.List[object]]::new()
$owned.Add([pscustomobject]@{
  ProcessId = [int]$root.ProcessId
  ParentProcessId = [int]$root.ParentProcessId
  ExecutablePath = [string]$root.ExecutablePath
  CommandLine = [string]$root.CommandLine
  CreatedUtc = $createdUtc
  Depth = 0
})
$rootStart = $root.CreationDate.ToUniversalTime()
$changed = $true
while ($changed) {
  $changed = $false
  foreach ($candidate in $all) {
    if ($owned.ProcessId -contains [int]$candidate.ProcessId) { continue }
    $parent = $owned | Where-Object { $_.ProcessId -eq [int]$candidate.ParentProcessId } | Select-Object -First 1
    if (-not $parent) { continue }
    $candidateStart = $candidate.CreationDate.ToUniversalTime()
    if ($candidateStart -lt $rootStart) { throw 'A descendant predates the captured process; refusing unsafe cleanup.' }
    $owned.Add([pscustomobject]@{
      ProcessId = [int]$candidate.ProcessId
      ParentProcessId = [int]$candidate.ParentProcessId
      ExecutablePath = [string]$candidate.ExecutablePath
      CommandLine = [string]$candidate.CommandLine
      CreatedUtc = $candidateStart.ToString('o')
      Depth = [int]$parent.Depth + 1
    })
    $changed = $true
  }
}

$stopped = [System.Collections.Generic.List[int]]::new()
foreach ($item in ($owned | Sort-Object Depth -Descending)) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($item.ProcessId)"
  if (-not $current) { continue }
  $currentCreated = $current.CreationDate.ToUniversalTime().ToString('o')
  if ([int]$current.ParentProcessId -ne $item.ParentProcessId -or
      [IO.Path]::GetFullPath($current.ExecutablePath) -ine [IO.Path]::GetFullPath($item.ExecutablePath) -or
      $currentCreated -cne $item.CreatedUtc -or
      [string]$current.CommandLine -cne $item.CommandLine) {
    throw "Process $($item.ProcessId) changed identity; refusing to terminate it."
  }
  Stop-Process -Id ([int]$item.ProcessId) -Force -ErrorAction Stop
  $stopped.Add([int]$item.ProcessId)
}
Write-Output ("Stopped only the verified test-owned process tree: " + ($stopped -join ', '))
`;

  const { stdout, stderr } = await execFileAsync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script,
  ], {
    windowsHide: true,
    env: {
      ...processEnv(child.pid, options),
      LP_TEST_CREATED_UTC: identity.createdUtc,
    },
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.warn(stderr.trim());
  await new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => reject(new Error("Timed out waiting for the verified test-owned process to exit.")), 10_000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}
