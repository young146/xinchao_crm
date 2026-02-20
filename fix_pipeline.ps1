$filePath = "src\components\LeadPipeline.js"
$lines = Get-Content $filePath -Encoding UTF8

# Find the line with LeadDetailModal comment
$modalStart = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "const LeadDetailModal") {
        $modalStart = $i
        break
    }
}

Write-Host "File total lines: $($lines.Count)"
Write-Host "LeadDetailModal starts at line (0-indexed): $modalStart"

if ($modalStart -gt 442) {
    # Keep lines 1-442 (index 0-441) and lines from modalStart onwards
    $newLines = $lines[0..441] + $lines[$modalStart..($lines.Count-1)]
    $newLines | Set-Content $filePath -Encoding UTF8
    Write-Host "Done! New file has $($newLines.Count) lines"
} else {
    Write-Host "modalStart=$modalStart is not > 442, skipping"
}
