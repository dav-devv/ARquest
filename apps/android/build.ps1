param([string]$Sdk="$env:LOCALAPPDATA/Android/Sdk",[string]$Java='C:/Program Files/Android/Android Studio/jbr')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$build=Join-Path $root ('output/android-native-build/'+[guid]::NewGuid().ToString('N'))
$out=Join-Path $root 'output/packages/android'
$platform=Get-ChildItem "$Sdk/platforms" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$tools=Get-ChildItem "$Sdk/build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
if(!$platform -or !$tools){throw 'Instale Android SDK Platform e Build Tools'}
$env:JAVA_HOME=$Java
$env:PATH="$Java/bin;$env:PATH"
New-Item -ItemType Directory -Force -Path "$build/classes","$build/dex","$build/generated",$out,"$PSScriptRoot/deps" | Out-Null
function RunTool([string]$exe,[string[]]$arguments){ & $exe @arguments; if($LASTEXITCODE -ne 0){throw "Falha: $exe"} }
$aar=Join-Path $PSScriptRoot 'deps/arcore-1.56.0.aar'
if(!(Test-Path $aar)){Invoke-WebRequest 'https://dl.google.com/dl/android/maven2/com/google/ar/core/1.56.0/core-1.56.0.aar' -OutFile $aar -UseBasicParsing}
if((Get-FileHash $aar -Algorithm SHA256).Hash -ne '20A66FB176C62234879A94202F1424ADF14F3CC1159AEDBD247D3517B65F1F50'){throw 'Checksum inesperado para ARCore 1.56.0'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($aar,"$build/arcore")
$opencv=Join-Path $PSScriptRoot 'deps/opencv-4.12.0.aar'
if(!(Test-Path $opencv)){Invoke-WebRequest 'https://repo.maven.apache.org/maven2/org/opencv/opencv/4.12.0/opencv-4.12.0.aar' -OutFile $opencv -UseBasicParsing}
if((Get-FileHash $opencv -Algorithm SHA256).Hash -ne 'F71846A313388D9DA667A59BE1E921669FCF792D1BA264B3898253CA789BC3F0'){throw 'Checksum inesperado para OpenCV 4.12.0'}
[IO.Compression.ZipFile]::ExtractToDirectory($opencv,"$build/opencv")
RunTool "$($tools.FullName)/aapt2.exe" @('compile','--dir',"$build/arcore/res",'-o',"$build/arcore-res.zip")
RunTool "$($tools.FullName)/aapt2.exe" @('compile','--dir',"$build/opencv/res",'-o',"$build/opencv-res.zip")
RunTool "$($tools.FullName)/aapt2.exe" @('link','-I',"$($platform.FullName)/android.jar",'--manifest',"$PSScriptRoot/AndroidManifest.xml",'--java',"$build/generated",'--extra-packages','com.google.ar.core:org.opencv','-o',"$build/unsigned.apk","$build/arcore-res.zip","$build/opencv-res.zip")
$sources=@(Get-ChildItem "$PSScriptRoot/src" -Filter '*.java' -Recurse | ForEach-Object FullName)
$sources+=@(Get-ChildItem "$build/generated" -Filter '*.java' -Recurse | ForEach-Object FullName)
RunTool "$Java/bin/javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-classpath',"$($platform.FullName)/android.jar;$build/arcore/classes.jar;$build/opencv/classes.jar",'-d',"$build/classes")+$sources)
RunTool "$Java/bin/jar.exe" @('cf',"$build/classes.jar",'-C',"$build/classes",'.')
RunTool "$($tools.FullName)/d8.bat" @('--min-api','26','--lib',"$($platform.FullName)/android.jar",'--output',"$build/dex","$build/classes.jar","$build/arcore/classes.jar","$build/opencv/classes.jar")
RunTool "$Java/bin/jar.exe" @('uf',"$build/unsigned.apk",'-C',"$build/dex",'.')
Copy-Item "$build/arcore/jni" -Destination "$build/lib" -Recurse
Get-ChildItem "$build/opencv/jni" -Directory | ForEach-Object { $abi=Join-Path "$build/lib" $_.Name; New-Item -ItemType Directory -Force $abi | Out-Null; Copy-Item "$($_.FullName)/*.so" -Destination $abi }
RunTool "$Java/bin/jar.exe" @('uf',"$build/unsigned.apk",'-C',$build,'lib')
RunTool "$($tools.FullName)/zipalign.exe" @('-f','4',"$build/unsigned.apk","$build/aligned.apk")
$keys=Join-Path $env:LOCALAPPDATA 'MRCompanion/build-keys'
New-Item -ItemType Directory -Force -Path $keys | Out-Null
$key=Join-Path $keys 'android-debug.jks'
if(!(Test-Path $key)){RunTool "$Java/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=MR Companion Development','-keyalg','RSA','-keysize','2048','-validity','3650')}
$apk=Join-Path $out 'MRCompanion-native-debug.apk'
RunTool "$($tools.FullName)/apksigner.bat" @('sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,"$build/aligned.apk")
RunTool "$($tools.FullName)/apksigner.bat" @('verify','--verbose',$apk)
Write-Output "APK de desenvolvimento: $apk"
