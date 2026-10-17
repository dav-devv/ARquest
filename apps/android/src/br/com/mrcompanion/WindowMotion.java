package br.com.mrcompanion;

/** World-space math independent of the display refresh rate and camera roll. */
public final class WindowMotion {
    private WindowMotion() {}
    public static final class Filter {
        private float[] value; private long time;
        public void reset(){value=null;time=0;}
        public float[] update(float[] sample,long now){
            if(value==null||now-time>250||distance(value,sample)>.12f){value=sample.clone();time=now;return value.clone();}
            if(now<=time)return value.clone();
            float dt=(now-time)*.001f;time=now;float delta=distance(value,sample);
            if(delta>.0012f){float tau=delta>.015f?.025f:.085f,alpha=1-(float)Math.exp(-dt/tau);for(int i=0;i<3;i++)value[i]+=(sample[i]-value[i])*alpha;}
            return value.clone();
        }
    }
    public static final class Capture {
        public String owner;private long lastSample,lastClosed,openSince;private int openSamples;
        public void begin(String hand,long sample){owner=hand;lastSample=sample;lastClosed=sample;openSince=0;openSamples=0;}
        public boolean observe(String hand,long sample,boolean closed,boolean observed){
            if(owner==null||!owner.equals(hand)||!observed||sample<=lastSample)return false;
            lastSample=sample;if(closed){lastClosed=sample;openSince=0;openSamples=0;return false;}
            if(openSince==0)openSince=sample;openSamples++;return openSamples>=2&&sample-openSince>=60;
        }
        public boolean lost(long now){return owner!=null&&now-lastClosed>750;}
        public void clear(){owner=null;lastSample=lastClosed=openSince=0;openSamples=0;}
    }
    public static float distance(float[] a,float[] b){float x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return (float)Math.sqrt(x*x+y*y+z*z);}
    public static float[] rayPlane(float[] origin,float[] direction,float[] point,float[] normal){
        float den=dot(direction,normal);if(Math.abs(den)<.08f)return null;
        float t=((point[0]-origin[0])*normal[0]+(point[1]-origin[1])*normal[1]+(point[2]-origin[2])*normal[2])/den;
        if(t<.05f||t>12||!Float.isFinite(t))return null;
        return new float[]{origin[0]+direction[0]*t,origin[1]+direction[1]*t,origin[2]+direction[2]*t};
    }
    static float dot(float[] a,float[] b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
    public static boolean perspectiveWeights(float[] weights,float[] inverseW,int[] indices){
        float sum=0;for(int i=0;i<3;i++){weights[i]*=inverseW[indices[i]];sum+=weights[i];}
        if(sum<1e-6f||!Float.isFinite(sum))return false;
        for(int i=0;i<3;i++)weights[i]/=sum;return true;
    }
    public static float[] facing(float[] position,float[] viewer){
        float zx=viewer[0]-position[0],zy=viewer[1]-position[1],zz=viewer[2]-position[2],length=(float)Math.sqrt(zx*zx+zy*zy+zz*zz);
        if(length<.01f)return new float[]{0,0,0,1};zx/=length;zy/=length;zz/=length;
        float side=(float)Math.hypot(zx,zz),xx,xy,xz;
        if(side>=.02f){xx=zz/side;xy=0;xz=-zx/side;}
        else{float lengthXY=(float)Math.hypot(zx,zy);xx=-zy/lengthXY;xy=zx/lengthXY;xz=0;}
        float yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
        float trace=xx+yy+zz,x,y,z,w,s;
        if(trace>0){s=(float)Math.sqrt(trace+1)*2;w=.25f*s;x=(yz-zy)/s;y=(zx-xz)/s;z=(xy-yx)/s;}
        else if(xx>yy&&xx>zz){s=(float)Math.sqrt(1+xx-yy-zz)*2;w=(yz-zy)/s;x=.25f*s;y=(yx+xy)/s;z=(zx+xz)/s;}
        else if(yy>zz){s=(float)Math.sqrt(1+yy-xx-zz)*2;w=(zx-xz)/s;x=(yx+xy)/s;y=.25f*s;z=(zy+yz)/s;}
        else{s=(float)Math.sqrt(1+zz-xx-yy)*2;w=(xy-yx)/s;x=(zx+xz)/s;y=(zy+yz)/s;z=.25f*s;}
        return new float[]{x,y,z,w};
    }
}
