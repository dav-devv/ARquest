const {randomUUID}=require('node:crypto');
const actions=new Set(['open_ar','close_ar','marker_id','marker_size','reference','place','remove','smaller','larger','select_panel','hands','stereo','stereo_ipd','stereo_convergence','stereo_vertical','stereo_reset','camera_sharpness','camera_contrast','camera_focus','stereo_balance','vr_calibration','vr_eye','mapping']);
function validateCommand(input){
  if(!input||!actions.has(input.action))throw Error('Comando desconhecido.');
  const command={action:input.action};
  if(input.action==='marker_id'){if(![100].includes(input.value))throw Error('Use a referência universal ID 100.');command.value=input.value;}
  if(input.action==='marker_size'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<30||input.value>1000)throw Error('Informe de 30 a 1000 mm.');command.value=input.value;}
  if(input.action==='select_panel'){if(typeof input.panelId!=='string'||!/^p[1-9]\d{0,3}$/.test(input.panelId))throw Error('Selecione um painel válido.');command.panelId=input.panelId;}
  if(input.action==='hands'||input.action==='stereo'||input.action==='mapping'){if(input.value!==0&&input.value!==1)throw Error('Use 0 ou 1 para desligar ou ligar a função.');command.value=input.value;}
  if(input.action==='stereo_ipd'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<0||input.value>72)throw Error('A separação virtual deve ficar entre 0 e 72 mm.');command.value=input.value;}
  if(input.action==='stereo_convergence'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value< -400||input.value>400)throw Error('A convergência horizontal deve ficar entre -400 e 400 px.');command.value=input.value;}
  if(input.action==='stereo_vertical'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value< -160||input.value>160)throw Error('O alinhamento vertical deve ficar entre -160 e 160 px.');command.value=input.value;}
  if(input.action==='camera_sharpness'){if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<0||input.value>70)throw Error('A nitidez deve ficar entre 0 e 70%.');command.value=input.value;}
  const ranges={stereo_balance:[-120,120],camera_contrast:[80,130],camera_focus:[0,1],vr_calibration:[0,1],vr_eye:[0,2]};
  if(ranges[input.action]){const [min,max]=ranges[input.action];if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<min||input.value>max||(['camera_focus','vr_calibration','vr_eye'].includes(input.action)&&!Number.isInteger(input.value)))throw Error('Valor de calibração inválido.');command.value=input.value;}
  return command;
}
class NativeControl {
  constructor(now=Date.now){this.now=now;this.devices=new Map();}
  clean(){for(const [id,d] of this.devices){if(this.now()-d.seen>120000){this.devices.delete(id);continue;}for(const c of d.commands)if(c.status==='pending'&&c.expires<=this.now()){c.status='expired';c.message='Sem confirmação; não repetido. Confira o estado no celular.';}d.commands=d.commands.slice(-32);}}
  sync(body){
    this.clean();if(!body||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))throw Error('Dispositivo inválido.');
    let d=this.devices.get(body.id);if(!d){if(this.devices.size>=8)throw Error('Limite de conexões atingido.');d={id:body.id,commands:[]};this.devices.set(d.id,d);}
    const s=body.state||{};d.seen=this.now();d.name=String(body.name||'Android').slice(0,80);
    const seenPanels=new Set();const panelList=(Array.isArray(s.panelList)?s.panelList:[]).slice(0,24).map(p=>({id:typeof p?.id==='string'&&/^p[1-9]\d{0,3}$/.test(p.id)?p.id:'',name:String(p?.name||'Painel').slice(0,40),size:Number.isFinite(p?.size)?Math.max(.2,Math.min(3,p.size)):.65,tracked:p?.tracked===true})).filter(p=>p.id&&!seenPanels.has(p.id)&&seenPanels.add(p.id));
    const selectedPanel=typeof s.selectedPanel==='string'&&panelList.some(p=>p.id===s.selectedPanel)?s.selectedPanel:(panelList.at(-1)?.id||'');
    d.state={screen:s.screen==='ar'?'ar':'home',active:s.active===true,ready:s.ready===true,handsEnabled:s.handsEnabled===true,handControl:String(s.handControl||'').slice(0,180),dragging:s.dragging===true,dragPoseReady:s.dragPoseReady===true,stereo:s.stereo===true,stereoIpdMm:Number.isFinite(s.stereoIpdMm)?Math.max(0,Math.min(72,s.stereoIpdMm)):64,stereoConvergencePx:Number.isFinite(s.stereoConvergencePx)?Math.max(-400,Math.min(400,s.stereoConvergencePx)):0,stereoVerticalPx:Number.isFinite(s.stereoVerticalPx)?Math.max(-160,Math.min(160,s.stereoVerticalPx)):0,vrControlsVersion:s.vrControlsVersion===2?2:0,vrCalibration:s.vrCalibration===1?1:0,vrEye:[0,1,2].includes(s.vrEye)?s.vrEye:0,stereoBalancePx:Number.isFinite(s.stereoBalancePx)?Math.max(-120,Math.min(120,s.stereoBalancePx)):0,cameraContrast:Number.isFinite(s.cameraContrast)?Math.max(80,Math.min(130,s.cameraContrast)):100,cameraFocus:s.cameraFocus===1?1:0,cameraResolution:String(s.cameraResolution||"Não informada").slice(0,40),cameraSharpness:Number.isFinite(s.cameraSharpness)?Math.max(0,Math.min(70,s.cameraSharpness)):25,mapping:s.mapping===true,mappedSurfaces:Number.isInteger(s.mappedSurfaces)?Math.max(0,Math.min(48,s.mappedSurfaces)):0,depthCoverage:Number.isFinite(s.depthCoverage)?Math.max(-1,Math.min(1,s.depthCoverage)):-1,selected:[100].includes(s.selected)?s.selected:100,side:Number.isFinite(s.side)?s.side:140,panels:Number.isInteger(s.panels)?Math.max(0,Math.min(24,s.panels)):0,panelList,selectedPanel,trackedAnchors:Number.isInteger(s.trackedAnchors)?Math.max(0,Math.min(24,s.trackedAnchors)):0,fps:Number.isFinite(s.fps)?Math.max(0,Math.min(120,s.fps)):0,tracking:s.tracking===true,trackingFailure:String(s.trackingFailure||'UNKNOWN').slice(0,80),markerVisible:s.markerVisible===true,telemetryVersion:Number.isInteger(s.testTelemetryVersion)?Math.max(0,Math.min(4,s.testTelemetryVersion)):0,lastSize:Number.isFinite(s.lastSize)?s.lastSize:0,origin:[100].includes(s.origin)?s.origin:0,status:String(s.status||'').slice(0,800),measurements:String(s.measurements||'').slice(0,1200)};
    for(const ack of (Array.isArray(body.acks)?body.acks:[]).slice(0,32)){const c=d.commands.find(c=>c.id===ack.id);if(c&&c.status==='pending'){c.status=ack.ok===true?'received':'rejected';c.message=String(ack.message||'').slice(0,300);}}
    return {commands:d.commands.filter(c=>c.status==='pending').map(c=>({id:c.id,action:c.action,value:c.value,panelId:c.panelId,ttl:Math.max(0,c.expires-this.now())}))};
  }
  command(id,input){this.clean();const command=validateCommand(input),d=this.devices.get(id);if(!d||this.now()-d.seen>3000)throw Error('Celular desconectado.');if(!d.state.active)throw Error('Deixe o aplicativo aberto no celular.');if(command.action==='open_ar'){if(d.state.screen!=='home'||!d.state.ready)throw Error('AR indisponível neste momento.');}else if(command.action==='close_ar'){if(d.state.screen!=='ar')throw Error('Abra o AR no celular primeiro.');}else if(d.state.screen!=='ar'||!d.state.ready)throw Error('Abra o AR no celular primeiro.');
    const pending=d.commands.filter(c=>c.status==='pending');
    if(command.action==='close_ar'){
      const closing=pending.find(c=>c.action==='close_ar');if(closing)return {id:closing.id};
      // Leaving AR runs on Android's activity thread even if the GL renderer has failed.
      for(const c of pending){c.status='rejected';c.message='Cancelado para sair do AR.';}
    }else if(pending.length)throw Error('Aguarde a confirmação do comando anterior.');
    const c={...command,id:randomUUID(),expires:this.now()+5000,status:'pending',message:'Aguardando o celular.'};d.commands.push(c);return {id:c.id};
  }
  status(){this.clean();return [...this.devices.values()].map(d=>({id:d.id,name:d.name,online:this.now()-d.seen<=3000,state:d.state,lastCommand:d.commands.at(-1)||null}));}
}
module.exports={NativeControl,validateCommand};
