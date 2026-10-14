'use strict';
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline/promises');
const {stdin,stdout}=require('node:process');
const {parseMarkerPose,summarize,compareMarkerPoses}=require('./native-metrics.cjs');

const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const base=new URL(arg('--server','http://localhost:3000'));
const duration=Math.max(10,Math.min(180,Number(arg('--duration','30'))||30));
const exerciseControls=args.includes('--exercise-controls');
const outputDirectory=path.resolve(arg('--output','output/qa/device-tests'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rl=readline.createInterface({input:stdin,output:stdout});
const report={schema:1,createdAt:new Date().toISOString(),application:'ARquest native Android companion',testMode:'guided-on-device',server:base.origin,deviceModel:null,checks:[],notes:[],samples:[]};

if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Por segurança, rode o verificador no próprio PC do servidor, usando localhost.');
if(base.protocol!=='http:'||base.username||base.password)throw new Error('Use a URL local do painel, por exemplo http://localhost:3000.');

async function request(route,body) {
  const response=await fetch(new URL(route,base),body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base.origin},body:JSON.stringify(body)}:{});
  let data;try{data=await response.json();}catch{throw new Error('O servidor devolveu uma resposta inválida.');}
  if(!response.ok)throw new Error(data.error||`Servidor respondeu HTTP ${response.status}.`);
  return data;
}
async function onlineDevices(){return (await request('/api/native/status')).devices.filter(d=>d.online);}
async function readDevice(id){return (await onlineDevices()).find(d=>d.id===id)||null;}
async function waitFor(id,predicate,timeoutMs,description) {
  const start=Date.now();
  while(Date.now()-start<timeoutMs){const device=await readDevice(id);if(device&&predicate(device))return device;await delay(400);}
  throw new Error(`Tempo esgotado aguardando: ${description}.`);
}
async function recordFor(id,seconds,label,{markerOnly=false}={}) {
  const end=Date.now()+seconds*1000,start=Date.now(),collected=[];let lastSample=0;
  while(Date.now()<end){const device=await readDevice(id);if(!device)throw new Error('Celular desconectou durante a medição.');const s=device.state;
    if(Date.now()-lastSample>=900){const sample={elapsedSeconds:Number(((Date.now()-start)/1000).toFixed(1)),fps:s.fps,tracking:s.tracking,trackingFailure:s.trackingFailure,anchors:s.panels,trackedAnchors:s.trackedAnchors,markerVisible:s.markerVisible};
      if(s.markerVisible)sample.pose=parseMarkerPose(s.measurements);
      if(!markerOnly||sample.markerVisible){collected.push(sample);const {pose,...shareable}=sample;report.samples.push({phase:label,...shareable});}
      lastSample=Date.now();stdout.write(`\r${label}: ${Math.min(seconds,Math.floor((Date.now()-start)/1000))}/${seconds}s · ${s.fps||'—'} FPS · AR ${s.tracking?'rastreando':'sem pose'} · marcador ${s.markerVisible?'visível':'—'}   `);
    }
    await delay(200);
  }
  stdout.write('\n');const metrics=summarize(collected);report.checks.push({name:label,metrics});return collected;
}
async function command(id,action){return request('/api/native/command',{device:id,action});}
function check(name,result,details={}){report.checks.push({name,result,...details});stdout.write(`${result==='passed'?'PASS':result==='skipped'?'SKIP':'INFO'} · ${name}${details.message?': '+details.message:''}\n`);}

