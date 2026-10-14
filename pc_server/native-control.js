const {randomUUID}=require('node:crypto');
const actions=new Set(['open_ar','close_ar','marker_id','marker_size','reference','place','remove','smaller','larger']);
function validateCommand(input){
  if(!input||!actions.has(input.action))throw Error('Comando desconhecido.');
  const command={action:input.action};
  if(input.action==='marker_id'){if(![100].includes(input.value))throw Error('Use a referência universal ID 100.');command.value=input.value;}
  if(input.action==='marker_size'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<30||input.value>1000)throw Error('Informe de 30 a 1000 mm.');command.value=input.value;}
  return command;
}
class NativeControl {
  constructor(now=Date.now){this.now=now;this.devices=new Map();}
  clean(){for(const [id,d] of this.devices){if(this.now()-d.seen>120000){this.devices.delete(id);continue;}for(const c of d.commands)if(c.status==='pending'&&c.expires<=this.now()){c.status='expired';c.message='Sem confirmação; não repetido. Confira o estado no celular.';}d.commands=d.commands.slice(-32);}}
  sync(body){
    this.clean();if(!body||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))throw Error('Dispositivo inválido.');
    let d=this.devices.get(body.id);if(!d){if(this.devices.size>=8)throw Error('Limite de conexões atingido.');d={id:body.id,commands:[]};this.devices.set(d.id,d);}
    const s=body.state||{};d.seen=this.now();d.name=String(body.name||'Android').slice(0,80);
    d.state={screen:s.screen==='ar'?'ar':'home',active:s.active===true,ready:s.ready===true,selected:[100].includes(s.selected)?s.selected:100,side:Number.isFinite(s.side)?s.side:140,panels:Number.isInteger(s.panels)?Math.max(0,Math.min(24,s.panels)):0,lastSize:Number.isFinite(s.lastSize)?s.lastSize:0,origin:[100].includes(s.origin)?s.origin:0,status:String(s.status||'').slice(0,800),measurements:String(s.measurements||'').slice(0,1200)};
    for(const ack of (Array.isArray(body.acks)?body.acks:[]).slice(0,32)){const c=d.commands.find(c=>c.id===ack.id);if(c&&c.status==='pending'){c.status=ack.ok===true?'received':'rejected';c.message=String(ack.message||'').slice(0,300);}}
    return {commands:d.commands.filter(c=>c.status==='pending').map(c=>({id:c.id,action:c.action,value:c.value,ttl:Math.max(0,c.expires-this.now())}))};
  }
  command(id,input){this.clean();const command=validateCommand(input),d=this.devices.get(id);if(!d||this.now()-d.seen>3000)throw Error('Celular desconectado.');if(!d.state.active)throw Error('Deixe o aplicativo aberto no celular.');if(command.action==='open_ar'){if(d.state.screen!=='home'||!d.state.ready)throw Error('AR indisponível neste momento.');}else if(d.state.screen!=='ar'||!d.state.ready)throw Error('Abra o AR no celular primeiro.');
    if(d.commands.some(c=>c.status==='pending'))throw Error('Aguarde a confirmação do comando anterior.');
    const c={...command,id:randomUUID(),expires:this.now()+5000,status:'pending',message:'Aguardando o celular.'};d.commands.push(c);return {id:c.id};
  }
  status(){this.clean();return [...this.devices.values()].map(d=>({id:d.id,name:d.name,online:this.now()-d.seen<=3000,state:d.state,lastCommand:d.commands.at(-1)||null}));}
}
module.exports={NativeControl,validateCommand};
