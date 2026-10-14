package br.com.mrcompanion;
import android.os.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.security.*;
import java.security.cert.*;
import java.util.*;
import java.util.concurrent.*;
import javax.net.ssl.*;

/** Optional LAN control. Rendering stays native and works without this connection. */
final class RemoteControl {
    interface Reply {void done(boolean ok,String message);}
    interface Target {void apply(String action,double value,Reply reply);}
    static volatile RemoteControl current;
    static volatile Target target;
    static volatile JSONObject state=new JSONObject();
    static String connectionStatus(){RemoteControl c=current;return c==null?"Sem conexão com o PC":c.status;}
    static void publish(JSONObject value){state=value;}
    static void connect(String code)throws Exception{NativePairing pairing=NativePairing.parse(code);RemoteControl next=new RemoteControl(pairing);disconnect();current=next;next.worker.scheduleWithFixedDelay(next::poll,0,500,TimeUnit.MILLISECONDS);}
    static void disconnect(){RemoteControl old=current;current=null;if(old!=null)old.worker.shutdownNow();}
    final NativePairing pairing;final SSLSocketFactory tls;final String id=UUID.randomUUID().toString();
    final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();final Handler main=new Handler(Looper.getMainLooper());
    final LinkedHashMap<String,JSONObject> acks=new LinkedHashMap<>();final LinkedHashSet<String> seen=new LinkedHashSet<>();
    volatile String status="Conectando ao PC…";
    RemoteControl(NativePairing p)throws Exception{pairing=p;tls=NativeTls.factory(p);}
    void acknowledge(String id,boolean ok,String message){try{JSONObject a=new JSONObject().put("id",id).put("ok",ok).put("message",message);synchronized(acks){acks.put(id,a);while(acks.size()>32)acks.remove(acks.keySet().iterator().next());}}catch(JSONException ignored){}}
    void poll(){if(current!=this)return;HttpsURLConnection c=null;long started=SystemClock.uptimeMillis();try{
        JSONArray batch=new JSONArray();synchronized(acks){for(JSONObject a:acks.values())batch.put(a);}
        JSONObject body=new JSONObject().put("id",id).put("name",Build.MANUFACTURER+" "+Build.MODEL).put("state",state).put("acks",batch);
        c=(HttpsURLConnection)new URL("https://"+pairing.host+":"+pairing.port+"/api/native/sync").openConnection();c.setSSLSocketFactory(tls);c.setHostnameVerifier(NativeTls.verifier(pairing));c.setInstanceFollowRedirects(false);c.setConnectTimeout(2500);c.setReadTimeout(2500);c.setRequestMethod("POST");c.setRequestProperty("Authorization","Bearer "+pairing.token);c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);byte[] payload=body.toString().getBytes("UTF-8");c.setFixedLengthStreamingMode(payload.length);try(OutputStream out=c.getOutputStream()){out.write(payload);}
        if(c.getResponseCode()!=200)throw new IOException("Pareamento recusado. Gere um novo código no PC.");
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream input=c.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>65536)throw new IOException("Resposta inválida");bytes.write(buffer,0,n);}}
        JSONObject response=new JSONObject(bytes.toString("UTF-8"));if(current!=this)return;status="Conectado ao PC "+pairing.host;
        synchronized(acks){for(int i=0;i<batch.length();i++)acks.remove(batch.getJSONObject(i).getString("id"));}
        JSONArray commands=response.getJSONArray("commands");for(int i=0;i<commands.length();i++){JSONObject command=commands.getJSONObject(i);String cid=command.getString("id");if(!seen.add(cid))continue;while(seen.size()>256)seen.remove(seen.iterator().next());long until=SystemClock.uptimeMillis()+Math.max(0,command.optLong("ttl")-(SystemClock.uptimeMillis()-started));String action=command.getString("action");double value=command.optDouble("value",0);
            main.post(()->{if(current!=this)return;Target t=target;if(SystemClock.uptimeMillis()>=until){acknowledge(cid,false,"Comando expirou; não aplicado.");return;}if(t==null){acknowledge(cid,false,"Aplicativo em segundo plano; comando não aplicado.");return;}t.apply(action,value,(ok,message)->acknowledge(cid,ok,message));});}
    }catch(Exception e){status=e instanceof SSLException?"Certificado não confere. Gere novo código no PC.":"PC desconectado. Confira a rede e o pareamento.";}finally{if(c!=null)c.disconnect();}}
}
