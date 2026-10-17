import br.com.mrcompanion.NativePairing;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Collections;
import javax.imageio.ImageIO;

/** Desktop smoke test: decodes a QR PNG and verifies the Android pairing parser accepts it. */
public final class PairingQrRoundTripTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass the generated QR PNG path.");
        BufferedImage image = ImageIO.read(new File(args[0]));
        if (image == null) throw new AssertionError("QR image could not be read.");
        int width = image.getWidth(), height = image.getHeight();
        int[] pixels = image.getRGB(0, 0, width, height, null, 0, width);
        MultiFormatReader reader = new MultiFormatReader();
        reader.setHints(Collections.singletonMap(DecodeHintType.POSSIBLE_FORMATS,
                Collections.singletonList(BarcodeFormat.QR_CODE)));
        Result result = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(
                new RGBLuminanceSource(width, height, pixels))));
        if (!result.getText().startsWith("mrcompanion://")) throw new AssertionError("Unexpected QR payload.");
        NativePairing.parse(result.getText());
        System.out.println("QR image decoded and accepted by Android pairing validation.");
    }
}
