param(
    [string]$BaseUrl = "http://localhost:8090",
    [string]$SessionId = "s-smoke-001",
    [string]$AccountId = "u-smoke-001",
    [switch]$SkipChat = $false
)

$ErrorActionPreference = "Stop"

# Keep Vietnamese output readable on Windows terminals.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Net.Http

function Invoke-JsonUtf8 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,
        [Parameter(Mandatory = $true)]
        [string]$Uri,
        [string]$Body
    )

    $client = [System.Net.Http.HttpClient]::new()
    try {
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Uri)
        if ($Body) {
            $request.Content = [System.Net.Http.StringContent]::new($Body, [System.Text.Encoding]::UTF8, "application/json")
        }

        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $response.EnsureSuccessStatusCode() | Out-Null
        $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $jsonText = [System.Text.Encoding]::UTF8.GetString($bytes)
        return $jsonText | ConvertFrom-Json
    }
    finally {
        $client.Dispose()
    }
}

Write-Host "[1/5] Health check..." -ForegroundColor Cyan
$live = Invoke-JsonUtf8 -Method "GET" -Uri "$BaseUrl/health/live"
$ready = Invoke-JsonUtf8 -Method "GET" -Uri "$BaseUrl/health/ready"
Write-Host "Live:  $($live | ConvertTo-Json -Compress)"
Write-Host "Ready: $($ready | ConvertTo-Json -Compress)"

Write-Host "[2/5] Get or create build session..." -ForegroundColor Cyan
$session = Invoke-JsonUtf8 -Method "GET" -Uri "$BaseUrl/api/build-sessions/$SessionId"
Write-Host ($session | ConvertTo-Json -Depth 8)

Write-Host "[3/5] Upsert CPU and RAM..." -ForegroundColor Cyan
$cpu = @{
    slot = "CPU"
    productId = "cpu-smoke-001"
    categoryId = "69ac61dba931fab39af1232e"
    name = "Intel Core i5-13400F"
    price = 4500000
    quantity = 1
    image = ""
    url = "https://example.com/cpu"
} | ConvertTo-Json

$ram = @{
    slot = "RAM"
    productId = "ram-smoke-001"
    categoryId = "69ac61dba931fab39af12330"
    name = "Kingston 16GB DDR4"
    price = 1200000
    quantity = 2
    image = ""
    url = "https://example.com/ram"
} | ConvertTo-Json

$afterCpu = Invoke-JsonUtf8 -Method "POST" -Uri "$BaseUrl/api/build-sessions/$SessionId/components" -Body $cpu
$afterRam = Invoke-JsonUtf8 -Method "POST" -Uri "$BaseUrl/api/build-sessions/$SessionId/components" -Body $ram
Write-Host "After CPU totalPrice: $($afterCpu.totalPrice)"
Write-Host "After RAM totalPrice: $($afterRam.totalPrice)"

Write-Host "[4/5] Checkout validate..." -ForegroundColor Cyan
$validate = Invoke-JsonUtf8 -Method "POST" -Uri "$BaseUrl/api/build-sessions/$SessionId/checkout-validate"
Write-Host ($validate | ConvertTo-Json -Depth 8)

if (-not $SkipChat) {
    Write-Host "[5/5] Chat request..." -ForegroundColor Cyan
    $chat = @{
        sessionId = $SessionId
        accountId = $AccountId
        query = "Tu van cau hinh gaming 20 trieu"
        context = @{
            budget = "15 - 20 trieu"
            purpose = "Gaming"
            brand = "Intel"
        }
        options = @{
            maxIterations = 3
            enableWebFallback = $true
        }
    } | ConvertTo-Json -Depth 8

    $chatResp = Invoke-JsonUtf8 -Method "POST" -Uri "$BaseUrl/api/chat" -Body $chat
    Write-Host ($chatResp | ConvertTo-Json -Depth 10)
}

Write-Host "Smoke test completed." -ForegroundColor Green
