package br.com.mrcompanion;
import android.graphics.*;
import android.opengl.GLES20;
import android.opengl.GLES11Ext;
import android.opengl.GLSurfaceView;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import com.google.ar.core.*;
import java.nio.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.microedition.khronos.opengles.GL10;
import javax.microedition.khronos.egl.EGLConfig;

/** Native camera and local panels. No WebView or web renderer. */
public final class NativeRenderer implements GLSurfaceView.Renderer {
    final NativeArActivity activity;
    final MarkerReference reference=new MarkerReference();
    final AtomicBoolean placeRequested=new AtomicBoolean();
    final ArrayList<Panel> panels=new ArrayList<>();
    static class Panel { final Anchor anchor;float size=.65f;Panel(Anchor a){anchor=a;} }
    final FloatBuffer quad=buffer(-1,-1,1,-1,-1,1,1,1),uv=buffer(0,1,1,1,0,0,1,0),cameraUv=buffer(0,0,0,0,0,0,0,0);
    final float[] projection=new float[16],view=new float[16],model=new float[16],pv=new float[16],mvp=new float[16],identity=new float[16];
    int cameraTexture,panelTexture,cameraProgram,panelProgram,width=1,height=1;
    long lastMessage,eventUntil;String event="";boolean failed;
    NativeRenderer(NativeArActivity a){activity=a;reference.detector.side=a.getPreferences(0).getFloat("markerSide",.14f);Matrix.setIdentityM(identity,0);}
    static FloatBuffer buffer(float... values){FloatBuffer b=ByteBuffer.allocateDirect(values.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(values).position(0);return b;}
    static int shader(int type,String code){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,code);GLES20.glCompileShader(s);int[] ok=new int[1];GLES20.glGetShaderiv(s,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException(GLES20.glGetShaderInfoLog(s));return s;}
    static int program(boolean external){
        String vertex="attribute vec2 p;attribute vec2 t;uniform mat4 m;varying vec2 uv;void main(){uv=t;gl_Position=m*vec4(p,0.,1.);}";
        String fragment=(external?"#extension GL_OES_EGL_image_external : require\n":"")+"precision mediump float;varying vec2 uv;uniform "+(external?"samplerExternalOES":"sampler2D")+" tex;void main(){gl_FragColor=texture2D(tex,uv);}";
        int v=shader(GLES20.GL_VERTEX_SHADER,vertex),f=shader(GLES20.GL_FRAGMENT_SHADER,fragment),p=GLES20.glCreateProgram();GLES20.glAttachShader(p,v);GLES20.glAttachShader(p,f);GLES20.glLinkProgram(p);GLES20.glDeleteShader(v);GLES20.glDeleteShader(f);int[] ok=new int[1];GLES20.glGetProgramiv(p,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException("Shader link failed");return p;
    }
    static int texture(int target){int[] t=new int[1];GLES20.glGenTextures(1,t,0);GLES20.glBindTexture(target,t[0]);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);return t[0];}
    @Override public void onSurfaceCreated(GL10 gl,EGLConfig config){
        try{failed=false;cameraTexture=texture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES);panelTexture=texture(GLES20.GL_TEXTURE_2D);cameraProgram=program(true);panelProgram=program(false);
            Bitmap image=Bitmap.createBitmap(1024,640,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(image);c.drawColor(Color.rgb(18,27,43));Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setColor(Color.rgb(56,189,248));c.drawRect(0,0,1024,12,p);p.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));p.setTextSize(58);c.drawText("Meu espaço",64,115,p);p.setColor(Color.WHITE);p.setTextSize(36);c.drawText("Painel local",64,240,p);p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));p.setTextSize(30);c.drawText("Fixado no ambiente pelo ARCore",64,320,p);c.drawText("Executado no celular, sem navegador",64,375,p);p.setColor(Color.LTGRAY);p.setTextSize(25);c.drawText("Monitores do PC ainda em desenvolvimento",64,540,p);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,image,0);image.recycle();
        }catch(RuntimeException e){failed=true;activity.message("Falha ao preparar os gráficos. Feche e reabra o AR.");}
    }
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){width=w;height=h;GLES20.glViewport(0,0,w,h);}
    void draw(int program,int texture,int target,FloatBuffer coordinates,float[] matrix){
        GLES20.glUseProgram(program);int p=GLES20.glGetAttribLocation(program,"p"),t=GLES20.glGetAttribLocation(program,"t");quad.position(0);coordinates.position(0);GLES20.glVertexAttribPointer(p,2,GLES20.GL_FLOAT,false,0,quad);GLES20.glVertexAttribPointer(t,2,GLES20.GL_FLOAT,false,0,coordinates);GLES20.glEnableVertexAttribArray(p);GLES20.glEnableVertexAttribArray(t);GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(program,"m"),1,false,matrix,0);GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(target,texture);GLES20.glUniform1i(GLES20.glGetUniformLocation(program,"tex"),0);GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);GLES20.glDisableVertexAttribArray(p);GLES20.glDisableVertexAttribArray(t);
    }
    @Override public void onDrawFrame(GL10 gl){
        GLES20.glClearColor(.07f,.1f,.16f,1);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);Session s=activity.session;if(s==null||!activity.active||failed)return;
        try{
            s.setDisplayGeometry(activity.getWindowManager().getDefaultDisplay().getRotation(),width,height);s.setCameraTextureName(cameraTexture);Frame frame=s.update();com.google.ar.core.Camera camera=frame.getCamera();
            if(frame.getTimestamp()!=0){quad.position(0);cameraUv.position(0);frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,quad,Coordinates2d.TEXTURE_NORMALIZED,cameraUv);GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);draw(cameraProgram,cameraTexture,GLES11Ext.GL_TEXTURE_EXTERNAL_OES,cameraUv,identity);GLES20.glDepthMask(true);}
            boolean tracking=camera.getTrackingState()==TrackingState.TRACKING;
            String markerText=reference.update(frame,s);
            HitResult hit=null;if(tracking)for(HitResult h:frame.hitTest(width*.5f,height*.5f)){if(h.getTrackable() instanceof Plane&&((Plane)h.getTrackable()).isPoseInPolygon(h.getHitPose())){hit=h;break;}}
            if(placeRequested.getAndSet(false)){Pose markerPose=reference.panelPose();if(!tracking||(markerPose==null&&hit==null))notice("Mire uma superfície ou defina a referência impressa.");else if(panels.size()>=24)notice("Limite desta versão: 24 painéis. Remova um para continuar.");else{Pose pose=markerPose!=null?markerPose:new Pose(hit.getHitPose().getTranslation(),camera.getDisplayOrientedPose().getRotationQuaternion());panels.add(new Panel(s.createAnchor(pose)));notice(markerPose!=null?"Painel fixado 10 cm à frente do marcador.":"Painel fixado na superfície.");}}
            if(tracking){camera.getProjectionMatrix(projection,0,.05f,100f);camera.getViewMatrix(view,0);Matrix.multiplyMM(pv,0,projection,0,view,0);GLES20.glEnable(GLES20.GL_DEPTH_TEST);
                for(Panel panel:panels)if(panel.anchor.getTrackingState()==TrackingState.TRACKING){panel.anchor.getPose().toMatrix(model,0);Matrix.scaleM(model,0,panel.size*.5f,panel.size*.3125f,1);Matrix.multiplyMM(mvp,0,pv,0,model,0);draw(panelProgram,panelTexture,GLES20.GL_TEXTURE_2D,uv,mvp);}
            }
            long now=android.os.SystemClock.uptimeMillis();if(now-lastMessage>500){lastMessage=now;activity.publishRemote(markerText);activity.runOnUiThread(()->activity.measurements.setText(markerText));activity.message(now<eventUntil?event:!tracking?"Rastreamento pausado: "+camera.getTrackingFailureReason()+". Mova devagar em um local iluminado.":(hit==null?"Mire uma superfície com a cruz central.":"Superfície encontrada. Toque em Fixar painel.")+" • "+panels.size()+" painéis");}
        }catch(com.google.ar.core.exceptions.CameraNotAvailableException e){failed=true;activity.message("Câmera indisponível. Feche outros aplicativos de câmera e reabra o AR.");}catch(RuntimeException e){failed=true;activity.message("Falha na sessão AR: "+e.getClass().getSimpleName()+". Saia e tente novamente.");}
    }
    void notice(String text){event=text;eventUntil=android.os.SystemClock.uptimeMillis()+2500;}
    void removeLast(){if(!panels.isEmpty()){panels.remove(panels.size()-1).anchor.detach();notice("Último painel removido.");}}
    void resize(float factor){if(!panels.isEmpty()){Panel p=panels.get(panels.size()-1);p.size=Math.max(.2f,Math.min(3f,p.size*factor));notice("Tamanho do último painel ajustado.");}}
}
