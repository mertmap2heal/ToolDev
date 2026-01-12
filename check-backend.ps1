# Quick script to check if backend is running
Write-Host "`n========================================="
Write-Host "Checking Backend Server Status"
Write-Host "=========================================`n"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend is running!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)`n"
} catch {
    Write-Host "❌ Backend is NOT running" -ForegroundColor Red
    Write-Host "`nTo start the backend:" -ForegroundColor Yellow
    Write-Host "1. Open a new terminal"
    Write-Host "2. Run: cd D:\ToolDevelopment\backend"
    Write-Host "3. Run: npm run dev`n"
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
