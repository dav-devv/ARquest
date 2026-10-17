importScripts('vendor/cv.js','vendor/aruco.js');
const detector=new AR.Detector();
onmessage=event=>{
  const {pixels,width,height,serial}=event.data;
  try {postMessage({serial,markers:detector.detect({width,height,data:new Uint8ClampedArray(pixels)}).filter(m=>[100,101,102,103].includes(m.id))});}
  catch(error){postMessage({serial,error:error.message});}
};
