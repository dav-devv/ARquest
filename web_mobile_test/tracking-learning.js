(function(root){
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const valid=v=>v&&v.every(Number.isFinite);
  // Bounded online noise estimation. No images or spatial maps are retained.
  class AdaptivePoint {
    constructor(){this.reset();}
    reset(){this.raw=null;this.value=null;this.velocity=null;this.noise=.002;this.samples=0;this.time=null;}
    step(point,time,identity='point'){
      if(!valid(point)||!Number.isFinite(time)){this.reset();return null;}
      const dt=(time-this.time)/1000;
      if(!this.raw||identity!==this.identity||dt<=0||dt>.4){this.reset();this.raw=[...point];this.value=[...point];this.velocity=point.map(()=>0);this.time=time;this.identity=identity;return [...point];}
      const delta=point.map((x,i)=>x-this.raw[i]),speed=Math.hypot(...delta)/dt;
      // Learn only from small movements, not intentional sweeps or reacquisition.
      if(speed<.25){const residual=Math.hypot(...delta.map((x,i)=>x-this.velocity[i]*dt))/Math.sqrt(2);this.noise=clamp(this.noise*.97+residual*.03,.0005,.02);this.samples++;}
      this.velocity=delta.map((x,i)=>this.velocity[i]*.7+x/dt*.3);
      const cutoff=clamp(1.5/(1+this.noise*100)+speed*14,1,30),alpha=1-Math.exp(-2*Math.PI*cutoff*dt);
      this.value=point.map((x,i)=>this.value[i]+alpha*(x-this.value[i]));this.raw=[...point];this.time=time;
      return [...this.value];
    }
  }
  class CameraMotion {
    constructor(){this.reset();}
    reset(){this.previous=null;this.time=null;this.safe=false;this.stable=0;this.label='Aguardando posição';}
    step(matrix,time){
      if(!matrix||matrix.length!==16||!valid(Array.from(matrix))){this.reset();return this;}
      const dt=(time-this.time)/1000,p=this.previous;
      this.previous=Array.from(matrix);this.time=time;
      if(!p||dt<=0||dt>.25){this.safe=false;this.stable=0;this.label='Recuperando posição';return this;}
      this.speed=Math.hypot(matrix[12]-p[12],matrix[13]-p[13],matrix[14]-p[14])/dt;
      const trace=[0,1,2,4,5,6,8,9,10].reduce((s,i)=>s+matrix[i]*p[i],0);
      this.angular=Math.acos(clamp((trace-1)/2,-1,1))/dt;
      const calm=this.speed<.35&&this.angular<.8;
      this.stable=calm?this.stable+dt:0;this.safe=this.stable>=.3;
      this.label=this.speed>2||this.angular>5?'Movimento brusco / salto de posição':calm?'Movimento estável':'Celular em movimento';return this;
    }
  }
  class CorrectionLearner {
    constructor(){this.reset();}
    reset(){this.mean=null;this.variance=.0001;this.samples=0;this.time=null;}
    step(target,time,safe){
      if(!safe||!valid(target)||Math.hypot(...target)>.15)return null;
      if(this.time!==null&&time<=this.time)return null;
      if(this.time!==null&&time-this.time>3000)this.reset();
      if(!this.mean){this.mean=[...target];this.time=time;this.samples=1;return null;}
      const residual=Math.hypot(...target.map((x,i)=>x-this.mean[i]));
      if(residual>Math.max(.025,3*Math.sqrt(this.variance)))return null;
      this.variance=clamp(.9*this.variance+.1*residual*residual,.000001,.0004);
      const gain=clamp(.00002/(.00002+this.variance),.08,.5);
      this.mean=target.map((x,i)=>this.mean[i]+gain*(x-this.mean[i]));this.samples++;this.time=time;
      return this.samples>=3?[...this.mean]:null;
    }
  }
  const api={AdaptivePoint,CameraMotion,CorrectionLearner};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MRTrackingLearning=api;
})(typeof globalThis!=='undefined'?globalThis:this);
