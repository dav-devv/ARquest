'use strict';

function parseMarkerPose(text='') {
  const match=String(text).match(/Celular:\s*X\s*([+-]?\d+(?:\.\d+)?)\s+Y\s*([+-]?\d+(?:\.\d+)?)\s+Z\s*([+-]?\d+(?:\.\d+)?)\s*m/i);
  if(!match)return null;
  const position=match.slice(1).map(Number);
  return position.every(Number.isFinite)?position:null;
}

function median(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function summarize(samples) {
  const fps=samples.map(s=>s.fps).filter(Number.isFinite);
  const tracking=samples.filter(s=>typeof s.tracking==='boolean');
  const anchors=samples.filter(s=>Number.isInteger(s.anchors)&&Number.isInteger(s.trackedAnchors));
  return {
    samples:samples.length,
    medianFps:median(fps),
    minimumFps:fps.length?Math.min(...fps):null,
    trackingSamples:tracking.length,
    trackingPercent:tracking.length?Math.round(tracking.filter(s=>s.tracking).length*100/tracking.length):null,
    anchorSamples:anchors.length,
    fullyTrackedAnchorPercent:anchors.length?Math.round(anchors.filter(s=>s.anchors===s.trackedAnchors).length*100/anchors.length):null,
    markerVisibleSamples:samples.filter(s=>s.markerVisible).length
  };
}

function compareMarkerPoses(first,returned) {
  const a=first.map(s=>s.pose).filter(Array.isArray),b=returned.map(s=>s.pose).filter(Array.isArray);
  if(!a.length||!b.length)return {millimetres:null,baselineSamples:a.length,returnSamples:b.length};
  const medianPose=poses=>[0,1,2].map(axis=>median(poses.map(p=>p[axis])));
  const start=medianPose(a),end=medianPose(b);
  const millimetres=Math.hypot(...start.map((v,i)=>v-end[i]))*1000;
  return {millimetres:Number(millimetres.toFixed(1)),baselineSamples:a.length,returnSamples:b.length,baselinePoseM:start,returnPoseM:end};
}

module.exports={parseMarkerPose,median,summarize,compareMarkerPoses};
