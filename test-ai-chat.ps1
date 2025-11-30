# Test AI Chat API
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Testing AI Chat API..." -ForegroundColor Cyan

$body = @{
    messages = @(
        @{
            role = "user"
            content = "What is a Helm chart? Please answer briefly."
        }
    )
    workspaceId = "test"
    provider = "anthropic"
    model = "claude-3-5-sonnet-20241022"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/ai-chat" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body `
        -TimeoutSec 30

    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body:" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

