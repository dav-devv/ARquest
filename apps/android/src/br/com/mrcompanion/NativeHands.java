package br.com.mrcompanion;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.Image;
import com.google.ar.core.Frame;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Pose;
import com.google.ar.core.TrackingState;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.core.Delegate;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** On-device two-hand landmarks; camera images are copied and closed before inference. */
final class NativeHands {
    static final class Hand {
        // side is a persistent tracking identity, not the classifier's changing label.
        final String side;
        final float[] x, y;
        final float pinchRatio, score;
        final float imageIndexX, imageIndexY;
        final boolean pinching, observed;
        // A retained pinch keeps the camera metadata of its last observed image.
        final Capture capture;
        Hand(String side, float[] x, float[] y, float pinchRatio, float score, boolean pinching) {
            this(side, x, y, pinchRatio, score, pinching, true);
        }
        Hand(String side, float[] x, float[] y, float pinchRatio, float score, boolean pinching, boolean observed) {
            this(side, x, y, pinchRatio, score, pinching, observed, null);
        }
        Hand(String side, float[] x, float[] y, float pinchRatio, float score, boolean pinching, boolean observed, Capture capture) {
            this(side, x, y, pinchRatio, score, pinching, observed, capture, x[8], y[8]);
        }
        Hand(String side, float[] x, float[] y, float pinchRatio, float score, boolean pinching, boolean observed, Capture capture, float imageIndexX, float imageIndexY) {
            this.side = side; this.x = x; this.y = y;
            this.pinchRatio = pinchRatio; this.score = score; this.pinching = pinching; this.observed = observed;
            this.capture = capture;
            this.imageIndexX = imageIndexX; this.imageIndexY = imageIndexY;
        }
        float indexX() { return x[8]; }
        float indexY() { return y[8]; }
    }

    /** Image-coordinate camera calibration and world pose from the image's own AR frame. */
    static final class Capture {
        private static final long MAX_FRAME_SKEW_NS = 50_000_000L;
        final float[] translation, rotation;
        final float fx, fy, cx, cy;
        final int width, height;
        final long frameTimestampNs, androidCameraTimestampNs, imageTimestampNs, timestampMs;
        final boolean tracking;
        Capture(float[] translation, float[] rotation, float fx, float fy, float cx, float cy,
                int width, int height, long frameTimestampNs, long androidCameraTimestampNs, long imageTimestampNs, long timestampMs, boolean tracking) {
            this.translation = translation.clone(); this.rotation = rotation.clone();
            this.fx = fx; this.fy = fy; this.cx = cx; this.cy = cy;
            this.width = width; this.height = height;
            this.frameTimestampNs = frameTimestampNs; this.androidCameraTimestampNs = androidCameraTimestampNs;
            this.imageTimestampNs = imageTimestampNs; this.timestampMs = timestampMs;
            this.tracking = tracking;
        }
        boolean synchronizedImage() {
            // AR frame timestamps have an undefined timebase; compare Android camera clocks only.
            return androidCameraTimestampNs > 0 && imageTimestampNs > 0
                && Math.abs(androidCameraTimestampNs - imageTimestampNs) <= MAX_FRAME_SKEW_NS;
        }
    }

    static final class Snapshot {
        final long time;
        final List<Hand> hands;
        final Capture capture;
        Snapshot(long time, List<Hand> hands) { this(time, hands, null); }
        Snapshot(long time, List<Hand> hands, Capture capture) { this.time = time; this.hands = hands; this.capture = capture; }
    }

    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(), enabled = new AtomicBoolean();
    private final AtomicInteger generation = new AtomicInteger();
    private final AtomicReference<PendingImage> pendingImage = new AtomicReference<>();
    private final HandTrackingFilter filter = new HandTrackingFilter();
    private final HashMap<String, Capture> trackCaptures = new HashMap<>();
    volatile HandLandmarker landmarker;
    volatile Snapshot latest = new Snapshot(0, new ArrayList<>());
    volatile String status = "Rastreamento de mãos desligado.";
    private volatile long lastSubmit, inferenceIntervalMs = 67;
    private long lastTimestamp;
    private int[] pixels = new int[0];

    NativeHands(Context context) { this.context = context.getApplicationContext(); }

