# Free only admin (3000) and LMS (3001). Does NOT touch backend port (38472).
# Used by full dev so we don't kill the backend and trigger TIME_WAIT.
$ports = @(3000, 3001)
foreach ($port in $ports) {
  $lines = netstat -ano | findstr ":$port "
  foreach ($line in $lines) {
    if ($line -match '\s+LISTENING\s+(\d+)\s*$') {
      $procId = $matches[1]
      if ($procId -ne '0') {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "Freed port $port (PID $procId)"
      }
    }
  }
}
Write-Host "Done. Ports 3000, 3001 free (backend port not touched)."
