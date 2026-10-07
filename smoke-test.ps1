$ErrorActionPreference = "Stop"
function http($method, $url, $body = $null, [Hashtable]$headers = @{}) {
  $hr = @{
    Method = $method
    ContentType = "application/json"
    TimeoutSec = 20
  }
  if ($body) { $hr.Body = $body }
  if ($headers.Count -gt 0) { $hr.Headers = $headers }
  try {
    $r = Invoke-WebRequest -Uri $url @hr -UseBasicParsing
    return @{ status = $r.StatusCode; body = $r.Content }
  } catch {
    return @{ status = $_.Exception.Response.StatusCode.Value__; body = $_.ErrorDetails.Content }
  }
}

Write-Host "=== SMOKE 1: MySQL health ==="
$res = http "GET" "http://localhost:5000/api/health"
Write-Host "status=$($res.status) body=$($res.body)"

Write-Host "=== SMOKE 2: deviations list (expect 401 no auth) ==="
$res = http "GET" "http://localhost:5000/api/deviations"
Write-Host "status=$($res.status)"

Write-Host "=== SMOKE 3: signup (new row via MySQL) ==="
$body3 = '{"email":"smoke.test.user.2@example.com","password":"SmokeTest123","full_name":"Smoke Test User 2"}'
$res = http "POST" "http://localhost:5000/api/auth/signup" $body3
Write-Host "status=$($res.status) body=$($res.body)"

Write-Host "=== SMOKE 4: login ==="
$body4 = '{"email":"smoke.test.user@example.com","password":"SmokeTest123"}'
$res = http "POST" "http://localhost:5000/api/auth/login" $body4
Write-Host "status=$($res.status) body=$($res.body)"
$token = ($res.body | ConvertFrom-Json).token

Write-Host "=== SMOKE 5: dashboard me endpoint (JWT from MySQL) ==="
$res = http "GET" "http://localhost:5000/api/auth/me" -headers @{ Authorization = "Bearer $token" }
Write-Host "status=$($res.status) body=$($res.body)"

Write-Host "=== SMOKE 6: save deviation (basic MySQL write) ==="
$body6 = '{"level":"floor","department":"SMOKE-DEP","item":"SMOKE-ITEM","op_code":"SMOKE-OP","op_desc":"Smoke test deviation","floor_status":"PENDING","created_by":"smoke.test.user@example.com"}'
$res = http "POST" "http://localhost:5000/api/deviations" $body6 -headers @{ Authorization = "Bearer $token" }
Write-Host "status=$($res.status) body=$($res.body)"
$devId = $null
if ($res.body) { $json = $res.body | ConvertFrom-Json; if ($json.id) { $devId = $json.id } }
Write-Host "created deviation id=$devId

=== SMOKE 7: read deviation back from MySQL ==="
$res = http "GET" "http://localhost:5000/api/deviations/$devId" -headers @{ Authorization = "Bearer $token" }
Write-Host "status=$($res.status) body=$($res.body)"

Write-Host "=== SMOKE 8: master-routing list (MySQL) ==="
$res = http "GET" "http://localhost:5000/api/master-routing" -headers @{ Authorization = "Bearer $token" }
Write-Host "status=$($res.status) body=$($res.body)"
