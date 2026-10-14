package br.com.mrcompanion;
import javax.net.ssl.*;
import java.security.*;
import java.security.cert.*;
import java.util.Locale;
/** The user-transferred pairing code binds a private LAN endpoint to its exact certificate. */
public final class NativeTls {
    public static SSLSocketFactory factory(NativePairing p)throws GeneralSecurityException{
        SSLContext context=SSLContext.getInstance("TLS");context.init(null,new TrustManager[]{new X509TrustManager(){public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}public void checkClientTrusted(X509Certificate[] c,String a)throws CertificateException{throw new CertificateException("Client trust unavailable");}public void checkServerTrusted(X509Certificate[] c,String a)throws CertificateException{try{if(c.length==0)throw new CertificateException();c[0].checkValidity();if(!fingerprint(c[0]).equals(p.pin))throw new CertificateException("Certificado diferente do PC pareado");}catch(GeneralSecurityException e){throw new CertificateException(e);}}}},null);return context.getSocketFactory();
    }
    public static HostnameVerifier verifier(NativePairing p){return (host,session)->{try{return host.equals(p.host)&&fingerprint(session.getPeerCertificates()[0]).equals(p.pin);}catch(Exception e){return false;}};}
    public static String fingerprint(java.security.cert.Certificate c)throws GeneralSecurityException{byte[] hash=MessageDigest.getInstance("SHA-256").digest(c.getEncoded());StringBuilder out=new StringBuilder();for(byte b:hash)out.append(String.format(Locale.US,"%02x",b&255));return out.toString();}
}
