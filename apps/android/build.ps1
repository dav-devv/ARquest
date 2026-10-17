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
$mpVersion='0.10.26.1';$mpVision=Join-Path $PSScriptRoot "deps/tasks-vision-$mpVersion.aar";$mpCore=Join-Path $PSScriptRoot "deps/tasks-core-$mpVersion.aar"
if(!(Test-Path $mpVision)){Invoke-WebRequest "https://dl.google.com/dl/android/maven2/com/google/mediapipe/tasks-vision/$mpVersion/tasks-vision-$mpVersion.aar" -OutFile $mpVision -UseBasicParsing}
if((Get-FileHash $mpVision -Algorithm SHA256).Hash -ne '1763C11D5B4C490090F1E6345CB4EB87812B4EDC3C11B42594A216E4B63C694B'){throw 'Checksum inesperado para MediaPipe Tasks Vision'}
if(!(Test-Path $mpCore)){Invoke-WebRequest "https://dl.google.com/dl/android/maven2/com/google/mediapipe/tasks-core/$mpVersion/tasks-core-$mpVersion.aar" -OutFile $mpCore -UseBasicParsing}
if((Get-FileHash $mpCore -Algorithm SHA256).Hash -ne 'F4BCADAAB6AE07E2AC2B4710DA9F0B193603990F06832A8AEFD81215B791981B'){throw 'Checksum inesperado para MediaPipe Tasks Core'}
$zxing=Join-Path $PSScriptRoot 'deps/zxing-core-3.5.3.jar';if(!(Test-Path $zxing)){Invoke-WebRequest 'https://repo.maven.apache.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar' -OutFile $zxing -UseBasicParsing}
if((Get-FileHash $zxing -Algorithm SHA256).Hash -ne '8D8064C1636FDAEF7189DD9055C7D59950A8940A12F2293956446EC3C109FD82'){throw 'Checksum inesperado para ZXing Core 3.5.3'}
$model=Join-Path $root 'web_mobile_test/vendor/vision/hand_landmarker.task';if((Get-FileHash $model -Algorithm SHA256).Hash -ne 'FBC2A30080C3C557093B5DDFC334698132EB341044CCEE322CCF8BCF3607CDE1'){throw 'Checksum inesperado para o modelo de mãos'}
$mavenJars=@(
  @{Path='androidx/annotation/annotation/1.1.0/annotation-1.1.0.jar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/guava/guava/27.0.1-android/guava-27.0.1-android.jar';Repo='https://repo.maven.apache.org/maven2'},
  @{Path='com/google/flogger/flogger/0.6/flogger-0.6.jar';Repo='https://repo.maven.apache.org/maven2'},
  @{Path='com/google/flogger/flogger-system-backend/0.6/flogger-system-backend-0.6.jar';Repo='https://repo.maven.apache.org/maven2'},
  @{Path='com/google/protobuf/protobuf-javalite/4.26.1/protobuf-javalite-4.26.1.jar';Repo='https://repo.maven.apache.org/maven2'},
  @{Path='javax/inject/javax.inject/1/javax.inject-1.jar';Repo='https://repo.maven.apache.org/maven2'},
  @{Path='com/google/firebase/firebase-encoders/17.0.0/firebase-encoders-17.0.0.jar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/firebase/firebase-encoders-proto/16.0.0/firebase-encoders-proto-16.0.0.jar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/firebase/firebase-encoders-json/18.0.0/firebase-encoders-json-18.0.0.aar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/android/datatransport/transport-api/3.0.0/transport-api-3.0.0.aar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/android/datatransport/transport-backend-cct/3.1.0/transport-backend-cct-3.1.0.aar';Repo='https://dl.google.com/dl/android/maven2'},
  @{Path='com/google/android/datatransport/transport-runtime/3.1.0/transport-runtime-3.1.0.aar';Repo='https://dl.google.com/dl/android/maven2'}
)
$dependencyJars=@();$transportAars=@();foreach($item in $mavenJars){$file=Join-Path $PSScriptRoot ('deps/'+[IO.Path]::GetFileName($item.Path));if(!(Test-Path $file)){Invoke-WebRequest ($item.Repo+'/'+$item.Path) -OutFile $file -UseBasicParsing};if($file.EndsWith('.aar')){$target=Join-Path $build ('transport-'+[IO.Path]::GetFileNameWithoutExtension($file));[IO.Compression.ZipFile]::ExtractToDirectory($file,$target);$dependencyJars+=,(Join-Path $target 'classes.jar');$transportAars+=,$target}else{$dependencyJars+=,$file}}
[IO.Compression.ZipFile]::ExtractToDirectory($opencv,"$build/opencv")
[IO.Compression.ZipFile]::ExtractToDirectory($mpVision,"$build/mpvision")
[IO.Compression.ZipFile]::ExtractToDirectory($mpCore,"$build/mpcore")
RunTool "$($tools.FullName)/aapt2.exe" @('compile','--dir',"$build/arcore/res",'-o',"$build/arcore-res.zip")
RunTool "$($tools.FullName)/aapt2.exe" @('compile','--dir',"$build/opencv/res",'-o',"$build/opencv-res.zip")
RunTool "$($tools.FullName)/aapt2.exe" @('link','-I',"$($platform.FullName)/android.jar",'--manifest',"$PSScriptRoot/AndroidManifest.xml",'--java',"$build/generated",'--extra-packages','com.google.ar.core:org.opencv','-o',"$build/unsigned.apk","$build/arcore-res.zip","$build/opencv-res.zip")
$sources=@(Get-ChildItem "$PSScriptRoot/src" -Filter '*.java' -Recurse | ForEach-Object FullName)
$sources+=@(Get-ChildItem "$build/generated" -Filter '*.java' -Recurse | ForEach-Object FullName)
$classPath=@("$($platform.FullName)/android.jar","$build/arcore/classes.jar","$build/opencv/classes.jar","$build/mpvision/classes.jar","$build/mpcore/classes.jar",$zxing)+$dependencyJars
RunTool "$Java/bin/javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-classpath',($classPath -join ';'),'-d',"$build/classes")+$sources)
RunTool "$Java/bin/jar.exe" @('cf',"$build/classes.jar",'-C',"$build/classes",'.')
RunTool "$($tools.FullName)/d8.bat" (@('--min-api','26','--lib',"$($platform.FullName)/android.jar",'--output',"$build/dex","$build/classes.jar","$build/arcore/classes.jar","$build/opencv/classes.jar","$build/mpvision/classes.jar","$build/mpcore/classes.jar",$zxing)+$dependencyJars)
RunTool "$Java/bin/jar.exe" @('uf',"$build/unsigned.apk",'-C',"$build/dex",'.')
Copy-Item "$build/arcore/jni" -Destination "$build/lib" -Recurse
Get-ChildItem "$build/opencv/jni" -Directory | ForEach-Object { $abi=Join-Path "$build/lib" $_.Name; New-Item -ItemType Directory -Force $abi | Out-Null; Copy-Item "$($_.FullName)/*.so" -Destination $abi }
Get-ChildItem "$build/mpvision/jni" -Directory | ForEach-Object { $abi=Join-Path "$build/lib" $_.Name; New-Item -ItemType Directory -Force $abi | Out-Null; Copy-Item "$($_.FullName)/*.so" -Destination $abi }
RunTool "$Java/bin/jar.exe" @('uf',"$build/unsigned.apk",'-C',$build,'lib')
New-Item -ItemType Directory -Force "$build/assets" | Out-Null;Copy-Item $model "$build/assets/hand_landmarker.task"
RunTool "$Java/bin/jar.exe" @('uf',"$build/unsigned.apk",'-C',$build,'assets')
RunTool "$($tools.FullName)/zipalign.exe" @('-f','4',"$build/unsigned.apk","$build/aligned.apk")
$keys=Join-Path $env:LOCALAPPDATA 'MRCompanion/build-keys'
New-Item -ItemType Directory -Force -Path $keys | Out-Null
$key=Join-Path $keys 'android-debug.jks'
if(!(Test-Path $key)){RunTool "$Java/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=MR Companion Development','-keyalg','RSA','-keysize','2048','-validity','3650')}
$apk=Join-Path $out 'MRCompanion-native-debug.apk'
RunTool "$($tools.FullName)/apksigner.bat" @('sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,"$build/aligned.apk")
RunTool "$($tools.FullName)/apksigner.bat" @('verify','--verbose',$apk)
Write-Output "APK de desenvolvimento: $apk"
