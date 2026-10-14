(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MRDeviceTestMetrics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function summarize(samples){
    const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
    const count=samples.length,track=samples.filter(s=>s.active&&s.tracked>0).length;
    return {samples:count,medianFps:median(samples.map(s=>s.fps)),medianVideoFps:median(samples.map(s=>s.videoFps)),trackedPercent:count?Math.round(track*100/count):null,medianTrackedAnchors:median(samples.map(s=>s.tracked)),medianAnchors:median(samples.map(s=>s.anchors))};
  }
  return {summarize};
});
