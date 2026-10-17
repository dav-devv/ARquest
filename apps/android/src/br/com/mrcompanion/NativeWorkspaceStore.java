package br.com.mrcompanion;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.ar.core.Pose;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Saves user configuration and map-relative panel poses; ARCore anchors are recreated after relocalization. */
final class NativeWorkspaceStore {
    static final class SavedPanel extends WorkspacePersistence.Panel<Pose> {
        SavedPanel(String id,String name,float size,Pose pose){super(id,name,size,pose);}
    }
    static final class Snapshot {
        final float markerSide;final boolean originConfigured;final String selected;final List<SavedPanel> panels;final List<SavedSurface> surfaces;
        Snapshot(float markerSide,boolean originConfigured,String selected,List<SavedPanel> panels,List<SavedSurface> surfaces){this.markerSide=markerSide;this.originConfigured=originConfigured;this.selected=selected;this.panels=panels;this.surfaces=surfaces;}
    }
    static final class SavedSurface {
        final int type;final Pose pose;final float[] polygon;final float area;final int observations;final float depthCoverage;
        SavedSurface(int type,Pose pose,float[] polygon,float area,int observations,float depthCoverage){this.type=type;this.pose=pose;this.polygon=polygon;this.area=area;this.observations=observations;this.depthCoverage=depthCoverage;}
    }
    static Snapshot load(Context context){
        SharedPreferences preferences=context.getSharedPreferences("arquest-workspace-v1",Context.MODE_PRIVATE);
        float side=preferences.getFloat("markerSide",.10f);boolean origin=preferences.getBoolean("originConfigured",false);String selected=preferences.getString("selected","");List<SavedPanel> panels=readPanels(preferences.getString("panels","[]"));
        List<SavedSurface> surfaces=new ArrayList<>();try{JSONArray list=new JSONArray(preferences.getString("surfaces","[]"));for(int i=0;i<Math.min(48,list.length());i++){JSONObject s=list.getJSONObject(i);Pose pose=readPose(s.optJSONArray("pose"));JSONArray points=s.optJSONArray("polygon");if(pose==null||points==null||points.length()<6||points.length()>256||points.length()%2!=0)continue;float[] polygon=new float[points.length()];for(int j=0;j<polygon.length;j++)polygon[j]=(float)points.getDouble(j);int type=s.optInt("type",-1);float area=(float)s.optDouble("area",0),depth=(float)s.optDouble("depthCoverage",-1);if(type>=0&&type<=2&&area>=0&&area<=10000&&depth>=-1&&depth<=1)surfaces.add(new SavedSurface(type,pose,polygon,area,Math.max(1,Math.min(1000,s.optInt("observations",1))),depth));}}catch(Exception ignored){}
        return new Snapshot(side,origin,selected,panels,surfaces);
    }
    private static List<SavedPanel> readPanels(String json){
        List<SavedPanel> panels=new ArrayList<>();
        try{JSONArray list=new JSONArray(json);for(int i=0;i<Math.min(24,list.length());i++){JSONObject p=list.getJSONObject(i);String id=p.optString("id","");float size=(float)p.optDouble("size",.65);Pose pose=readPose(p.optJSONArray("pose"));if(id.matches("p[1-9][0-9]{0,3}")&&size>=.2f&&size<=3f&&pose!=null)panels.add(new SavedPanel(id,p.optString("name","Painel"),size,pose));}}catch(Exception ignored){}
        return panels;
    }
    static void save(Context context,float side,Pose origin,String selected,List<NativeRenderer.Panel> panels,List<SavedSurface> surfaces){
        SharedPreferences preferences=context.getSharedPreferences("arquest-workspace-v1",Context.MODE_PRIVATE);
        List<WorkspacePersistence.Panel<Pose>> current=new ArrayList<>();
        Pose inverse=origin==null?null:origin.inverse();
        for(NativeRenderer.Panel panel:panels){
            Pose relative=panel.savedPose;
            if(inverse!=null)try{
                Pose world=panel.dragPose!=null?panel.dragPose:panel.anchor!=null?panel.anchor.getPose():null;
                if(world!=null)relative=inverse.compose(world);
            }catch(RuntimeException ignored){}
            current.add(new WorkspacePersistence.Panel<>(panel.id,panel.name,panel.size,relative));
        }
        JSONArray list=new JSONArray();
        for(WorkspacePersistence.Panel<Pose> panel:WorkspacePersistence.mergePanels(current,readPanels(preferences.getString("panels","[]"))))try{
            JSONObject value=new JSONObject().put("id",panel.id).put("name",panel.name).put("size",panel.size);
            // Never persist a session-world pose as if it belonged to the marker's map.
            if(panel.pose!=null){JSONArray pose=new JSONArray();for(float v:panel.pose.getTranslation())pose.put(v);for(float v:panel.pose.getRotationQuaternion())pose.put(v);value.put("pose",pose);}
            list.put(value);
        }catch(Exception ignored){}
        JSONArray savedSurfaces=new JSONArray();for(SavedSurface surface:surfaces){try{JSONArray pose=new JSONArray(),polygon=new JSONArray();for(float v:surface.pose.getTranslation())pose.put(v);for(float v:surface.pose.getRotationQuaternion())pose.put(v);for(float v:surface.polygon)polygon.put(v);savedSurfaces.put(new JSONObject().put("type",surface.type).put("pose",pose).put("polygon",polygon).put("area",surface.area).put("observations",surface.observations).put("depthCoverage",surface.depthCoverage));}catch(Exception ignored){}}
        SharedPreferences.Editor editor=preferences.edit().putFloat("markerSide",side).putString("selected",selected)
            .putString("panels",list.toString()).putString("surfaces",savedSurfaces.toString());
        if(origin!=null)editor.putBoolean("originConfigured",true);editor.apply();
    }
    /** Changes map coordinates while retaining every surface's physical pose and local polygon. */
    static void rebaseSurfaces(List<SavedSurface> surfaces,Pose oldOrigin,Pose newOrigin){
        if(oldOrigin==null||newOrigin==null)return;
        Pose newFromOld=newOrigin.inverse().compose(oldOrigin);
        for(int i=0;i<surfaces.size();i++){
            SavedSurface surface=surfaces.get(i);
            surfaces.set(i,new SavedSurface(surface.type,newFromOld.compose(surface.pose),surface.polygon,surface.area,surface.observations,surface.depthCoverage));
        }
    }
    static void saveOrigin(Context context,float side,boolean configured){context.getSharedPreferences("arquest-workspace-v1",Context.MODE_PRIVATE).edit().putFloat("markerSide",side).putBoolean("originConfigured",configured).apply();}
    static void clearOrigin(Context context){context.getSharedPreferences("arquest-workspace-v1",Context.MODE_PRIVATE).edit().putBoolean("originConfigured",false).apply();}
    static Pose readPose(String value){try{return readPose(new JSONArray(value));}catch(Exception e){return null;}}
    static Pose readPose(JSONArray values){try{if(values==null||values.length()!=7)return null;float[] t=new float[3],q=new float[4];for(int i=0;i<3;i++)t[i]=(float)values.getDouble(i);for(int i=0;i<4;i++)q[i]=(float)values.getDouble(i+3);return new Pose(t,q);}catch(Exception e){return null;}}
}
