const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline'),{randomUUID}=require('node:crypto');
class NativeMouse {
  constructor(){this.child=null;this.starting=null;}
  start(){
    if(this.starting)return this.starting;
    this.starting=new Promise((resolve,reject)=>{
      const child=this.child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'mouse-helper.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      const timeout=setTimeout(()=>{child.kill();reject(Error('O controle de mouse não iniciou.'));},10000);
      readline.createInterface({input:child.stdout}).on('line',line=>{try{const data=JSON.parse(line);if(data.ready){clearTimeout(timeout);resolve();}if(data.error)this.onError?.(data.error);}catch{}});
      child.stderr.on('data',()=>{});child.stdin.on('error',()=>this.onError?.('Controle de mouse desconectado.'));
      child.on('error',()=>{clearTimeout(timeout);reject(Error('Não foi possível abrir o controle de mouse.'));});
      child.on('exit',()=>{clearTimeout(timeout);this.child=null;this.starting=null;reject(Error('Controle de mouse encerrado.'));this.onError?.('Controle de mouse encerrado.');});
    });return this.starting;
  }
  send(packet){if(!this.child?.stdin.writable)return;if(this.child.stdin.writableLength>4096){this.release();return;}this.child.stdin.write(JSON.stringify(packet)+'\n');}
  release(){if(this.child?.stdin.writable)this.child.stdin.write('{"release":true}\n');}
}
class MouseControl {
  constructor(native,onState=()=>{},now=Date.now){this.native=native;this.onState=onState;this.now=now;this.bindings=new Map();this.owner=null;this.last=0;this.armed=false;native.onError=()=>{this.clear();};}
  state(){return [...this.bindings].map(([id,b])=>({id,token:b.token}));}
  bind(id,display,pc){this.release();this.bindings.set(id,{display,pc,token:randomUUID()});this.onState(this.state());}
  unbind(id,pc){if(this.bindings.get(id)?.pc!==pc)return;this.release();this.bindings.delete(id);this.onState(this.state());}
  release(){this.native.release();this.owner=null;this.armed=false;this.source=null;}
  clear(){this.release();this.bindings.clear();this.onState(this.state());}
  disconnect(client){if(this.owner===client)this.release();for(const [id,b] of this.bindings)if(b.pc===client)this.unbind(id,client);}
  input(client,p){
    if(p.release===true){if(this.owner===client)this.release();return;}
    const b=this.bindings.get(p.streamId);
    if(!b||b.token!==p.token||typeof p.down!=='boolean'||!Number.isFinite(p.u)||!Number.isFinite(p.v)||p.u<0||p.u>1||p.v<0||p.v>1)return;
    if(this.owner&&this.owner!==client)return;
    if(this.source&&this.source!==p.streamId)this.release();
    this.owner=client;this.source=p.streamId;this.last=this.now();
    if(!p.down)this.armed=true;if(p.down&&!this.armed)return;
    this.native.send({display:b.display.name,bounds:b.display,u:p.u,v:p.v,down:p.down});
  }
  tick(){if(this.owner&&this.now()-this.last>500)this.release();}
}
module.exports={NativeMouse,MouseControl};
