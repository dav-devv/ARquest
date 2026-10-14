package br.com.mrcompanion;
import java.net.URI;
public final class NativePairing {
    public final String host,token,pin;public final int port;
    private NativePairing(String h,int p,String t,String s){host=h;port=p;token=t;pin=s;}
    public static NativePairing parse(String code){try{
        URI u=new URI(code.trim());String host=u.getHost();if(!"mrcompanion".equals(u.getScheme())||host==null||u.getUserInfo()!=null||u.getRawQuery()!=null||!"/".equals(u.getPath())||u.getPort()<1024||u.getPort()>65535)throw new Exception();
        String[] pieces=host.split("\\.");if(pieces.length!=4)throw new Exception();int[] ip=new int[4];for(int i=0;i<4;i++){if(!pieces[i].matches("[0-9]{1,3}"))throw new Exception();ip[i]=Integer.parseInt(pieces[i]);if(ip[i]>255)throw new Exception();}if(!(ip[0]==10||ip[0]==192&&ip[1]==168||ip[0]==172&&ip[1]>=16&&ip[1]<=31))throw new Exception();
        String f=u.getRawFragment();if(f==null||!f.matches("token=[a-f0-9]{48}&sha256=[a-f0-9]{64}"))throw new Exception();return new NativePairing(host,u.getPort(),f.substring(6,54),f.substring(62));
    }catch(Exception e){throw new IllegalArgumentException("Cole o código completo mrcompanion:// gerado em Editar Android no PC.");}}
}