    synchronized void enable() {
        if (!enabled.compareAndSet(false, true)) return;
        final int session = generation.incrementAndGet();
        filter.reset();
        trackCaptures.clear();
        lastSubmit = 0;
        status = "Carregando modelo local de mãos…";
        worker.execute(() -> {
            if (!current(session)) return;
            try {
                BaseOptions base = BaseOptions.builder().setModelAssetPath("hand_landmarker.task").setDelegate(Delegate.CPU).build();
                HandLandmarker.HandLandmarkerOptions options = HandLandmarker.HandLandmarkerOptions.builder()
                    .setBaseOptions(base).setRunningMode(RunningMode.LIVE_STREAM).setNumHands(2)
                    .setMinHandDetectionConfidence(.50f).setMinHandPresenceConfidence(.52f).setMinTrackingConfidence(.50f)
                    .setResultListener((result, input) -> onResult(result, input, session))
                    .setErrorListener(error -> {
                        synchronized (NativeHands.this) {
                            if (!current(session)) return;
                            status = "Detector de mãos: " + error.getMessage();
                            latest = new Snapshot(android.os.SystemClock.uptimeMillis(), new ArrayList<>());
                            trackCaptures.clear();
                            filter.reset();
                            releasePending(session, -1);
                            // An asynchronous detector error must not block acquisition.
                            busy.set(false);
                        }
                    }).build();
                HandLandmarker detector = HandLandmarker.createFromOptions(context, options);
                synchronized (NativeHands.this) {
                    if (current(session)) {
                        landmarker = detector;
                        status = "Mostre uma ou duas mãos à câmera.";
                    } else { detector.close(); }
                }
            } catch (Throwable error) {
                if (!current(session)) return;
                enabled.set(false);
                String detail = error.getMessage();
                status = "Modelo de mãos indisponível: " + error.getClass().getSimpleName() + (detail == null ? "" : ": " + detail);
                android.util.Log.e("NativeHands", "Falha ao inicializar MediaPipe", error);
            }
        });
    }

    private boolean current(int session) { return enabled.get() && generation.get() == session; }

    synchronized void disable() {
        enabled.set(false);
        int oldSession = generation.getAndIncrement();
        HandLandmarker detector = landmarker;
        landmarker = null;
        busy.set(false);
        filter.reset();
        trackCaptures.clear();
        latest = new Snapshot(android.os.SystemClock.uptimeMillis(), new ArrayList<>());
        status = "Rastreamento de mãos desligado.";
        worker.execute(() -> {
            if (detector != null) try { detector.close(); } catch (RuntimeException ignored) {}
            releasePending(oldSession, -1);
        });
    }

    boolean wantsFrame(long now) {
        return enabled.get() && landmarker != null && now - lastSubmit >= inferenceIntervalMs && busy.compareAndSet(false, true);
    }

    void submit(Frame frame, long now) {
        final int session = generation.get();
        lastSubmit = now;
        Image image = null;
        Bitmap bitmap = null;
        MPImage input = null;
        PendingImage pending = null;
        boolean submitted = false;
        try {
            image = frame.acquireCameraImage();
            // Copy before conversion/inference: a later AR frame has a different pose.
            Camera camera = frame.getCamera();
            Pose pose = camera.getPose();
            CameraIntrinsics intrinsics = camera.getImageIntrinsics();
            float[] focal = intrinsics.getFocalLength(), principal = intrinsics.getPrincipalPoint();
            long timestamp = Math.max(now, lastTimestamp + 1);
            Capture capture = new Capture(pose.getTranslation(), pose.getRotationQuaternion(), focal[0], focal[1], principal[0], principal[1],
                image.getWidth(), image.getHeight(), frame.getTimestamp(), frame.getAndroidCameraTimestamp(), image.getTimestamp(), timestamp, camera.getTrackingState() == TrackingState.TRACKING);
            if (!capture.synchronizedImage()) {
                if (current(session)) status = "Aguardando uma imagem de mão sincronizada com a câmera.";
                return;
            }
            bitmap = toBitmap(image, 480);
            image.close(); image = null;
            input = new BitmapImageBuilder(bitmap).build();
            lastTimestamp = timestamp;
            HandLandmarker detector = landmarker;
            if (detector == null || !current(session)) return;
            pending = new PendingImage(session, timestamp, input, capture);
            PendingImage previous = pendingImage.getAndSet(pending);
            if (previous != null) previous.close();
            detector.detectAsync(input, timestamp);
            submitted = true;
        } catch (com.google.ar.core.exceptions.NotYetAvailableException error) {
            if (current(session)) status = "Aguardando imagem da câmera para as mãos.";
        } catch (Throwable error) {
            if (current(session)) status = "Falha no rastreamento de mãos: " + error.getClass().getSimpleName();
        } finally {
            if (image != null) image.close();
            if (!submitted) {
                if (pending != null) {
                    pendingImage.compareAndSet(pending, null);
                    pending.close();
                } else if (input != null) input.close();
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
                if (generation.get() == session) busy.set(false);
            }
        }
    }

