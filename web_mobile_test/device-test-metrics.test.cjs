'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('./device-test-metrics.js');
test('summarizes WebXR samples without requiring device globals',()=>{
  assert.deepEqual(summarize([{fps:30,videoFps:24,anchors:2,tracked:2,active:true},{fps:20,videoFps:22,anchors:2,tracked:0,active:true},{fps:40,videoFps:25,anchors:3,tracked:3,active:true}]),{samples:3,medianFps:30,medianVideoFps:24,trackedPercent:67,medianTrackedAnchors:2,medianAnchors:2});
});
test('empty WebXR sample summary is explicit',()=>{
  assert.deepEqual(summarize([]),{samples:0,medianFps:null,medianVideoFps:null,trackedPercent:null,medianTrackedAnchors:null,medianAnchors:null});
});
