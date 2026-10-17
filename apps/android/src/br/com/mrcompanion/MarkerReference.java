package br.com.mrcompanion;
import com.google.ar.core.*;
import java.util.*;
import android.os.SystemClock;

/** GL-thread owner of a persistent ARCore origin; raw detections never move existing anchors. */
final class MarkerReference {
    final NativeMarkers detector=new NativeMarkers();
    final Map<Integer,NativeMarkers.Reading> stable=new HashMap<>(),previous=new HashMap<>();
    final Map<Integer,Integer> counts=new HashMap<>();
    final Map<Integer,ArrayDeque<NativeMarkers.Reading>> windows=new HashMap<>();
    volatile float confidence,originConfidence;
    Pose previousOrigin;Anchor anchor;int selected=100,originId,observedEpoch;long consumed=-1,lastValid;boolean defineRequested,restoreRequested,originChanged,savedOriginConfigured;
    void reset(float side){boolean configured=savedOriginConfigured||anchor!=null;if(anchor!=null)previousOrigin=anchor.getPose();detector.reset(side);stable.clear();previous.clear();counts.clear();windows.clear();confidence=0;originConfidence=0;consumed=-1;defineRequested=false;restoreRequested=configured;savedOriginConfigured=configured;if(anchor!=null){anchor.detach();anchor=null;}}
    void select(int id){if(id!=100)throw new IllegalArgumentException("Use a referência universal ID 100.");selected=100;defineRequested=false;}
    String update(Frame frame,Session session,boolean allowImageCapture){
        long now=SystemClock.uptimeMillis();boolean tracking=frame.getCamera().getTrackingState()==TrackingState.TRACKING;
        if(observedEpoch!=detector.epoch||now-lastValid>500){observedEpoch=detector.epoch;stable.clear();previous.clear();counts.clear();windows.clear();confidence=0;}
        if(!tracking){stable.clear();previous.clear();counts.clear();windows.clear();confidence=0;detector.epoch++;detector.result=null;defineRequested=false;return "Marcadores: aguardando rastreamento da câmera.";}
        if(allowImageCapture)detector.submit(frame);NativeMarkers.Result result=detector.result;
        if(result!=null&&result.epoch==detector.epoch&&now-result.time<=500&&result.time!=consumed){consumed=result.time;lastValid=result.time;
            Set<Integer> seen=new HashSet<>();Set<Integer> duplicated=new HashSet<>();for(NativeMarkers.Reading r:result.readings)if(!seen.add(r.id))duplicated.add(r.id);
            seen.clear();for(NativeMarkers.Reading r:result.readings){if(duplicated.contains(r.id))continue;seen.add(r.id);NativeMarkers.Reading old=previous.put(r.id,r);boolean compatible=old!=null&&MarkerGeometry.compatible(old.world.getTranslation(),old.world.getRotationQuaternion(),r.world.getTranslation(),r.world.getRotationQuaternion());int n=compatible?counts.getOrDefault(r.id,0)+1:1;ArrayDeque<NativeMarkers.Reading> window=windows.computeIfAbsent(r.id,k->new ArrayDeque<>());if(!compatible)window.clear();window.addLast(r);while(window.size()>8)window.removeFirst();counts.put(r.id,n);if(n>=6&&r.confidence>=.45f){NativeMarkers.Reading filtered=average(r.id,window);stable.put(r.id,filtered);if(r.id==100)confidence=filtered.confidence;}else{stable.remove(r.id);if(r.id==100)confidence=0;}}
            previous.keySet().retainAll(seen);counts.keySet().retainAll(seen);stable.keySet().retainAll(seen);windows.keySet().retainAll(seen);
        }
        if(now-lastValid>500){stable.clear();previous.clear();counts.clear();windows.clear();confidence=0;}
        NativeMarkers.Reading reading=stable.get(selected);
        if(defineRequested&&reading!=null&&reading.confidence>=.58f){defineRequested=false;Anchor next=session.createAnchor(reading.world);if(anchor!=null){previousOrigin=anchor.getPose();anchor.detach();}anchor=next;originId=selected;originConfidence=reading.confidence;savedOriginConfigured=true;originChanged=true;}
        if(restoreRequested){if(anchor!=null)restoreRequested=false;if(anchor==null&&reading!=null&&reading.confidence>=.58f&&savedOriginConfigured){restoreRequested=false;anchor=session.createAnchor(reading.world);originId=selected;originConfidence=reading.confidence;originChanged=true;}}
        if(!detector.error.isEmpty())return detector.error;
        String origin=anchor==null?"Sem origem fixa. Leia o ID 100 para localizar o espaço salvo.":"Espaço localizado pelo ID "+originId+". Posicione janelas em superfícies detectadas.";
        if(reading==null){if(anchor!=null&&anchor.getTrackingState()==TrackingState.TRACKING)return origin+"\n"+coordinates(anchor.getPose(),frame.getCamera().getPose(),"Estimativa ARCore; folha fora de leitura");return "Mostre o ID "+selected+" inteiro e mantenha-o estável. "+origin;}
        String text=coordinates(reading.world,frame.getCamera().getPose(),"ID "+selected+" visível")+String.format(Locale.US," • erro %.1f px • confiança %.0f%% • lado %.0f px",reading.error,reading.confidence*100,reading.edgePixels);
        StringBuilder tags=new StringBuilder();for(Integer id:stable.keySet())if(id!=100){if(tags.length()>0)tags.append(", ");tags.append(id==101?"101 chão/mesa ↑":id==102?"102 parede ↑":"103 teto ↓");}
        return text+(tags.length()>0?"\nEtiquetas: "+tags:"")+"\n"+origin;
    }
    static NativeMarkers.Reading average(int id,Collection<NativeMarkers.Reading> values){float[][] t=new float[values.size()][3],q=new float[values.size()][4];float[] w=new float[values.size()];double error=0,edge=0,quality=0;int i=0;for(NativeMarkers.Reading r:values){t[i]=r.world.getTranslation();q[i]=r.world.getRotationQuaternion();w[i]=Math.max(.05f,r.confidence);error+=r.error*w[i];edge+=r.edgePixels*w[i];quality+=r.confidence*w[i];i++;}float[] pose=MarkerGeometry.averagePose(t,q,w);float sum=0;for(float weight:w)sum+=weight;return new NativeMarkers.Reading(id,new Pose(new float[]{pose[0],pose[1],pose[2]},new float[]{pose[3],pose[4],pose[5],pose[6]}),error/sum,(float)(quality/sum),(float)(edge/sum));}
    static String coordinates(Pose marker,Pose camera,String label){float[] p=marker.inverse().compose(camera).getTranslation();return String.format(Locale.US,"%s\nCelular: X %+.3f  Y %+.3f  Z %+.3f m | distância %.3f m",label,p[0],p[1],p[2],MarkerGeometry.distance(p,new float[3]));}
    Pose originPose(){return anchor!=null&&anchor.getTrackingState()==TrackingState.TRACKING?anchor.getPose():null;}
}
