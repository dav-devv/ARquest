package br.com.mrcompanion;
import com.google.ar.core.*;
import java.util.*;
import android.os.SystemClock;

/** GL-thread owner of a persistent ARCore origin; raw detections never move existing anchors. */
final class MarkerReference {
    final NativeMarkers detector=new NativeMarkers();
    final Map<Integer,NativeMarkers.Reading> stable=new HashMap<>(),previous=new HashMap<>();
    final Map<Integer,Integer> counts=new HashMap<>();
    Anchor anchor;int selected=100,originId,observedEpoch;long consumed=-1,lastValid;boolean defineRequested;
    void reset(float side){detector.reset(side);stable.clear();previous.clear();counts.clear();consumed=-1;defineRequested=false;if(anchor!=null){anchor.detach();anchor=null;}}
    void select(int id){if(id!=100)throw new IllegalArgumentException("Use a referência universal ID 100.");selected=100;defineRequested=false;}
    String update(Frame frame,Session session){
        long now=SystemClock.uptimeMillis();boolean tracking=frame.getCamera().getTrackingState()==TrackingState.TRACKING;
        if(observedEpoch!=detector.epoch||now-lastValid>500){observedEpoch=detector.epoch;stable.clear();previous.clear();counts.clear();}
        if(!tracking){stable.clear();previous.clear();counts.clear();detector.epoch++;detector.result=null;defineRequested=false;return "Marcadores: aguardando rastreamento da câmera.";}
        detector.submit(frame);NativeMarkers.Result result=detector.result;
        if(result!=null&&result.epoch==detector.epoch&&now-result.time<=500&&result.time!=consumed){consumed=result.time;lastValid=result.time;
            Set<Integer> seen=new HashSet<>();Set<Integer> duplicated=new HashSet<>();for(NativeMarkers.Reading r:result.readings)if(!seen.add(r.id))duplicated.add(r.id);
            seen.clear();for(NativeMarkers.Reading r:result.readings){if(duplicated.contains(r.id))continue;seen.add(r.id);NativeMarkers.Reading old=previous.put(r.id,r);boolean compatible=old!=null&&MarkerGeometry.compatible(old.world.getTranslation(),old.world.getRotationQuaternion(),r.world.getTranslation(),r.world.getRotationQuaternion());int n=compatible?counts.getOrDefault(r.id,0)+1:1;counts.put(r.id,n);if(n>=4)stable.put(r.id,r);else stable.remove(r.id);}
            previous.keySet().retainAll(seen);counts.keySet().retainAll(seen);stable.keySet().retainAll(seen);
        }
        if(now-lastValid>500){stable.clear();previous.clear();counts.clear();}
        NativeMarkers.Reading reading=stable.get(selected);
        if(defineRequested){defineRequested=false;if(reading!=null){Anchor next=session.createAnchor(reading.world);if(anchor!=null)anchor.detach();anchor=next;originId=selected;}}
        if(!detector.error.isEmpty())return detector.error;
        String origin=anchor==null?"Sem origem fixa. Use Referência após estabilizar.":"Origem fixa: ID "+originId+". Novos painéis usam essa folha.";
        if(reading==null){if(anchor!=null&&anchor.getTrackingState()==TrackingState.TRACKING)return origin+"\n"+coordinates(anchor.getPose(),frame.getCamera().getPose(),"Estimativa ARCore; folha fora de leitura");return "Mostre o ID "+selected+" inteiro e mantenha-o estável. "+origin;}
        String text=coordinates(reading.world,frame.getCamera().getPose(),"ID "+selected+" visível")+String.format(Locale.US," • erro %.1f px",reading.error);
        return text+"\n"+origin;
    }
    static String coordinates(Pose marker,Pose camera,String label){float[] p=marker.inverse().compose(camera).getTranslation();return String.format(Locale.US,"%s\nCelular: X %+.3f  Y %+.3f  Z %+.3f m | distância %.3f m",label,p[0],p[1],p[2],MarkerGeometry.distance(p,new float[3]));}
    Pose panelPose(){return anchor!=null&&anchor.getTrackingState()==TrackingState.TRACKING?anchor.getPose().compose(Pose.makeTranslation(0,0,.10f)):null;}
}
