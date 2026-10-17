package br.com.mrcompanion;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.*;
import com.google.ar.core.ArCoreApk;

public class MainActivity extends Activity implements RemoteControl.Target {
    static final int SCAN_PAIRING_QR=102;
    static final int BG=Color.rgb(8,14,24), CARD=Color.rgb(16,27,42), CARD_ALT=Color.rgb(20,34,52), CYAN=Color.rgb(85,213,242), MINT=Color.rgb(114,225,189), MUTED=Color.rgb(157,176,198), WHITE=Color.rgb(237,245,251);
    boolean arReady,foreground;TextView remoteStatus;final android.os.Handler ticker=new android.os.Handler(android.os.Looper.getMainLooper());
    final Runnable refresh=new Runnable(){public void run(){if(!foreground)return;if(remoteStatus!=null)remoteStatus.setText(RemoteControl.connectionStatus());publishHome();ticker.postDelayed(this,750);}};
    void publishHome(){try{RemoteControl.publish(new org.json.JSONObject().put("screen","home").put("active",foreground).put("ready",arReady).put("status",arReady?"Aplicativo aberto. Pronto para iniciar o AR.":"Verificando disponibilidade do AR."));}catch(org.json.JSONException ignored){}}
    @Override protected void onResume(){super.onResume();foreground=true;RemoteControl.target=this;if(RemoteControl.current==null){String code=PairingStore.load(this);if(code!=null)try{RemoteControl.connect(code);}catch(Exception e){PairingStore.clear(this);}}ticker.post(refresh);}
    @Override protected void onPause(){foreground=false;ticker.removeCallbacks(refresh);if(RemoteControl.target==this)RemoteControl.target=null;publishHome();super.onPause();}
    @Override public void apply(String action,double value,String panelId,RemoteControl.Reply reply){if(!foreground||!arReady||!action.equals("open_ar")){reply.done(false,"Abra o AR no celular antes de editar.");return;}reply.done(true,"Abrindo AR. Autorize a câmera no celular se solicitado.");startActivity(new Intent(this,NativeArActivity.class));}
    void scanPairingQr(){startActivityForResult(new Intent(this,PairingScannerActivity.class),SCAN_PAIRING_QR);}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=SCAN_PAIRING_QR||resultCode!=RESULT_OK||data==null)return;String value=data.getStringExtra("pairing");try{RemoteControl.connect(value);PairingStore.save(this,value);remoteStatus.setText("QR lido. Pareamento salvo; conectando ao PC…");}catch(Exception e){remoteStatus.setText("QR inválido. Gere outro no painel do PC.");}}
    int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    GradientDrawable shape(int color,int stroke){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(20));if(stroke!=0)d.setStroke(dp(1),stroke);return d;}
    TextView label(String value,int size,int color){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    TextView text(String value,int size){TextView v=label(value,size,MUTED);v.setPadding(0,dp(8),0,dp(8));return v;}
    LinearLayout card(LinearLayout parent,int color){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(20),dp(18),dp(20),dp(18));c.setBackground(shape(color,0xff26384e));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(14);parent.addView(c,p);return c;}
    Button button(String title,boolean primary){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(15);b.setTypeface(null,Typeface.BOLD);b.setMinHeight(dp(52));b.setPadding(dp(16),dp(8),dp(16),dp(8));b.setTextColor(primary?BG:WHITE);b.setBackground(shape(primary?CYAN:CARD_ALT,primary?0:0xff34485e));return b;}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BG);
        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(22),dp(30),dp(22),dp(24));scroll.addView(body);setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)->{body.setPadding(dp(22),dp(18)+insets.getSystemWindowInsetTop(),dp(22),dp(24)+insets.getSystemWindowInsetBottom());return insets;});
        LinearLayout brand=new LinearLayout(this);brand.setGravity(Gravity.CENTER_VERTICAL);TextView logo=label("A",19,BG);logo.setGravity(Gravity.CENTER);logo.setTypeface(null,Typeface.BOLD);logo.setBackground(shape(CYAN,0));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(38),dp(38));lp.rightMargin=dp(12);brand.addView(logo,lp);LinearLayout brandText=new LinearLayout(this);brandText.setOrientation(LinearLayout.VERTICAL);brandText.addView(label("ARQUEST",14,WHITE));brandText.addView(label("REALIDADE AUMENTADA",10,MUTED));brand.addView(brandText);body.addView(brand);
        TextView eyebrow=label("SEU ESPAÇO, NO CELULAR",12,MINT);eyebrow.setTypeface(null,Typeface.BOLD);eyebrow.setPadding(0,dp(30),0,dp(8));body.addView(eyebrow);
        TextView headline=label("Suas telas.\nNo seu espaço.",34,WHITE);headline.setTypeface(null,Typeface.BOLD);headline.setGravity(Gravity.CENTER_VERTICAL);body.addView(headline);
        TextView intro=text("Reconheça o ambiente e posicione painéis virtuais sobre as superfícies ao seu redor.",16);intro.setPadding(0,dp(12),0,dp(20));body.addView(intro);
        LinearLayout hero=card(body,CARD);TextView heroTitle=label("ESPAÇO AR",12,CYAN);heroTitle.setTypeface(null,Typeface.BOLD);hero.addView(heroTitle);TextView heroText=label("Mapeie uma superfície\ne crie seu primeiro painel.",19,WHITE);heroText.setTypeface(null,Typeface.BOLD);heroText.setPadding(0,dp(8),0,dp(14));hero.addView(heroText);
        Button start=button("Abrir espaço AR  →",true);start.setEnabled(false);hero.addView(start);TextView status=label("Verificando suporte ao ARCore…",13,MUTED);status.setPadding(0,dp(10),0,0);hero.addView(status);
        ArCoreApk.getInstance().checkAvailabilityAsync(this,a->{if(isFinishing()||isDestroyed())return;arReady=a.isSupported();start.setEnabled(arReady);status.setText(arReady?"●  Pronto para iniciar · câmera solicitada no AR":"ARCore indisponível. Verifique o Google Play Services para AR.");status.setTextColor(arReady?MINT:0xffffbf69);publishHome();});
        start.setOnClickListener(v->startActivity(new Intent(this,NativeArActivity.class)));
        LinearLayout pairCard=card(body,CARD_ALT);TextView pairTitle=label("CONTROLE PELO COMPUTADOR",12,CYAN);pairTitle.setTypeface(null,Typeface.BOLD);pairCard.addView(pairTitle);TextView pairCopy=text("Edite e organize as telas do celular no painel do PC.",14);pairCopy.setPadding(0,dp(6),0,dp(12));pairCard.addView(pairCopy);
        Button pair=button("Ler QR do computador",true);pair.setOnClickListener(v->scanPairingQr());pairCard.addView(pair);remoteStatus=label(RemoteControl.connectionStatus(),13,MUTED);remoteStatus.setPadding(0,dp(10),0,0);pairCard.addView(remoteStatus);
        Button disconnect=button("Desconectar e apagar pareamento",false);disconnect.setTextSize(13);disconnect.setOnClickListener(v->{RemoteControl.disconnect();PairingStore.clear(this);remoteStatus.setText(RemoteControl.connectionStatus());});pairCard.addView(disconnect);
        LinearLayout details=card(body,CARD);TextView detailsTitle=label("O QUE VOCÊ PODE FAZER",12,MINT);detailsTitle.setTypeface(null,Typeface.BOLD);details.addView(detailsTitle);details.addView(text("•  Criar até 24 painéis independentes\n•  Usar o ID 100 para localizar o espaço\n•  Selecionar e mover com as mãos\n•  Redimensionar com pinça de duas mãos",14));
        TextView version=label("AR nativo · versão 0.13",12,MUTED);version.setPadding(0,dp(3),0,dp(10));body.addView(version);
        TextView privacy=text("Este aplicativo usa o Google Play Services para AR (ARCore), fornecido pelo Google e regido pela Política de Privacidade do Google: https://policies.google.com/privacy",12);android.text.util.Linkify.addLinks(privacy,android.text.util.Linkify.WEB_URLS);body.addView(privacy);
    }
}
