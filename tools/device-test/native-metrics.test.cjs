'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseMarkerPose,median,summarize,compareMarkerPoses}=require('./native-metrics.cjs');

test('parses only valid numeric camera positions in marker diagnostics',()=>{
  assert.deepEqual(parseMarkerPose('ID 100 visível\nCelular: X -0.125  Y +0.250  Z +0.500 m | distância 0.575 m'),[-.125,.25,.5]);
  assert.equal(parseMarkerPose('Marcador não visível'),null);
  assert.equal(parseMarkerPose('Celular: X NaN Y +0.2 Z +0.3 m'),null);
});

test('summarizes FPS, camera tracking and retained anchors without inventing missing samples',()=>{
  const result=summarize([
    {fps:58,tracking:true,anchors:2,trackedAnchors:2,markerVisible:true},
    {fps:48,tracking:false,anchors:2,trackedAnchors:1,markerVisible:false},
    {fps:54,tracking:true,anchors:2,trackedAnchors:2,markerVisible:true}
  ]);
  assert.equal(result.medianFps,54);assert.equal(result.minimumFps,48);assert.equal(result.trackingPercent,67);
  assert.equal(result.fullyTrackedAnchorPercent,67);assert.equal(result.markerVisibleSamples,2);
  assert.equal(summarize([]).medianFps,null);
});

test('computes marker return-position difference from coordinate medians',()=>{
  const measured=compareMarkerPoses([{pose:[0,0,0]},{pose:[.001,0,0]}],[{pose:[.02,0,0]},{pose:[.021,0,0]}]);
  assert.equal(measured.millimetres,20);assert.equal(measured.baselineSamples,2);assert.equal(measured.returnSamples,2);
  assert.equal(compareMarkerPoses([],[]).millimetres,null);
});
