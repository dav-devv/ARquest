(function(root){
  const M=root.MRSpatialMath||(typeof require==='function'?require('./spatial-math'):null);
  function cells(id){
    const rows=[[1,0,0,0,0],[1,0,1,1,1],[0,1,0,0,1],[0,1,1,1,0]];
    return Array.from({length:7},(_,y)=>Array.from({length:7},(_,x)=>x===0||y===0||x===6||y===6?0:rows[(id>>((5-y)*2))&3][x-1]));
  }
  function solve(a){
    for(let i=0;i<8;i++){
      let p=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;
      [a[i],a[p]]=[a[p],a[i]];if(Math.abs(a[i][i])<1e-9)return null;
      const d=a[i][i];for(let k=i;k<9;k++)a[i][k]/=d;
      for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<9;k++)a[j][k]-=f*a[i][k];}
    }
    return a.map(r=>r[8]);
  }
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const norm=a=>Math.hypot(...a);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Detector pixels have top-left origin. Solve in a right/down/forward camera,
  // then convert to WebXR right/up/back coordinates using diag(1,-1,-1).
  function pose(corners,width,height,projection,size=.14){
    if(corners.length!==4||!(size>0)||!projection[0]||!projection[5])return null;
    if(corners.some((p,i)=>Math.hypot(p.x-corners[(i+1)%4].x,p.y-corners[(i+1)%4].y)<28))return null;
    const h=size/2,xy=[[-h,h],[h,h],[h,-h],[-h,-h]],a=[];
    const points=corners.map(p=>[(2*p.x/width-1+projection[8])/projection[0],-(1-2*p.y/height+projection[9])/projection[5]]);
    for(let i=0;i<4;i++){const [x,y]=xy[i],[u,v]=points[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
    const H=solve(a);if(!H)return null;
    let r1=[H[0],H[3],H[6]],r2=[H[1],H[4],H[7]];
    const n1=norm(r1),n2=norm(r2);if(n1/n2<.7||n1/n2>1.3)return null;
    const scale=2/(n1+n2),t=[H[2]*scale,H[5]*scale,scale];
    r1=r1.map(v=>v/n1);const d=dot(r1,r2);r2=r2.map((v,i)=>v-d*r1[i]);const n=norm(r2);r2=r2.map(v=>v/n);
    const r3=cross(r1,r2);if(t[2]<.15||t[2]>3||Math.abs(r3[2])<.3)return null;
    let error=0;
    for(let i=0;i<4;i++){
      const q=t.map((v,k)=>v+r1[k]*xy[i][0]+r2[k]*xy[i][1]);
      error+=((q[0]/q[2]-points[i][0])*projection[0]*width/2)**2+((q[1]/q[2]-points[i][1])*projection[5]*height/2)**2;
    }
    if(Math.sqrt(error/4)>3)return null;
    const out=M.identity();[r1,r2,r3,t].forEach((v,c)=>{out[c*4]=v[0];out[c*4+1]=-v[1];out[c*4+2]=-v[2];});return out;
  }
  class StablePose {
    constructor(){this.reset();}
    reset(){this.last=null;this.count=0;this.id=null;}
    add(id,m){
      if(!m){this.reset();return null;}
      const compatible=this.last&&id===this.id&&Math.hypot(...[12,13,14].map(i=>m[i]-this.last[i]))<.025&&dot([m[8],m[9],m[10]],[this.last[8],this.last[9],this.last[10]])>.96;
      this.count=compatible?this.count+1:1;this.last=m;this.id=id;return this.count>=4?m:null;
    }
  }
  const api={cells,pose,StablePose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MRMarkerMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
