(function(root){
  const M=root.MRSpatialMath||(typeof require==='function'?require('./spatial-math'):null);
  const defaults={zoom:1,separation:0,vertical:0,distortion:0,dwell:true,dwellMs:1400,autoQuality:true,adaptiveTracking:true,correctMarkers:false,hands:false};
  function settings(value={}){
    if(!value||typeof value!=='object')value={};
    const out={...defaults};
    for(const [key,min,max] of [['zoom',.7,1.5],['separation',-.3,.3],['vertical',-.3,.3],['distortion',-.3,.5],['dwellMs',800,3000]]){
      const n=Number(value[key]);if(Number.isFinite(n))out[key]=Math.max(min,Math.min(max,n));
    }
    for(const key of ['dwell','autoQuality','correctMarkers','hands','adaptiveTracking'])if(typeof value[key]==='boolean')out[key]=value[key];
    return out;
  }
  class Dwell {
    constructor(){this.reset();}
    reset(){this.key=null;this.since=0;this.last=0;this.fired=false;this.progress=0;}
    step(key,time,duration=1400){
      if(!key){this.reset();return false;}
      if(key!==this.key){this.key=key;this.since=time;this.fired=false;}
      else if(time-this.last>250)this.since=time;
      this.last=time;this.progress=this.fired?1:Math.min(1,(time-this.since)/duration);
      if(this.progress>=1&&!this.fired){this.fired=true;return true;}return false;
    }
    consume(){this.fired=true;this.progress=1;}
  }
  class ButtonEdge {
    constructor(){this.down=true;}
    step(down){const pressed=!!down&&!this.down;this.down=!!down;return pressed;}
    reset(){this.down=true;}
  }
  class Pinch {
    constructor(){this.reset();}
    reset(){this.closed=false;this.armed=false;this.identity=null;}
    step(points,identity,aspect=1){
      if(!points||points.length!==21||identity!==this.identity){this.reset();this.identity=identity;if(!points)return {pressed:false,closed:false};}
      const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
      const palm=distance(points[0],points[9]);if(palm<.025){this.reset();return {pressed:false,closed:false};}
      const ratio=distance(points[4],points[8])/palm;
      if(ratio>.48){this.closed=false;this.armed=true;}
      const pressed=this.armed&&!this.closed&&ratio<.3;
      if(pressed){this.closed=true;this.armed=false;}
      return {pressed,closed:this.closed};
    }
  }
  const levels=[{name:'Nítida',scale:.75,video:30,hand:12,marker:4},{name:'Equilibrada',scale:.6,video:24,hand:8,marker:2},{name:'Econômica',scale:.45,video:15,hand:5,marker:1}];
  class Quality {
    constructor(){this.index=0;this.low=0;this.high=0;this.changed=-Infinity;}
    sample(fps,time,target=60){
      this.low=fps<Math.min(42,target*.75)?this.low+1:0;
      this.high=fps>target*.92?this.high+1:0;
      if(time-this.changed<8000)return false;
      let next=this.index;if(this.low>=3)next=Math.min(2,next+1);else if(this.high>=8)next=Math.max(0,next-1);
      if(next===this.index)return false;this.index=next;this.changed=time;this.low=this.high=0;return true;
    }
    get level(){return levels[this.index];}
  }
  function rayAt(u,v,projection,world){
    const local=[(2*u-1+projection[8])/projection[0],(1-2*v+projection[9])/projection[5],-1];
    const direction=M.transform(world,local,0),n=Math.hypot(...direction);
    return {origin:[world[12],world[13],world[14]],direction:direction.map(x=>x/n)};
  }
  function correctionTarget(worldMarker,anchorMatrix,base=[0,0,0]){
    const local=M.transform(M.inverseRigid(anchorMatrix),[worldMarker[12],worldMarker[13],worldMarker[14]]);
    const delta=local.map((v,i)=>v-base[i]);return delta.every(Number.isFinite)&&Math.hypot(...delta)<=.15?delta:null;
  }
  function easeCorrection(current,target,dt){
    const delta=target.map((v,i)=>v-current[i]),n=Math.hypot(...delta),step=Math.min(n*.15,.025*Math.min(.1,Math.max(0,dt)));
    return n<.002?current:current.map((v,i)=>v+delta[i]/n*step);
  }
  const api={defaults,settings,Dwell,ButtonEdge,Pinch,Quality,levels,rayAt,correctionTarget,easeCorrection};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MRARFeatures=api;
})(typeof globalThis!=='undefined'?globalThis:this);
