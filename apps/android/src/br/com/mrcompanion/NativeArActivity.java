package br.com.mrcompanion;
import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.opengl.GLSurfaceView;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.*;
import com.google.ar.core.*;
public class NativeArActivity extends Activity implements RemoteControl.Target {
    volatile Session session;
    GLSurfaceView surface;NativeRenderer renderer;TextView status,measurements;Spinner markerSelector;boolean updatingSelector;
    boolean installRequested,cameraRequested;volatile boolean active;String lastStatus="";
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root=new FrameLayout(this);surface=new GLSurfaceView(this);surface.setEGLContextClientVersion(2);surface.setEGLConfigChooser(8,8,8,8,16,0);surface.setPreserveEGLContextOnPause(true);
        renderer=new NativeRenderer(this);surface.setRenderer(renderer);root.addView(surface);
        LinearLayout overlay=new LinearLayout(this);overlay.setOrientation(LinearLayout.VERTICAL);overlay.setPadding(20,20,20,20);overlay.setBackgroundColor(0xB0121B2B);
        status=new TextView(this);status.setTextColor(Color.WHITE);status.setTextSize(16);status.setText("Mova o celular lentamente para reconhecer o ambiente.");overlay.addView(status);
        measurements=new TextView(this);measurements.setTextColor(Color.rgb(56,189,248));measurements.setTextSize(14);measurements.setText("Referência universal ID 100 • lado preto: 140 mm");overlay.addView(measurements);
        LinearLayout markers=new LinearLayout(this);Spinner selector=markerSelector=new Spinner(this);selector.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Referência universal ID 100"}));selector.setVisibility(android.view.View.GONE);selector.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,android.view.View v,int n,long id){if(active&&!updatingSelector)local("marker_id",n==0?100:200);}});
        add(markers,"Referência",()->local("reference",0));add(markers,"Lado (mm)",()->markerSize());overlay.addView(markers);
        LinearLayout buttons=new LinearLayout(this);add(buttons,"Fixar painel",()->local("place",0));add(buttons,"Remover último",()->local("remove",0));overlay.addView(buttons);
        LinearLayout size=new LinearLayout(this);add(size,"Menor",()->local("smaller",0));add(size,"Maior",()->local("larger",0));add(size,"Sair",()->finish());overlay.addView(size);
        root.addView(overlay,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));TextView cross=new TextView(this);cross.setText("+");cross.setTextSize(30);cross.setTextColor(Color.WHITE);cross.setGravity(Gravity.CENTER);root.addView(cross,new FrameLayout.LayoutParams(64,64,Gravity.CENTER));
        root.setOnApplyWindowInsetsListener((v,i)->{overlay.setPadding(20,20,20,20+i.getSystemWindowInsetBottom());return i;});setContentView(root);
    }
    void add(LinearLayout row,String label,Runnable action){Button b=new Button(this);b.setText(label);row.addView(b,new LinearLayout.LayoutParams(0,-2,1));b.setOnClickListener(v->action.run());}
    void message(String value){runOnUiThread(()->{if(!value.equals(lastStatus)){lastStatus=value;status.setText(value);}if(RemoteControl.target==this)try{RemoteControl.publish(new org.json.JSONObject(RemoteControl.state.toString()).put("screen","ar").put("active",active).put("ready",active&&!renderer.failed).put("status",value));}catch(org.json.JSONException ignored){}});}
    void local(String action,double value){apply(action,value,(ok,text)->message(text));}
    @Override public void apply(String action,double value,RemoteControl.Reply reply){
        if(!active){reply.done(false,"Abra o AR e autorize a câmera no celular.");return;}
        if(action.equals("close_ar")){reply.done(true,"Saindo do AR.");finish();return;}
        long deadline=android.os.SystemClock.uptimeMillis()+2000;RemoteControl connection=RemoteControl.current;
        surface.queueEvent(()->{if(!active||android.os.SystemClock.uptimeMillis()>deadline||RemoteControl.current!=connection){reply.done(false,"Comando expirou ou a sessão mudou.");return;}try{
            switch(action){
            case "marker_id":if(value!=100)throw new IllegalArgumentException();renderer.reference.select((int)value);runOnUiThread(()->{updatingSelector=true;markerSelector.setSelection(value==100?0:1);updatingSelector=false;});reply.done(true,"Marcador selecionado: ID "+(int)value);break;
            case "marker_size":float metres=MarkerGeometry.metres(String.valueOf(value));getPreferences(0).edit().putFloat("markerSide",metres).apply();renderer.reference.reset(metres);reply.done(true,"Medida aplicada; origem fixa removida.");break;
            case "reference":renderer.reference.defineRequested=true;reply.done(true,"Referência solicitada. Confira a origem e as medidas após a leitura estável.");break;
            case "place":renderer.placeRequested.set(true);reply.done(true,"Posicionamento solicitado. Confira a quantidade de painéis e o estado do AR.");break;
            case "remove":if(renderer.panels.isEmpty())throw new IllegalStateException("Não há painel para remover.");renderer.removeLast();reply.done(true,"Último painel removido.");break;
            case "smaller":case "larger":if(renderer.panels.isEmpty())throw new IllegalStateException("Não há painel para redimensionar.");renderer.resize(action.equals("smaller")?.85f:1.15f);reply.done(true,"Tamanho do último painel alterado.");break;
            default:reply.done(false,"Comando indisponível no AR.");
            }
        }catch(RuntimeException e){reply.done(false,e.getMessage()==null?"Valor inválido.":e.getMessage());}});
    }
    void publishRemote(String markerText){try{RemoteControl.publish(new org.json.JSONObject().put("screen","ar").put("active",active).put("ready",active&&!renderer.failed).put("selected",renderer.reference.selected).put("side",renderer.reference.detector.side*1000).put("panels",renderer.panels.size()).put("lastSize",renderer.panels.isEmpty()?0:renderer.panels.get(renderer.panels.size()-1).size).put("origin",renderer.reference.anchor==null?0:renderer.reference.originId).put("status",lastStatus).put("measurements",markerText));}catch(org.json.JSONException ignored){}}
    void markerSize(){EditText input=new EditText(this);input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);input.setText(String.valueOf(getPreferences(0).getFloat("markerSide",.14f)*1000));android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this).setTitle("Lado preto da referência universal (mm)").setMessage("Meça o quadrado preto, sem a margem branca. X aponta à direita da folha, Y para cima e Z sai do papel. Alterar a medida limpa a origem fixa.").setView(input).setNegativeButton("Cancelar",null).setPositiveButton("Aplicar",null).create();dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(button->{try{float metres=MarkerGeometry.metres(input.getText().toString());local("marker_size",metres*1000);dialog.dismiss();}catch(RuntimeException e){input.setError("Informe uma medida entre 30 e 1000 mm.");}}));dialog.show();}
    @Override protected void onResume(){super.onResume();RemoteControl.target=this;resumeAr();}
    void resumeAr(){
        if(active||isFinishing())return;
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){if(!cameraRequested){cameraRequested=true;requestPermissions(new String[]{Manifest.permission.CAMERA},11);}else message("Autorize a câmera nas configurações do aplicativo para usar o AR.");return;}
        try{
            if(session==null){if(ArCoreApk.getInstance().requestInstall(this,!installRequested)==ArCoreApk.InstallStatus.INSTALL_REQUESTED){installRequested=true;return;}session=new Session(this);Config config=new Config(session);config.setFocusMode(Config.FocusMode.AUTO);config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);session.configure(config);}
            session.resume();active=true;surface.onResume();
        }catch(Exception e){message("Não foi possível iniciar o AR: "+e.getClass().getSimpleName()+". Confira o Google Play Services para AR e a permissão da câmera.");}
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] result){super.onRequestPermissionsResult(code,permissions,result);if(code==11){if(result.length>0&&result[0]==PackageManager.PERMISSION_GRANTED)resumeAr();else message("Câmera não autorizada. Ative a permissão nas configurações do aplicativo e reabra o AR.");}}
    @Override protected void onPause(){if(RemoteControl.target==this)RemoteControl.target=null;if(active){surface.onPause();renderer.reference.detector.epoch++;renderer.reference.detector.result=null;if(session!=null)session.pause();active=false;}try{RemoteControl.publish(new org.json.JSONObject(RemoteControl.state.toString()).put("active",false));}catch(org.json.JSONException ignored){}super.onPause();}
    @Override protected void onDestroy(){renderer.reference.detector.close();if(session!=null){session.close();session=null;}super.onDestroy();}
}
