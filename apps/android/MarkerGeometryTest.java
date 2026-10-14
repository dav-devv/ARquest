import br.com.mrcompanion.MarkerGeometry;
public class MarkerGeometryTest {
    static int checks;
    static void near(double a,double b){checks++;if(Math.abs(a-b)>1e-5)throw new AssertionError(a+" != "+b);}
    static void yes(boolean a){checks++;if(!a)throw new AssertionError();}
    public static void main(String[] args){
        near(MarkerGeometry.metres("140"),.14);near(MarkerGeometry.metres("140,5"),.1405);
        for(String s:new String[]{"0","-1","1001","NaN","Infinity","abc"}){boolean rejected=false;try{MarkerGeometry.metres(s);}catch(RuntimeException e){rejected=true;}yes(rejected);}
        float[] t=MarkerGeometry.translation(new double[]{.2,-.3,1.5});near(t[0],.2);near(t[1],.3);near(t[2],-1.5);
        float[] q=MarkerGeometry.quaternion(new double[]{1,0,0,0,-1,0,0,0,-1});near(Math.abs(q[3]),1);near(q[0],0);near(q[1],0);near(q[2],0);
        q=MarkerGeometry.quaternion(new double[]{1,0,0,0,1,0,0,0,1});near(Math.abs(q[0]),1);near(q[3],0);
        near(MarkerGeometry.distance(new float[]{0,0,0},new float[]{3,4,12}),13);
        yes(MarkerGeometry.compatible(new float[]{0,0,1},new float[]{0,0,0,1},new float[]{.01f,0,1},new float[]{0,0,0,-1}));
        yes(!MarkerGeometry.compatible(new float[]{0,0,1},new float[]{0,0,0,1},new float[]{.05f,0,1},new float[]{0,0,0,1}));
        for(int id:new int[]{100,200}){byte[] b=MarkerGeometry.bits(id);yes(b.length==25);for(byte bit:b)yes(bit==0||bit==1);System.out.print(id+":");for(byte bit:b)System.out.print(bit);System.out.println();}
        System.out.println("Geometry: "+checks+" checks passed");
    }
}
