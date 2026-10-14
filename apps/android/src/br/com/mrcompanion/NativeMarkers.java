package br.com.mrcompanion;
import android.media.Image;
import android.os.SystemClock;
import com.google.ar.core.*;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.opencv.core.*;
import org.opencv.core.Point;
import org.opencv.objdetect.*;
import org.opencv.calib3d.Calib3d;

/** One in-flight grayscale frame, capped at 5 Hz. Never holds an ARCore Image in the worker. */
final class NativeMarkers {
    static final class Reading {final int id;final Pose world;final double error;Reading(int id,Pose world,double error){this.id=id;this.world=world;this.error=error;}}
    static final class Result {final long time;final int epoch;final List<Reading> readings;Result(long t,int e,List<Reading> r){time=t;epoch=e;readings=r;}}
    final ExecutorService worker=Executors.newSingleThreadExecutor();final AtomicBoolean busy=new AtomicBoolean();
    volatile Result result;volatile String error="";volatile int epoch;volatile boolean closed;
    ArucoDetector detector;long lastSubmit;float side=.14f;
    void reset(float metres){side=metres;epoch++;result=null;}
    void close(){closed=true;epoch++;worker.shutdown();}
    void submit(Frame frame){
        long now=SystemClock.uptimeMillis();if(closed||now-lastSubmit<200||!busy.compareAndSet(false,true))return;lastSubmit=now;
        try(Image image=frame.acquireCameraImage()){
            if(Math.abs(image.getTimestamp()-frame.getTimestamp())>50000000L){busy.set(false);return;}
            int w=image.getWidth(),h=image.getHeight();Image.Plane plane=image.getPlanes()[0];ByteBuffer source=plane.getBuffer();int row=plane.getRowStride(),pixel=plane.getPixelStride(),base=source.position();byte[] gray=new byte[w*h];
            if(pixel==1){for(int y=0;y<h;y++){source.position(base+y*row);source.get(gray,y*w,w);}}else for(int y=0;y<h;y++)for(int x=0;x<w;x++)gray[y*w+x]=source.get(base+y*row+x*pixel);
            CameraIntrinsics intrinsics=frame.getCamera().getImageIntrinsics();float[] f=intrinsics.getFocalLength(),c=intrinsics.getPrincipalPoint();int[] dimensions=intrinsics.getImageDimensions();
            if(dimensions[0]!=w||dimensions[1]!=h){busy.set(false);error="Dimensões da câmera incompatíveis com a calibração.";return;}
            Pose camera=frame.getCamera().getPose();int generation=epoch;float size=side;
            worker.execute(()->{try{List<Reading> readings=detect(gray,w,h,f,c,camera,size);if(!closed&&epoch==generation){result=new Result(now,generation,readings);error="";}}catch(Throwable e){if(!closed)error="Detector indisponível: "+e.getClass().getSimpleName();}finally{busy.set(false);}});
        }catch(com.google.ar.core.exceptions.NotYetAvailableException e){busy.set(false);}catch(RuntimeException e){busy.set(false);error="Imagem do marcador indisponível.";}
    }
    void initialize(){
        if(detector!=null)return;System.loadLibrary("opencv_java4");
        ArrayList<Mat> codes=new ArrayList<>();Mat all=new Mat();
        try{for(int id:new int[]{100}){Mat bits=new Mat(5,5,CvType.CV_8UC1);try{bits.put(0,0,MarkerGeometry.bits(id));codes.add(org.opencv.objdetect.Dictionary.getByteListFromBits(bits));}finally{bits.release();}}
            Core.vconcat(codes,all);org.opencv.objdetect.Dictionary dictionary=new org.opencv.objdetect.Dictionary(all,5,0);DetectorParameters parameters=new DetectorParameters();parameters.set_cornerRefinementMethod(Objdetect.CORNER_REFINE_SUBPIX);detector=new ArucoDetector(dictionary,parameters);
        }finally{all.release();for(Mat m:codes)m.release();}
    }
    List<Reading> detect(byte[] pixels,int width,int height,float[] f,float[] c,Pose camera,float size){
        initialize();Mat image=new Mat(height,width,CvType.CV_8UC1),ids=new Mat(),k=Mat.eye(3,3,CvType.CV_64F);ArrayList<Mat> corners=new ArrayList<>();ArrayList<Reading> found=new ArrayList<>();
        try{image.put(0,0,pixels);k.put(0,0,f[0]);k.put(1,1,f[1]);k.put(0,2,c[0]);k.put(1,2,c[1]);detector.detectMarkers(image,corners,ids);
            for(int i=0;i<ids.rows();i++){int index=(int)ids.get(i,0)[0];if(index!=0)continue;Point[] p=new Point[4];boolean valid=true;for(int j=0;j<4;j++){double[] xy=corners.get(i).get(0,j);p[j]=new Point(xy[0],xy[1]);if(xy[0]<3||xy[1]<3||xy[0]>width-4||xy[1]>height-4)valid=false;}
                for(int j=0;j<4;j++)if(Math.hypot(p[j].x-p[(j+1)%4].x,p[j].y-p[(j+1)%4].y)<28)valid=false;
                if(!valid)continue;Reading reading=solve(100,p,k,camera,size);if(reading!=null)found.add(reading);
            }return found;
        }finally{image.release();ids.release();k.release();for(Mat m:corners)m.release();}
    }
    Reading solve(int id,Point[] points,Mat k,Pose camera,float size){
        double h=size/2;MatOfPoint3f object=new MatOfPoint3f(new Point3(-h,h,0),new Point3(h,h,0),new Point3(h,-h,0),new Point3(-h,-h,0));MatOfPoint2f observed=new MatOfPoint2f(points),projected=new MatOfPoint2f();MatOfDouble distortion=new MatOfDouble();Mat r=new Mat(),t=new Mat(),rotation=new Mat();
        try{if(!Calib3d.solvePnP(object,observed,k,distortion,r,t,false,Calib3d.SOLVEPNP_IPPE_SQUARE))return null;double[] translation=new double[3];t.get(0,0,translation);if(!Double.isFinite(translation[2])||translation[2]<.15||translation[2]>4)return null;
            Calib3d.projectPoints(object,r,t,k,distortion,projected);Point[] check=projected.toArray();double error=0;for(int j=0;j<4;j++)error+=Math.pow(check[j].x-points[j].x,2)+Math.pow(check[j].y-points[j].y,2);error=Math.sqrt(error/4);if(!Double.isFinite(error)||error>2.5)return null;
            Calib3d.Rodrigues(r,rotation);double[] matrix=new double[9];rotation.get(0,0,matrix);if(Math.abs(matrix[8])<.3)return null;Pose relative=new Pose(MarkerGeometry.translation(translation),MarkerGeometry.quaternion(matrix));return new Reading(id,camera.compose(relative),error);
        }finally{object.release();observed.release();projected.release();distortion.release();r.release();t.release();rotation.release();}
    }
}
