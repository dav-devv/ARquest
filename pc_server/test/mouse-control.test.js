const test=require('node:test'),assert=require('node:assert/strict');
const {MouseControl}=require('../mouse-control');
const {desktopPoint,ARWorkspace}=require('../../web_mobile_test/spatial-ar');
test('mouse control needs binding, token and open hand; watchdog releases and requires rearming',()=>{
  const packets=[];let time=0;const c=new MouseControl({send:p=>packets.push(p),release:()=>packets.push('release')},()=>{},()=>time),pc={},phone={};
  const display={name:'left',x:-1920,y:0,width:1920,height:1080};c.bind('a',display,pc);const token=c.state()[0].token;
  const p={streamId:'a',token,u:.5,v:.5,down:true};c.input(phone,p);assert.equal(packets.filter(p=>p.down).length,0);
  c.input(phone,{...p,down:false});c.input(phone,p);assert.equal(packets.at(-1).down,true);assert.equal(packets.at(-1).bounds.x,-1920);
  const length=packets.length;c.input({},p);c.input(phone,{...p,u:NaN});c.input(phone,{...p,u:1.01});c.input(phone,{...p,token:'bad'});assert.equal(packets.length,length);
  time=501;c.tick();assert.equal(packets.at(-1),'release');c.input(phone,p);assert.equal(packets.at(-1),'release');
  c.input(phone,{...p,down:false});c.input(phone,p);c.disconnect(pc);assert.equal(c.state().length,0);assert.equal(packets.at(-1),'release');
});
test('video coordinate mapping excludes header and letterboxing and follows resized panel',()=>{
  const panel={width:1,height:.625},content={width:1920,height:1080};
  const center=desktopPoint({u:.5,v:.535},panel,content);assert(Math.abs(center.u-.5)<1e-8);assert(Math.abs(center.v-.5)<1e-8);
  assert.equal(desktopPoint({u:.5,v:0},panel,content),null);assert.equal(desktopPoint({u:0,v:.5},panel,content),null);
  const larger=desktopPoint({u:.6,v:.6},{width:2,height:1.25},content),original=desktopPoint({u:.6,v:.6},panel,content);assert.deepEqual(larger,original);
});
test('workspace mouse sends press/release and releases immediately on tracking loss',()=>{
  const sent=[],bridge={mouse:p=>{sent.push(p);return true;},source:()=>({}),mouseBindings:new Map([['a','token']])};
  const w=new ARWorkspace({bridge,onState(){},onMessage(){}});w.mouseMode=true;w.desktopSources.set('a',{width:1920,height:1080});
  const panel={type:'desktop',sourceId:'a',width:1,height:.625},target={panel,hit:{u:.5,v:.535}};
  w.updateMouse({closed:false,pressed:false},target,100);w.updateMouse({closed:true,pressed:true},target,110);assert(sent.at(-1).down);
  w.updateMouse({closed:false,pressed:false},target,120);assert.equal(sent.at(-1).down,false);
  w.updateMouse({closed:true,pressed:true},target,130);w.updateMouse(null,target,140);assert.equal(sent.at(-1).release,true);assert.equal(w.remoteSource,null);
});
