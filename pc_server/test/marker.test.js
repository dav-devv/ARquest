const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const M=require('../../web_mobile_test/spatial-math'),K=require('../../web_mobile_test/marker-math');
const ctx={};vm.createContext(ctx);for(const file of ['cv.js','aruco.js'])vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../../web_mobile_test/vendor',file),'utf8'),ctx);
test('printed original ArUco patterns decode to the intended IDs in all four rotations',()=>{
 for(const id of [100,200]){let bits=K.cells(id);for(let rotation=0;rotation<4;rotation++){
  const width=270,data=new Uint8ClampedArray(width*width*4).fill(255);
  for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(!bits[y][x])for(let dy=0;dy<30;dy++)for(let dx=0;dx<30;dx++){const i=((y*30+30+dy)*width+x*30+30+dx)*4;data[i]=data[i+1]=data[i+2]=0;}
  const markers=new ctx.AR.Detector().detect({width,height:width,data});assert.equal(markers.length,1);assert.equal(markers[0].id,id);
  bits=bits[0].map((_,x)=>bits.map(row=>row[x]).reverse());
 }}
});
test('marker pose recovers metric translation with an off-center XR projection',()=>{
 const p=M.identity();p[0]=1.4;p[5]=2;p[8]=.12;p[9]=-.08;
 const size=.14,width=640,height=480,z=-.7,x=.08,y=.03;
 const corners=[[-.07,.07],[.07,.07],[.07,-.07],[-.07,-.07]].map(([a,b])=>({x:((p[0]*(x+a)/-z-p[8])+1)*width/2,y:(1-(p[5]*(y+b)/-z-p[9]))*height/2}));
 const pose=K.pose(corners,width,height,p,size);assert(pose);assert(Math.abs(pose[12]-x)<1e-5);assert(Math.abs(pose[13]-y)<1e-5);assert(Math.abs(pose[14]-z)<1e-5);
 assert.equal(K.pose(corners.map(c=>({x:c.x/20,y:c.y/20})),width,height,p,size),null);
});
test('marker stability rejects jumps, missing detections and changing IDs',()=>{
 const s=new K.StablePose(),m=M.identity();assert.equal(s.add(100,m),null);assert.equal(s.add(100,m),null);assert.equal(s.add(100,m),null);assert(s.add(100,m));
 assert.equal(s.add(200,m),null);assert.equal(s.add(200,null),null);m[12]=1;assert.equal(s.add(100,m),null);
});
