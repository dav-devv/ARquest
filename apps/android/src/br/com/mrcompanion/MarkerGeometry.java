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
    /** Confidence favors low reprojection error and a large, evenly resolved marker. */
    public static float detectionConfidence(double reprojectionError,float minEdgePixels,float maxEdgePixels){
        if(!Double.isFinite(reprojectionError)||!Float.isFinite(minEdgePixels)||!Float.isFinite(maxEdgePixels)||minEdgePixels<=0||maxEdgePixels<minEdgePixels)return 0;
        double errorScore=Math.max(0,1-reprojectionError/2.5),sizeScore=Math.min(1,minEdgePixels/90.0),shapeScore=Math.max(0,1-(maxEdgePixels-minEdgePixels)/Math.max(1,maxEdgePixels));
        return (float)Math.max(0,Math.min(1,.5*errorScore+.35*sizeScore+.15*shapeScore));
    }
    /** Weighted pose average with quaternion hemisphere correction. */
    public static float[] averagePose(float[][] translations,float[][] rotations,float[] weights){
        if(translations==null||rotations==null||weights==null||translations.length==0||translations.length!=rotations.length||weights.length!=translations.length)throw new IllegalArgumentException("Medições incompatíveis.");
        double total=0;float[] t=new float[3],q=new float[4],reference=rotations[0];
        for(int n=0;n<weights.length;n++){double w=Math.max(.01,Math.min(1,weights[n]));total+=w;for(int i=0;i<3;i++)t[i]+=translations[n][i]*w;double dot=0;for(int i=0;i<4;i++)dot+=reference[i]*rotations[n][i];double sign=dot<0?-1:1;for(int i=0;i<4;i++)q[i]+=rotations[n][i]*(float)(w*sign);}
        for(int i=0;i<3;i++)t[i]/=(float)total;double norm=Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]);if(norm<1e-8)throw new IllegalArgumentException("Rotações inválidas.");for(int i=0;i<4;i++)q[i]/=(float)norm;return new float[]{t[0],t[1],t[2],q[0],q[1],q[2],q[3]};
    }
}