    private void onResult(HandLandmarkerResult result, MPImage input, int session) {
        PendingImage pending = pendingImage.get();
        boolean matched = pending != null && pending.matches(session, result.timestampMs());
        try {
            if (!current(session) || !matched) return;
            ArrayList<HandTrackingFilter.Observation> observations = new ArrayList<>();
            List<List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>> all = result.landmarks();
            List<List<com.google.mediapipe.tasks.components.containers.Category>> categories = result.handedness();
            for (int i = 0; i < all.size() && i < 2; i++) {
                List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark> points = all.get(i);
                if (points.size() < 21) continue;
                float[] x = new float[21], y = new float[21];
                for (int j = 0; j < 21; j++) { x[j] = points.get(j).x(); y[j] = points.get(j).y(); }
                String side = "Hand";
                float score = .7f;
                if (i < categories.size() && !categories.get(i).isEmpty()) {
                    com.google.mediapipe.tasks.components.containers.Category category = categories.get(i).get(0);
                    side = category.categoryName(); score = category.score();
                }
                observations.add(new HandTrackingFilter.Observation(side, score, x, y));
            }
            ArrayList<Hand> hands = new ArrayList<>();
            boolean pinching = false, observed = false;
            synchronized (this) {
                if (!current(session) || pendingImage.get() != pending) return;
                Capture capture = pending.capture;
                List<HandTrackingFilter.Sample> samples = filter.update(observations, result.timestampMs(), (float)capture.width / Math.max(1, capture.height));
                hands = bindCaptures(samples, capture, trackCaptures);
                for (Hand hand : hands) {
                    pinching |= hand.pinching;
                    observed |= hand.observed;
                }
                latest = new Snapshot(result.timestampMs(), hands, capture);
            }
            if (!current(session)) return;
            long duration = Math.max(0, android.os.SystemClock.uptimeMillis() - result.timestampMs());
            // At most 15 Hz; slow devices self-limit without queuing camera frames.
            inferenceIntervalMs = Math.max(67, Math.min(125, (inferenceIntervalMs * 3 + duration) / 4));
            if (hands.isEmpty()) status = "Mostre uma mão à câmera, com boa iluminação.";
            else if (!observed) status = "Retomando a mão; pinça mantida por um instante.";
            else status = hands.size() + " mão(s) rastreada(s) · " + (pinching ? "pinça reconhecida" : "faça uma pinça para selecionar");
        } catch (RuntimeException error) {
            if (current(session)) status = "Não foi possível ler os pontos da mão.";
        } finally {
            try { input.close(); } catch (Exception ignored) {}
            synchronized (this) {
                boolean released = matched && releasePending(session, result.timestampMs());
                if (released && generation.get() == session) busy.set(false);
            }
        }
    }

    // Missing hands retain their original frame; rebinding would turn camera movement into hand movement.
    static ArrayList<Hand> bindCaptures(List<HandTrackingFilter.Sample> samples, Capture capture, HashMap<String, Capture> captures) {
        ArrayList<Hand> hands = new ArrayList<>();
        HashSet<String> live = new HashSet<>();
        for (HandTrackingFilter.Sample sample : samples) {
            live.add(sample.id);
            if (sample.observed) captures.put(sample.id, capture);
            hands.add(new Hand(sample.id, sample.x, sample.y, sample.pinchRatio, sample.score, sample.pinching, sample.observed, captures.get(sample.id), sample.imageIndexX, sample.imageIndexY));
        }
        captures.keySet().retainAll(live);
        return hands;
    }

    private boolean releasePending(int session, long timestamp) {
        PendingImage pending = pendingImage.get();
        if (pending != null && pending.session == session && (timestamp < 0 || pending.timestamp == timestamp)
                && pendingImage.compareAndSet(pending, null)) { pending.close(); return true; }
        return false;
    }

    static final class PendingImage {
        final int session;
        final long timestamp;
        final MPImage image;
        final Capture capture;
        final AtomicBoolean closed = new AtomicBoolean();
        PendingImage(int session, long timestamp, MPImage image, Capture capture) { this.session = session; this.timestamp = timestamp; this.image = image; this.capture = capture; }
        boolean matches(int session, long timestamp) { return this.session == session && this.timestamp == timestamp; }
        void close() { if (closed.compareAndSet(false, true)) try { image.close(); } catch (RuntimeException ignored) {} }
    }

    private Bitmap toBitmap(Image image, int maxSide) {
        int sw = image.getWidth(), sh = image.getHeight();
        float scale = Math.min(1f, (float)maxSide / Math.max(sw, sh));
        int w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer yb = planes[0].getBuffer(), ub = planes[1].getBuffer(), vb = planes[2].getBuffer();
        int yp = planes[0].getPixelStride(), ys = planes[0].getRowStride(), up = planes[1].getPixelStride(), us = planes[1].getRowStride(), vp = planes[2].getPixelStride(), vs = planes[2].getRowStride();
        if (pixels.length < w * h) pixels = new int[w * h];
        for (int j = 0; j < h; j++) {
            int sy = Math.min(sh - 1, (int)(j / scale));
            for (int i = 0; i < w; i++) {
                int sx = Math.min(sw - 1, (int)(i / scale));
                int yy = yb.get(sy * ys + sx * yp) & 255, u = (ub.get((sy / 2) * us + (sx / 2) * up) & 255) - 128, v = (vb.get((sy / 2) * vs + (sx / 2) * vp) & 255) - 128;
                int c = Math.max(0, yy - 16), r = (298 * c + 409 * v + 128) >> 8, g = (298 * c - 100 * u - 208 * v + 128) >> 8, b = (298 * c + 516 * u + 128) >> 8;
                pixels[j * w + i] = 0xff000000 | (Math.min(255, Math.max(0, r)) << 16) | (Math.min(255, Math.max(0, g)) << 8) | Math.min(255, Math.max(0, b));
            }
        }
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bitmap.setPixels(pixels, 0, w, 0, 0, w, h);
        return bitmap;
    }

    void close() { disable(); worker.shutdown(); }
}
