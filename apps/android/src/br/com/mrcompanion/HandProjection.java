package br.com.mrcompanion;

/** A landmark uses the optical camera pose and intrinsics of its own captured image. */
public final class HandProjection {
    private HandProjection(){}
    public static final class Ray {
        public final float[] origin,direction;
        Ray(float[] origin,float[] direction){this.origin=origin;this.direction=direction;}
        public float[] at(float distance){return new float[]{origin[0]+direction[0]*distance,origin[1]+direction[1]*distance,origin[2]+direction[2]*distance};}
    }
    public static Ray ray(float[] translation,float[] rotation,float fx,float fy,float cx,float cy,int width,int height,float u,float v){
        if(translation==null||rotation==null||translation.length!=3||rotation.length!=4||width<=0||height<=0||!Float.isFinite(fx)||!Float.isFinite(fy)||fx<=0||fy<=0||!Float.isFinite(u)||!Float.isFinite(v)||!Float.isFinite(cx)||!Float.isFinite(cy))return null;
        for(float value:translation)if(!Float.isFinite(value))return null;
        float norm=0;for(float value:rotation){if(!Float.isFinite(value))return null;norm+=value*value;}if(norm<1e-6f)return null;norm=(float)Math.sqrt(norm);
        float x=rotation[0]/norm,y=rotation[1]/norm,z=rotation[2]/norm,w=rotation[3]/norm;
        float vx=(u*width-cx)/fx,vy=-(v*height-cy)/fy,vz=-1;
        float dot=x*vx+y*vy+z*vz,diagonal=w*w-x*x-y*y-z*z;
        float[] direction={2*dot*x+diagonal*vx+2*w*(y*vz-z*vy),2*dot*y+diagonal*vy+2*w*(z*vx-x*vz),2*dot*z+diagonal*vz+2*w*(x*vy-y*vx)};
        float length=(float)Math.sqrt(direction[0]*direction[0]+direction[1]*direction[1]+direction[2]*direction[2]);if(length<1e-6f||!Float.isFinite(length))return null;for(int i=0;i<3;i++)direction[i]/=length;
        return new Ray(translation.clone(),direction);
    }
    /** Rejects the pixel-span magnification caused by moving the headset during a resize. */
    public static final class Resize {
        private float[] stablePosition,stableRotation,previousPosition,previousRotation;
        private float baseSpan,baseSize,size;private long stableSince,lastTime;private boolean settling;
        public void begin(float span,float size,float[] position,float[] rotation,long now){baseSpan=span;baseSize=this.size=size;stablePosition=position.clone();stableRotation=rotation.clone();previousPosition=position.clone();previousRotation=rotation.clone();lastTime=now;settling=false;}
        public float update(float span,float[] position,float[] rotation,long now){
            if(stablePosition==null||now<=lastTime||span<.02f||!Float.isFinite(span))return size;
            float dt=Math.max(.001f,(now-lastTime)*.001f);lastTime=now;
            boolean moved=WindowMotion.distance(position,stablePosition)>.012f||angle(rotation,stableRotation)>.035f;
            boolean moving=WindowMotion.distance(position,previousPosition)/dt>.025f||angle(rotation,previousRotation)/dt>.08f;
            previousPosition=position.clone();previousRotation=rotation.clone();
            if(moved||settling){
                if(!settling||moving)stableSince=now;settling=true;
                if(now-stableSince>=200){baseSpan=span;baseSize=size;stablePosition=position.clone();stableRotation=rotation.clone();settling=false;}
                return size;
            }
            if(baseSpan>=.02f)size=Math.max(.2f,Math.min(3,baseSize*span/baseSpan));return size;
        }
        public boolean settling(){return settling;}
        static float angle(float[] a,float[] b){float dot=0,aa=0,bb=0;for(int i=0;i<4;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}if(aa*bb<1e-9)return (float)Math.PI;return 2*(float)Math.acos(Math.min(1,Math.abs(dot)/(float)Math.sqrt(aa*bb)));}
    }
}
