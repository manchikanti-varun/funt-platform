# Free ports 3000, 3001, 38472 so dev servers can start (admin, lms, backend).
$ports = @(3000, 3001, 38472)
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
Write-Host "Done. Ports 3000, 3001, 38472 should be free."
