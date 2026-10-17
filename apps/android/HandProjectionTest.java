import br.com.mrcompanion.HandProjection;
import br.com.mrcompanion.WindowMotion;
public class HandProjectionTest {
    static int checks;static void yes(boolean v){checks++;if(!v)throw new AssertionError("check "+checks);}static void near(float a,float b){yes(Math.abs(a-b)<.001f);}
    public static void main(String[] args){
        float[] identity={0,0,0,1};
        HandProjection.Ray captured=HandProjection.ray(new float[]{0,0,0},identity,500,500,320,240,640,480,(320+62.5f)/640,240f/480);
        float[] hit=WindowMotion.rayPlane(captured.origin,captured.direction,new float[]{0,0,-2},new float[]{0,0,1});near(hit[0],.25f);near(hit[2],-2);
        // A delayed sample remains at x=.25 even after the current camera moved x=.3.
        HandProjection.Ray incorrectlyCurrent=HandProjection.ray(new float[]{.3f,0,0},identity,500,500,320,240,640,480,(320+62.5f)/640,240f/480);
        float[] incorrect=WindowMotion.rayPlane(incorrectlyCurrent.origin,incorrectlyCurrent.direction,new float[]{0,0,-2},new float[]{0,0,1});near(incorrect[0],.55f);
        // Equal world hand spacing has different pixel spacing after moving the camera closer.
        float[] distances=new float[2];for(int i=0;i<2;i++){
            float cameraZ=i==0?0:-.4f,depth=2+cameraZ;float[][] worldPoints=new float[2][];
            for(int h=0;h<2;h++){float x=h==0?-.15f:.15f,u=(320+x/depth*500)/640;HandProjection.Ray ray=HandProjection.ray(new float[]{0,0,cameraZ},identity,500,500,320,240,640,480,u,.5f);worldPoints[h]=WindowMotion.rayPlane(ray.origin,ray.direction,new float[]{0,0,-2},new float[]{0,0,1});}
            distances[i]=WindowMotion.distance(worldPoints[0],worldPoints[1]);
        }near(distances[0],.3f);near(distances[1],.3f);
        float angle=(float)Math.PI/4;HandProjection.Ray rotated=HandProjection.ray(new float[]{1,2,3},new float[]{0,(float)Math.sin(angle),0,(float)Math.cos(angle)},500,500,320,240,640,480,.5f,.5f);
        near(rotated.direction[0],-1);near(rotated.direction[2],0);near(rotated.origin[1],2);
        yes(HandProjection.ray(new float[3],identity,0,500,320,240,640,480,.5f,.5f)==null);
        HandProjection.Resize resize=new HandProjection.Resize();resize.begin(.3f,.65f,new float[3],identity,1000);
        near(resize.update(.45f,new float[3],identity,1100),.975f);
        near(resize.update(.75f,new float[]{0,0,.4f},identity,1200),.975f);yes(resize.settling());
        near(resize.update(.75f,new float[]{0,0,.4f},identity,1300),.975f);near(resize.update(.75f,new float[]{0,0,.4f},identity,1500),.975f);yes(!resize.settling());
        near(resize.update(1.125f,new float[]{0,0,.4f},identity,1600),1.4625f);
        near(resize.update(1.5f,new float[]{0,0,.4f},new float[]{0,.2f,0,.98f},1700),1.4625f);yes(resize.settling());
        near(resize.update(0,new float[]{0,0,.4f},identity,1750),1.4625f);
        System.out.println("Hand projection and spatial resize: "+checks+" checks passed");
    }
}
