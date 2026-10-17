param(
    [string]$Sdk="$env:LOCALAPPDATA/Android/Sdk",
    [string]$Java='C:/Program Files/Android/Android Studio/jbr'
)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$destination=Join-Path $root 'output/qa/hand-capture'
$platform=Get-ChildItem "$Sdk/platforms" -Directory | Sort-Object Name -Descending | Select-Object -First 1
if(!$platform){throw 'Android SDK Platform is required for the hand capture integration test.'}
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$classPath=@((Join-Path $platform.FullName 'android.jar'))
foreach($dependency in @('arcore-1.56.0','tasks-core-0.10.26.1','tasks-vision-0.10.26.1')){
    $aar=Join-Path $PSScriptRoot "deps/$dependency.aar"
    if(!(Test-Path $aar)){throw "Missing $aar; run the Android build to download verified dependencies first."}
    $archive=[IO.Compression.ZipFile]::OpenRead($aar)
    try {
        $jar=Join-Path $destination "$dependency.jar"
        [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry('classes.jar'),$jar,$true)
        $classPath+=,$jar
    } finally {$archive.Dispose()}
}
$classPath+=@(Get-ChildItem (Join-Path $PSScriptRoot 'deps') -Filter '*.jar' | ForEach-Object FullName)
$sources=@('NativeHands','HandTrackingFilter') | ForEach-Object {Join-Path $PSScriptRoot "src/br/com/mrcompanion/$_.java"}
$sources+=,(Join-Path $PSScriptRoot 'NativeHandsCaptureTest.java')
& "$Java/bin/javac.exe" --release 8 -encoding UTF-8 -classpath ($classPath -join ';') -d $destination @sources
if($LASTEXITCODE -ne 0){throw 'Failed to compile hand capture integration tests.'}
& "$Java/bin/java.exe" -cp (@($destination)+$classPath -join ';') br.com.mrcompanion.NativeHandsCaptureTest
if($LASTEXITCODE -ne 0){throw 'Hand capture synchronization test failed.'}
