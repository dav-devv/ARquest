(function(root){
  function install(Renderer){
    Renderer.prototype.beginOptics=function(vp){
      const gl=this.gl;
      if(!this.optics){
        const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
        const vs=compile(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p.xy*2.0,0.0,1.0);}');
        const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform sampler2D tex;uniform vec2 fit;uniform vec2 center;uniform float zoom;uniform float k;uniform float portrait;void main(){vec2 q=(v*2.0-1.0-center)/(fit*zoom);if(portrait>0.5)q=vec2(q.y,-q.x);float r=dot(q,q);vec2 uv=(q*(1.0+k*r)+1.0)*0.5;if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}else{gl_FragColor=vec4(texture2D(tex,uv).rgb,1.0);}}');
        const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
        this.optics={program,fbo:gl.createFramebuffer(),texture:gl.createTexture(),depth:gl.createRenderbuffer()};
      }
      const o=this.optics,width=Math.max(1,Math.min(1280,vp.width)),height=Math.max(1,Math.round(width*vp.height/vp.width));
      gl.bindTexture(gl.TEXTURE_2D,o.texture);
      if(o.width!==width||o.height!==height){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.bindRenderbuffer(gl.RENDERBUFFER,o.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);o.width=width;o.height=height;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,o.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,o.texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,o.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Composição das lentes indisponível.');
      gl.viewport(0,0,width,height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      return {x:0,y:0,width,height};
    };
    Renderer.prototype.endOptics=function(layer,vp,settings){
      const gl=this.gl,o=this.optics;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.useProgram(o.program);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      const position=gl.getAttribLocation(o.program,'p'),uv=gl.getAttribLocation(o.program,'uv');
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.texture);gl.uniform1i(gl.getUniformLocation(o.program,'tex'),0);
      // Some immersive AR sessions keep a portrait framebuffer even when the phone is sideways.
      // Rotate the entire composition (camera and geometry together), then split along its long axis.
      const portrait=vp.height>vp.width,eyeWidth=portrait?vp.width:Math.floor(vp.width/2),eyeHeight=portrait?Math.floor(vp.height/2):vp.height;
      const sourceAspect=portrait?o.height/o.width:o.width/o.height,eyeAspect=eyeWidth/eyeHeight;
      const fit=sourceAspect>eyeAspect?[1,eyeAspect/sourceAspect]:[sourceAspect/eyeAspect,1];
      gl.uniform2fv(gl.getUniformLocation(o.program,'fit'),fit);gl.uniform1f(gl.getUniformLocation(o.program,'zoom'),settings.zoom);gl.uniform1f(gl.getUniformLocation(o.program,'k'),settings.distortion);
      for(let eye=0;eye<2;eye++){
        gl.viewport(vp.x+(portrait?0:eye*eyeWidth),vp.y+(portrait?eye*eyeHeight:0),eyeWidth,eyeHeight);
        gl.uniform1f(gl.getUniformLocation(o.program,'portrait'),portrait?1:0);
        const separation=settings.separation*(eye===0?-1:1);
        gl.uniform2f(gl.getUniformLocation(o.program,'center'),portrait?settings.vertical:separation,portrait?separation:settings.vertical);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
    };
    Renderer.prototype.disposeOptics=function(){if(!this.optics)return;const gl=this.gl,o=this.optics;gl.deleteProgram(o.program);gl.deleteTexture(o.texture);gl.deleteRenderbuffer(o.depth);gl.deleteFramebuffer(o.fbo);this.optics=null;};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={install};else root.MROptics={install};
})(typeof globalThis!=='undefined'?globalThis:this);
