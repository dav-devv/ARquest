param([string]$Java=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if(!$Java -and (Test-Path 'C:/Program Files/Android/Android Studio/jbr')){$Java='C:/Program Files/Android/Android Studio/jbr'}
$javac=if($Java){Join-Path $Java 'bin/javac.exe'}else{(Get-Command javac).Source}
$javaExe=if($Java){Join-Path $Java 'bin/java.exe'}else{(Get-Command java).Source}
$destination=Join-Path $root 'output/qa/android-core-tests'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$sources=@('WindowMotion','PlaneGeometry','VrOptics','HandTrackingFilter','HandProjection','WorkspacePersistence') | ForEach-Object {Join-Path $PSScriptRoot "src/br/com/mrcompanion/$_.java"}
$tests=@('WindowMotionTest','PlaneGeometryTest','VrOpticsTest','HandTrackingFilterTest','HandProjectionTest','WorkspacePersistenceTest') | ForEach-Object {Join-Path $PSScriptRoot "$_.java"}
& $javac --release 8 -encoding UTF-8 -d $destination @sources @tests
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar os testes de rastreamento.'}
foreach($test in @('WindowMotionTest','PlaneGeometryTest','VrOpticsTest','br.com.mrcompanion.HandTrackingFilterTest','HandProjectionTest','br.com.mrcompanion.WorkspacePersistenceTest')){
    & $javaExe -cp $destination $test
    if($LASTEXITCODE -ne 0){throw "Falha em $test"}
}
