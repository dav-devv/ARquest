param([string]$Sdk="$env:LOCALAPPDATA/Android/Sdk",[string]$Java=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if(!$Java -and (Test-Path 'C:/Program Files/Android/Android Studio/jbr')){$Java='C:/Program Files/Android/Android Studio/jbr'}
$javac=if($Java){Join-Path $Java 'bin/javac.exe'}else{(Get-Command javac).Source}
$javaExe=if($Java){Join-Path $Java 'bin/java.exe'}else{(Get-Command java).Source}
$platform=Get-ChildItem (Join-Path $Sdk 'platforms') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$aar=Join-Path $PSScriptRoot 'deps/arcore-1.56.0.aar'
if(!$platform -or !(Test-Path $aar)){throw 'Este teste precisa do Android SDK e do ARCore baixado por apps/android/build.ps1.'}
if((Get-FileHash $aar -Algorithm SHA256).Hash -ne '20A66FB176C62234879A94202F1424ADF14F3CC1159AEDBD247D3517B65F1F50'){throw 'Checksum inesperado para ARCore 1.56.0'}
$destination=Join-Path $root 'output/qa/android-workspace-tests'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($aar)
try{[IO.Compression.ZipFileExtensions]::ExtractToFile($zip.GetEntry('classes.jar'),(Join-Path $destination 'arcore.jar'),$true)}finally{$zip.Dispose()}
# Compile only the store and its real geometry; this test double supplies its renderer data fields.
$stub=@'
package br.com.mrcompanion;
import com.google.ar.core.Pose;
import com.google.ar.core.Anchor;
final class NativeRenderer {
    static final class Panel {String id,name;float size;Pose savedPose,dragPose;Anchor anchor;}
}
'@
$stubPath=Join-Path $destination 'NativeRenderer.java'
[IO.File]::WriteAllText($stubPath,$stub)
$classPath=(Join-Path $destination 'arcore.jar')+';'+(Join-Path $platform.FullName 'android.jar')
$sources=@($stubPath,(Join-Path $PSScriptRoot 'src/br/com/mrcompanion/WorkspacePersistence.java'),(Join-Path $PSScriptRoot 'src/br/com/mrcompanion/NativeWorkspaceStore.java'),(Join-Path $PSScriptRoot 'NativeWorkspaceStorePoseTest.java'))
& $javac --release 8 -encoding UTF-8 -cp $classPath -d $destination @sources
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o teste do mapa salvo.'}
& $javaExe -cp "$destination;$classPath" br.com.mrcompanion.NativeWorkspaceStorePoseTest
if($LASTEXITCODE -ne 0){throw 'Falha na transformação das superfícies salvas.'}
