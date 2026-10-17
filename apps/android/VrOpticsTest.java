import br.com.mrcompanion.VrOptics;
public final class VrOpticsTest {
    static int checks;
    static void near(float a,float b){checks++;if(Math.abs(a-b)>.001f)throw new AssertionError(a+" != "+b);}
    public static void main(String[] args){
        for(int width:new int[]{720,1080,1440})for(float convergence:new float[]{-400,0,400}){
            float left=VrOptics.shiftX(convergence,width,false),right=VrOptics.shiftX(convergence,width,true);
            near(VrOptics.displayX(width*.5f,width,left),width*.5f+convergence);
            near(VrOptics.displayX(width*.5f,width,right),width*.5f-convergence);
            // Translating the image leaves the distance between features unchanged.
            near(VrOptics.displayX(400,width,left)-VrOptics.displayX(200,width,left),200);
        }
        float left=VrOptics.shiftY(20,16,1440,false),right=VrOptics.shiftY(20,16,1440,true);
        near(VrOptics.displayY(500,1440,left),472);near(VrOptics.displayY(500,1440,right),488);
        for(double bad:new double[]{Double.NaN,Double.POSITIVE_INFINITY,-401,401}){
            boolean rejected=false;try{VrOptics.bounded(bad,-400,400);}catch(IllegalArgumentException e){rejected=true;}
            checks++;if(!rejected)throw new AssertionError("Invalid calibration accepted");
        }
        near(VrOptics.bounded(400,-400,400),400);
        System.out.println("VR optics: "+checks+" checks passed");
    }
}
