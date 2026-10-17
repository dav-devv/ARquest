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
    final NativeHands handTracker;
    final AtomicBoolean placeRequested=new AtomicBoolean();
    final ArrayList<Panel> panels=new ArrayList<>();
    final ArrayList<NativeWorkspaceStore.SavedSurface> mappedSurfaces=new ArrayList<>();
    final ArrayList<float[]> depthWorldPoints=new ArrayList<>();
    volatile boolean mappingEnabled;volatile float depthCoverage=-1;long lastMapCapture,lastDepthRead,lastMapSave;
    static class Panel { final String id,name;Anchor anchor;Pose savedPose,dragPose;float size=.65f;int texture,appearance=-1;Pose renderedPose;long lastTracked;boolean originFiltering;final WindowMotion.Filter positionFilter=new WindowMotion.Filter();Panel(String id,String name,Anchor a){this.id=id;this.name=name;anchor=a;} }
    final FloatBuffer quad=buffer(-1,-1,1,-1,-1,1,1,1),uv=buffer(0,1,1,1,0,0,1,0),cameraUv=buffer(0,0,0,0,0,0,0,0);
    final float[] projection=new float[16],view=new float[16],model=new float[16],pv=new float[16],mvp=new float[16],identity=new float[16];
    int calibrationTexture,calibrationWidth,calibrationHeight;volatile int vrCalibration,vrEye,cameraFocus;volatile float stereoBalancePx,cameraContrast=100;volatile String cameraResolution="";
    int cameraTexture,cameraProgram,panelProgram,width=1,height=1,panelSerial;String selectedPanelId="";
    volatile boolean stereo;volatile float stereoIpdMm=64,stereoConvergencePx=0,stereoVerticalPx=0,cameraSharpness=25,cameraTexelX=1f/1920f,cameraTexelY=1f/1080f;private volatile float[] cameraFacingRotation={0,0,0,1};private final HashMap<String,Boolean> pinchWasClosed=new HashMap<>();
    private final HashSet<String> armedHands=new HashSet<>();
    private final WindowMotion.Capture grabCapture=new WindowMotion.Capture();
    private final float[] viewerPosition=new float[3];private final ArrayList<Panel> drawOrder=new ArrayList<>();
    private Panel dragPanel,resizePanel;private String resizeA,resizeB;private long lastGestureSample,lastHandUi,grabStarted,lastResizeSeen,trackingLostAt;
    private final WindowMotion.Filter dragPointFilter=new WindowMotion.Filter();
    private final HandProjection.Resize resizeGesture=new HandProjection.Resize();
    private float[] resizePlanePoint,resizePlaneNormal;
    private float dragLocalX,dragLocalY,grabU,grabV;private boolean closeGrab,closeMoved;
    private float[] dragPlanePoint,dragPlaneNormal,dragRotation,dragRayOffset;private int cursorTexture;
    private float[][] cursorPoints;private boolean[] cursorPinching;private long cursorTime;

    volatile boolean pendingWorkspaceSave;
    volatile boolean placementPending;private long placementRequestedAt,planeStableSince;private int planeStableFrames;private Pose previousPlanePose;private float previousPlaneArea;
    void releasePanelTextures(){for(Panel panel:panels)if(panel.texture!=0){GLES20.glDeleteTextures(1,new int[]{panel.texture},0);panel.texture=0;}}
    long lastMessage,eventUntil,fpsWindowStart;int fpsWindowFrames;volatile int fps;volatile boolean tracking;volatile String trackingFailure="UNKNOWN";String event="";volatile boolean failed,graphicsReady;
    volatile String handControlStatus="Aguardando uma mão aberta.";
    NativeRenderer(NativeArActivity a){activity=a;handTracker=new NativeHands(a);NativeWorkspaceStore.Snapshot saved=NativeWorkspaceStore.load(a);reference.detector.side=saved.markerSide;boolean restore=saved.originConfigured||!saved.panels.isEmpty()||!saved.surfaces.isEmpty();reference.savedOriginConfigured=restore;reference.restoreRequested=restore;selectedPanelId=saved.selected;mappedSurfaces.addAll(saved.surfaces);for(NativeWorkspaceStore.SavedPanel savedPanel:saved.panels){Panel panel=new Panel(savedPanel.id,savedPanel.name,null);panel.size=savedPanel.size;panel.savedPose=savedPanel.pose;panels.add(panel);try{panelSerial=Math.max(panelSerial,Integer.parseInt(savedPanel.id.substring(1)));}catch(Exception ignored){}}Matrix.setIdentityM(identity,0);}
    static FloatBuffer buffer(float... values){FloatBuffer b=ByteBuffer.allocateDirect(values.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(values).position(0);return b;}
    void drawCameraBackground(float shiftX,float shiftY){GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);draw(cameraProgram,cameraTexture,GLES11Ext.GL_TEXTURE_EXTERNAL_OES,cameraUv,identity,shiftX,shiftY);GLES20.glDepthMask(true);GLES20.glEnable(GLES20.GL_DEPTH_TEST);}
    float eyeShiftX(boolean right){return VrOptics.shiftX(stereoConvergencePx,right?width-width/2:width/2,right);}
    float eyeShiftY(boolean right){return VrOptics.shiftY(stereoVerticalPx,stereoBalancePx,height,right);}
    boolean showEye(boolean right){return vrEye==0||vrEye==(right?2:1);}
    void drawStereoCamera(){for(int i=0;i<2;i++){boolean right=i==1;if(!showEye(right))continue;int w=right?width-width/2:width/2;GLES20.glViewport(right?width/2:0,0,w,height);drawCameraBackground(eyeShiftX(right),eyeShiftY(right));}GLES20.glViewport(0,0,width,height);}
    void drawCalibration(){
        int w=Math.max(1,width/2),h=Math.max(1,height);
        if(calibrationTexture==0||calibrationWidth!=w||calibrationHeight!=h){
            if(calibrationTexture!=0)GLES20.glDeleteTextures(1,new int[]{calibrationTexture},0);
            Bitmap image=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(image);c.drawColor(Color.rgb(12,16,22));Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);float cx=w*.5f,cy=h*.5f,unit=Math.min(w,h);
            p.setColor(Color.rgb(48,61,77));p.setStrokeWidth(1);for(int x=0;x<w;x+=80)c.drawLine(x,0,x,h,p);for(int y=0;y<h;y+=80)c.drawLine(0,y,w,y,p);
            p.setColor(Color.WHITE);p.setStrokeWidth(2);c.drawLine(cx-unit*.12f,cy,cx+unit*.12f,cy,p);c.drawLine(cx,cy-unit*.12f,cx,cy+unit*.12f,p);p.setStyle(Paint.Style.STROKE);c.drawCircle(cx,cy,unit*.14f,p);p.setStyle(Paint.Style.FILL);p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));
            int[] sizes={48,32,24,18};for(int i=0;i<sizes.length;i++){p.setTextSize(sizes[i]);c.drawText("ARquest 12345 ABCDE",cx,cy+unit*.22f+i*58,p);}
            p.setTextSize(24);c.drawText("CALIBRACAO VR BOX",cx,cy-unit*.25f,p);
            p.setAntiAlias(false);for(int row=0;row<3;row++){int line=1<<row;for(int x=(int)(cx-100);x<cx+100;x+=line*2)c.drawRect(x,cy-unit*.22f+row*18,x+line,cy-unit*.22f+row*18+12,p);}
            calibrationTexture=texture(GLES20.GL_TEXTURE_2D);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,image,0);image.recycle();calibrationWidth=w;calibrationHeight=h;
        }
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);
        for(int i=0;i<2;i++){boolean right=i==1;if(!showEye(right))continue;GLES20.glViewport(right?width/2:0,0,right?width-width/2:width/2,height);draw(panelProgram,calibrationTexture,GLES20.GL_TEXTURE_2D,uv,identity,eyeShiftX(right),eyeShiftY(right));}
        GLES20.glViewport(0,0,width,height);GLES20.glDepthMask(true);GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
    void buildEyeView(float eye,float[] out){float[] offset=new float[16];Matrix.setIdentityM(offset,0);Matrix.translateM(offset,0,-eye,0,0);Matrix.multiplyMM(out,0,offset,0,view,0);}
    void updatePanelPoses(Pose camera,long now){
        float[] viewer=camera.getTranslation();System.arraycopy(viewer,0,viewerPosition,0,3);Pose origin=reference.originPose();
        for(Panel panel:panels){
            if(panel.dragPose!=null){panel.renderedPose=panel.dragPose;panel.lastTracked=now;continue;}
            if(panel.anchor!=null&&panel.anchor.getTrackingState()==TrackingState.TRACKING){
                Pose raw=panel.anchor.getPose();boolean relative=origin!=null;if(panel.originFiltering!=relative){panel.positionFilter.reset();panel.originFiltering=relative;}
                float[] sample=relative?origin.inverse().transformPoint(raw.getTranslation()):raw.getTranslation();
                float[] filtered=panel.positionFilter.update(sample,now),position=relative?origin.transformPoint(filtered):filtered;
                panel.renderedPose=new Pose(position,WindowMotion.facing(position,viewer));panel.lastTracked=now;
            }else if(now-panel.lastTracked>180)panel.renderedPose=null;
        }
        drawOrder.clear();for(Panel panel:panels)if(panel.renderedPose!=null)drawOrder.add(panel);
        Collections.sort(drawOrder,(a,b)->Float.compare(WindowMotion.distance(b.renderedPose.getTranslation(),viewerPosition),WindowMotion.distance(a.renderedPose.getTranslation(),viewerPosition)));
    }
    Pose panelPose(Panel panel){return panel.renderedPose;}
    void drawPanelSet(float[] eyeView,float shiftX,float shiftY){
        Matrix.multiplyMM(pv,0,projection,0,eyeView,0);GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_ONE,GLES20.GL_ONE_MINUS_SRC_ALPHA);
        for(Panel panel:drawOrder){Pose pose=panelPose(panel);if(pose==null)continue;int appearance=(panel.id.equals(selectedPanelId)?1:0)|(panel==dragPanel&&!closeGrab?2:0);if(panel.texture==0||panel.appearance!=appearance)createPanelTexture(panel);
            pose.toMatrix(model,0);Matrix.scaleM(model,0,panel.size*.5f,panel.size*.3125f,1);Matrix.multiplyMM(mvp,0,pv,0,model,0);draw(panelProgram,panel.texture,GLES20.GL_TEXTURE_2D,uv,mvp,shiftX,shiftY);
        }GLES20.glDisable(GLES20.GL_BLEND);GLES20.glDepthMask(true);
    }
    void drawPanels(){if(!stereo){GLES20.glViewport(0,0,width,height);drawPanelSet(view,0,0);return;}float[] eyeView=new float[16];for(int i=0;i<2;i++){boolean right=i==1;if(!showEye(right))continue;GLES20.glViewport(right?width/2:0,0,right?width-width/2:width/2,height);buildEyeView((right?1:-1)*stereoIpdMm*.0005f,eyeView);drawPanelSet(eyeView,eyeShiftX(right),eyeShiftY(right));}GLES20.glViewport(0,0,width,height);}
    static final class PanelHit {final Panel panel;final float u,v,localX,localY;final int corner;PanelHit(Panel panel,float u,float v,float localX,float localY,int corner){this.panel=panel;this.u=u;this.v=v;this.localX=localX;this.localY=localY;this.corner=corner;}}
    static float pointSegmentDistance(float x,float y,float ax,float ay,float bx,float by){float dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len>1e-4f?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/len)):0;return (float)Math.hypot(x-(ax+t*dx),y-(ay+t*dy));}
    static boolean insideQuad(float x,float y,float[] p){boolean inside=false;for(int i=0,j=3;i<4;j=i++){float xi=p[i*2],yi=p[i*2+1],xj=p[j*2],yj=p[j*2+1];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
    static boolean triangleWeights(float x,float y,float[] p,int a,int b,int c,float[] w){float ax=p[a*2],ay=p[a*2+1],bx=p[b*2],by=p[b*2+1],cx=p[c*2],cy=p[c*2+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-4f)return false;w[0]=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den;w[1]=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den;w[2]=1-w[0]-w[1];return w[0]>=-.01f&&w[1]>=-.01f&&w[2]>=-.01f;}
    PanelHit panelAt(float x,float y,int viewportX,int viewportWidth,float[] eyeView,float shiftX,float shiftY){PanelHit best=null;float bestDepth=Float.POSITIVE_INFINITY;float[] eyePv=new float[16],world=new float[16],clip=new float[4];Matrix.multiplyMM(eyePv,0,projection,0,eyeView,0);for(Panel panel:panels){Pose pose=panelPose(panel);if(pose==null||panel.anchor==null||panel.anchor.getTrackingState()!=TrackingState.TRACKING)continue;pose.toMatrix(world,0);Matrix.scaleM(world,0,panel.size*.5f,panel.size*.3125f,1);float[] projected=new float[8],inverseW=new float[4];float depth=Float.POSITIVE_INFINITY;boolean visible=true;float[] corners={-1,-1,0,1,1,-1,0,1,1,1,0,1,-1,1,0,1};for(int i=0;i<4;i++){float[] point={corners[i*4],corners[i*4+1],0,1},w=new float[4];Matrix.multiplyMV(w,0,world,0,point,0);Matrix.multiplyMV(clip,0,eyePv,0,w,0);if(clip[3]<=.01f){visible=false;break;}inverseW[i]=1f/clip[3];projected[i*2]=viewportX+(clip[0]/clip[3]+1+shiftX)*.5f*viewportWidth;projected[i*2+1]=(1-(clip[1]/clip[3]+shiftY))*.5f*height;depth=Math.min(depth,clip[2]/clip[3]);}if(!visible||depth>=bestDepth)continue;float[] center={(projected[0]+projected[2]+projected[4]+projected[6])*.25f,(projected[1]+projected[3]+projected[5]+projected[7])*.25f};float diag=(float)Math.hypot(projected[0]-projected[4],projected[1]-projected[5]);float cornerRadius=Math.max(48f,Math.min(112f,diag*.24f));int corner=-1;float nearest=cornerRadius;for(int i=0;i<4;i++){float d=(float)Math.hypot(x-projected[i*2],y-projected[i*2+1]);if(d<nearest){nearest=d;corner=i;}}boolean inside=insideQuad(x,y,projected);if(!inside&&corner<0)continue;float[] weights=new float[3];int a=0,b=1,c=2;if(!triangleWeights(x,y,projected,a,b,c,weights)){a=0;b=2;c=3;if(!triangleWeights(x,y,projected,a,b,c,weights)){if(corner<0)continue;weights[0]=1;weights[1]=weights[2]=0;a=corner;b=corner;c=corner;}}float lx=0,ly=0;int[] indices={a,b,c};if(!WindowMotion.perspectiveWeights(weights,inverseW,indices))continue;float[] localX={-panel.size*.5f,panel.size*.5f,panel.size*.5f,-panel.size*.5f},localY={-panel.size*.3125f,-panel.size*.3125f,panel.size*.3125f,panel.size*.3125f};for(int k=0;k<3;k++){lx+=weights[k]*localX[indices[k]];ly+=weights[k]*localY[indices[k]];}float u=lx/panel.size+.5f,v=ly/(panel.size*.625f)+.5f;if(!PanelAppearance.isSurface(u,v)&&!PanelAppearance.isGrab(u,v)&&PanelAppearance.cornerAt(u,v)<0)continue;best=new PanelHit(panel,u,v,lx,ly,corner);bestDepth=depth;}return best;}
    HandProjection.Ray capturedRay(NativeHands.Hand hand,NativeHands.Snapshot snapshot){
        NativeHands.Capture capture=hand.capture!=null?hand.capture:snapshot.capture;if(capture==null||!capture.tracking||!capture.synchronizedImage())return null;
        return HandProjection.ray(capture.translation,capture.rotation,capture.fx,capture.fy,capture.cx,capture.cy,capture.width,capture.height,hand.imageIndexX,hand.imageIndexY);
    }
    PanelHit panelAlongRay(HandProjection.Ray ray){
        if(ray==null)return null;PanelHit best=null;float nearest=Float.POSITIVE_INFINITY;
        for(Panel panel:panels){Pose pose=panelPose(panel);if(pose==null||panel.anchor==null||panel.anchor.getTrackingState()!=TrackingState.TRACKING)continue;
            float[] normal=pose.rotateVector(new float[]{0,0,1}),point=WindowMotion.rayPlane(ray.origin,ray.direction,pose.getTranslation(),normal);if(point==null)continue;
            float distance=WindowMotion.distance(ray.origin,point);if(distance>=nearest)continue;float[] local=pose.inverse().transformPoint(point);float u=local[0]/panel.size+.5f,v=local[1]/(panel.size*.625f)+.5f;
            if(!PanelAppearance.isSurface(u,v)&&!PanelAppearance.isGrab(u,v)&&PanelAppearance.cornerAt(u,v)<0)continue;
            best=new PanelHit(panel,u,v,local[0],local[1],PanelAppearance.cornerAt(u,v));nearest=distance;
        }return best;
    }
    float[] onGrabPlane(HandProjection.Ray ray){return ray==null?null:WindowMotion.rayPlane(ray.origin,ray.direction,dragPlanePoint,dragPlaneNormal);}
    float resizeSpan(HandProjection.Ray a,HandProjection.Ray b){
        if(a==null||b==null||resizePlanePoint==null)return -1;float[] pa=WindowMotion.rayPlane(a.origin,a.direction,resizePlanePoint,resizePlaneNormal),pb=WindowMotion.rayPlane(b.origin,b.direction,resizePlanePoint,resizePlaneNormal);return pa==null||pb==null?-1:WindowMotion.distance(pa,pb);
    }
    void beginGrab(PanelHit hit,NativeHands.Hand hand,HandProjection.Ray ray,long sample){
        Pose pose=panelPose(hit.panel);if(pose==null||ray==null)return;selectedPanelId=hit.panel.id;activity.updatePanelControls();
        dragPointFilter.reset();dragPointFilter.update(pose.getTranslation(),sample);dragPanel=hit.panel;closeGrab=PanelAppearance.isClose(hit.u,hit.v);closeMoved=false;grabU=hit.u;grabV=hit.v;grabStarted=sample;dragLocalX=hit.localX;dragLocalY=hit.localY;
        dragRotation=pose.getRotationQuaternion();dragPlanePoint=pose.transformPoint(new float[]{hit.localX,hit.localY,0});dragPlaneNormal=pose.rotateVector(new float[]{0,0,1});
        float[] point=onGrabPlane(ray);dragRayOffset=point==null?new float[3]:new float[]{dragPlanePoint[0]-point[0],dragPlanePoint[1]-point[1],dragPlanePoint[2]-point[2]};
        grabCapture.begin(hand.side,sample);notice(closeGrab?"Solte a pinça sobre o botão para fechar.":"Janela presa à sua mão. Arraste e solte para fixar.");
    }
    void updateHandControl(Frame frame,long now){
        NativeHands.Snapshot snapshot=handTracker.latest;
        if(!activity.handsEnabled){if(dragPanel!=null)finishDrag(false);finishResize();cursorPoints=null;handControlStatus="Rastreamento de mãos desligado.";return;}
        if(grabCapture.lost(now)){finishDrag(true);handControlStatus="Pinça encerrada após perda da mão.";}
        if(resizePanel!=null&&now-lastResizeSeen>750)finishResize();
        if(now-snapshot.time>350||snapshot.hands.isEmpty()){cursorPoints=null;handControlStatus=dragPanel==null?"Mostre a mão à câmera.":"Mão temporariamente oculta; janela permanece selecionada.";return;}
        if(snapshot.time==lastGestureSample)return;lastGestureSample=snapshot.time;
        int n=snapshot.hands.size();FloatBuffer source=buffer(new float[n*42]),dest=buffer(new float[n*42]);source.clear();for(NativeHands.Hand hand:snapshot.hands)for(int i=0;i<21;i++)source.put(hand.x[i]).put(hand.y[i]);source.position(0);frame.transformCoordinates2d(Coordinates2d.IMAGE_NORMALIZED,source,Coordinates2d.VIEW,dest);dest.position(0);
        // The optional 2D skeleton is diagnostic. Selection and movement use world rays below.
        float[][] points=new float[n][42],cursorWorld=new float[n][3];boolean[] pinching=new boolean[n];PanelHit[] hits=new PanelHit[n];HandProjection.Ray[] rays=new HandProjection.Ray[n];NativeHands.Capture[] captures=new NativeHands.Capture[n];
        for(int h=0;h<n;h++){for(int i=0;i<42;i++)points[h][i]=dest.get();NativeHands.Hand hand=snapshot.hands.get(h);pinching[h]=hand.pinching;rays[h]=capturedRay(hand,snapshot);captures[h]=hand.capture!=null?hand.capture:snapshot.capture;hits[h]=hand.observed?panelAlongRay(rays[h]):null;
            if(rays[h]!=null){float[] point=null;if(dragPanel!=null&&hand.side.equals(grabCapture.owner))point=onGrabPlane(rays[h]);if(point==null&&hits[h]!=null){Pose pose=panelPose(hits[h].panel);point=pose.transformPoint(new float[]{hits[h].localX,hits[h].localY,0});}cursorWorld[h]=point!=null?point:rays[h].at(.75f);}else cursorWorld[h]=null;
        }
        cursorPoints=cursorWorld;cursorPinching=pinching;cursorTime=snapshot.time;if(now-lastHandUi>=65){lastHandUi=now;activity.updateHands(points,pinching,stereo);}
        // A resize owns two identities and survives the fingers leaving the panel rectangle.
        if(resizePanel!=null){int a=-1,b=-1;for(int i=0;i<n;i++){String side=snapshot.hands.get(i).side;if(side.equals(resizeA))a=i;if(side.equals(resizeB))b=i;}
            if(a>=0&&b>=0&&snapshot.hands.get(a).observed&&snapshot.hands.get(b).observed){if(!pinching[a]||!pinching[b])finishResize();else{lastResizeSeen=now;float span=resizeSpan(rays[a],rays[b]);if(span>=.02f&&captures[a]!=null)resizePanel.size=resizeGesture.update(span,captures[a].translation,captures[a].rotation,snapshot.time);handControlStatus=resizeGesture.settling()?"Tamanho mantido enquanto o celular se move; estabilize para continuar.":"Dimensionando com as duas mãos; solte para salvar.";}}
            rememberPinches(snapshot);return;
        }
        if(n==2&&pinching[0]&&pinching[1]&&armedHands.contains(snapshot.hands.get(0).side)&&armedHands.contains(snapshot.hands.get(1).side)&&snapshot.hands.get(0).observed&&snapshot.hands.get(1).observed&&hits[0]!=null&&hits[1]!=null&&hits[0].panel==hits[1].panel&&!PanelAppearance.isClose(hits[0].u,hits[0].v)&&!PanelAppearance.isClose(hits[1].u,hits[1].v)){
            Panel target=hits[0].panel;Pose pose=panelPose(target);resizePlanePoint=pose.getTranslation();resizePlaneNormal=pose.rotateVector(new float[]{0,0,1});float span=resizeSpan(rays[0],rays[1]);if(span>=.02f&&captures[0]!=null){if(dragPanel!=null)finishDrag(false);resizePanel=target;resizeA=snapshot.hands.get(0).side;resizeB=snapshot.hands.get(1).side;resizeGesture.begin(span,target.size,captures[0].translation,captures[0].rotation,snapshot.time);lastResizeSeen=now;selectedPanelId=target.id;rememberPinches(snapshot);return;}
        }
        if(dragPanel!=null){
            int owner=-1;for(int i=0;i<n;i++)if(snapshot.hands.get(i).side.equals(grabCapture.owner)){owner=i;break;}
            if(owner<0||!snapshot.hands.get(owner).observed){handControlStatus="Retomando a mão que segura a janela.";rememberPinches(snapshot);return;}
            NativeHands.Hand hand=snapshot.hands.get(owner);if(closeGrab&&(hits[owner]==null||Math.hypot(hits[owner].u-grabU,hits[owner].v-grabV)>.06))closeMoved=true;
            if(grabCapture.observe(hand.side,snapshot.time,hand.pinching,true)){
                Panel closing=dragPanel;boolean close=closeGrab&&!closeMoved&&snapshot.time-grabStarted<1800&&hits[owner]!=null&&hits[owner].panel==closing&&PanelAppearance.isClose(hits[owner].u,hits[owner].v);finishDrag(false);if(close)removePanel(closing);
            }else if(hand.pinching&&!closeGrab){float[] point=onGrabPlane(rays[owner]);if(point!=null){float[] offset=new Pose(new float[3],dragRotation).rotateVector(new float[]{dragLocalX,dragLocalY,0});float[] target={point[0]+dragRayOffset[0]-offset[0],point[1]+dragRayOffset[1]-offset[1],point[2]+dragRayOffset[2]-offset[2]};dragPanel.dragPose=new Pose(dragPointFilter.update(target,snapshot.time),dragRotation);dragPanel.renderedPose=dragPanel.dragPose;handControlStatus="Movendo "+dragPanel.name+"; solte para fixar.";}}
        }else{
            handControlStatus="Mão rastreada. Faça pinça na janela ou na barra inferior.";
            for(int i=0;i<n;i++){NativeHands.Hand hand=snapshot.hands.get(i);if(hand.observed&&armedHands.contains(hand.side)&&hand.pinching&&!pinchWasClosed.getOrDefault(hand.side,false)&&hits[i]!=null){beginGrab(hits[i],hand,rays[i],snapshot.time);break;}}
        }
        rememberPinches(snapshot);
    }
    void rememberPinches(NativeHands.Snapshot snapshot){HashSet<String> present=new HashSet<>();for(NativeHands.Hand h:snapshot.hands){present.add(h.side);if(h.observed){pinchWasClosed.put(h.side,h.pinching);if(!h.pinching)armedHands.add(h.side);}}pinchWasClosed.keySet().retainAll(present);armedHands.retainAll(present);}
    void finishResize(){if(resizePanel!=null){resizePanel=null;resizeA=resizeB=null;activity.saveWorkspace();}}
    void finishDrag(boolean handLost){
        Panel moving=dragPanel;if(moving!=null&&moving.dragPose!=null&&activity.session!=null){try{Anchor next=activity.session.createAnchor(moving.dragPose);if(moving.anchor!=null)moving.anchor.detach();moving.anchor=next;moving.dragPose=null;moving.savedPose=null;moving.positionFilter.reset();notice(moving.name+" fixado no novo ponto.");}catch(RuntimeException e){moving.dragPose=null;moving.positionFilter.reset();notice("Rastreamento insuficiente; mantida a posição anterior.");}}
        dragPanel=null;closeGrab=false;grabCapture.clear();if(moving!=null)activity.saveWorkspace();
    }
    void suspendInteractions(long now){cursorPoints=null;if(trackingLostAt==0)trackingLostAt=now;if(now-trackingLostAt>350&&dragPanel!=null){dragPanel.dragPose=null;dragPanel.positionFilter.reset();dragPanel=null;grabCapture.clear();handControlStatus="Interação pausada até recuperar o rastreamento do celular.";}if(resizePanel!=null)finishResize();}
    void drawHandCursors(long now){
        if(cursorPoints==null||now-cursorTime>250)return;if(cursorTexture==0){Bitmap b=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);Paint p=new Paint(3);p.setColor(0xffffffff);p.setStrokeWidth(4);p.setStyle(Paint.Style.STROKE);c.drawCircle(32,32,21,p);p.setStyle(Paint.Style.FILL);c.drawCircle(32,32,4,p);cursorTexture=texture(GLES20.GL_TEXTURE_2D);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,b,0);b.recycle();}
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_ONE,GLES20.GL_ONE_MINUS_SRC_ALPHA);
        int count=stereo?2:1;for(int e=0;e<count;e++){boolean right=e==1;if(stereo&&!showEye(right))continue;int ew=stereo?(right?width-width/2:width/2):width;GLES20.glViewport(right?width/2:0,0,ew,height);float[] eyeView=new float[16],eyePv=new float[16];if(stereo)buildEyeView((right?1:-1)*stereoIpdMm*.0005f,eyeView);else System.arraycopy(view,0,eyeView,0,16);Matrix.multiplyMM(eyePv,0,projection,0,eyeView,0);for(int h=0;h<cursorPoints.length;h++){if(cursorPoints[h]==null)continue;float[] clip=new float[4],world=cursorPoints[h],t=new float[16];Matrix.multiplyMV(clip,0,eyePv,0,new float[]{world[0],world[1],world[2],1},0);if(clip[3]<=.01f)continue;Matrix.setIdentityM(t,0);float x=clip[0]/clip[3],y=clip[1]/clip[3];Matrix.translateM(t,0,x+(stereo?eyeShiftX(right):0),y+(stereo?eyeShiftY(right):0),0);float radius=cursorPinching[h]?12:17;Matrix.scaleM(t,0,radius*2/ew,radius*2/height,1);draw(panelProgram,cursorTexture,GLES20.GL_TEXTURE_2D,uv,t,0,0);}}
        GLES20.glViewport(0,0,width,height);GLES20.glDisable(GLES20.GL_BLEND);GLES20.glDepthMask(true);GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
    private static float distance(float[] a,float[] b){return (float)Math.hypot(a[0]-b[0],a[1]-b[1]);}
    static int shader(int type,String code){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,code);GLES20.glCompileShader(s);int[] ok=new int[1];GLES20.glGetShaderiv(s,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException(GLES20.glGetShaderInfoLog(s));return s;}
    static int program(boolean external){
        String vertex="attribute vec2 p;attribute vec2 t;uniform mat4 m;uniform vec2 offset;varying vec2 uv;void main(){uv=t;vec4 clip=m*vec4(p,0.,1.);clip.xy+=offset*clip.w;gl_Position=clip;}";
        String fragment=(external?"#extension GL_OES_EGL_image_external : require\n":"")+"precision mediump float;varying vec2 uv;uniform "+(external?"samplerExternalOES":"sampler2D")+" tex;"+(external?"uniform vec2 texel;uniform float sharpness;uniform float contrast;":"")+"void main(){"+(external?"vec4 center=texture2D(tex,uv);vec3 neighbors=texture2D(tex,uv+vec2(texel.x,0.0)).rgb+texture2D(tex,uv-vec2(texel.x,0.0)).rgb+texture2D(tex,uv+vec2(0.0,texel.y)).rgb+texture2D(tex,uv-vec2(0.0,texel.y)).rgb;vec3 detail=clamp(center.rgb-neighbors*.25,vec3(-.06),vec3(.06));vec3 crisp=clamp((center.rgb+detail*sharpness-.5)*contrast+.5,0.0,1.0);gl_FragColor=vec4(crisp,center.a);":"vec4 color=texture2D(tex,uv);if(color.a<.01)discard;gl_FragColor=color;")+"}";
        int v=shader(GLES20.GL_VERTEX_SHADER,vertex),f=shader(GLES20.GL_FRAGMENT_SHADER,fragment),p=GLES20.glCreateProgram();GLES20.glAttachShader(p,v);GLES20.glAttachShader(p,f);GLES20.glLinkProgram(p);GLES20.glDeleteShader(v);GLES20.glDeleteShader(f);int[] ok=new int[1];GLES20.glGetProgramiv(p,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new IllegalStateException("Shader link failed");return p;
    }
    static int texture(int target){int[] t=new int[1];GLES20.glGenTextures(1,t,0);GLES20.glBindTexture(target,t[0]);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);return t[0];}
    void createPanelTexture(Panel panel){boolean selected=panel.id.equals(selectedPanelId),dragging=panel==dragPanel&&!closeGrab;Bitmap image=PanelAppearance.render(panel.name,selected,dragging);if(panel.texture==0){panel.texture=texture(GLES20.GL_TEXTURE_2D);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,image,0);}else{GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,panel.texture);GLUtils.texSubImage2D(GLES20.GL_TEXTURE_2D,0,0,0,image);}image.recycle();panel.appearance=(selected?1:0)|(dragging?2:0);}
    @Override public void onSurfaceCreated(GL10 gl,EGLConfig config){
        try{failed=false;graphicsReady=false;calibrationTexture=0;cursorTexture=0;releasePanelTextures();cameraTexture=texture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES);cameraProgram=program(true);panelProgram=program(false);for(Panel panel:panels)createPanelTexture(panel);graphicsReady=true;
        }catch(RuntimeException e){failed=true;activity.message("Falha ao preparar os gráficos. Feche e reabra o AR.");}
    }
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){width=w;height=h;GLES20.glViewport(0,0,w,h);}
    void draw(int program,int texture,int target,FloatBuffer coordinates,float[] matrix,float shiftX,float shiftY){
        GLES20.glUseProgram(program);int p=GLES20.glGetAttribLocation(program,"p"),t=GLES20.glGetAttribLocation(program,"t");quad.position(0);coordinates.position(0);GLES20.glVertexAttribPointer(p,2,GLES20.GL_FLOAT,false,0,quad);GLES20.glVertexAttribPointer(t,2,GLES20.GL_FLOAT,false,0,coordinates);GLES20.glEnableVertexAttribArray(p);GLES20.glEnableVertexAttribArray(t);GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(program,"m"),1,false,matrix,0);GLES20.glUniform2f(GLES20.glGetUniformLocation(program,"offset"),shiftX,shiftY);if(target==GLES11Ext.GL_TEXTURE_EXTERNAL_OES){GLES20.glUniform2f(GLES20.glGetUniformLocation(program,"texel"),cameraTexelX,cameraTexelY);GLES20.glUniform1f(GLES20.glGetUniformLocation(program,"sharpness"),cameraSharpness*.025f);GLES20.glUniform1f(GLES20.glGetUniformLocation(program,"contrast"),cameraContrast*.01f);}GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(target,texture);GLES20.glUniform1i(GLES20.glGetUniformLocation(program,"tex"),0);GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);GLES20.glDisableVertexAttribArray(p);GLES20.glDisableVertexAttribArray(t);
    }
    static int surfaceType(Plane plane){switch(plane.getType()){case HORIZONTAL_UPWARD_FACING:return 0;case VERTICAL:return 1;case HORIZONTAL_DOWNWARD_FACING:return 2;default:return -1;}}
    void updatePlacement(HitResult hit,Pose origin,boolean tracking,long now,Session session){
        if(now-placementRequestedAt>12000){placementPending=false;planeStableFrames=0;notice("Não consegui confirmar uma superfície estável. Mantenha a mira parada sobre um plano detectado e tente novamente.");return;}
        if(origin==null||reference.originConfidence<.58f){if(now-lastMessage>700)notice("Aguardando uma referência ID 100 estável e confiável antes de gravar a janela.");planeStableFrames=0;previousPlanePose=null;return;}
        if(!tracking||hit==null||!(hit.getTrackable() instanceof Plane)){planeStableFrames=0;previousPlanePose=null;return;}
        Plane plane=(Plane)hit.getTrackable();if(plane.getTrackingState()!=TrackingState.TRACKING||plane.getSubsumedBy()!=null||!plane.isPoseInPolygon(hit.getHitPose())){planeStableFrames=0;previousPlanePose=null;return;}
        Pose center=plane.getCenterPose();FloatBuffer polygon=plane.getPolygon();float area=polygon==null?0:polygonArea(copyPolygon(polygon));boolean stable=previousPlanePose!=null&&MarkerGeometry.compatible(previousPlanePose.getTranslation(),previousPlanePose.getRotationQuaternion(),center.getTranslation(),center.getRotationQuaternion())&&previousPlaneArea>0&&Math.abs(area-previousPlaneArea)/previousPlaneArea<.4f;
        if(stable){planeStableFrames++;}else{planeStableFrames=1;planeStableSince=now;}
        previousPlanePose=center;previousPlaneArea=area;
        if(planeStableFrames<8||now-planeStableSince<850)return;
        if(panels.size()>=24){placementPending=false;notice("Limite desta versão: 24 painéis. Remova um para continuar.");return;}
        Pose surfacePose=hit.getHitPose();Pose pose=new Pose(surfacePose.getTranslation(),cameraFacingRotation);Panel panel=new Panel("p"+(++panelSerial),"Painel "+panelSerial,session.createAnchor(pose));createPanelTexture(panel);panels.add(panel);selectedPanelId=panel.id;placementPending=false;activity.saveWorkspace();notice(panel.name+" criado após confirmar a referência e o plano por estabilidade temporal.");
    }
    String placementHint(){if(reference.originConfidence<.58f)return "Aguardando confiança suficiente do ID 100 antes de gravar a janela.";if(planeStableFrames==0)return "Aguardando a mira encontrar um plano detectado pelo ARCore…";return String.format(java.util.Locale.US,"Validando superfície: %d/8 quadros estáveis…",Math.min(8,planeStableFrames));}
    static float[] copyPolygon(FloatBuffer source){FloatBuffer points=source.duplicate();int n=Math.min(128,points.remaining());float[] out=new float[n];points.get(out);return out;}
    static float polygonArea(float[] points){if(points.length<6)return 0;double twice=0;int n=points.length/2;for(int i=0;i<n;i++){int j=(i+1)%n;twice+=(double)points[i*2]*points[j*2+1]-(double)points[j*2]*points[i*2+1];}return (float)(Math.abs(twice)*.5);}
    static final class DepthFit {final int inliers;final float support,offset;DepthFit(int n,float s,float o){inliers=n;support=s;offset=o;}}
    DepthFit depthFit(Plane plane,float[] polygon){if(depthWorldPoints.isEmpty())return new DepthFit(0,-1,0);Pose inverse=plane.getCenterPose().inverse();ArrayList<float[]> local=new ArrayList<>();for(float[] world:depthWorldPoints)local.add(inverse.transformPoint(world));PlaneGeometry.Fit fit=PlaneGeometry.fitDepth(local,polygon,.12f);return new DepthFit(fit.inliers,fit.support,fit.offset);}
    static boolean insidePolygon(float x,float y,float[] points){boolean inside=false;int n=points.length/2;for(int i=0,j=n-1;i<n;j=i++){float xi=points[2*i],yi=points[2*i+1],xj=points[2*j],yj=points[2*j+1];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-8f)+xi))inside=!inside;}return inside;}
    void captureMap(Session session,Pose origin,long now){if(!mappingEnabled||origin==null||now-lastMapCapture<450)return;lastMapCapture=now;Pose inverse=origin.inverse();boolean changed=false;for(Plane plane:session.getAllTrackables(Plane.class)){int type=surfaceType(plane);if(type<0||plane.getTrackingState()!=TrackingState.TRACKING||plane.getSubsumedBy()!=null)continue;FloatBuffer source=plane.getPolygon();if(source==null||source.remaining()<6)continue;FloatBuffer points=source.duplicate();int count=Math.min(128,points.remaining()/2);float[] polygon=new float[count*2];for(int i=0;i<polygon.length;i++)polygon[i]=points.get();float area=polygonArea(polygon);if(area<.015f)continue;DepthFit fit=now-lastDepthRead<2200?depthFit(plane,polygon):new DepthFit(0,-1,0);Pose refined=plane.getCenterPose();if(fit.inliers>=10&&fit.support>=.45f&&Math.abs(fit.offset)<=.06f){float correction=Math.max(-.03f,Math.min(.03f,fit.offset*.65f));refined=refined.compose(new Pose(PlaneGeometry.normalTranslation(correction),new float[]{0,0,0,1}));}Pose center=inverse.compose(refined);int match=-1;float nearest=.55f;float[] ct=center.getTranslation();for(int i=0;i<mappedSurfaces.size();i++){NativeWorkspaceStore.SavedSurface old=mappedSurfaces.get(i);if(old.type!=type)continue;float[] ot=old.pose.getTranslation();float d=(float)Math.sqrt((ct[0]-ot[0])*(ct[0]-ot[0])+(ct[1]-ot[1])*(ct[1]-ot[1])+(ct[2]-ot[2])*(ct[2]-ot[2]));if(d<nearest){nearest=d;match=i;}}int observations=1;if(match>=0)observations=Math.min(1000,mappedSurfaces.get(match).observations+1);else if(mappedSurfaces.size()>=48)continue;float support=fit.inliers>=10&&fit.support>=.45f?fit.support:-1;NativeWorkspaceStore.SavedSurface surface=new NativeWorkspaceStore.SavedSurface(type,center,polygon,area,observations,support);if(match>=0)mappedSurfaces.set(match,surface);else mappedSurfaces.add(surface);changed=true;}if(changed&&now-lastMapSave>1200){lastMapSave=now;activity.saveWorkspace();}}
    void sampleDepth(Frame frame,long now){if(!mappingEnabled||now-lastDepthRead<1200)return;lastDepthRead=now;try{android.media.Image image=frame.acquireDepthImage16Bits();try{android.media.Image.Plane plane=image.getPlanes()[0];ByteBuffer data=plane.getBuffer().duplicate().order(ByteOrder.LITTLE_ENDIAN);int width=image.getWidth(),height=image.getHeight(),row=plane.getRowStride(),pixel=plane.getPixelStride(),valid=0,total=0;CameraIntrinsics intrinsics=frame.getCamera().getImageIntrinsics();float[] focal=intrinsics.getFocalLength(),principal=intrinsics.getPrincipalPoint();int[] dims=intrinsics.getImageDimensions();float sx=width/(float)dims[0],sy=height/(float)dims[1],fx=focal[0]*sx,fy=focal[1]*sy,cx=principal[0]*sx,cy=principal[1]*sy;Pose camera=frame.getCamera().getPose();depthWorldPoints.clear();int stepX=Math.max(1,width/28),stepY=Math.max(1,height/20);for(int y=stepY;y<height-stepY;y+=stepY)for(int x=stepX;x<width-stepX;x+=stepX){int offset=y*row+x*pixel;if(offset+1>=data.limit())continue;int mm=data.getShort(offset)&0xffff;total++;if(mm==0||mm>=65000)continue;valid++;float z=mm/1000f;depthWorldPoints.add(camera.transformPoint(new float[]{(x-cx)*z/fx,-(y-cy)*z/fy,-z}));}depthCoverage=total==0?0:valid/(float)total;}finally{image.close();}}catch(Exception unavailable){depthCoverage=-1;depthWorldPoints.clear();}}
    String surfaceMap(Session session){int horizontal=0,vertical=0,downward=0,depthSupported=0;double area=0;for(NativeWorkspaceStore.SavedSurface s:mappedSurfaces){if(s.type==0)horizontal++;else if(s.type==1)vertical++;else if(s.type==2)downward++;if(s.depthCoverage>=0)depthSupported++;area+=s.area;}String depth=depthCoverage<0?"profundidade indisponível":"amostras de profundidade válidas "+Math.round(depthCoverage*100)+"%";return String.format(java.util.Locale.US,"Mapa salvo: %d superfícies · %.2f m² estimados · chão/mesas %d, paredes %d, face inferior/teto %d · %d com suporte de profundidade · %s%s",mappedSurfaces.size(),area,horizontal,vertical,downward,depthSupported,depth,mappingEnabled?" · VARREDURA ATIVA":"");}
    String mappingHint(Pose origin){if(origin==null)return "Para mapear: localize primeiro o ID 100 e inicie a varredura.";if(!mappingEnabled)return "Mapa salvo. Toque em Mapear ambiente para atualizar superfícies.";boolean horizontal=false,vertical=false;for(NativeWorkspaceStore.SavedSurface s:mappedSurfaces){if(s.type==0)horizontal=true;if(s.type==1)vertical=true;}if(!horizontal)return "Etapa 1/3 · mova devagar e mostre chão, mesas e outras superfícies horizontais.";if(!vertical)return "Etapa 2/3 · percorra o cômodo apontando a câmera para as paredes.";return "Etapa 3/3 · contornos salvos. Revise cantos e superfícies ainda não detectadas; toque em Concluir.";}
    @Override public void onDrawFrame(GL10 gl){
        GLES20.glViewport(0,0,width,height);GLES20.glClearColor(0,0,0,1);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);Session s=activity.session;if(s==null||!activity.active||failed||!graphicsReady)return;
        try{
            s.setDisplayGeometry(activity.getWindowManager().getDefaultDisplay().getRotation(),stereo?Math.max(1,width/2):width,height);s.setCameraTextureName(cameraTexture);Frame frame=s.update();com.google.ar.core.Camera camera=frame.getCamera();cameraFacingRotation=camera.getDisplayOrientedPose().getRotationQuaternion();
            if(frame.getTimestamp()!=0){quad.position(0);cameraUv.position(0);frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,quad,Coordinates2d.TEXTURE_NORMALIZED,cameraUv);if(vrCalibration==0){if(stereo)drawStereoCamera();else drawCameraBackground(0,0);}}
            boolean tracking=camera.getTrackingState()==TrackingState.TRACKING;
            this.tracking=tracking;trackingFailure=camera.getTrackingFailureReason().name();long frameTime=android.os.SystemClock.uptimeMillis();if(fpsWindowStart==0)fpsWindowStart=frameTime;fpsWindowFrames++;long fpsElapsed=frameTime-fpsWindowStart;if(fpsElapsed>=1000){fps=(int)Math.round(fpsWindowFrames*1000.0/fpsElapsed);fpsWindowFrames=0;fpsWindowStart=frameTime;}
            long now=android.os.SystemClock.uptimeMillis();boolean processHands=handTracker.wantsFrame(now);String markerText=reference.update(frame,s,!processHands);if(processHands)handTracker.submit(frame,now);Pose origin=reference.originPose();if(reference.originChanged&&origin!=null){reference.originChanged=false;Pose previous=reference.previousOrigin;if(previous!=null&&origin!=null){NativeWorkspaceStore.rebaseSurfaces(mappedSurfaces,previous,origin);Pose delta=origin.inverse().compose(previous);for(Panel panel:panels)if(panel.anchor==null&&panel.savedPose!=null)panel.savedPose=delta.compose(panel.savedPose);}for(Panel panel:panels)panel.positionFilter.reset();reference.previousOrigin=null;activity.saveWorkspace();}sampleDepth(frame,now);captureMap(s,origin,now);
            if(origin!=null){boolean restored=false;for(Panel panel:panels)if(panel.anchor==null&&panel.savedPose!=null){panel.anchor=s.createAnchor(origin.compose(panel.savedPose));panel.savedPose=null;restored=true;}if(restored)activity.message("Espaço reconhecido pelo marcador. Janelas salvas restauradas nas superfícies.");}
            if(origin!=null&&pendingWorkspaceSave)activity.saveWorkspace();
            HitResult hit=null;if(tracking)for(HitResult h:frame.hitTest((stereo?width*.25f:width*.5f),height*.5f)){if(h.getTrackable() instanceof Plane&&((Plane)h.getTrackable()).isPoseInPolygon(h.getHitPose())){hit=h;break;}}
            if(placeRequested.getAndSet(false)){placementPending=true;placementRequestedAt=now;planeStableSince=0;planeStableFrames=0;previousPlanePose=null;previousPlaneArea=0;notice("Validando a estabilidade da referência e da superfície…");}
            if(placementPending)updatePlacement(hit,origin,tracking,now,s);
            if(stereo&&vrCalibration==1){if(dragPanel!=null)finishDrag(false);finishResize();cursorPoints=null;drawCalibration();}else if(tracking){trackingLostAt=0;camera.getProjectionMatrix(projection,0,.05f,100f);camera.getViewMatrix(view,0);updatePanelPoses(camera.getDisplayOrientedPose(),now);updateHandControl(frame,now);drawPanels();drawHandCursors(now);}else suspendInteractions(now);
            if(now-lastMessage>500){lastMessage=now;String map=surfaceMap(s);String diagnostics=markerText+"\n"+map+"\n"+handTracker.status+"\n"+handControlStatus+(stereo?"\nDuas lentes · fundo monocular duplicado":"");activity.publishRemote(diagnostics);activity.runOnUiThread(()->activity.measurements.setText(diagnostics));activity.message(now<eventUntil?event:!tracking?"Rastreamento pausado: "+camera.getTrackingFailureReason()+". Mova devagar em um local iluminado.":placementPending?placementHint():mappingEnabled?mappingHint(origin):(origin==null?"Leia o marcador ID 100 para localizar o espaço; depois mire uma superfície.":hit==null?"Espaço localizado. Mire uma superfície detectada pelo ARCore.":"Superfície detectada. Toque em Criar painel."));}
        }catch(com.google.ar.core.exceptions.CameraNotAvailableException e){failed=true;activity.message("Câmera indisponível. Feche outros aplicativos de câmera e reabra o AR.");}catch(RuntimeException e){failed=true;activity.message("Falha na sessão AR: "+e.getClass().getSimpleName()+". Saia e tente novamente.");}
    }
    void onSessionPaused(){
        if(dragPanel!=null){dragPanel.dragPose=null;dragPanel.positionFilter.reset();dragPanel=null;}grabCapture.clear();resizePanel=null;resizeA=resizeB=null;cursorPoints=null;pinchWasClosed.clear();armedHands.clear();
    }
    void onSessionResumed(){
        if(graphicsReady)failed=false;trackingLostAt=0;lastGestureSample=0;cursorPoints=null;
        if(dragPanel!=null){dragPanel.dragPose=null;dragPanel.positionFilter.reset();dragPanel=null;}grabCapture.clear();finishResize();pinchWasClosed.clear();armedHands.clear();
    }
    void notice(String text){event=text;eventUntil=android.os.SystemClock.uptimeMillis()+2500;}
    Panel selectedPanel(){for(Panel panel:panels)if(panel.id.equals(selectedPanelId))return panel;return panels.isEmpty()?null:panels.get(panels.size()-1);}
    boolean isDragging(){return dragPanel!=null;}
    boolean hasDragPose(){return dragPanel!=null&&dragPanel.dragPose!=null;}
    boolean selectPanel(String id){for(Panel panel:panels)if(panel.id.equals(id)){selectedPanelId=id;activity.saveWorkspace();return true;}return false;}
    void removeSelected(){Panel panel=selectedPanel();if(panel!=null)removePanel(panel);}
    void removePanel(Panel panel){if(dragPanel==panel){dragPanel=null;grabCapture.clear();}if(resizePanel==panel)resizePanel=null;panels.remove(panel);drawOrder.remove(panel);if(panel.anchor!=null)panel.anchor.detach();if(panel.texture!=0)GLES20.glDeleteTextures(1,new int[]{panel.texture},0);selectedPanelId=panels.isEmpty()?"":panels.get(panels.size()-1).id;activity.saveWorkspace();activity.updatePanelControls();notice(panel.name+" fechado.");}
    void resize(float factor){Panel p=selectedPanel();if(p!=null){p.size=Math.max(.2f,Math.min(3f,p.size*factor));activity.saveWorkspace();notice(p.name+" redimensionado.");}}
}
