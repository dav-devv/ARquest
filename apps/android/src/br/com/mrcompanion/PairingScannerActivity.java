package br.com.mrcompanion;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.Camera;
import android.os.Bundle;
import android.view.Gravity;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.NotFoundException;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;

import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Temporary camera view used only to scan the PC's pairing QR. */
@SuppressWarnings("deprecation")
public final class PairingScannerActivity extends Activity implements SurfaceHolder.Callback, Camera.PreviewCallback {
    static final int CAMERA_REQUEST = 41;
    final AtomicBoolean decoding = new AtomicBoolean(false);
    final ExecutorService decoder = Executors.newSingleThreadExecutor();
    Camera camera;
    SurfaceView preview;
    TextView message;
    volatile boolean finished;
    long lastFrame;
    int previewWidth, previewHeight;

    int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 14, 24));
        preview = new SurfaceView(this);
        preview.setZOrderMediaOverlay(true);
        preview.getHolder().addCallback(this);
        root.addView(preview, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(22), dp(20), dp(22), dp(18));
        header.setBackgroundColor(0xb0080e18);
        TextView title = label("Conectar ao computador", 21, Color.WHITE);
        title.setTypeface(null, Typeface.BOLD);
        header.addView(title);
        header.addView(label("Aponte para o QR exibido no painel do ARquest.", 14, 0xffc4d1df));
        root.addView(header, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        View frame = new View(this);
        GradientDrawable outline = new GradientDrawable();
        outline.setColor(Color.TRANSPARENT);
        outline.setCornerRadius(dp(20));
        outline.setStroke(dp(3), 0xff55d5f2);
        frame.setBackground(outline);
        FrameLayout.LayoutParams frameParams = new FrameLayout.LayoutParams(dp(252), dp(252), Gravity.CENTER);
        root.addView(frame, frameParams);

        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setGravity(Gravity.CENTER_HORIZONTAL);
        footer.setPadding(dp(22), dp(16), dp(22), dp(22));
        footer.setBackgroundColor(0xb0080e18);
        message = label("A leitura começa automaticamente.", 14, 0xffc4d1df);
        message.setGravity(Gravity.CENTER);
        footer.addView(message);
        TextView cancel = label("Cancelar", 15, 0xff55d5f2);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(dp(18), dp(14), dp(18), dp(8));
        cancel.setOnClickListener(v -> finish());
        footer.addView(cancel);
        root.addView(footer, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
        setContentView(root);
    }

    TextView label(String text, int size, int color) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    @Override public void surfaceCreated(SurfaceHolder holder) { openCamera(); }
    @Override public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) { }
    @Override public void surfaceDestroyed(SurfaceHolder holder) { closeCamera(); }

    void openCamera() {
        if (finished || camera != null) return;
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
            return;
        }
        try {
            camera = Camera.open(Camera.CameraInfo.CAMERA_FACING_BACK);
            Camera.Parameters parameters = camera.getParameters();
            if (parameters.getSupportedFocusModes().contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE))
                parameters.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE);
            Camera.Size best = null;
            for (Camera.Size size : parameters.getSupportedPreviewSizes()) {
                if (size.width > 1600 || size.height > 1600) continue;
                if (best == null || Math.abs(size.width * size.height - 1280 * 720) < Math.abs(best.width * best.height - 1280 * 720)) best = size;
            }
            if (best != null) parameters.setPreviewSize(best.width, best.height);
            Camera.Size selected = parameters.getPreviewSize();
            previewWidth = selected.width;
            previewHeight = selected.height;
            camera.setParameters(parameters);
            camera.setDisplayOrientation(displayOrientation());
            camera.setPreviewDisplay(preview.getHolder());
            camera.setPreviewCallback(this);
            camera.startPreview();
            message.setText("Mantenha o QR dentro da moldura.");
        } catch (Exception e) {
            closeCamera();
            message.setText("Não foi possível abrir a câmera. Feche o AR e tente novamente.");
        }
    }

    int displayOrientation() {
        Camera.CameraInfo info = new Camera.CameraInfo();
        Camera.getCameraInfo(Camera.CameraInfo.CAMERA_FACING_BACK, info);
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        int degrees = rotation == 1 ? 90 : rotation == 2 ? 180 : rotation == 3 ? 270 : 0;
        return (info.orientation - degrees + 360) % 360;
    }

    @Override public void onPreviewFrame(byte[] data, Camera source) {
        if (finished || data == null || !decoding.compareAndSet(false, true)) return;
        long now = System.currentTimeMillis();
        if (now - lastFrame < 100) { decoding.set(false); return; }
        lastFrame = now;
        int width = previewWidth, height = previewHeight;
        byte[] frame = Arrays.copyOf(data, data.length);
        decoder.execute(() -> {
            try {
                int left = width / 10, top = height / 10;
                int cropWidth = width - 2 * left, cropHeight = height - 2 * top;
                PlanarYUVLuminanceSource luminance = new PlanarYUVLuminanceSource(frame, width, height,
                        left, top, cropWidth, cropHeight, false);
                Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
                hints.put(DecodeHintType.POSSIBLE_FORMATS, Collections.singletonList(BarcodeFormat.QR_CODE));
                hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
                MultiFormatReader reader = new MultiFormatReader();
                reader.setHints(hints);
                Result result = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(luminance)));
                String code = result.getText();
                NativePairing.parse(code);
                runOnUiThread(() -> finishWithCode(code));
            } catch (NotFoundException ignored) {
                // Most preview frames do not contain a complete QR; continue scanning.
            } catch (IllegalArgumentException invalid) {
                runOnUiThread(() -> message.setText("Este QR não é um pareamento válido do ARquest."));
            } finally {
                decoding.set(false);
            }
        });
    }

    void finishWithCode(String code) {
        if (finished) return;
        finished = true;
        closeCamera();
        setResult(RESULT_OK, new Intent().putExtra("pairing", code));
        finish();
    }

    void closeCamera() {
        Camera active = camera;
        camera = null;
        if (active != null) {
            try { active.setPreviewCallback(null); active.stopPreview(); active.release(); }
            catch (Exception ignored) { }
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == CAMERA_REQUEST) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) openCamera();
            else { message.setText("Permita o uso da câmera para ler o QR."); }
        }
    }

    @Override protected void onDestroy() {
        finished = true;
        closeCamera();
        decoder.shutdownNow();
        super.onDestroy();
    }
}
