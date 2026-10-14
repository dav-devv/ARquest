import br.com.mrcompanion.*;
import javax.net.ssl.*;
import java.net.*;
import java.io.*;
public class NativeTlsTest {
 static int request(NativePairing p)throws Exception{HttpsURLConnection c=(HttpsURLConnection)new URL("https://"+p.host+":"+p.port+"/api/native/status").openConnection();try{c.setSSLSocketFactory(NativeTls.factory(p));c.setHostnameVerifier(NativeTls.verifier(p));c.setConnectTimeout(3000);c.setReadTimeout(3000);return c.getResponseCode();}finally{c.disconnect();}}
 public static void main(String[] args)throws Exception{String code=new BufferedReader(new InputStreamReader(System.in)).readLine();NativePairing p=NativePairing.parse(code);if(request(p)!=403)throw new AssertionError("Remote administration must be forbidden");String bad=code.substring(0,code.length()-1)+(code.endsWith("0")?"1":"0");boolean rejected=false;try{request(NativePairing.parse(bad));}catch(SSLException e){rejected=true;}if(!rejected)throw new AssertionError("Wrong certificate accepted");System.out.println("TLS: valid pairing connected; remote administration denied; wrong certificate rejected");}
}
