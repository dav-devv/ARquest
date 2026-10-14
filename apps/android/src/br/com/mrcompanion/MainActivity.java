package br.com.mrcompanion;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.widget.*;
import com.google.ar.core.ArCoreApk;
public class MainActivity extends Activity implements RemoteControl.Target {
    boolean arReady,foreground;TextView remoteStatus;final android.os.Handler ticker=new android.os.Handler(android.os.Looper.getMainLooper());
    final Runnable refresh=new Runnable(){public void run(){if(!foreground)return;if(remoteStatus!=null)remoteStatus.setText(RemoteControl.connectionStatus());publishHome();ticker.postDelayed(this,750);}};
    void publishHome(){try{RemoteControl.publish(new org.json.JSONObject().put("screen","home").put("active",foreground).put("ready",arReady).put("status",arReady?"Aplicativo aberto. Pronto para iniciar o AR.":"Verificando disponibilidade do AR."));}catch(org.json.JSONException ignored){}}
    @Override protected void onResume(){super.onResume();foreground=true;RemoteControl.target=this;ticker.post(refresh);}
    @Override protected void onPause(){foreground=false;ticker.removeCallbacks(refresh);if(RemoteControl.target==this)RemoteControl.target=null;publishHome();super.onPause();}
    @Override public void apply(String action,double value,RemoteControl.Reply reply){if(!foreground||!arReady||!action.equals("open_ar")){reply.done(false,"Abra o AR no celular antes de editar.");return;}reply.done(true,"Abrindo AR. Autorize a câmera no celular se solicitado.");startActivity(new Intent(this,NativeArActivity.class));}
    void connectPc(){EditText code=new EditText(this);code.setHint("mrcompanion://...");code.setSaveEnabled(false);code.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this).setTitle("Conectar ao PC").setMessage("No PC, abra Editar Android, gere o código e cole aqui. O computador poderá editar os controles enquanto este aplicativo estiver aberto.").setView(code).setNegativeButton("Cancelar",null).setPositiveButton("Conectar",null).create();dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(button->{try{RemoteControl.connect(code.getText().toString());dialog.dismiss();}catch(Exception e){code.setError(e.getMessage());}}));dialog.show();}
    int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(Color.WHITE);v.setPadding(0,dp(12),0,dp(12));return v;}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(18,27,43));
        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(24),dp(32),dp(24),dp(24));scroll.addView(body);setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)->{body.setPadding(dp(24),dp(24)+insets.getSystemWindowInsetTop(),dp(24),dp(24)+insets.getSystemWindowInsetBottom());return insets;});
        body.addView(text("MR Companion",30));body.addView(text("Seu espaço, no celular",23));
        body.addView(text("Abra a câmera, reconheça uma superfície e fixe painéis no ambiente. Esta experiência roda dentro do aplicativo, sem navegador e sem computador.",17));
        Button start=new Button(this);start.setText("Abrir espaço AR");start.setMinHeight(dp(56));start.setTextColor(Color.BLACK);start.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(56,189,248)));start.setEnabled(false);body.addView(start);
        TextView status=text("Verificando suporte ao ARCore…",15);body.addView(status);
        ArCoreApk.getInstance().checkAvailabilityAsync(this,a->{if(isFinishing()||isDestroyed())return;arReady=a.isSupported();start.setEnabled(arReady);status.setText(arReady?"Pronto. A câmera será solicitada ao entrar.":"ARCore indisponível ou suporte não confirmado. Verifique o Google Play Services para AR e reabra o aplicativo.");publishHome();});
        start.setOnClickListener(v->startActivity(new Intent(this,NativeArActivity.class)));
        Button pair=new Button(this);pair.setText("Conectar ao PC");pair.setOnClickListener(v->connectPc());body.addView(pair);Button disconnect=new Button(this);disconnect.setText("Desconectar do PC");disconnect.setOnClickListener(v->{RemoteControl.disconnect();remoteStatus.setText(RemoteControl.connectionStatus());});body.addView(disconnect);remoteStatus=text(RemoteControl.connectionStatus(),15);body.addView(remoteStatus);
        body.addView(text("Versão nativa inicial",20));
        body.addView(text("Disponível: câmera, rastreamento espacial, painéis locais e referência impressa universal ID 100. Meça o lado preto da folha e informe em Lado (mm) no AR.\nEm desenvolvimento: monitores do PC, mãos, pinças e duas lentes. Os painéis desta versão não exibem o Windows.",15));
        TextView privacy=text("Este aplicativo usa o Google Play Services para AR (ARCore), fornecido pelo Google e regido pela Política de Privacidade do Google: https://policies.google.com/privacy",13);android.text.util.Linkify.addLinks(privacy,android.text.util.Linkify.WEB_URLS);body.addView(privacy);
    }
}
