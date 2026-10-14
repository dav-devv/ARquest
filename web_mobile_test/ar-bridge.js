// The AR camera is owned by WebXR. This bridge only receives the PC desktop stream.
(function(root) {
  class ARPCBridge {
    constructor(video,onStatus,onMessage,options={}) {
      this.owner=options.owner;this.streamId=options.streamId||'default';this.channels=new Map();this.sources=[];
      this.mouseBindings=new Map();
      this.video=video;this.onStatus=onStatus;this.onMessage=onMessage;
      this.ws=null;this.peer=null;this.ice=[];this.closed=false;this.generation=0;
      this.image=new Image();this.imageReady=false;this.imageDecoding=false;this.lastVideoTime=-1;this.videoHealthy=false;
      this.videoSerial=0;this.imageSerial=0;
      const nextFrame=()=>{this.videoSerial++;if(!this.closed)this.videoCallback=this.video.requestVideoFrameCallback(nextFrame);};
      if(this.video.requestVideoFrameCallback)this.videoCallback=this.video.requestVideoFrameCallback(nextFrame);
      this.image.onload=()=>{this.imageReady=true;this.imageDecoding=false;this.imageSerial++;};
      this.image.onerror=()=>{this.imageDecoding=false;};
      this.heartbeat=setInterval(()=>{
        const playing=this.peer?.connectionState==='connected' && this.video.readyState>=2 && !this.video.paused && this.video.currentTime!==this.lastVideoTime;
        this.lastVideoTime=this.video.currentTime;
        this.videoHealthy=playing;
        this.send({type:'stream_status',playing});
      },1000);
    }
    connect() {
      if(this.closed)return;
      let token='';try {token=sessionStorage.getItem('pairingToken')||'';}catch{}
      const url=(location.protocol==='https:'?'wss://'+location.host:'ws://'+location.hostname+':8080')+'?token='+encodeURIComponent(token);
      const ws=this.ws=new WebSocket(url);
      ws.onopen=()=>{this.onStatus('PC conectado');this.send({type:'headset_ready'});};
      ws.onmessage=event=>this.receive(event).catch(error=>this.onMessage('Falha no vídeo do PC: '+error.message));
      ws.onerror=()=>this.onStatus('Falha na conexão com o PC');
      ws.onclose=()=>{
        this.mouseBindings.clear();
        for(const channel of this.channels.values())channel.stop();this.channels.clear();this.sources=[];this.onSourcesChanged?.();
        this.clearPeer();this.imageReady=false;
        this.onStatus('PC desconectado — use o link de pareamento atualizado');
        if(!this.closed)this.retry=setTimeout(()=>this.connect(),2500);
      };
    }
    send(data) {
      if(this.owner)return this.owner.send({...data,streamId:this.streamId,sessionId:this.sessionId});
      if(this.ws?.readyState!==1)return false;
      this.ws.send(JSON.stringify(data));return true;
    }
    action(action) {
      this.onMessage(this.send({type:'pc_action',action})?'Comando enviado ao PC.':'PC desconectado. Abra o link de pareamento no painel.');
    }
    clearPeer() {
      this.generation++;
      if(this.peer)this.peer.close();this.peer=null;
      this.video.srcObject=null;this.ice=[];
      this.videoHealthy=false;
    }
    async receive(event) {
      const data=JSON.parse(event.data);
      if(data.type==='mouse_control_state'){this.mouseBindings=new Map((data.bindings||[]).map(b=>[b.id,b.token]));return;}
      if(!this.owner){
        if(Array.isArray(data.sources)&&data.type==='stream_status'){
          this.sources=data.sources.filter(s=>s&&/^screen-[a-zA-Z0-9-]{1,80}$/.test(s.id)&&typeof s.label==='string').map(s=>({id:s.id,label:s.label.slice(0,100)}));
          for(const [id,channel] of this.channels)if(!this.sources.some(s=>s.id===id)){channel.stop();this.channels.delete(id);}
          this.onSourcesChanged?.();return;
        }
        if(data.streamId&&data.streamId!=='default'){
          if(!/^screen-[a-zA-Z0-9-]{1,80}$/.test(data.streamId)||!this.sources.some(s=>s.id===data.streamId))return;
          if(data.type==='screen_stream_ended'){this.channels.get(data.streamId)?.stop();this.channels.delete(data.streamId);this.sources=this.sources.filter(s=>s.id!==data.streamId);this.onSourcesChanged?.();return;}
          if(!['webrtc_offer','webrtc_ice'].includes(data.type))return;
          let channel=this.channels.get(data.streamId);
          if(!channel){const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;channel=new ARPCBridge(video,this.onStatus,this.onMessage,{owner:this,streamId:data.streamId});this.channels.set(data.streamId,channel);}
          await channel.receive(event);return;
        }
      }else{
        if(data.type==='webrtc_offer'){if(this.sessionId!==data.sessionId)this.ice=this.nextIce?.sessionId===data.sessionId?this.nextIce.candidates:[];this.nextIce=null;this.sessionId=data.sessionId;}
        if(data.type==='webrtc_ice'){if(!this.sessionId)this.sessionId=data.sessionId;if(this.sessionId!==data.sessionId){if(this.nextIce?.sessionId!==data.sessionId)this.nextIce={sessionId:data.sessionId,candidates:[]};if(this.nextIce.candidates.length<64)this.nextIce.candidates.push(data.candidate);return;}}
      }
      if(data.type==='hologram_notification')this.onMessage(data.title+': '+data.message);
      if(data.type==='direct_screen_frame' && !this.videoHealthy && !this.imageDecoding) {
        this.imageDecoding=true;this.image.src=data.frame;
      }
      if(data.type==='screen_stream_ended'){this.clearPeer();this.imageReady=false;}
      if(data.type==='webrtc_ice' && data.candidate) {
        if(this.peer?.remoteDescription)await this.peer.addIceCandidate(data.candidate);
        else if(this.ice.length<64)this.ice.push(data.candidate);
      }
      if(data.type==='webrtc_offer') {
        const pending=this.ice;this.clearPeer();
        const generation=this.generation;
        const peer=this.peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
        peer.onicecandidate=event=>{if(event.candidate && this.peer===peer)this.send({type:'webrtc_ice',candidate:event.candidate});};
        peer.ontrack=event=>{
          if(this.peer!==peer)return;
          this.video.srcObject=event.streams[0]||new MediaStream([event.track]);
          this.video.play().catch(()=>this.onMessage('Toque em Iniciar para permitir o vídeo do PC.'));
        };
        await peer.setRemoteDescription(data.sdp);
        if(generation!==this.generation)return;
        for(const candidate of pending.concat(this.ice.splice(0)))await peer.addIceCandidate(candidate).catch(()=>{});
        const answer=await peer.createAnswer();
        if(generation!==this.generation)return;
        await peer.setLocalDescription(answer);
        if(generation===this.generation)this.send({type:'webrtc_answer',sdp:peer.localDescription});
      }
    }
    mouse(packet){
      if(packet.release)return this.send({type:'mouse_control',release:true});
      const token=this.mouseBindings.get(packet.streamId);if(!token)return false;
      if(this.ws?.bufferedAmount>8192)return false;
      return this.send({type:'mouse_control',...packet,token});
    }
    source(id='default') {
      if(id!=='default')return this.channels.get(id)?.source()||null;
      if(this.videoHealthy && this.peer?.connectionState==='connected' && this.video.readyState>=2 && !this.video.paused)return this.video;
      return this.imageReady?this.image:null;
    }
    frameKey(source,id='default') {if(id!=='default')return this.channels.get(id)?.frameKey(source);return source===this.video?(this.video.requestVideoFrameCallback?this.videoSerial:this.video.currentTime):this.imageSerial;}
    stop() {
      for(const channel of this.channels.values())channel.stop();this.channels.clear();this.sources=[];
      this.closed=true;clearTimeout(this.retry);clearInterval(this.heartbeat);this.clearPeer();
      if(this.videoCallback!==undefined)this.video.cancelVideoFrameCallback(this.videoCallback);
      if(this.ws){this.ws.onclose=null;this.ws.close();}
    }
  }
  root.ARPCBridge=ARPCBridge;
})(globalThis);
