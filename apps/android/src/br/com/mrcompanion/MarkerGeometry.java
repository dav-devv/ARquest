package br.com.mrcompanion;

/** Units are metres. Marker axes: right, up on the print, out of the paper. */
public final class MarkerGeometry {
    public static float metres(String input){float mm=Float.parseFloat(input.trim().replace(',','.'));if(!Float.isFinite(mm)||mm<30||mm>1000)throw new IllegalArgumentException("Informe de 30 a 1000 mm.");return mm/1000f;}
    public static byte[] bits(int id){int[][] rows={{1,0,0,0,0},{1,0,1,1,1},{0,1,0,0,1},{0,1,1,1,0}};byte[] out=new byte[25];for(int y=0;y<5;y++)for(int x=0;x<5;x++)out[y*5+x]=(byte)rows[(id>>((4-y)*2))&3][x];return out;}
    public static double distance(float[] a,float[] b){double x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return Math.sqrt(x*x+y*y+z*z);}
    /** OpenCV right/down/forward -> ARCore physical camera right/up/back. */
    public static float[] translation(double[] t){return new float[]{(float)t[0],(float)-t[1],(float)-t[2]};}
    public static float[] quaternion(double[] cv){double[] r=cv.clone();for(int i=3;i<9;i++)r[i]=-r[i];double x,y,z,w,s,trace=r[0]+r[4]+r[8];
        if(trace>0){s=Math.sqrt(trace+1)*2;w=s/4;x=(r[7]-r[5])/s;y=(r[2]-r[6])/s;z=(r[3]-r[1])/s;}
        else if(r[0]>r[4]&&r[0]>r[8]){s=Math.sqrt(1+r[0]-r[4]-r[8])*2;w=(r[7]-r[5])/s;x=s/4;y=(r[1]+r[3])/s;z=(r[2]+r[6])/s;}
        else if(r[4]>r[8]){s=Math.sqrt(1+r[4]-r[0]-r[8])*2;w=(r[2]-r[6])/s;x=(r[1]+r[3])/s;y=s/4;z=(r[5]+r[7])/s;}
        else{s=Math.sqrt(1+r[8]-r[0]-r[4])*2;w=(r[3]-r[1])/s;x=(r[2]+r[6])/s;y=(r[5]+r[7])/s;z=s/4;}
        double n=Math.sqrt(x*x+y*y+z*z+w*w);return new float[]{(float)(x/n),(float)(y/n),(float)(z/n),(float)(w/n)};
    }
    public static boolean compatible(float[] a,float[] aq,float[] b,float[] bq){double dot=0;for(int i=0;i<4;i++)dot+=aq[i]*bq[i];return distance(a,b)<.03&&Math.abs(dot)>.995;}
}
