package br.com.mrcompanion;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** Deterministic noisy trajectories; no camera/model accuracy is claimed by this test. */
public final class HandTrackingFilterTest {
    private static int checks;
    private static void check(boolean value, String message) { checks++; if (!value) throw new AssertionError(message); }
    private static HandTrackingFilter.Observation hand(String label, float cx, float cy, float ratio) {
        float[] x = new float[21], y = new float[21];
        Arrays.fill(x, cx); Arrays.fill(y, cy);
        x[5] -= .06f; x[17] += .06f;
        y[0] += .10f; y[9] -= .04f;
        y[8] -= .18f; x[4] = x[8] + ratio * .12f; y[4] = y[8];
        return new HandTrackingFilter.Observation(label, .95f, x, y);
    }
    private static List<HandTrackingFilter.Sample> one(HandTrackingFilter filter, HandTrackingFilter.Observation observation, long time) {
        return filter.update(Collections.singletonList(observation), time, 1f);
    }

    public static void main(String[] args) {
        associationAndDropout();
        pinchHysteresis();
        aspectAndInvalidInput();
        trajectoryMetrics();
        System.out.println("Hand tracking: " + checks + " checks passed");
    }

    private static void associationAndDropout() {
        HandTrackingFilter filter = new HandTrackingFilter();
        List<HandTrackingFilter.Sample> first = filter.update(Arrays.asList(hand("Left", .28f, .60f, .25f), hand("Right", .72f, .60f, 1.1f)), 1000, 1f);
        String leftId = first.get(0).id, rightId = first.get(1).id;
        List<HandTrackingFilter.Sample> reordered = filter.update(Arrays.asList(hand("Left", .70f, .60f, 1.1f), hand("Right", .30f, .60f, .25f)), 1067, 1f);
        check(reordered.get(0).id.equals(leftId) && reordered.get(1).id.equals(rightId), "Classifier labels/order changed the physical hand identity");
        check(reordered.get(0).pinching && !reordered.get(1).pinching, "Pinch transferred to the other hand");
        List<HandTrackingFilter.Sample> missing = filter.update(Collections.emptyList(), 1200, 1f);
        check(missing.size() == 1 && missing.get(0).id.equals(leftId) && !missing.get(0).observed && missing.get(0).pinching, "Short occlusion should hold only the existing pinch");
        check(missing.get(0).x[8] == reordered.get(0).x[8], "Unobserved hand must never extrapolate a moving cursor");
        check(filter.update(Collections.emptyList(), 1300, 1f).isEmpty(), "Missing hand must not remain visible indefinitely");
        check(one(filter, hand("Right", .31f, .60f, .25f), 1350).get(0).id.equals(leftId), "Brief reacquisition lost the grab identity");
        List<HandTrackingFilter.Sample> expired = one(filter, hand("Right", .31f, .60f, .25f), 2100);
        check(!expired.get(0).id.equals(leftId), "Expired identity should not capture an unrelated later hand");
        String beforeReset = expired.get(0).id;
        filter.reset();
        check(!one(filter, hand("Right", .31f, .60f, .25f), 2200).get(0).id.equals(beforeReset), "Restart reused a captured hand identity");
    }

    private static void pinchHysteresis() {
        HandTrackingFilter filter = new HandTrackingFilter();
        check(one(filter, hand("Left", .5f, .6f, .25f), 1000).get(0).pinching, "Deliberate pinch was not recognized");
        check(one(filter, hand("Left", .5f, .6f, 1.15f), 1067).get(0).pinching, "One bad landmark frame released the pinch");
        check(one(filter, hand("Left", .5f, .6f, .25f), 1134).get(0).pinching, "Recovered pinch was lost");
        for (int i = 0; i < 5; i++) check(one(filter, hand("Left", .5f, .6f, .55f), 1201 + i * 67).get(0).pinching, "Threshold chatter released the pinch");
        boolean released = false;
        for (int i = 0; i < 5; i++) released |= !one(filter, hand("Left", .5f, .6f, 1.15f), 1600 + i * 67).get(0).pinching;
        check(released, "Sustained open fingers did not release promptly");
        check(!one(filter, hand("Left", .5f, .6f, .55f), 2000).get(0).pinching, "Open hand chattered back into pinch");
        check(one(filter, hand("Left", .5f, .6f, .25f), 2067).get(0).pinching, "Second intentional pinch was not recognized");
    }

    private static void aspectAndInvalidInput() {
        for (float aspect : new float[]{1f, 4f / 3f, 16f / 9f}) {
            HandTrackingFilter filter = new HandTrackingFilter();
            HandTrackingFilter.Observation observation = hand("Left", .5f, .6f, .3f);
            for (int i = 0; i < 21; i++) observation.y[i] = .6f + (observation.y[i] - .6f) * aspect;
            observation.x[4] = observation.x[8]; observation.y[4] = observation.y[8] + .3f * .12f * aspect;
            HandTrackingFilter.Sample sample = filter.update(Collections.singletonList(observation), 1000, aspect).get(0);
            check(Math.abs(sample.pinchRatio - .3f) < .001f && sample.pinching, "Image aspect changed physical pinch ratio");
        }
        HandTrackingFilter filter = new HandTrackingFilter();
        HandTrackingFilter.Observation invalid = hand("Left", .5f, .6f, .25f);
        invalid.x[8] = Float.NaN;
        check(one(filter, invalid, 1000).isEmpty(), "Invalid coordinate was published");
        check(one(filter, new HandTrackingFilter.Observation("Left", .9f, new float[21], new float[21]), 1067).isEmpty(), "Degenerate palm was published");
        check(one(filter, new HandTrackingFilter.Observation("Left", .9f, new float[8], new float[8]), 1134).isEmpty(), "Truncated hand was published");
    }

    private static void trajectoryMetrics() {
        HandTrackingFilter filter = new HandTrackingFilter();
        Random noise = new Random(20811);
        double rawSquared = 0, filteredSquared = 0;
        for (int i = 0; i < 300; i++) {
            float offset = (float)(noise.nextGaussian() * .004);
            HandTrackingFilter.Sample sample = one(filter, hand("Left", .5f + offset, .6f, .25f), 1000 + i * 67).get(0);
            if (i > 30) { rawSquared += offset * offset; filteredSquared += Math.pow(sample.x[8] - .5f, 2); }
        }
        double reduction = 1 - Math.sqrt(filteredSquared / rawSquared);
        check(reduction > .25, "Position filter did not reduce stationary jitter sufficiently: " + reduction);
        double maxLagMs = 0;
        for (int i = 0; i < 12; i++) {
            float target = .5f + (i + 1) * .025f;
            HandTrackingFilter.Sample sample = one(filter, hand("Left", target, .6f, .25f), 1000 + (300 + i) * 67).get(0);
            maxLagMs = Math.max(maxLagMs, (target - sample.x[8]) / (.025f / .067f) * 1000);
        }
        check(maxLagMs < 100, "Adaptive filter lagged a deliberate movement by " + maxLagMs + " ms");
        System.out.printf(java.util.Locale.ROOT, "Synthetic 15 Hz trajectory: stationary RMS jitter reduced %.1f%%; max filter lag %.1f ms.%n", reduction * 100, maxLagMs);
    }
}
