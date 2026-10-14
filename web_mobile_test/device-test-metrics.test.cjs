'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('./device-test-metrics.js');
test('summarizes WebXR samples without requiring device globals',()=>{
  assert.deepEqual(summarize([{fps:30,videoFps:24,anchors:2,tracked:2,canPlace:true},{fps:20,videoFps:22,anchors:2,tracked:0,canPlace:false},{fps:40,videoFps:25,anchors:3,tracked:3,canPlace:true}]),{samples:3,medianFps:30,medianVideoFps:24,canPlacePercent:67,trackedAnchorPercent:71,medianTrackedAnchors:2,medianAnchors:2});
});
test('empty WebXR sample summary is explicit',()=>{
  assert.deepEqual(summarize([]),{samples:0,medianFps:null,medianVideoFps:null,canPlacePercent:null,trackedAnchorPercent:null,medianTrackedAnchors:null,medianAnchors:null});
});
