$files = @{
  "C:\temp\a.txt" = @"
hello
"@
}
foreach ($entry in $files.GetEnumerator()) {
  $directory = Split-Path -Parent $entry.Key
  if (!(Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
  Set-Content -Path $entry.Key -Value $entry.Value -NoNewline
}