(async()=>{
  try{
    stdout.write('ARquest · verificador guiado para o APK Android nativo\n');
    stdout.write('O teste mede estado real reportado pelo APK; você movimentará o telefone nos passos indicados.\n\n');
    await rl.question('1) Conecte o APK pelo botão “Editar Android” no PC; deixe o AR aberto e pressione Enter... ');
    const devices=await onlineDevices();
    if(!devices.length)throw new Error('Nenhum celular conectado. Confirme o pareamento, a rede e que o APK esteja aberto em AR.');
    let device=devices[0];
    if(devices.length>1){stdout.write(devices.map((d,i)=>`${i+1}) ${d.name} · ${d.state.screen}/${d.state.active?'ativo':'pausado'}`).join('\n')+'\n');const choice=Number(await rl.question('Escolha o número do Infinix: '));if(!Number.isInteger(choice)||choice<1||choice>devices.length)throw new Error('Seleção inválida.');device=devices[choice-1];}
    const id=device.id;
    if(device.state.screen!=='ar'||!device.state.active)throw new Error('O telefone está pareado, mas o AR nativo não está aberto em primeiro plano.');
    if(device.state.telemetryVersion<1)throw new Error('Este APK não envia telemetria de teste. Compile e instale a versão 0.6.0 atualizada do ARquest.');
    report.deviceModel=device.name;report.appState={screen:device.state.screen,sideMm:device.state.side,panelsAtStart:device.state.panels};
    check('pareamento PC ↔ APK','passed',{message:'telefone ativo e enviando estado'});

    await rl.question(`2) Aponte para uma superfície detalhada, mantenha o celular imóvel por ${duration}s e pressione Enter... `);
    const baseline=await recordFor(id,duration,'Base imóvel');
    const baselineMetrics=report.checks.at(-1).metrics;
    check('amostra de FPS e rastreamento',baselineMetrics.samples>=Math.floor(duration*.8)?'passed':'failed',{message:`mediana ${baselineMetrics.medianFps??'—'} FPS; pose válida em ${baselineMetrics.trackingPercent??'—'}% das amostras`,metrics:baselineMetrics});

    await rl.question('3) Mostre a folha ID 100 inteira, com boa luz, e pressione Enter para verificar reconhecimento... ');
    const markerStart=Date.now();
    device=await waitFor(id,d=>d.state.markerVisible,25000,'marcador ID 100 visível');
    check('reconhecimento do ID 100','passed',{secondsToRecognize:Number(((Date.now()-markerStart)/1000).toFixed(1)),sideMm:device.state.side});
    const firstPoses=await recordFor(id,6,'Pose da câmera no marcador',{markerOnly:true});
    const validFirst=firstPoses.filter(s=>Array.isArray(s.pose));
    check('telemetria métrica do marcador',validFirst.length>=3?'passed':'failed',{message:`${validFirst.length} leituras com posição utilizável`});

    await rl.question('4) Mantenha o ID 100 visível. Mova o telefone aproximadamente 1 m para o lado, volte à posição e ao ângulo iniciais; pressione Enter quando retornar... ');
    const returnedPoses=await recordFor(id,8,'Pose após retorno',{markerOnly:true});
    const comparison=compareMarkerPoses(validFirst,returnedPoses.filter(s=>Array.isArray(s.pose)));
    const markerReturn={millimetres:comparison.millimetres,baselineSamples:comparison.baselineSamples,returnSamples:comparison.returnSamples};
    report.checks.push({name:'repetibilidade da pose ao retornar',result:comparison.millimetres===null?'inconclusive':'measured',...markerReturn});
    stdout.write(comparison.millimetres===null?'INFO · pose de retorno: leituras insuficientes\n':`MEDIDO · pose de retorno difere ${comparison.millimetres} mm (comparação prática; não é calibração laboratorial)\n`);

    if(exerciseControls){
      await rl.question('\n5) O teste vai criar um painel extra e removê-lo no final. Deixe uma superfície/marcador no alvo. Pressione Enter para continuar ou Ctrl+C para cancelar... ');
      const before=(await readDevice(id))?.state.panels??0;
      if(before>=24)check('comando fixar/remover','skipped',{message:'limite de 24 painéis já atingido'});
      else{
        let added=false;
        try{
          const placed=await command(id,'place');
          device=await waitFor(id,d=>d.state.panels===before+1&&d.lastCommand?.id===placed.id&&d.lastCommand?.status==='received',8000,'painel extra aparecer');added=true;
          check('comando de fixar painel','passed',{panels:device.state.panels});
        }finally{
          const current=await readDevice(id);
          if(added||current?.state.panels>before){
            const removed=await command(id,'remove');
            device=await waitFor(id,d=>d.state.panels===before&&d.lastCommand?.id===removed.id&&d.lastCommand?.status==='received',8000,'painel de teste ser removido');
            check('remoção e limpeza do painel de teste','passed',{panelsRestored:device.state.panels===before});
          }
        }
      }
    }else check('comando de fixar/remover','skipped',{message:'opcional; repita com --exercise-controls para criar e remover um painel de teste'});

    report.summary={result:report.checks.some(c=>c.result==='failed')?'review-needed':'collected',sampleCount:report.samples.length,baseline:baselineMetrics,markerReturn,limitations:['O movimento da câmera e o enquadramento continuam sendo manuais.','O FPS é a frequência de quadros renderizados reportada pelo app, não a latência total nem o FPS do sensor da câmera.','A distância após retornar depende de reproduzir aproximadamente a mesma posição e orientação; não é precisão de laboratório.']};
  }catch(error){report.summary={result:'incomplete',reason:error.message,sampleCount:report.samples.length};process.exitCode=2;stdout.write(`\nINCOMPLETO · ${error.message}\n`);}
  finally{
    try{fs.mkdirSync(outputDirectory,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const file=path.join(outputDirectory,`native-test-${stamp}.json`);fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');stdout.write(`Relatório local: ${file}\n`);}catch(error){stdout.write(`Não foi possível salvar relatório: ${error.message}\n`);}
    rl.close();
  }
})().catch(error=>{stdout.write(`${error.message}\n`);process.exitCode=1;});
