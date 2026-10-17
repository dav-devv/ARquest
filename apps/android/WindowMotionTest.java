import br.com.mrcompanion.WindowMotion;
public class WindowMotionTest {
    static int checks;static void yes(boolean v){checks++;if(!v)throw new AssertionError("check "+checks);}
    static void near(float a,float b,float tolerance){yes(Math.abs(a-b)<=tolerance);}
    public static void main(String[] args){
        WindowMotion.Capture grab=new WindowMotion.Capture();grab.begin("left#1",1000);
        yes(!grab.observe("right#2",1100,false,true));yes(!grab.observe("left#1",1100,false,false));
        yes(!grab.observe("left#1",1100,false,true));for(int i=0;i<20;i++)yes(!grab.observe("left#1",1100,false,true));
        yes(!grab.observe("left#1",1200,true,true));yes(!grab.observe("left#1",1300,false,true));yes(grab.observe("left#1",1410,false,true));
        grab.begin("left#1",2000);yes(!grab.lost(2400));yes(grab.lost(2800));
        float[] p=WindowMotion.rayPlane(new float[]{0,0,0},new float[]{.1f,0,-1},new float[]{0,0,-2},new float[]{0,0,1});near(p[0],.2f,.001f);near(p[2],-2,.001f);
        yes(WindowMotion.rayPlane(new float[]{0,0,0},new float[]{1,0,0},new float[]{0,0,-2},new float[]{0,0,1})==null);
        float[] weights={.5f,.25f,.25f};yes(WindowMotion.perspectiveWeights(weights,new float[]{1,.5f,.25f,1},new int[]{0,1,2}));near(weights[0],8f/11,.001f);near(weights[1],2f/11,.001f);near(weights[2],1f/11,.001f);
        float[] q=WindowMotion.facing(new float[]{0,0,-2},new float[]{0,0,0});near(q[3],1,.001f);near(q[0],0,.001f);near(q[2],0,.001f);
        for(float[] direction:new float[][]{{1,0,0},{0,1,0},{0,-1,0},{.4f,.5f,.8f},{-.2f,.4f,-.8f}}){
            q=WindowMotion.facing(new float[]{0,0,0},direction);float length=WindowMotion.distance(new float[3],direction);
            near(2*(q[0]*q[2]+q[3]*q[1]),direction[0]/length,.001f);
            near(2*(q[1]*q[2]-q[3]*q[0]),direction[1]/length,.001f);
            near(1-2*(q[0]*q[0]+q[1]*q[1]),direction[2]/length,.001f);
        }
        WindowMotion.Filter filter=new WindowMotion.Filter();double raw=0,smooth=0;int n=180;
        for(int i=0;i<n;i++){float jitter=(float)Math.sin(i*2.1)*.004f;float[] out=filter.update(new float[]{jitter,0,0},1000+i*33);if(i>20){raw+=jitter*jitter;smooth+=out[0]*out[0];}}
        yes(smooth<raw*.4);float[] out=null;for(int i=0;i<10;i++)out=filter.update(new float[]{.08f,0,0},7000+i*33);near(out[0],.08f,.002f);
        System.out.printf(java.util.Locale.US,"Window motion: %d checks; stationary synthetic RMS %.2f -> %.2f mm%n",checks,Math.sqrt(raw/(n-21))*1000,Math.sqrt(smooth/(n-21))*1000);
    }
}
