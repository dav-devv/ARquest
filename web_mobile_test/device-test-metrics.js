(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MRDeviceTestMetrics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function summarize(samples){
    const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
    const count=samples.length,place=samples.filter(s=>typeof s.canPlace==='boolean'),anchors=samples.reduce((n,s)=>n+(Number.isFinite(s.anchors)?s.anchors:0),0),tracked=samples.reduce((n,s)=>n+(Number.isFinite(s.tracked)?s.tracked:0),0);
    return {samples:count,medianFps:median(samples.map(s=>s.fps)),medianVideoFps:median(samples.map(s=>s.videoFps)),canPlacePercent:place.length?Math.round(place.filter(s=>s.canPlace).length*100/place.length):null,trackedAnchorPercent:anchors?Math.round(tracked*100/anchors):null,medianTrackedAnchors:median(samples.map(s=>s.tracked)),medianAnchors:median(samples.map(s=>s.anchors))};
  }
  return {summarize};
});
