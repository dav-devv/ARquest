// Local MediaPipe assets. Camera pixels never leave this worker/device.
importScripts('/mobile/vendor/vision/vision_bundle.js');
let task,canvas,context;
onmessage=async event=>{
  const data=event.data;
  try{
    if(data.init){
      const files=await Vision.FilesetResolver.forVisionTasks('/mobile/vendor/vision/wasm');
      task=await Vision.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/mobile/vendor/vision/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
      postMessage({ready:true});return;
    }
    if(!task)return;
    if(!canvas||canvas.width!==data.width||canvas.height!==data.height){canvas=new OffscreenCanvas(data.width,data.height);context=canvas.getContext('2d');}
    context.putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
    const started=performance.now(),result=task.detectForVideo(canvas,data.time);
    postMessage({serial:data.serial,processingMs:performance.now()-started,hands:result.landmarks.map((points,i)=>({points,identity:result.handedness[i]?.[0]?.categoryName||'hand',score:result.handedness[i]?.[0]?.score||0}))});
  }catch(error){postMessage({serial:data.serial,error:'Mãos indisponíveis: '+error.message});}
};
