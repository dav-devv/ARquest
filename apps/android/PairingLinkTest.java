import br.com.mrcompanion.PairingLink;
public class PairingLinkTest {
    public static void main(String[] args){
        String token="0123456789abcdef0123456789abcdef0123456789abcdef";
        String base="https://192.168.1.10:3453/mobile";
        if(!PairingLink.arUrl(base+"#token="+token).equals(base+"/ar.html#token="+token))throw new AssertionError("AR route");
        String[] invalid={"http://192.168.1.10:3453/mobile#token="+token,"https://example.com:3453/mobile#token="+token,base+"#token=bad",base+"?token="+token,base.replace("192.168.1.10","192.168.1.999")+"#token="+token,base.replace("192.168.1.10","user@192.168.1.10")+"#token="+token};
        for(String input:invalid){boolean rejected=false;try{PairingLink.arUrl(input);}catch(IllegalArgumentException e){rejected=true;}if(!rejected)throw new AssertionError("Invalid link accepted");}
        System.out.println("PairingLink: 7 checks passed");
    }
}
