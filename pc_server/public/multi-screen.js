// Independent captures: each source has its own media tracks, peer and signaling generation.
(function(root){
  class MultiScreenSender {
    constructor(send,onChange){this.send=send;this.onChange=onChange;this.sources=new Map();this.pending=false;}
    catalog(){this.send({type:'stream_status',sources:[...this.sources.values()].map(s=>({id:s.id,label:s.label,surface:s.surface}))});this.onChange?.([...this.sources.values()]);}
    async add(){
      if(this.pending)return;this.pending=true;
      let stream;
      try{
        stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:20,max:24},width:{ideal:1280},height:{ideal:720}},audio:false});
        const track=stream.getVideoTracks()[0];if(!track)throw Error('Nenhuma tela foi selecionada.');
        const source={id:'screen-'+crypto.randomUUID(),label:track.label||'Tela independente',surface:track.getSettings().displaySurface,stream,peer:null,epoch:0,ice:[]};
        this.sources.set(source.id,source);track.onended=()=>this.remove(source.id);this.catalog();await this.offer(source);
      }catch(error){if(stream&&!([...this.sources.values()].some(s=>s.stream===stream)))stream.getTracks().forEach(t=>t.stop());throw error;}
      finally{this.pending=false;}
    }
    async offer(s){
      if(!this.sources.has(s.id))return;
      s.peer?.close();s.ice=[];const epoch=++s.epoch,peer=s.peer=new RTCPeerConnection({iceServers:[]});
      s.sessionId=crypto.randomUUID();const sessionId=s.sessionId;
      peer.onicecandidate=e=>{if(e.candidate&&s.peer===peer)this.send({type:'webrtc_ice',streamId:s.id,sessionId,candidate:e.candidate});};
      for(const track of s.stream.getTracks())peer.addTrack(track,s.stream);
      await peer.setLocalDescription(await peer.createOffer());
      if(s.epoch===epoch&&this.sources.has(s.id))this.send({type:'webrtc_offer',streamId:s.id,sessionId,label:s.label,sdp:peer.localDescription});
    }
    async receive(data){
      if(data.type==='headset_ready'){this.catalog();for(const s of this.sources.values())await this.offer(s);return;}
      const s=this.sources.get(data.streamId);if(!s||data.sessionId!==s.sessionId)return;
      const peer=s.peer;
      if(data.type==='webrtc_answer'){
        await peer.setRemoteDescription(data.sdp);if(peer!==s.peer)return;
        for(const c of s.ice.splice(0))await peer.addIceCandidate(c);
      }else if(data.type==='webrtc_ice'&&data.candidate){if(peer.remoteDescription)await peer.addIceCandidate(data.candidate);else if(s.ice.length<64)s.ice.push(data.candidate);}
    }
    remove(id){const s=this.sources.get(id);if(!s)return;this.sources.delete(id);s.epoch++;s.peer?.close();for(const t of s.stream.getTracks()){t.onended=null;t.stop();}this.send({type:'screen_stream_ended',streamId:id,sessionId:s.sessionId});this.catalog();}
    stop(){for(const id of [...this.sources.keys()])this.remove(id);}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=MultiScreenSender;else root.MultiScreenSender=MultiScreenSender;
})(globalThis);
