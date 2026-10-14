const net=require('node:net');
const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const PIPE='\\\\.\\pipe\\MTTVirtualDisplayPipe';
function validateCount(count){if(!Number.isInteger(count)||count<1||count>8)throw Error('Escolha um total entre 1 e 8 monitores virtuais.');return count;}
function command(text,connect=net.createConnection){
  return new Promise((resolve,reject)=>{
    const socket=connect(PIPE);let chunks=[],size=0,done=false;
    const finish=(error)=>{if(done)return;done=true;socket.destroy();if(error)reject(error);else {const bytes=Buffer.concat(chunks);resolve(bytes.toString(bytes[1]===0?'utf16le':'utf8').replace(/\0/g,''));}};
    socket.setTimeout(5000,()=>finish(Error('O driver não respondeu a tempo. Verifique o estado antes de tentar novamente.')));
    socket.on('connect',()=>socket.write(Buffer.from(text+'\0','utf16le')));
    socket.on('data',chunk=>{size+=chunk.length;if(size>65536)return finish(Error('Resposta do driver excedeu o limite.'));chunks.push(chunk);});
    socket.on('end',()=>finish());socket.on('error',error=>{if(error.code==='EPIPE'&&chunks.length)finish();else finish(Error('Virtual Display Driver não instalado, inativo ou sem acesso.'));});
  });
}
let busy=false;
async function configuredCount(){const xml=await fs.readFile('C:/VirtualDisplayDriver/vdd_settings.xml','utf8');return Number(xml.match(/<monitors>\s*<count>(\d+)<\/count>/)?.[1]);}
async function setCount(count){
  validateCount(count);if(busy)throw Error('Aguarde a alteração anterior terminar.');busy=true;
  try{
    // This driver can disconnect before its reply is drained. Verify the actual setting,
    // never repeat a display reload just because the pipe lost its acknowledgement.
    if(await configuredCount().catch(()=>null)===count)return;
    let error;try{await command('SETDISPLAYCOUNT '+count);}catch(e){error=e;}
    if(await configuredCount().catch(()=>null)!==count)throw error||Error('O driver não confirmou a quantidade solicitada.');
  }finally{busy=false;}
}
async function status(){
  const script='Add-Type -AssemblyName System.Windows.Forms; $devices=@(Get-PnpDevice -Class Display -PresentOnly | Where-Object { $_.FriendlyName -eq "Virtual Display Driver" -and $_.Status -eq "OK" }); @{ driverReady=($devices.Count -gt 0); displays=@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { @{ name=$_.DeviceName; primary=$_.Primary; width=$_.Bounds.Width; height=$_.Bounds.Height; x=$_.Bounds.X; y=$_.Bounds.Y } }) } | ConvertTo-Json -Compress -Depth 4';
  const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:8000,maxBuffer:65536});
  return {...JSON.parse(stdout.trim()),configuredCount:await configuredCount().catch(()=>null)};
}
module.exports={validateCount,command,setCount,status};
