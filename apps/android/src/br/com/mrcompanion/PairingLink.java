package br.com.mrcompanion;
import java.net.URI;
public final class PairingLink {
    public static String arUrl(String input) {
        try {
            URI uri=new URI(input.trim());
            String host=uri.getHost(),fragment=uri.getRawFragment();
            if(!"https".equals(uri.getScheme())||host==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getPort()<1024||uri.getPort()>65535)throw new Exception();
            String[] parts=host.split("\\.");if(parts.length!=4)throw new Exception();
            int[] ip=new int[4];for(int i=0;i<4;i++){if(!parts[i].matches("[0-9]{1,3}"))throw new Exception();ip[i]=Integer.parseInt(parts[i]);if(ip[i]>255)throw new Exception();}
            if(!(ip[0]==10||(ip[0]==192&&ip[1]==168)||(ip[0]==172&&ip[1]>=16&&ip[1]<=31)))throw new Exception();
            if(fragment==null||!fragment.matches("token=[a-f0-9]{48}"))throw new Exception();
            String path=uri.getPath();if(!"/mobile".equals(path)&&!"/mobile/".equals(path)&&!"/mobile/ar.html".equals(path))throw new Exception();
            return new URI("https",null,host,uri.getPort(),"/mobile/ar.html",null,fragment).toASCIIString();
        }catch(Exception e){throw new IllegalArgumentException("Cole o link HTTPS completo do painel do PC, incluindo #token. Use a mesma rede Wi-Fi.");}
    }
}
