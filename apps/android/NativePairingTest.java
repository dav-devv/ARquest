import br.com.mrcompanion.NativePairing;
public class NativePairingTest {
 public static void main(String[] args){String token="0123456789abcdef0123456789abcdef0123456789abcdef",pin="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",good="mrcompanion://192.168.1.8:3453/#token="+token+"&sha256="+pin;NativePairing p=NativePairing.parse(good);if(!p.token.equals(token)||!p.pin.equals(pin)||p.port!=3453)throw new AssertionError();
 String[] bad={good.replace("mrcompanion:","http:"),good.replace("192.168.1.8","example.com"),good.replace("192.168.1.8","127.0.0.1"),good.replace("192.168.1.8","192.168.1.999"),good.replace("/#","/evil#"),good.replace("3453","80"),good+"x",good.replace("/#","/?redirect=evil#")};for(String s:bad){boolean rejected=false;try{NativePairing.parse(s);}catch(IllegalArgumentException e){rejected=true;}if(!rejected)throw new AssertionError();}System.out.println("Native pairing: 9 checks passed");}
}
