# Run this SQL in Supabase SQL Editor to set up Mr. Mentor session management

Write-Host "=== Mr. Mentor Session Management Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To set up the mentor_sessions table in Supabase:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to your Supabase project dashboard" -ForegroundColor White
Write-Host "2. Navigate to SQL Editor" -ForegroundColor White
Write-Host "3. Create a new query" -ForegroundColor White
Write-Host "4. Copy and paste the contents of:" -ForegroundColor White
Write-Host "   scripts/setup-mentor-sessions.sql" -ForegroundColor Green
Write-Host "5. Run the query" -ForegroundColor White
Write-Host ""
Write-Host "This will create:" -ForegroundColor Yellow
Write-Host "  - mentor_sessions table" -ForegroundColor White
Write-Host "  - Indexes for performance" -ForegroundColor White
Write-Host "  - RLS policies for security" -ForegroundColor White
Write-Host "  - Trigger to enforce single active session per facilitator" -ForegroundColor White
Write-Host ""
Write-Host "After running the migration, the Mr. Mentor session management will be active." -ForegroundColor Green
Write-Host ""

# Offer to open the SQL file
$openFile = Read-Host "Open setup-mentor-sessions.sql now? (y/n)"
if ($openFile -eq 'y' -or $openFile -eq 'Y') {
    $sqlPath = Join-Path $PSScriptRoot "setup-mentor-sessions.sql"
    if (Test-Path $sqlPath) {
        Start-Process $sqlPath
        Write-Host "Opened setup-mentor-sessions.sql" -ForegroundColor Green
    } else {
        Write-Host "File not found: $sqlPath" -ForegroundColor Red
    }
}
