const test=require('node:test'),assert=require('node:assert/strict');
const {ARWorkspace}=require('../../web_mobile_test/spatial-ar');
const M=require('../../web_mobile_test/spatial-math');
const {validateCommand}=require('../native-control');
test('the printed origin marker defines the room reference, independently of window types',()=>{
 const previousTracker=global.MRMarkerTracker,previousMath=global.MRMarkerMath;let callback;
 global.MRMarkerTracker=class{constructor(renderer,cb){callback=cb;}dispose(){}};
 global.MRMarkerMath={pose:()=>M.identity(),StablePose:class{add(id,m){this.count=4;return m;}}};
 try{const w=new ARWorkspace({bridge:{},onState(){},onMessage(){}});w.session={};w.state.cameraReady=true;w.scanMarker(100);callback([{id:100,corners:[]}],{time:performance.now(),width:640,height:480,projection:M.identity(),world:M.identity()});assert.equal(w.markerPending.id,100);assert.equal(w.markerPending.size,.1);w.stopMarker();}
 finally{global.MRMarkerTracker=previousTracker;global.MRMarkerMath=previousMath;}
});
test('PC editor accepts only the spatial origin marker',()=>{assert.equal(validateCommand({action:'marker_id',value:100}).value,100);assert.throws(()=>validateCommand({action:'marker_id',value:101}));});
