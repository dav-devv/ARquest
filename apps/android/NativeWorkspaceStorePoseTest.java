package br.com.mrcompanion;

import com.google.ar.core.Pose;
import java.util.ArrayList;
import java.util.List;

/** Runs against the real ARCore Pose implementation without starting an Android session. */
public class NativeWorkspaceStorePoseTest {
    private static int checks;
    private static void yes(boolean value){checks++;if(!value)throw new AssertionError("check "+checks);}
    private static void near(float a,float b){yes(Math.abs(a-b)<.0001f);}
    private static void sameWorld(Pose a,Pose b){
        for(float[] point:new float[][]{{0,0,0},{1,0,0},{0,1,0},{0,0,1},{.5f,-.3f,.7f}}){
            float[] x=a.transformPoint(point),y=b.transformPoint(point);
            for(int i=0;i<3;i++)near(x[i],y[i]);
        }
    }
    public static void main(String[] args){
        Pose oldOrigin=new Pose(new float[]{1,2,3},new float[]{0,.70710677f,0,.70710677f});
        Pose newOrigin=new Pose(new float[]{-2,1,4},new float[]{0,0,.70710677f,.70710677f});
        Pose nextOrigin=new Pose(new float[]{3,-2,1},new float[]{.5f,0,0,.8660254f});
        Pose relative=new Pose(new float[]{.2f,.3f,-2},new float[]{.5f,0,0,.8660254f});
        float[] polygon={-1,-1,1,-1,1,1,-1,1};
        List<NativeWorkspaceStore.SavedSurface> surfaces=new ArrayList<>();
        surfaces.add(new NativeWorkspaceStore.SavedSurface(1,relative,polygon,4,17,.8f));
        surfaces.add(new NativeWorkspaceStore.SavedSurface(0,Pose.makeTranslation(2,-1,0),polygon,2,3,-1));
        Pose[] world={oldOrigin.compose(relative),oldOrigin.compose(surfaces.get(1).pose)};
        NativeWorkspaceStore.rebaseSurfaces(surfaces,oldOrigin,newOrigin);
        yes(surfaces.size()==2);
        for(int i=0;i<2;i++)sameWorld(world[i],newOrigin.compose(surfaces.get(i).pose));
        for(int i=0;i<polygon.length;i++)near(polygon[i],surfaces.get(0).polygon[i]);
        near(surfaces.get(0).area,4);yes(surfaces.get(0).observations==17);
        near(surfaces.get(0).depthCoverage,.8f);yes(surfaces.get(0).type==1);
        near(surfaces.get(1).depthCoverage,-1);yes(surfaces.get(1).type==0);
        NativeWorkspaceStore.rebaseSurfaces(surfaces,newOrigin,nextOrigin);
        for(int i=0;i<2;i++)sameWorld(world[i],nextOrigin.compose(surfaces.get(i).pose));
        Pose preserved=surfaces.get(0).pose;
        NativeWorkspaceStore.rebaseSurfaces(surfaces,null,nextOrigin);
        yes(surfaces.get(0).pose==preserved);
        NativeWorkspaceStore.rebaseSurfaces(surfaces,nextOrigin,null);
        yes(surfaces.get(0).pose==preserved);
        // Relocalizing an existing workspace for the first time must preserve saved coordinates.
        List<NativeWorkspaceStore.SavedSurface> initial=new ArrayList<>();
        initial.add(new NativeWorkspaceStore.SavedSurface(1,relative,polygon,4,17,.8f));
        NativeWorkspaceStore.rebaseSurfaces(initial,null,newOrigin);
        sameWorld(relative,initial.get(0).pose);
        System.out.println("Workspace surface rebase: "+checks+" checks");
    }
}
