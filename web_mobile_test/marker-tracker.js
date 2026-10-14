(function(root){
  class MarkerTracker {
    constructor(renderer,onResult,onError,options={}){
      this.renderer=renderer;this.gl=renderer.gl;this.serial=0;this.next=0;this.busy=false;this.active=true;
      this.interval=250;this.captureWidth=640;
      this.worker=new Worker(options.url||'/mobile/marker-worker.js');
      this.ready=!options.init;
      this.worker.onerror=()=>{if(this.active)onError('Não foi possível carregar o detector de '+(options.init?'mãos.':'marcadores.'));};
      this.worker.onmessage=event=>{
        if(!this.active)return;
        if(event.data.ready){this.ready=true;options.onReady?.();return;}
        if(event.data.error){this.busy=false;onError(event.data.error);return;}
        if(!this.active||event.data.serial!==this.serial)return;
        this.busy=false;
        if(event.data.error){onError(event.data.error);return;}
        this.snapshot.processingMs=event.data.processingMs;
        onResult(event.data.markers||event.data.hands,this.snapshot);
      };
      if(options.init)this.worker.postMessage({init:true});
    }
    capture(time,texture,view){
      if(!this.ready||this.busy||time<this.next)return false;
      const gl=this.gl,width=Math.min(this.captureWidth,Math.round(this.captureWidth*view.camera.width/view.camera.height)),height=Math.max(1,Math.round(width*view.camera.height/view.camera.width));
      // Restrict readback to a small offscreen buffer and one outstanding worker job.
      if(height>1000)return;
      if(!this.target){this.target=gl.createTexture();this.fbo=gl.createFramebuffer();}
      const previous=gl.getParameter(gl.FRAMEBUFFER_BINDING),viewport=gl.getParameter(gl.VIEWPORT);
      try{
        gl.bindTexture(gl.TEXTURE_2D,this.target);
        if(this.width!==width||this.height!==height){
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          this.width=width;this.height=height;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.target,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Leitura da câmera indisponível.');
        gl.viewport(0,0,width,height);this.renderer.cameraBackground(texture);
        const bottom=new Uint8Array(width*height*4),pixels=new Uint8Array(bottom.length);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bottom);
        for(let y=0;y<height;y++)pixels.set(bottom.subarray(y*width*4,(y+1)*width*4),(height-y-1)*width*4);
        this.snapshot={width,height,time,projection:new Float32Array(view.projectionMatrix),world:new Float32Array(view.transform.matrix)};
        this.busy=true;this.next=time+this.interval;this.worker.postMessage({pixels:pixels.buffer,width,height,time,serial:++this.serial},[pixels.buffer]);
        return true;
      }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,previous);gl.viewport(...viewport);}
    }
    dispose(){this.active=false;this.worker.terminate();if(this.target)this.gl.deleteTexture(this.target);if(this.fbo)this.gl.deleteFramebuffer(this.fbo);}
  }
  root.MRMarkerTracker=MarkerTracker;
})(globalThis);
