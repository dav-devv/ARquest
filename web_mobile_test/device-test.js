(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('test')!=='1')return;
  const panel=document.getElementById('qaRecorder'),start=document.getElementById('qaStart'),download=document.getElementById('qaDownload'),instruction=document.getElementById('qaInstruction'),progress=document.getElementById('qaProgress');
  panel.hidden=false;
  let samples=[],timer=null;
  const phase=seconds=>seconds<20?'Mantenha o telefone parado, apontado para a mesma cena.':seconds<40?'Mova o telefone devagar cerca de 1 m para o lado.':'Volte ao ponto e ao ângulo iniciais.';
  function save(){
    const report={schema:1,application:'ARquest WebXR',createdAt:new Date().toISOString(),testMode:'guided-device-sampling',durationSeconds:samples.length,summary:MRDeviceTestMetrics.summarize(samples),samples,limitations:['Movimento e enquadramento são realizados manualmente.','FPS é a taxa reportada pela renderização WebXR, não latência ponta a ponta nem FPS do sensor.','As âncoras acompanhadas são contadores da sessão, não medição laboratorial de erro espacial.','Nenhuma imagem da câmera, posição bruta, endereço de rede ou identificador do dispositivo é incluído.']};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='arquest-webxr-test-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  start.addEventListener('click',()=>{
    if(!window.__ARQUEST_TEST_DIAGNOSTICS?.().active){instruction.textContent='Inicie primeiro a sessão AR e tente novamente.';return;}
    samples=[];download.hidden=true;start.disabled=true;const began=Date.now();
    const collect=()=>{const seconds=Math.min(60,Math.floor((Date.now()-began)/1000));const state=window.__ARQUEST_TEST_DIAGNOSTICS?.();
      if(state)samples.push({elapsedSeconds:seconds,active:state.active,visible:state.visible,fps:state.fps,videoFps:state.videoFps,anchors:state.anchors,tracked:state.tracked,canPlace:state.canPlace,cameraReady:state.cameraReady,sbs:state.sbs,quality:state.quality,markerScanning:state.markerScanning,markerStatus:state.markerStatus,handMs:state.handMs,handStatus:state.handStatus,learningSamples:state.learningSamples});
      progress.value=seconds;instruction.textContent=seconds<60?`${phase(seconds)} (${seconds}/60 s)`: `Coleta concluída: ${samples.length} amostras.`;
      if(seconds>=60){clearInterval(timer);timer=null;start.disabled=false;download.hidden=false;}
    };
    collect();timer=setInterval(collect,1000);
  });
  download.addEventListener('click',save);
})();
