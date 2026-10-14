$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$destination=Join-Path $root 'output/packages/windows/MRCompanion'
New-Item -ItemType Directory -Force -Path "$destination/runtime","$destination/pc_server" | Out-Null
$source=Join-Path $PSScriptRoot 'Launcher.cs'
$executable=Join-Path $destination 'MRCompanion.exe'
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$executable" $source
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o executavel'}
Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination "$destination/runtime/node.exe"
$nodeVersion=(& node --version).Trim()
Invoke-WebRequest "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile "$destination/runtime/LICENSE.txt" -UseBasicParsing
Copy-Item "$root/apps/README.md" -Destination "$destination/README.md"
Get-ChildItem "$root/pc_server" -File | Where-Object { $_.Extension -in '.js','.ps1' -or $_.Name -in 'package.json','package-lock.json' } | Copy-Item -Destination "$destination/pc_server"
Copy-Item "$root/pc_server/public" -Destination "$destination/pc_server" -Recurse -Force
Copy-Item "$root/pc_server/node_modules" -Destination "$destination/pc_server" -Recurse -Force
Copy-Item "$root/web_mobile_test" -Destination $destination -Recurse -Force
& "$destination/MRCompanion.exe" --self-test
if($LASTEXITCODE -ne 0){throw 'Pacote incompleto'}
Write-Output "Executavel: $destination/MRCompanion.exe"
