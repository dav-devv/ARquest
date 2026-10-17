(function(root) {
  const M=root.MRSpatialMath||(typeof require==='function'?require('./spatial-math'):null);
  const UI=root.MRInteraction||(typeof require==='function'?require('./interaction'):null);
  const F=root.MRARFeatures||(typeof require==='function'?require('./ar-features'):null);
  const L=root.MRTrackingLearning||(typeof require==='function'?require('./tracking-learning'):null);
  const APPS=[
    {name:'YouTube',icon:'▶',action:'open_youtube'}, {name:'Navegador',icon:'◎',action:'open_browser'},
    {name:'Mídia',icon:'♫',action:'play_pause'}, {name:'Calculadora',icon:'▦',action:'launch_calc'},
    {name:'Notas',icon:'✎',action:'launch_notepad'}, {name:'Mudo',icon:'◌',action:'mute'},
    {name:'Volume +',icon:'+',action:'volume_up'}, {name:'Volume −',icon:'−',action:'volume_down'},
    {name:'Monitor PC',icon:'▣',action:'desktop'}
  ];
  function errorText(error) {
    if(error?.name==='NotSupportedError')return 'Este aparelho/navegador não oferece AR com superfícies e âncoras. Confira o Google Play Services para RA.';
    if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'O Chrome não autorizou a sessão AR. Verifique HTTPS e as permissões de câmera/realidade aumentada.';
    return 'Não foi possível iniciar o mapeamento: '+(error?.message||'erro desconhecido');
  }
  function transformFromMatrix(matrix){const m=matrix;let x,y,z,w,trace=m[0]+m[5]+m[10];if(trace>0){const s=Math.sqrt(trace+1)*2;w=.25*s;x=(m[6]-m[9])/s;y=(m[8]-m[2])/s;z=(m[1]-m[4])/s;}else if(m[0]>m[5]&&m[0]>m[10]){const s=Math.sqrt(1+m[0]-m[5]-m[10])*2;w=(m[6]-m[9])/s;x=.25*s;y=(m[4]+m[1])/s;z=(m[8]+m[2])/s;}else if(m[5]>m[10]){const s=Math.sqrt(1+m[5]-m[0]-m[10])*2;w=(m[8]-m[2])/s;x=(m[4]+m[1])/s;y=.25*s;z=(m[9]+m[6])/s;}else{const s=Math.sqrt(1+m[10]-m[0]-m[5])*2;w=(m[1]-m[4])/s;x=(m[8]+m[2])/s;y=(m[9]+m[6])/s;z=.25*s;}return new root.XRRigidTransform({x:m[12],y:m[13],z:m[14]},{x,y,z,w});}

  class QuadRenderer {
    constructor(canvas) {
      this.gl=canvas.getContext('webgl',{xrCompatible:true,alpha:true,antialias:false,premultipliedAlpha:false});
      if(!this.gl)throw new Error('WebGL indisponível');
      const gl=this.gl;
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      const vs=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 uv;uniform mat4 mvp;varying vec2 v;void main(){v=uv;gl_Position=mvp*vec4(p,1.0);}');
      const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;varying vec2 v;void main(){vec4 c=texture2D(tex,v);if(c.a<0.02)discard;gl_FragColor=c;}');
      this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
        -.5,-.5,0,0,0, .5,-.5,0,1,0, -.5,.5,0,0,1,
        -.5,.5,0,0,1, .5,-.5,0,1,0, .5,.5,0,1,1
      ]),gl.STATIC_DRAW);
      this.position=gl.getAttribLocation(this.program,'p');this.uv=gl.getAttribLocation(this.program,'uv');
      this.mvp=gl.getUniformLocation(this.program,'mvp');this.sampler=gl.getUniformLocation(this.program,'tex');
      this.textures=new Map();this.textureSizes=new Map();
    }
    upload(key,source) {
      const gl=this.gl;
      if(!this.textures.has(key))this.textures.set(key,gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D,this.textures.get(key));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      const width=source.videoWidth||source.naturalWidth||source.width;
      const height=source.videoHeight||source.naturalHeight||source.height;
      const size=width+'x'+height;
      if(this.textureSizes.get(key)===size)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
      else {gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);this.textureSizes.set(key,size);}
    }
    begin(layer) {
      const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
      gl.viewport(0,0,layer.framebufferWidth,layer.framebufferHeight);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,20,0);
      gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,20,12);
      gl.activeTexture(gl.TEXTURE0);gl.uniform1i(this.sampler,0);
    }
    draw(key,matrix) {
      const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.textures.get(key));gl.uniformMatrix4fv(this.mvp,false,matrix);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    cameraBackground(texture) {
      const gl=this.gl;
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniformMatrix4fv(this.mvp,false,M.scale(M.identity(),2,2));gl.drawArrays(gl.TRIANGLES,0,6);
      gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
    }
    dispose() {
      this.disposeOptics?.();
      const gl=this.gl;for(const texture of this.textures.values())gl.deleteTexture(texture);
      gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);this.textures.clear();
    }
  }

  class ARWorkspace {
    constructor({xr,canvas,overlay,bridge,onState,onMessage,rendererFactory}) {
      Object.assign(this,{xr,canvas,overlay,bridge,onState,onMessage});
      this.rendererFactory=rendererFactory||((canvas)=>new QuadRenderer(canvas));
      this.session=null;this.renderer=null;this.panels=new Map();this.revisions={library:0,desktop:0};this.panelSerial=0;this.mapAnchor=null;this.mapMatrix=null;this.mapReferenceId=null;this.savedPanels=[];this.selectedPanelId='';
      try{const saved=JSON.parse(root.localStorage?.getItem('mr-spatial-workspace-v1')||'{}');if(saved?.version===1&&Array.isArray(saved.panels))this.savedPanels=saved.panels.filter(p=>p&&['library','desktop'].includes(p.type)&&typeof p.id==='string'&&Array.isArray(p.anchorRelative)&&p.anchorRelative.length===16&&Array.isArray(p.relative)&&p.relative.length===16&&[...p.anchorRelative,...p.relative,p.width,p.height].every(Number.isFinite)).slice(0,24);this.selectedPanelId=saved?.selected||'';}catch{}
      this.pending=null;this.placing=false;this.canPlace=false;this.starting=false;this.nextTextureTime=0;
      this.state={active:false,canPlace:false,tracking:'Pronto para iniciar',anchors:0,tracked:0,fps:0,videoFps:0,sbs:false,cameraReady:false};
      this.frameCount=0;this.videoCount=0;this.metricTime=null;
      let saved={};try{saved=JSON.parse(root.localStorage?.getItem('mr-ar-settings')||'{}');}catch{}
      this.settings=F.settings(saved);this.quality=new F.Quality();this.dwell=new F.Dwell();this.gamepadEdge=new F.ButtonEdge();this.pinch=new F.Pinch();
      this.lastAction=-Infinity;this.suppressUntil=0;this.lastFrameTime=0;this.correctionStable=new Map();
      this.handFilter=new L.AdaptivePoint();this.motion=new L.CameraMotion();this.correctionLearners=new WeakMap();
      this.handTracks=new Map();this.handPair=null;this.resizeGesture=null;
      this.desktopSources=new Map();this.selectedDesktopSource='default';
      this.mouseMode=false;this.remoteDown=false;this.remoteSource=null;this.remoteTime=0;
    }
    configure(patch){
      if(patch.adaptiveTracking!==undefined)this.resetLearning();
      if(patch.hands===true)this.handFailed=false;
      if(patch.correctMarkers===true)this.markerFailed=false;
      this.settings=F.settings({...this.settings,...patch});
      try{root.localStorage?.setItem('mr-ar-settings',JSON.stringify(this.settings));}catch{}
      this.resetInput();
      if(!this.settings.hands){this.stopHands();this.stateChanged({handStatus:'Mãos desativadas.'});}else if(this.session&&this.state.cameraReady)this.startHands();
      if(!this.settings.correctMarkers&&this.markerMode==='correct')this.stopMarker();else this.ensureCorrection();
      if(!this.settings.autoQuality&&this.quality.index!==0){this.quality=new F.Quality();this.applyQuality();}
    }
    resetInput(){this.releaseMouse();this.dwell.reset();this.pinch.reset();this.gamepadEdge.reset();this.handSample=null;this.drag=null;this.inputRay=null;this.handHover=null;this.handPair=null;this.resizeGesture=null;this.handTracks?.clear();}
    releaseMouse(){if(this.remoteSource)this.bridge.mouse?.({release:true});this.remoteDown=false;this.remoteSource=null;this.remoteHover=null;this.lastRemoteDown=undefined;this.remoteTime=0;}
    updateMouse(sample,target,time){
      if(!this.mouseMode){this.releaseMouse();return false;}
      const panel=target?.panel,id=panel?.sourceId,content=id==='default'?this.desktopContent:this.desktopSources.get(id);
      const point=panel?.type==='desktop'&&content?desktopPoint(target.hit,panel,content):null;
      if(!sample||!point||!this.bridge.source(id)||!this.bridge.mouseBindings?.has(id)){
        this.releaseMouse();this.pinch.reset();return true;
      }
      if(this.remoteSource&&this.remoteSource!==id){this.releaseMouse();this.pinch.reset();return true;}
      this.remoteSource=id;
      let position=point;
      if(sample.pressed){
        if(this.remoteHover?.panel===panel&&time-this.remoteHover.time<250)position=this.remoteHover.point;
        this.remoteDown=true;sample.pressed=false;
      }
      const wasDown=this.lastRemoteDown,down=this.remoteDown&&sample.closed;
      if(!sample.closed){this.remoteDown=false;this.remoteHover={panel,point,time};}
      if(time-this.remoteTime>=40||down!==wasDown){
        if(!this.bridge.mouse({streamId:id,u:position.u,v:position.v,down})){this.releaseMouse();this.pinch.reset();return true;}
        this.remoteTime=time;this.lastRemoteDown=down;
      }
      return true;
    }
    startHands(){
      if(this.handTracker||!root.MRMarkerTracker||this.handFailed)return;
      this.stateChanged({handStatus:'Carregando detector de mãos…'});
      this.handTracker=new root.MRMarkerTracker(this.renderer,(hands,snapshot)=>{
        if(!this.session||this.inputReady===false||snapshot.time<(this.learningResetTime||0)||performance.now()-snapshot.time>400){this.resetInput();this.handFilter.reset();return;}
        const detected=(hands||[]).filter(h=>h.score>=.65).slice(0,2);
        const pair=[];
        for(const hand of detected){
          if(pair.some(h=>h.identity===hand.identity))continue;
          let track=this.handTracks.get(hand.identity);
          if(!track){track={pinch:new F.Pinch(),filter:new L.AdaptivePoint()};this.handTracks.set(hand.identity,track);}
          const gesture=track.pinch.step(hand.points,hand.identity,snapshot.width/snapshot.height),raw=hand.points[8];
          const point=this.settings.adaptiveTracking?track.filter.step([raw.x,raw.y],snapshot.time,hand.identity):[raw.x,raw.y];
          if(point)pair.push({identity:hand.identity,...gesture,ray:F.rayAt(point[0],point[1],snapshot.projection,snapshot.world),time:snapshot.time});
        }
        for(const key of this.handTracks.keys())if(!pair.some(h=>h.identity===key))this.handTracks.delete(key);
        this.handPair=pair.length===2?pair:null;
        const hand=detected[0];
        if(!hand){this.handFilter.reset();this.handSample=null;this.pinch.reset();this.drag=null;this.stateChanged({handStatus:'Mostre uma mão aberta para começar.'});return;}
        const gesture=this.pinch.step(hand.points,hand.identity,snapshot.width/snapshot.height);
        if(snapshot.time-(this.handMetricTime||0)>1000){this.handMetricTime=snapshot.time;this.stateChanged({handMs:Math.round(snapshot.processingMs||0)});}
        const raw=hand.points[8],filtered=this.settings.adaptiveTracking?this.handFilter.step([raw.x,raw.y],snapshot.time,hand.identity):[raw.x,raw.y];
        if(!filtered)return;
        const point={x:filtered[0],y:filtered[1]};
        this.handSample={ray:F.rayAt(point.x,point.y,snapshot.projection,snapshot.world),time:snapshot.time,...gesture};
        this.stateChanged({handStatus:gesture.closed?'Pinça fechada':'Mão rastreada — faça uma pinça para clicar.'});
      },message=>{this.handFailed=true;this.stopHands();this.stateChanged({handStatus:message});},{url:'/mobile/hand-worker.js',init:true,onReady:()=>{this.stateChanged({handStatus:'Mostre uma mão aberta para começar.'});}});
      this.handTracker.captureWidth=384;
    }
    stopHands(){this.handFilter.reset();this.handTracker?.dispose();this.handTracker=null;this.resetInput();}
    updateResize(time){
      const pair=this.handPair;
      if(!pair||pair.some(h=>time-h.time>400)){if(this.resizeGesture){this.resetInput();return true;}return false;}
      this.dwell.reset();this.drag=null;this.handHover=null;this.inputRay=null;
      if(this.handSample)this.handSample.pressed=false;
      if(!pair.every(h=>h.closed)){this.resizeGesture=null;return true;}
      if(!this.resizeGesture){
        const targets=pair.map(h=>this.pick(h.ray));
        if(!targets[0]||targets[0].panel!==targets[1]?.panel)return true;
        const panel=targets[0].panel,span=this.resizeSpan(pair,panel);
        if(span>.025)this.resizeGesture={panel,span,width:panel.width,height:panel.height};
      }else{
        const g=this.resizeGesture;
        if(!g.panel.tracked||this.panels.get(g.panel.id||g.panel.type)!==g.panel){this.resetInput();return true;}
        const span=this.resizeSpan(pair,g.panel);
        if(span!==null){const scale=Math.max(.15/g.width,Math.min(4/g.width,span/g.span));g.panel.width=g.width*scale;g.panel.height=g.height*scale;this.schedulePersist();}
      }
      this.stateChanged({inputStatus:'Duas pinças: afaste para aumentar; aproxime para diminuir.'});return true;
    }
    resizeSpan(pair,panel){
      const hits=pair.map(h=>M.intersectPanel(h.ray,panel.model,10000,10000));
      if(hits.some(h=>!h||h.distance>20))return null;
      const points=hits.map((hit,i)=>pair[i].ray.origin.map((x,j)=>x+pair[i].ray.direction[j]*hit.distance));
      return Math.hypot(...points[0].map((x,i)=>x-points[1][i]));
    }
    resetLearning(){this.learningResetTime=performance.now();this.handFilter.reset();this.motion.reset();this.correctionLearners=new WeakMap();for(const panel of this.panels.values())panel.correctionTarget=null;this.resetInput();}
    pick(ray){
      const hits=[...this.panels.values()].filter(p=>p.tracked).map(panel=>({panel,hit:M.intersectPanel(ray,panel.model,panel.width,panel.height)})).filter(x=>x.hit).sort((a,b)=>a.hit.distance-b.hit.distance);
      if(!hits.length)return null;const target=hits[0];
      target.index=target.panel.type==='library'?UI.appTiles({x:0,y:0,width:960,height:600},APPS.length).findIndex(r=>UI.contains(r,target.hit.u*960,target.hit.v*600)):-1;
      target.key=target.index>=0?(target.panel.id||target.panel.type)+':'+target.index:null;return target;
    }
    activate(target,time){
      if(!target||target.index<0||target.index>=APPS.length||!target.panel.tracked||this.panels.get(target.panel.id||target.panel.type)!==target.panel||time<this.suppressUntil||time-this.lastAction<600)return;
      this.lastAction=time;this.dwell.consume();
      if(APPS[target.index].action==='desktop')this.onMessage('Escolha Monitor do PC na barra e toque em Fixar no alvo.');else this.bridge.action(APPS[target.index].action);
    }
    updateInputs(time,viewer){
      if(this.calibrating||time<this.suppressUntil){this.resetInput();return;}
      const primary=viewer.views[0],gaze=F.rayAt(.5,.5,primary.projectionMatrix,primary.transform.matrix);
      if(this.handPair&&this.mouseMode){this.releaseMouse();this.inputRay=null;this.pinch.reset();this.stateChanged({inputStatus:'Controle do PC: use uma mão. Desative este modo para redimensionar.'});return;}
      if(this.updateResize(time))return;
      const sample=this.handSample&&time-this.handSample.time<=400?this.handSample:null;
      if(!sample&&this.handSample){this.handSample=null;this.pinch.reset();this.drag=null;}
      const ray=sample?.ray||gaze,target=this.pick(ray);this.inputRay=ray;
      const controlling=this.updateMouse(sample,target,time);
      if(controlling){this.dwell.reset();this.drag=null;}
      else if(sample){
        this.dwell.reset();
        if(sample.pressed){
          sample.pressed=false;
          const pressTarget=this.handHover&&time-this.handHover.time<300?this.handHover.target:target;
          if(pressTarget?.index>=0)this.activate(pressTarget,time);
          else if(target&&target.hit.v<.12)this.drag={panel:target.panel,distance:target.hit.distance,offset:M.transform(M.inverseRigid(target.panel.model),ray.origin.map((v,i)=>v+ray.direction[i]*target.hit.distance)),since:time};
        }
        if(!sample.closed)this.handHover={target,time};
        if(this.drag&&sample.closed&&time-this.drag.since>250){
          const panel=this.drag.panel;
          if(!panel.tracked||!panel.anchorMatrix){this.drag=null;return;}
          const next=new Float32Array(panel.model),offset=M.transform(next,this.drag.offset,0);
          for(let i=0;i<3;i++)next[12+i]=ray.origin[i]+ray.direction[i]*this.drag.distance-offset[i];
          const corrected=new Float32Array(panel.anchorMatrix),c=panel.correction||[0,0,0],shift=M.transform(panel.anchorMatrix,c,0);for(let i=0;i<3;i++)corrected[12+i]+=shift[i];
          panel.relative=M.multiply(M.inverseRigid(corrected),next);panel.model=next;this.schedulePersist();
        }
        if(!sample.closed)this.drag=null;
      }else if(this.state.sbs&&this.settings.dwell){if(this.dwell.step(target?.key,time,this.settings.dwellMs))this.activate(target,time);}
      else this.dwell.reset();
      let pad;try{pad=Array.from(root.navigator?.getGamepads?.()||[]).find(p=>p?.connected);}catch{}
      if((pad?.id||null)!==this.gamepadId){this.gamepadEdge.reset();this.gamepadId=pad?.id||null;}
      if(this.gamepadEdge.step(!!pad?.buttons?.[0]?.pressed))this.activate(this.pick(gaze),time);
      this.stateChanged({inputStatus:this.mouseMode&&target?.panel.type==='desktop'?(this.remoteSource?(this.remoteDown?'Arrastando no Windows':'Indicador: cursor / pinça: clique'):'Associe esta fonte ao monitor no painel do PC.'):target?.index>=0?APPS[target.index].name+(sample?' · pinça':this.state.sbs&&this.settings.dwell?' · mantenha a mira':' · botão A / toque'):'Mire um ícone; pinça no cabeçalho para mover.',gamepadStatus:pad?'Controle conectado · botão 0/A seleciona':'Controle: pressione um botão para conectar.'});
      if(this.reticle&&time-(this.reticleTime||0)>80){
        const c=this.reticle.getContext('2d');c.clearRect(0,0,128,128);c.strokeStyle=this.mouseMode&&this.remoteSource?'#38bdf8':target?.key?'#b6e5b9':'#fff';c.lineWidth=5;c.beginPath();c.arc(64,64,42,0,Math.PI*2);c.stroke();
        c.strokeStyle='#54e6b4';c.lineWidth=12;c.beginPath();c.arc(64,64,42,-Math.PI/2,-Math.PI/2+Math.PI*2*this.dwell.progress);c.stroke();c.fillStyle='#fff';c.fillRect(61,61,6,6);
        this.renderer.upload('reticle',this.reticle);this.reticleTime=time;
      }
    }
    applyQuality(){
      if(this.session&&root.XRWebGLLayer&&this.renderer){
        try{this.session.updateRenderState({baseLayer:new root.XRWebGLLayer(this.session,this.renderer.gl,{antialias:false,framebufferScaleFactor:this.quality.level.scale})});}
        catch{this.onMessage('O navegador manteve a resolução atual. Frequências de processamento ajustadas.');}
      }
      this.stateChanged({quality:this.quality.level.name});
    }
    stateChanged(patch) {
      if(!Object.keys(patch).some(key=>this.state[key]!==patch[key]))return;
      Object.assign(this.state,patch);this.onState({...this.state});
    }
    persistPanels(){if(!this.mapMatrix)return;try{const inverse=M.inverseRigid(this.mapMatrix),panels=[...this.panels.values()].filter(p=>p.anchorMatrix).slice(0,24).map(p=>({id:p.id||p.type,type:p.type,width:p.width,height:p.height,anchorRelative:Array.from(M.multiply(inverse,p.anchorMatrix)),relative:Array.from(p.relative)}));root.localStorage?.setItem('mr-spatial-workspace-v1',JSON.stringify({version:1,referenceId:this.mapReferenceId,panels,selected:this.selectedPanelId}));}catch{}}
    schedulePersist(){clearTimeout(this.persistTimer);this.persistTimer=setTimeout(()=>this.persistPanels(),500);}
    restorePanels(frame){if(!this.mapMatrix||!this.savedPanels.length)return;const saved=this.savedPanels.splice(0,24);for(const item of saved){if(this.panels.has(item.id))continue;const world=M.multiply(this.mapMatrix,new Float32Array(item.anchorRelative)),transform=transformFromMatrix(world);try{Promise.resolve(frame.createAnchor(transform,this.space)).then(anchor=>{if(!this.session){anchor.delete();return;}this.panels.set(item.id,{id:item.id,type:item.type,sourceId:'default',anchor,relative:new Float32Array(item.relative),width:item.width,height:item.height,model:null,tracked:false,markerInfo:null,correction:[0,0,0]});const n=Number(String(item.id).match(/(\d+)$/)?.[1]);if(Number.isFinite(n))this.panelSerial=Math.max(this.panelSerial,n);this.stateChanged({anchors:this.panels.size});}).catch(()=>{});}catch{}}}
    async start() {
      if(this.starting||this.session)return;
      this.starting=true;
      let session;
      try {
        // Called directly from the user gesture. No gyro-only fallback is allowed here.
        session=await this.xr.requestSession('immersive-ar',{
          requiredFeatures:['hit-test','anchors','dom-overlay'],optionalFeatures:['camera-access'],domOverlay:{root:this.overlay}
        });
        this.session=session;
        session.addEventListener('end',()=>this.cleanup(session));
        this.renderer=this.rendererFactory(this.canvas);
        await this.renderer.gl.makeXRCompatible();
        if(this.session!==session)return;
        try {this.cameraBinding=root.XRWebGLBinding?new root.XRWebGLBinding(session,this.renderer.gl):null;}catch{this.cameraBinding=null;}
        session.updateRenderState({baseLayer:new root.XRWebGLLayer(session,this.renderer.gl,{antialias:false,framebufferScaleFactor:.75}),depthNear:.05,depthFar:30});
        this.space=await session.requestReferenceSpace('local');
        const viewer=await session.requestReferenceSpace('viewer');
        this.hitSource=await session.requestHitTestSource({space:viewer});
        if(this.session!==session){this.hitSource?.cancel();return;}
        this.space.addEventListener('reset',()=>{this.stopMarker();this.resetLearning();this.correctionStable.clear();for(const panel of this.panels.values())panel.correctionTarget=null;this.mapAnchor?.delete();this.mapAnchor=null;this.mapMatrix=null;this.onMessage('O ambiente foi relocalizado. Leia novamente o marcador de referência para recuperar as janelas salvas.');});
        this.createTextures();
        session.addEventListener('select',event=>this.select(event));
        session.addEventListener('visibilitychange',()=>{
          if(session.visibilityState!=='visible'){this.canPlace=false;this.pending=null;this.resetInput();this.metricTime=null;this.frameCount=this.videoCount=0;this.stateChanged({canPlace:false,tracking:'Sessão pausada pelo navegador'});}
        });
        this.stateChanged({active:true,tracking:'Mova o celular devagar para reconhecer uma superfície.'});
        session.requestAnimationFrame((time,frame)=>this.frame(time,frame));
      } catch(error) {
        if(session){try{await session.end();}catch{}this.cleanup(session);}
        this.onMessage(errorText(error));
        this.stateChanged({active:false,canPlace:false,tracking:errorText(error)});
      } finally {this.starting=false;}
    }
    requestPlacement(type) {
      if(!['library','desktop'].includes(type))return;
      if(!this.session||!this.canPlace||this.placing){this.onMessage('Aguarde o alvo verde sobre uma superfície.');return;}
      this.pending=type;
    }
    toggleSBS() {
      if(!this.session)return;
      if(!this.state.sbs&&!this.state.cameraReady){this.onMessage('O Chrome não disponibilizou a imagem da câmera AR para duas lentes. O AR normal continua disponível.');return;}
      this.stateChanged({sbs:!this.state.sbs});
      this.resetInput();this.calibrating=false;
      if(this.state.sbs)try{root.screen?.orientation?.lock?.('landscape').catch(()=>{});}catch{}
      else try{root.screen?.orientation?.unlock?.();}catch{}
      this.onMessage(this.state.sbs?'Deite o celular. Se a sessão ficar em retrato, as lentes serão giradas automaticamente.':'Visualização AR normal.');
    }
    scanMarker(sizeMM=100,maintenance=false) {
      if(!this.session||!this.state.cameraReady){this.onMessage('A leitura exige acesso à câmera AR pelo Chrome.');return;}
      if(!Number.isFinite(sizeMM)||sizeMM<70||sizeMM>300){this.onMessage('Informe o lado preto medido, entre 70 e 300 mm.');return;}
      this.stopMarker();this.markerStable=new root.MRMarkerMath.StablePose();this.markerSize=sizeMM/1000;
      this.markerMode=maintenance?'correct':'place';this.correctionStable.clear();
      this.markerDeadline=maintenance?Infinity:performance.now()+20000;
      this.markerTracker=new root.MRMarkerTracker(this.renderer,(markers,snapshot)=>{
        if(!this.session||this.inputReady===false||snapshot.time<(this.learningResetTime||0)||performance.now()-snapshot.time>750)return;
        if(this.markerMode==='correct'){
          for(const panel of this.panels.values())if(panel.markerInfo){
            const matches=markers.filter(m=>m.id===panel.markerInfo.id),marker=matches.length===1?matches[0]:null,reference=snapshot.references?.find(r=>r.panel===panel);
            let stable=this.correctionStable.get(panel);if(!stable){stable=new root.MRMarkerMath.StablePose();this.correctionStable.set(panel,stable);}
            const local=marker&&root.MRMarkerMath.pose(marker.corners,snapshot.width,snapshot.height,snapshot.projection,panel.markerInfo.size);
            const world=local&&M.multiply(snapshot.world,local),accepted=stable.add(marker?.id,world);
            if(accepted&&reference){
              let target=F.correctionTarget(accepted,reference.matrix);
              if(target&&this.settings.adaptiveTracking){
                let learner=this.correctionLearners.get(panel);if(!learner){learner=new L.CorrectionLearner();this.correctionLearners.set(panel,learner);}
                target=learner.step(target,snapshot.time,snapshot.motionSafe===true&&this.motion.safe);
                if(!target)continue;
              }
              if(target){panel.correctionTarget=target;panel.correctionTime=snapshot.time;this.stateChanged({markerStatus:'Referência '+marker.id+' confirmada. Correção gradual ativa.'});}
              else this.stateChanged({markerStatus:'Desvio maior que 15 cm. Confira se a folha foi movida e leia novamente.'});
            }
          }
          return;
        }
        const origins=markers.filter(m=>m.id===100),marker=origins.length===1?origins[0]:null;
        const local=marker&&root.MRMarkerMath.pose(marker.corners,snapshot.width,snapshot.height,snapshot.projection,marker.id===100?this.markerSize:.07);
        const world=local&&M.multiply(snapshot.world,local);
        const stable=this.markerStable.add(marker?.id,world);
        const tags=markers.filter(m=>[101,102,103].includes(m.id)).map(m=>({101:'horizontal ↑',102:'vertical ↑',103:'teto ↓'})[m.id]);
        this.stateChanged({markerStatus:marker?'ID 100 — mantenha parado ('+this.markerStable.count+'/4)'+(tags.length?' · etiqueta '+tags.join(', '):''):tags.length?'Etiqueta '+tags.join(', ')+' detectada. Mostre também o ID 100 para localizar o espaço.':'Mostre o ID 100 inteiro e próximo.'});
        if(stable)this.markerPending={matrix:stable,time:snapshot.time,id:marker.id,size:marker.id===100?this.markerSize:.07};
      },message=>{this.markerFailed=true;this.stopMarker();this.onMessage(message);});
      this.stateChanged({markerScanning:!maintenance,markerStatus:maintenance?'Correção ligada. Mantenha as folhas nos mesmos locais.':'Lendo marcador por até 20 segundos…'});
    }
    ensureCorrection(){if(!this.markerFailed&&this.settings.correctMarkers&&this.session&&this.state.cameraReady&&!this.markerTracker&&[...this.panels.values()].some(p=>p.markerInfo))this.scanMarker(100,true);}
    stopMarker() {
      this.markerTracker?.dispose();this.markerTracker=null;this.markerPending=null;
      this.markerMode=null;
      this.stateChanged({markerScanning:false});
    }
    remove(type) {
      if(type in this.revisions)this.revisions[type]++;
      const panel=this.panels.get(type);if(panel){panel.anchor.delete();this.panels.delete(type);this.correctionStable.delete(panel);this.correctionLearners.delete(panel);this.resetInput();if(panel.sourceId&&![...this.panels.values()].some(p=>p.sourceId===panel.sourceId))this.releaseDesktopSource(panel.sourceId);}
      if(this.pending===type)this.pending=null;
      if(this.markerMode==='correct'&&![...this.panels.values()].some(p=>p.markerInfo))this.stopMarker();
      this.stateChanged({anchors:this.panels.size});
      this.schedulePersist();
    }
    place(frame,hit,hitPose,viewerPose,type) {
      const session=this.session,revision=++this.revisions[type];
      const sourceId=this.selectedDesktopSource;
      this.placing=true;
      const hitMatrix=hitPose.transform.matrix,viewerMatrix=viewerPose.transform.matrix;
      const distance=Math.hypot(hitMatrix[12]-viewerMatrix[12],hitMatrix[13]-viewerMatrix[13],hitMatrix[14]-viewerMatrix[14]);
      const projectionX=viewerPose.views?.[0]?.projectionMatrix?.[0];
      const visibleWidth=projectionX>0?2*distance/projectionX:1.15;
      const width=Math.max(.25,Math.min(.9,visibleWidth*.78)),height=width*600/960;
      const relative=M.multiply(M.inverseRigid(hitPose.transform.matrix),M.panelPose(hitPose.transform.matrix,viewerPose.transform.matrix,height));
      let promise;
      try {promise=hit.createAnchor();}catch(error){this.placing=false;this.onMessage('Não foi possível criar a âncora. Tente outra superfície.');return;}
      Promise.resolve(promise).then(anchor=>{
        if(this.session!==session||revision!==this.revisions[type]){anchor.delete();return;}
        const id=type==='desktop'&&this.panels.has(type)?'desktop:'+ ++this.panelSerial:type;
        if(type!=='desktop')this.panels.get(type)?.anchor.delete();
        this.panels.set(id,{id,type,sourceId,anchor,relative,width,height,model:null,tracked:false,markerInfo:null,correction:[0,0,0]});this.selectedPanelId=id;
        this.ensureCorrection();
        this.stateChanged({anchors:this.panels.size});
        this.schedulePersist();
        this.onMessage(type==='library'?'Biblioteca ancorada. Selecione os ícones por toque, mira ou pinça.':'Monitor ancorado. Ative Transmitir Tela no painel do PC.');
      }).catch(()=>this.onMessage('O rastreamento não conseguiu fixar a âncora. Mova o celular e tente de novo.'))
        .finally(()=>{if(this.session===session)this.placing=false;});
    }
    frame(time,frame) {
      const session=this.session;
      if(!session||frame.session!==session)return;
      session.requestAnimationFrame((time,frame)=>this.frame(time,frame));
      try {
        const layer=session.renderState.baseLayer;
        this.renderer.begin(layer);
        if(this.state.sbs){const gl=this.renderer.gl;gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
        const viewer=frame.getViewerPose(this.space);
        if(!viewer||viewer.emulatedPosition||session.visibilityState!=='visible') {
          this.inputReady=false;this.resetLearning();this.metricTime=null;this.frameCount=this.videoCount=0;
          this.markerStable?.reset();this.markerPending=null;
          this.correctionStable.clear();
          this.canPlace=false;this.pending=null;
          for(const panel of this.panels.values()){panel.tracked=false;panel.goodFrames=0;}
          this.stateChanged({canPlace:false,tracked:0,tracking:'Rastreamento perdido. Aponte para detalhes do ambiente e mova devagar.'});
          return;
        }
        this.inputReady=true;
        const mapPose=this.mapAnchor?frame.getPose(this.mapAnchor.anchorSpace,this.space):null;
        this.mapMatrix=mapPose&&!mapPose.emulatedPosition?new Float32Array(mapPose.transform.matrix):this.mapMatrix;
        if(this.mapMatrix)this.restorePanels(frame);
        this.motion.step(viewer.views[0]?.transform.matrix,time);
        if(time-(this.learningMetricTime||0)>1000){this.learningMetricTime=time;this.stateChanged({motionStatus:this.motion.label,learningSamples:this.handFilter.samples});}
        const dt=this.lastFrameTime?Math.min(.1,(time-this.lastFrameTime)/1000):0;this.lastFrameTime=time;
        const hit=frame.getHitTestResults(this.hitSource)[0];
        const hitPose=hit?.getPose(this.space);
        this.canPlace=!!hitPose&&!this.placing;
        if(this.pending) {
          const type=this.pending;this.pending=null;
          if(hitPose&&!this.placing)this.place(frame,hit,hitPose,viewer,type);
          else this.onMessage('A superfície saiu do alvo. Aponte e toque em Fixar novamente.');
        }
        let tracked=0;
        for(const panel of this.panels.values()) {
          const pose=frame.trackedAnchors?.has(panel.anchor)?frame.getPose(panel.anchor.anchorSpace,this.space):null;
          panel.goodFrames=pose&&!pose.emulatedPosition?(panel.goodFrames||0)+1:0;
          panel.tracked=panel.goodFrames>=2;
          if(panel.tracked){
            panel.anchorMatrix=new Float32Array(pose.transform.matrix);
            if(this.settings.correctMarkers&&(!this.settings.adaptiveTracking||this.motion.safe)&&panel.correctionTarget&&time-panel.correctionTime<2000)panel.correction=F.easeCorrection(panel.correction||[0,0,0],panel.correctionTarget,dt);
            const correction=M.identity();(panel.correction||[0,0,0]).forEach((v,i)=>correction[12+i]=v);
            panel.model=M.multiply(panel.anchorMatrix,M.multiply(correction,panel.relative));tracked++;
          }
        }
        // Rendering/pose tracking continues at XR cadence; video uploads only for visible monitors.
        if([...this.panels.values()].some(p=>p.type==='desktop'&&p.tracked) && time>=this.nextTextureTime){
          const ids=new Set([...this.panels.values()].filter(p=>p.type==='desktop'&&p.tracked).map(p=>p.sourceId||'default'));
          for(const id of ids)this.updateDesktop(id);
          for(const id of this.desktopSources.keys())if(![...this.panels.values()].some(p=>p.type==='desktop'&&(p.sourceId||'default')===id))this.releaseDesktopSource(id);
          const interval=1000/this.quality.level.video;
          this.nextTextureTime+=(Math.floor((time-this.nextTextureTime)/interval)+1)*interval;
        }
        if(this.metricTime===null)this.metricTime=time;
        this.frameCount++;
        if(time-this.metricTime>=1000){
          const seconds=(time-this.metricTime)/1000;
          this.stateChanged({fps:Math.round(this.frameCount/seconds),videoFps:Math.round(this.videoCount/seconds)});
          if(this.settings.autoQuality&&this.quality.sample(this.frameCount/seconds,time,session.frameRate||60))this.applyQuality();
          this.frameCount=0;this.videoCount=0;this.metricTime=time;
        }
        const primary=viewer.views[0];
        let cameraTexture=null;
        try {if(primary?.camera&&this.cameraBinding)cameraTexture=this.cameraBinding.getCameraImage(primary.camera);}catch{}
        this.stateChanged({cameraReady:!!cameraTexture});
        this.ensureCorrection();
        if(cameraTexture&&this.settings.hands)this.startHands();
        let captured=false;
        if(this.markerTracker){
          if(time>this.markerDeadline){this.stopMarker();this.stateChanged({markerStatus:'Leitura encerrada. Aproxime o marcador e tente novamente.'});}
          else if(this.markerPending){
            const pending=this.markerPending;this.stopMarker();
            if(time-pending.time<1000&&typeof frame.createAnchor==='function'&&!this.placing){
              const matrix=new Float32Array(pending.matrix),transform=transformFromMatrix(matrix);
              Promise.resolve(frame.createAnchor(transform,this.space)).then(anchor=>{if(this.session!==session){anchor.delete();return;}this.mapAnchor?.delete();this.mapAnchor=anchor;this.mapReferenceId=pending.id;this.mapMatrix=matrix;this.restorePanels(frame);this.onMessage('Referência ID '+pending.id+' localizada. As janelas são posicionadas nas superfícies detectadas, separadas dos marcadores.');}).catch(()=>this.stateChanged({markerStatus:'Não foi possível fixar o referencial do espaço.'}));
              this.stateChanged({markerStatus:'Marcador espacial reconhecido; atualizando o mapa do ambiente…'});
            }else this.stateChanged({markerStatus:'Referência expirou ou âncora indisponível. Tente novamente.'});
          }else if(cameraTexture){
            try{
              this.markerTracker.interval=1000/(this.markerMode==='correct'?Math.min(2,this.quality.level.marker):this.quality.level.marker);
              captured=this.markerTracker.capture(time,cameraTexture,primary);
              if(captured)this.markerTracker.snapshot.motionSafe=this.motion.safe;
              if(captured)this.markerTracker.snapshot.references=[...this.panels.values()].filter(p=>p.tracked&&p.anchorMatrix).map(panel=>({panel,matrix:new Float32Array(panel.anchorMatrix)}));
            }
            catch(error){this.markerFailed=true;this.stopMarker();this.stateChanged({markerStatus:'Leitura indisponível: '+error.message});}
          }
          else {this.markerStable.reset();this.stateChanged({markerStatus:'Aguardando imagem da câmera AR…'});}
        }
        if(this.state.sbs&&!cameraTexture){
          this.resetInput();
          this.canPlace=false;this.pending=null;
          this.stateChanged({canPlace:false,tracking:'Imagem da câmera AR indisponível. Saia de duas lentes para continuar.'});return;
        }
        if(cameraTexture&&this.handTracker&&!captured&&!this.calibrating){
          this.handTracker.interval=1000/this.quality.level.hand;
          try{this.handTracker.capture(time,cameraTexture,primary);}catch(error){this.handFailed=true;this.stopHands();this.stateChanged({handStatus:error.message});}
        }
        this.updateInputs(time,viewer);
        const optics=this.state.sbs&&!!this.renderer.beginOptics;
        const passes=optics?[{view:primary,vp:this.renderer.beginOptics(layer.getViewport(primary))}]:this.state.sbs?sbsViewports(layer.getViewport(primary)).map(vp=>({view:primary,vp})):viewer.views.map(view=>({view,vp:layer.getViewport(view)}));
        for(const {view,vp} of passes) {
          const gl=this.renderer.gl;gl.viewport(vp.x,vp.y,vp.width,vp.height);
          if(this.state.sbs)this.renderer.cameraBackground(cameraTexture);
          const camera=M.multiply(view.projectionMatrix,view.transform.inverse.matrix);
          if(this.calibrating){const aspect=vp.width/vp.height;this.renderer.draw('calibration',M.scale(M.identity(),2*Math.min(1,1.6/aspect),2*Math.min(1,aspect/1.6)));continue;}
          for(const panel of this.panels.values())if(panel.tracked){
            this.renderer.draw(panel.type,M.multiply(camera,M.scale(panel.model,panel.width,panel.height)));
            const content=(panel.sourceId&&panel.sourceId!=='default')?this.desktopSources.get(panel.sourceId):this.desktopContent;
            if(panel.type==='desktop' && content&&this.bridge.source(panel.sourceId||'default')){
              const {width,height}=content;
              const fit=Math.min(panel.width*.975/width,panel.height*.88/height);
              const offset=M.identity();offset[13]=-panel.height*.035;offset[14]=.001;
              this.renderer.draw(panel.sourceId&&panel.sourceId!=='default'?'desktopVideo:'+panel.sourceId:'desktopVideo',M.multiply(camera,M.scale(M.multiply(panel.model,offset),width*fit,height*fit)));
            }
          }
          if(hitPose) {
            const horizontal=M.identity();horizontal[5]=0;horizontal[6]=-1;horizontal[9]=1;horizontal[10]=0;horizontal[13]=.003;
            const marker=M.multiply(hitPose.transform.matrix,M.scale(horizontal,.14,.14));
            this.renderer.draw('marker',M.multiply(camera,marker));
          }
          if((this.state.sbs||this.handSample)&&this.inputRay&&this.reticle){
            const pose=new Float32Array(primary.transform.matrix),ray=this.inputRay;
            for(let i=0;i<3;i++)pose[12+i]=ray.origin[i]+ray.direction[i]*.4;
            gl.disable(gl.DEPTH_TEST);this.renderer.draw('reticle',M.multiply(camera,M.scale(pose,.018,.018)));gl.enable(gl.DEPTH_TEST);
          }
        }
        if(optics)this.renderer.endOptics(layer,layer.getViewport(primary),this.settings);
        this.stateChanged({canPlace:this.canPlace&&!this.placing,anchors:this.panels.size,tracked,
          tracking:hitPose?'Superfície encontrada — fixe a janela no alvo verde.':'Posição rastreada — procure uma mesa ou chão com detalhes.'});
      } catch(error) {
        this.onMessage('Falha no rastreamento AR: '+error.message);
        this.canPlace=false;this.pending=null;session.end().catch(()=>this.cleanup(session));
      }
    }
    select(event) {
      if(!this.session||!this.space)return;
      if(this.calibrating)return;
      if(this.state.sbs&&!this.state.cameraReady)return;
      const pose=this.state.sbs?event.frame.getViewerPose(this.space):event.frame.getPose(event.inputSource.targetRaySpace,this.space);if(!pose||pose.emulatedPosition)return;
      const view=pose.views?.[0];const ray=this.state.sbs&&view?F.rayAt(.5,.5,view.projectionMatrix,view.transform.matrix):M.rayFromPose(pose.transform.matrix);
      this.activate(this.pick(ray),performance.now());
    }
    createTextures() {
      this.library=document.createElement('canvas');this.library.width=960;this.library.height=600;
      const c=this.library.getContext('2d');c.fillStyle='#122035';c.fillRect(0,0,960,600);
      c.fillStyle='#ffffff';c.font='bold 24px sans-serif';c.fillText('Biblioteca · aplicativos no PC',24,30);
      UI.appTiles({x:0,y:0,width:960,height:600},APPS.length).forEach((r,i)=>{
        c.fillStyle=i%2?'#24577a':'#17465e';c.fillRect(r.x,r.y,r.width,r.height);
        c.textAlign='center';c.fillStyle='#fff';c.font='40px sans-serif';c.fillText(APPS[i].icon,r.x+r.width/2,r.y+r.height*.46);
        c.font='22px sans-serif';c.fillText(APPS[i].name,r.x+r.width/2,r.y+r.height*.8,r.width-20);
      });
      this.renderer.upload('library',this.library);
      this.desktop=document.createElement('canvas');this.desktop.width=960;this.desktop.height=600;
      const dc=this.desktop.getContext('2d');
      dc.fillStyle='#08111e';dc.fillRect(0,0,960,600);dc.fillStyle='#a8d9e8';dc.font='22px sans-serif';dc.fillText('Monitor do PC',24,32);
      dc.fillStyle='#fff';dc.font='24px sans-serif';dc.fillText('Ative Transmitir Tela no painel do PC.',50,300);
      this.renderer.upload('desktop',this.desktop);
      const marker=document.createElement('canvas');marker.width=marker.height=128;
      const ctx=marker.getContext('2d');ctx.strokeStyle='#76ecd0';ctx.lineWidth=10;ctx.beginPath();ctx.arc(64,64,49,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#ffffff';ctx.fillRect(58,58,12,12);this.renderer.upload('marker',marker);
      this.reticle=document.createElement('canvas');this.reticle.width=this.reticle.height=128;
      this.renderer.upload('reticle',this.reticle);
      const grid=document.createElement('canvas');grid.width=960;grid.height=600;const g=grid.getContext('2d');
      g.fillStyle='#101817';g.fillRect(0,0,960,600);g.strokeStyle='#708e79';g.lineWidth=2;
      for(let x=0;x<=960;x+=60){g.beginPath();g.moveTo(x,0);g.lineTo(x,600);g.stroke();}for(let y=0;y<=600;y+=60){g.beginPath();g.moveTo(0,y);g.lineTo(960,y);g.stroke();}
      g.strokeStyle='#b6e5b9';g.lineWidth=5;g.beginPath();g.arc(480,300,105,0,Math.PI*2);g.moveTo(440,300);g.lineTo(520,300);g.moveTo(480,260);g.lineTo(480,340);g.stroke();
      g.fillStyle='#fff';g.textAlign='center';g.font='26px sans-serif';g.fillText('Alinhe os centros e deixe a grade reta',480,490);this.renderer.upload('calibration',grid);
    }
    releaseDesktopSource(id){
      this.desktopSources.delete(id);const key=id==='default'?'desktopVideo':'desktopVideo:'+id,texture=this.renderer?.textures?.get(key);
      if(texture){this.renderer.gl.deleteTexture(texture);this.renderer.textures.delete(key);this.renderer.textureSizes.delete(key);}
      if(id==='default'){this.desktopContent=null;this.lastVideoSource=null;}
    }
    updateDesktop(id='default') {
      if(!this.desktop)return;
      if(id!=='default'){
        const source=this.bridge.source(id),previous=this.desktopSources.get(id);
        if(!source){this.releaseDesktopSource(id);return;}
        const key=this.bridge.frameKey(source,id);if(previous?.source===source&&previous.key===key)return;
        const width=source.videoWidth||source.naturalWidth,height=source.videoHeight||source.naturalHeight;if(!width||!height)return;
        this.renderer.upload('desktopVideo:'+id,source);this.desktopSources.set(id,{source,key,width,height});this.videoCount++;return;
      }
      const source=this.bridge.source();
      if(!source){this.desktopContent=null;this.lastVideoSource=null;return;}
      const key=this.bridge.frameKey(source);
      if(source===this.lastVideoSource && key===this.lastVideoKey)return;
      const width=source.videoWidth||source.naturalWidth,height=source.videoHeight||source.naturalHeight;
      if(!width||!height)return;
      // Avoid video -> 2D canvas -> WebGL copies and texture allocations per frame.
      this.renderer.upload('desktopVideo',source);
      this.desktopContent={width,height};this.lastVideoSource=source;this.lastVideoKey=key;this.videoCount++;
    }
    cleanup(session) {
      if(this.session!==session)return;
      try{root.screen?.orientation?.unlock?.();}catch{}
      this.stopMarker();
      this.stopHands();this.resetLearning();this.calibrating=false;this.quality=new F.Quality();this.handFailed=false;this.markerFailed=false;this.correctionStable.clear();this.lastFrameTime=0;
      this.session=null;this.pending=null;this.canPlace=false;this.placing=false;
      this.hitSource?.cancel();this.hitSource=null;
      this.persistPanels();for(const panel of this.panels.values())panel.anchor.delete();this.panels.clear();this.mapAnchor?.delete();this.mapAnchor=null;this.mapMatrix=null;
      this.renderer?.dispose();this.renderer=null;this.space=null;
      this.desktopSources.clear();
      this.desktopContent=null;this.lastVideoSource=null;this.lastVideoKey=null;this.metricTime=null;this.frameCount=this.videoCount=0;
      this.nextTextureTime=0;
      this.cameraBinding=null;
      this.revisions.library++;this.revisions.desktop++;
      this.stateChanged({active:false,canPlace:false,anchors:0,tracked:0,sbs:false,cameraReady:false,quality:this.quality.level.name,handStatus:'Mãos desativadas',tracking:'Sessão encerrada. As âncoras foram removidas.'});
    }
    async end() {if(this.session)await this.session.end();}
  }

  // Duplicate the same monocular AR view without stretching it or inventing eye poses.
  function desktopPoint(hit,panel,content){
    const fit=Math.min(panel.width*.975/content.width,panel.height*.88/content.height);
    const u=.5+(hit.u-.5)*panel.width/(content.width*fit);
    const v=.5-((.5-hit.v)*panel.height+panel.height*.035)/(content.height*fit);
    return Number.isFinite(u)&&Number.isFinite(v)&&u>=0&&u<=1&&v>=0&&v<=1?{u,v}:null;
  }
  // The camera and virtual geometry use exactly the same fitted viewport.
  function sbsViewports(vp) {
    const width=Math.floor(vp.width/2),height=Math.max(1,Math.floor(width*vp.height/vp.width));
    return [0,1].map(eye=>({x:vp.x+eye*width,y:vp.y+Math.floor((vp.height-height)/2),width,height}));
  }

  async function checkSupport(xr,secure) {
    if(!secure)return {supported:false,text:'Abra esta página por HTTPS para usar o mapeamento.'};
    if(!xr)return {supported:false,text:'O Chrome deste aparelho não disponibilizou WebXR.'};
    try {const supported=await xr.isSessionSupported('immersive-ar');return {supported,text:supported?'AR disponível. O suporte a superfícies e âncoras será confirmado ao iniciar.':'Realidade aumentada não disponível neste aparelho/Chrome.'};}
    catch(error){return {supported:false,text:errorText(error)};}
  }
  function boot() {
    const $=id=>document.getElementById(id);
    const token=new URLSearchParams(location.hash.slice(1)).get('token');
    try {if(token)sessionStorage.setItem('pairingToken',token);}catch{}
    if(token)history.replaceState(null,'',location.pathname);
    let toastTimer;
    const message=text=>{$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);};
    const bridge=new root.ARPCBridge($('pcVideo'),text=>{$('connectionStatus').textContent=text;$('introConnection').textContent=text;},message);
    bridge.connect();
    const workspace=new ARWorkspace({xr:navigator.xr,canvas:$('xrCanvas'),overlay:$('overlay'),bridge,onMessage:message,onState:state=>{
      $('intro').hidden=state.active;$('hud').hidden=!state.active;
      $('placePanel').disabled=!state.canPlace;
      const list=$('windowList'),selected=list.value,signature=[...workspace.panels.keys()].join('|');
      if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren(...[...workspace.panels.values()].map((p,i)=>{const o=document.createElement('option');o.value=p.id||p.type;o.textContent=p.type==='desktop'?'Monitor '+(i+1):'Biblioteca';return o;}));if(workspace.panels.has(workspace.selectedPanelId))list.value=workspace.selectedPanelId;else if(workspace.panels.has(selected))list.value=selected;}
      $('removePanel').disabled=!workspace.panels.has(list.value);
      $('assignSource').disabled=workspace.panels.get(list.value)?.type!=='desktop';
      if($('trackingStatus').textContent!==state.tracking)$('trackingStatus').textContent=state.tracking;
      $('anchorStatus').textContent=state.tracked+' de '+state.anchors+' janelas rastreadas';
      $('performanceStatus').textContent='Cena: '+state.fps+' FPS · Vídeo do PC: '+state.videoFps+' FPS';
      $('qualityStatus').textContent='Qualidade: '+(state.quality||workspace.quality.level.name)+(workspace.settings.autoQuality?' · automática':' · fixa')+(workspace.settings.hands&&state.handMs?' · mãos: '+state.handMs+' ms':'');
      $('gamepadStatus').textContent=state.gamepadStatus||'Controle: pressione um botão para conectar.';
      $('inputStatus').textContent=state.inputStatus||'Mire um ícone.';
      $('learningStatus').textContent=workspace.settings.adaptiveTracking?(state.motionStatus||'Aguardando posição')+' · '+(state.learningSamples||0)+' amostras de ajuste da mão':'Rastreamento adaptativo desativado.';
      if(state.handStatus)$('handStatus').textContent=state.handStatus;
      $('handsEnabled').disabled=!state.cameraReady;
      if(!state.sbs){$('opticsPanel').hidden=true;$('calibrateSBS').textContent='Calibrar lentes';}
      $('overlay').classList.toggle('sbs',state.sbs);
      $('toggleSBS').disabled=!state.cameraReady;
      $('sbsSupport').textContent=state.cameraReady?'Duas lentes disponíveis, inclusive com a rotação do navegador bloqueada.':'Duas lentes aguardando acesso à câmera AR pelo Chrome.';
      $('scanMarker').disabled=!state.cameraReady||state.markerScanning;
      $('cancelMarker').hidden=!state.markerScanning;
      $('markerStatus').textContent=state.markerStatus||'Referência universal ID 100 para qualquer janela';
      if(!state.active)$('capability').textContent=state.tracking;
    }});
    root.__ARQUEST_TEST_DIAGNOSTICS=()=>({
      active:!!workspace.session,visible:workspace.session?.visibilityState==='visible',
      tracking:(workspace.state.tracking||'').slice(0,120),fps:workspace.state.fps||0,videoFps:workspace.state.videoFps||0,
      anchors:workspace.state.anchors||0,tracked:workspace.state.tracked||0,canPlace:!!workspace.state.canPlace,
      cameraReady:!!workspace.state.cameraReady,sbs:!!workspace.state.sbs,quality:workspace.state.quality||workspace.quality.level.name,
      markerScanning:!!workspace.state.markerScanning,markerStatus:(workspace.state.markerStatus||'').slice(0,120),
      handStatus:(workspace.state.handStatus||'').slice(0,120),handMs:workspace.state.handMs||0,
      learningSamples:workspace.state.learningSamples||0
    });
    const verify=async()=>{
      $('retryAR').disabled=true;$('startAR').disabled=true;$('supportLabel').textContent='Verificando aparelho';
      const support=await checkSupport(navigator.xr,window.isSecureContext);
      $('capability').textContent=support.text;$('startAR').disabled=!support.supported;$('compatHelp').hidden=support.supported;
      $('intro').dataset.support=support.supported?'available':'unavailable';
      $('supportLabel').textContent=support.supported?'Pronto para iniciar':'AR indisponível neste navegador';$('retryAR').disabled=false;
    };
    $('retryAR').onclick=verify;
    $('startAR').onclick=async()=>{
      $('startAR').disabled=true;$('retryAR').disabled=true;$('startAR').textContent='Iniciando AR…';
      $('supportLabel').textContent='Aguardando câmera e rastreamento';
      try{await workspace.start();}finally{
        $('startAR').textContent='Iniciar meu espaço ↗';$('startAR').disabled=false;$('retryAR').disabled=false;
        $('supportLabel').textContent=workspace.session?'Sessão em andamento':'Pronto para tentar novamente';
      }
    };
    $('placePanel').onclick=()=>workspace.requestPlacement($('panelType').value);
    const syncSources=()=>{const select=$('desktopSource'),previous=select.value;select.replaceChildren(...[{id:'default',label:'Transmissão principal'},...bridge.sources].map(s=>{const option=document.createElement('option');option.value=s.id;option.textContent=s.label;return option;}));select.value=[...select.options].some(o=>o.value===previous)?previous:'default';workspace.selectedDesktopSource=select.value;};
    bridge.onSourcesChanged=syncSources;syncSources();
    $('desktopSource').onchange=()=>{workspace.selectedDesktopSource=$('desktopSource').value;};
    $('mouseMode').onchange=()=>{workspace.resetInput();workspace.mouseMode=$('mouseMode').checked;message(workspace.mouseMode?'Controle do PC: indicador move o cursor; pinça clica e segura.':'Organizar janelas: pinça no cabeçalho move; duas pinças redimensionam.');};
    $('assignSource').onclick=()=>{const panel=workspace.panels.get($('windowList').value);if(panel?.type==='desktop'){panel.sourceId=$('desktopSource').value;workspace.schedulePersist();message('Conteúdo do monitor alterado.');}};
    $('windowList').onchange=()=>{workspace.selectedPanelId=$('windowList').value;workspace.schedulePersist();$('removePanel').disabled=!workspace.panels.has($('windowList').value);$('assignSource').disabled=workspace.panels.get($('windowList').value)?.type!=='desktop';};
    $('removePanel').onclick=()=>{workspace.remove($('windowList').value);message('Janela removida. Use Fixar no alvo para adicioná-la novamente.');};
    $('endAR').onclick=()=>workspace.end().catch(error=>message(error.message));
    $('toggleSBS').onclick=()=>workspace.toggleSBS();
    $('leaveSBS').onclick=()=>workspace.toggleSBS();
    $('scanMarker').onclick=()=>workspace.scanMarker(Number($('markerSize').value));
    $('cancelMarker').onclick=()=>{workspace.stopMarker();workspace.stateChanged({markerStatus:'Leitura cancelada.'});};
    $('resetLearning').onclick=()=>{workspace.resetLearning();workspace.stateChanged({learningSamples:0,motionStatus:'Aprendizado reiniciado'});};
    const checkboxes={adaptiveTracking:'adaptiveTracking',dwellEnabled:'dwell',autoQuality:'autoQuality',correctMarkers:'correctMarkers',handsEnabled:'hands'};
    for(const [id,key] of Object.entries(checkboxes)){$(id).checked=workspace.settings[key];$(id).onchange=()=>{workspace.configure({[key]:$(id).checked});};}
    $('dwellTime').value=String(workspace.settings.dwellMs);$('dwellTime').onchange=()=>workspace.configure({dwellMs:Number($('dwellTime').value)});
    const ranges={lensSeparation:['separation','separationValue'],lensZoom:['zoom','zoomValue'],lensVertical:['vertical','verticalValue'],lensDistortion:['distortion','distortionValue']};
    const syncOptics=()=>{for(const [id,[key,output]] of Object.entries(ranges)){$(id).value=workspace.settings[key];$(output).textContent=workspace.settings[key].toFixed(2);}};
    for(const [id,[key]] of Object.entries(ranges))$(id).oninput=()=>{workspace.configure({[key]:Number($(id).value)});syncOptics();};
    syncOptics();
    $('calibrateSBS').onclick=()=>{workspace.calibrating=true;workspace.resetInput();$('opticsPanel').hidden=false;$('opticsPanel').scrollTop=0;};
    $('previewOptics').onclick=()=>{$('opticsPanel').hidden=true;$('calibrateSBS').textContent='Ajustar lentes';};
    $('finishOptics').onclick=()=>{workspace.calibrating=false;workspace.resetInput();$('opticsPanel').hidden=true;$('calibrateSBS').textContent='Calibrar lentes';};
    $('resetOptics').onclick=()=>{workspace.configure({zoom:1,separation:0,vertical:0,distortion:0});syncOptics();};
    $('overlay').addEventListener('pointerdown',event=>{if(event.target.closest('button,select,a,label,input,summary')){workspace.suppressUntil=performance.now()+800;workspace.resetInput();}});
    // Prevent button taps from also becoming XR scene selections.
    $('overlay').addEventListener('beforexrselect',event=>{if(event.target.closest('button,select,a,label,input,summary,.toolbar,.diagnostics'))event.preventDefault();});
    window.addEventListener('pagehide',()=>{workspace.end().catch(()=>{});bridge.stop();clearTimeout(toastTimer);});
    verify();
  }
  (root.MROptics||(typeof require==='function'?require('./ar-optics'):null))?.install(QuadRenderer);
  const api={ARWorkspace,QuadRenderer,checkSupport,errorText,sbsViewports,desktopPoint};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else {root.MRSpatialAR=api;boot();}
})(typeof globalThis!=='undefined'?globalThis:this);
