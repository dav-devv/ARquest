param([switch]$DryRun)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class MRMouse {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
  static readonly object gate=new object();
  static readonly System.Diagnostics.Stopwatch clock=System.Diagnostics.Stopwatch.StartNew();
  static bool held=false,dry=false; static long last=0; static Timer timer;
  public static void Init(bool simulate){dry=simulate;SetProcessDPIAware();timer=new Timer(_=>{lock(gate){if(held&&clock.ElapsedMilliseconds-last>650)Release();}},null,100,100);}
  public static void Release(){lock(gate){if(held&&!dry)mouse_event(4,0,0,0,UIntPtr.Zero);held=false;}}
  public static void Apply(int x,int y,bool down){lock(gate){last=clock.ElapsedMilliseconds;if(!dry&&!SetCursorPos(x,y))throw new Exception("Cursor indisponivel");if(down!=held&&!dry)mouse_event(down?2u:4u,0,0,0,UIntPtr.Zero);held=down;}}
}
'@
[MRMouse]::Init($DryRun.IsPresent)
[Console]::WriteLine('{"ready":true}')
try {
  while ($null -ne ($line=[Console]::ReadLine())) {
    try {
      $packet=$line | ConvertFrom-Json
      if($packet.release -eq $true){[MRMouse]::Release();continue}
      $monitor=[System.Windows.Forms.Screen]::AllScreens | Where-Object DeviceName -eq $packet.display | Select-Object -First 1
      if(!$monitor){throw 'Monitor desconectado'}
      $bounds=$monitor.Bounds
      if($bounds.X -ne $packet.bounds.x -or $bounds.Y -ne $packet.bounds.y -or $bounds.Width -ne $packet.bounds.width -or $bounds.Height -ne $packet.bounds.height){throw 'Disposicao dos monitores mudou; associe novamente'}
      $u=[double]$packet.u;$v=[double]$packet.v
      if([double]::IsNaN($u)-or [double]::IsNaN($v)-or $u -lt 0 -or $u -gt 1 -or $v -lt 0 -or $v -gt 1){throw 'Coordenadas invalidas'}
      $x=$bounds.X+[int][Math]::Round($u*($bounds.Width-1));$y=$bounds.Y+[int][Math]::Round($v*($bounds.Height-1))
      [MRMouse]::Apply($x,$y,($packet.down -eq $true))
      if($DryRun){[Console]::WriteLine((@{x=$x;y=$y;down=$packet.down}|ConvertTo-Json -Compress))}
    } catch { [MRMouse]::Release();[Console]::WriteLine('{"error":"Monitor indisponivel ou disposicao alterada. Associe novamente no painel."}') }
  }
} finally { [MRMouse]::Release() }
