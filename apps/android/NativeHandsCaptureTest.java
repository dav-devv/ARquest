package br.com.mrcompanion;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;

/** Runs on the JVM with SDK jars; no camera, Android methods or MediaPipe native runtime. */
public final class NativeHandsCaptureTest {
    private static int checks;
    private static void check(boolean value, String message) { checks++; if (!value) throw new AssertionError(message); }
    private static NativeHands.Capture capture(long time, float worldX) {
        long nanos = time * 1_000_000L;
        return new NativeHands.Capture(new float[]{worldX, 0, 0}, new float[]{0, 0, 0, 1},
            800, 810, 320, 240, 640, 480, nanos + 99_000_000_000L, nanos, nanos, time, true);
    }
    private static HandTrackingFilter.Observation hand(String label, float cx) {
        float[] x = new float[21], y = new float[21];
        Arrays.fill(x, cx); Arrays.fill(y, .55f);
        x[5] -= .06f; x[17] += .06f;
        y[0] += .10f; y[9] -= .04f;
        y[8] -= .18f; x[4] = x[8] + .03f; y[4] = y[8];
        return new HandTrackingFilter.Observation(label, .95f, x, y);
    }
    public static void main(String[] args) {
        exactPendingMatch();
        captureIntegrity();
        retainedHandsKeepObservationPose();
        System.out.println("Hand capture synchronization: " + checks + " checks passed");
    }
    private static void exactPendingMatch() {
        NativeHands.Capture frame = capture(1000, 0);
        NativeHands.PendingImage pending = new NativeHands.PendingImage(7, 1000, null, frame);
        check(pending.matches(7, 1000), "Exact callback was not matched");
        check(!pending.matches(7, 999), "An older callback acquired a newer frame's pose");
        check(!pending.matches(7, 1001), "A later callback acquired a different frame's pose");
        check(!pending.matches(6, 1000), "A previous detector generation acquired current metadata");
        check(!pending.matches(8, 1000), "A future detector generation acquired old metadata");
        check(pending.capture == frame && pending.capture.timestampMs == pending.timestamp, "Pending image lost its calibration");
    }
    private static void captureIntegrity() {
        float[] translation = {1, 2, 3}, rotation = {0, 0, 0, 1};
        NativeHands.Capture copied = new NativeHands.Capture(translation, rotation, 800, 810, 320, 240,
            640, 480, 99_000_000_000L, 100_000_000L, 150_000_000L, 5000, false);
        translation[0] = 8; rotation[3] = 0;
        check(copied.translation[0] == 1 && copied.rotation[3] == 1, "Capture borrowed mutable camera arrays");
        check(copied.synchronizedImage(), "Allowed 50 ms camera clock skew was rejected");
        check(copied.frameTimestampNs != copied.androidCameraTimestampNs, "Test must keep AR and Android camera clocks independent");
        check(!copied.tracking, "Unavailable AR tracking became a valid world pose");
        NativeHands.Capture stale = new NativeHands.Capture(translation, rotation, 800, 810, 320, 240,
            640, 480, 99_000_000_000L, 100_000_000L, 150_000_001L, 5000, true);
        check(!stale.synchronizedImage(), "A stale CPU image acquired an unrelated frame's pose");
        NativeHands.Capture invalid = new NativeHands.Capture(translation, rotation, 800, 810, 320, 240,
            640, 480, 99_000_000_000L, 0, 0, 5000, true);
        check(!invalid.synchronizedImage(), "Uninitialized camera timestamps were accepted");
    }
    private static void retainedHandsKeepObservationPose() {
        HandTrackingFilter filter = new HandTrackingFilter();
        HashMap<String, NativeHands.Capture> history = new HashMap<>();
        NativeHands.Capture initial = capture(1000, 0), moved = capture(1067, 1);
        List<HandTrackingFilter.Sample> both = filter.update(Arrays.asList(hand("Left", .25f), hand("Right", .75f)), 1000, 4f / 3f);
        ArrayList<NativeHands.Hand> first = NativeHands.bindCaptures(both, initial, history);
        check(first.size() == 2 && first.get(0).capture == initial && first.get(1).capture == initial, "First observations did not share their capture");
        List<HandTrackingFilter.Sample> onlyRight = filter.update(Collections.singletonList(hand("Right", .78f)), 1067, 4f / 3f);
        ArrayList<NativeHands.Hand> second = NativeHands.bindCaptures(onlyRight, moved, history);
        NativeHands.Hand retained = second.get(0), observed = second.get(1);
        check(!retained.observed && retained.pinching && retained.capture == initial, "Retained pinch was rebound to the moving camera");
        check(observed.observed && observed.capture == moved, "New observation kept an obsolete camera pose");
        check(retained.capture.translation[0] == 0 && observed.capture.translation[0] == 1, "Two hands lost independent observation times");
        check(retained.x[8] == first.get(0).x[8], "Missing observation moved its frozen landmark");
        check(observed.imageIndexX == .78f && observed.imageIndexY == hand("Right", .78f).y[8], "Interaction landmark did not come from the exact captured image");
        check(observed.imageIndexX != observed.indexX(), "Test must distinguish raw optical coordinates from smoothed display coordinates");
        check(retained.imageIndexX == first.get(0).imageIndexX && retained.imageIndexY == first.get(0).imageIndexY, "Missing hand changed its frozen raw interaction landmark");
        NativeHands.Hand legacy = new NativeHands.Hand(observed.side, observed.x, observed.y, observed.pinchRatio, observed.score, true);
        check(legacy.imageIndexX == legacy.indexX() && legacy.imageIndexY == legacy.indexY(), "Legacy hand constructors lost their landmark fallback");
        NativeHands.Snapshot snapshot = new NativeHands.Snapshot(1067, second, moved);
        check(snapshot.capture == moved && snapshot.hands.get(0).capture == initial, "Snapshot overwrote a hand's original capture");
        NativeHands.bindCaptures(Collections.emptyList(), capture(1400, 2), history);
        check(history.isEmpty(), "Expired hand metadata leaked into a new tracking session");
        check(new NativeHands.Snapshot(0, Collections.emptyList()).capture == null, "Empty legacy snapshots need no capture");
    }
}
