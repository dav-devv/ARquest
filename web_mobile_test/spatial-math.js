(function(root) {
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  function multiply(a,b) {
    const out=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++)
      for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
    return out;
  }
  function inverseRigid(m) {
    const out=identity();
    for(let c=0;c<3;c++)for(let r=0;r<3;r++)out[c*4+r]=m[r*4+c];
    for(let r=0;r<3;r++)out[12+r]=-(out[r]*m[12]+out[4+r]*m[13]+out[8+r]*m[14]);
    return out;
  }
  function transform(m,v,w=1) {
    return [0,1,2].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*w);
  }
  function scale(m,x,y,z=1) {
    const out=new Float32Array(m);
    for(let i=0;i<4;i++){out[i]*=x;out[4+i]*=y;out[8+i]*=z;}
    return out;
  }
  // Upright panel initially facing the viewer. Its pose is then fixed to the anchor.
  function panelPose(hit,viewer,height=.54) {
    const out=identity();
    const yaw=Math.atan2(viewer[12]-hit[12],viewer[14]-hit[14]);
    const c=Math.cos(yaw),s=Math.sin(yaw);
    out[0]=c;out[2]=-s;out[8]=s;out[10]=c;
    out[12]=hit[12];out[13]=hit[13]+height/2+.02;out[14]=hit[14];
    return out;
  }
  function rayFromPose(m) {return {origin:[m[12],m[13],m[14]],direction:[-m[8],-m[9],-m[10]]};}
  function intersectPanel(ray,pose,width,height) {
    const inverse=inverseRigid(pose);
    const o=transform(inverse,ray.origin),d=transform(inverse,ray.direction,0);
    // Ignore the back of a panel and rays parallel to it.
    if(d[2]>=-1e-6)return null;
    const distance=-o[2]/d[2];
    if(distance<=0)return null;
    const x=o[0]+d[0]*distance,y=o[1]+d[1]*distance;
    if(Math.abs(x)>width/2 || Math.abs(y)>height/2)return null;
    return {distance,u:x/width+.5,v:.5-y/height};
  }
  const api={identity,multiply,inverseRigid,transform,scale,panelPose,rayFromPose,intersectPanel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MRSpatialMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
