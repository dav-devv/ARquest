package br.com.mrcompanion;

import java.util.ArrayList;
import java.util.List;

/** Temporal hand association and gesture filtering, independent of camera/UI code. */
final class HandTrackingFilter {
    static final class Observation {
        final String label;
        final float score;
        final float[] x, y;
        Observation(String label, float score, float[] x, float[] y) {
            this.label = label;
            this.score = score;
            this.x = x;
            this.y = y;
        }
    }

    static final class Sample {
        final String id;
        final float[] x, y;
        final float pinchRatio, score;
        // Optical rays must use the landmark from this image, before temporal smoothing.
        final float imageIndexX, imageIndexY;
        final boolean pinching, observed;
        Sample(Track track, boolean observed) {
            id = track.id;
            x = track.x.clone();
            y = track.y.clone();
            pinchRatio = track.ratio;
            score = track.score;
            imageIndexX = track.rawX[8];
            imageIndexY = track.rawY[8];
            pinching = track.pinching;
            this.observed = observed;
        }
    }

    private static final long TRACK_TTL_MS = 650;
    private static final long PINCH_HOLD_MS = 220;
    private final ArrayList<Track> tracks = new ArrayList<>();
    private int nextId;

    synchronized void reset() {
        tracks.clear();
        // Never reuse an identity after disabling/re-enabling hands.
    }

    synchronized List<Sample> update(List<Observation> input, long time, float imageAspect) {
        float aspect = finite(imageAspect) && imageAspect > .1f ? imageAspect : 1f;
        ArrayList<Observation> observations = new ArrayList<>();
        for (Observation observation : input) {
            if (observations.size() == 2) break;
            if (valid(observation, aspect)) observations.add(observation);
        }
        for (int i = tracks.size() - 1; i >= 0; i--) {
            if (time - tracks.get(i).lastSeen > TRACK_TTL_MS) tracks.remove(i);
        }

        // Exhaustively associate at most two observations, allowing an unmatched hand.
        // Position/velocity dominate; handedness is only a weak hint and may flip.
        int[] best = {-1, -1};
        double bestCost = Double.POSITIVE_INFINITY;
        for (int a = -1; a < tracks.size(); a++) {
            for (int b = -1; b < tracks.size(); b++) {
                if (a >= 0 && a == b) continue;
                if (observations.size() < 2 && b != -1) continue;
                if (observations.isEmpty() && a != -1) continue;
                double cost = observations.isEmpty() ? 0 : assignmentCost(a, observations.get(0), time, aspect);
                if (observations.size() == 2) cost += assignmentCost(b, observations.get(1), time, aspect);
                if (cost < bestCost) { bestCost = cost; best[0] = a; best[1] = b; }
            }
        }
        ArrayList<Track> matched = new ArrayList<>();
        for (int i = 0; i < observations.size(); i++) {
            Observation observation = observations.get(i);
            Track track;
            if (best[i] >= 0) track = tracks.get(best[i]);
            else {
                // Prefer removing a missing old track to ever publishing >2 hands.
                track = new Track((observation.label == null ? "Hand" : observation.label) + "#" + (++nextId));
            }
            track.update(observation, time, aspect);
            matched.add(track);
        }
        for (Track track : matched) if (!tracks.contains(track)) tracks.add(track);
        while (tracks.size() > 2) {
            Track oldest = null;
            for (Track track : tracks) if (!matched.contains(track) && (oldest == null || track.lastSeen < oldest.lastSeen)) oldest = track;
            if (oldest == null) break;
            tracks.remove(oldest);
        }
        ArrayList<Sample> output = new ArrayList<>();
        // Track order stays stable even if MediaPipe returns hands in another order.
        for (Track track : tracks) {
            boolean observed = matched.contains(track);
            if (observed || (track.pinching && time - track.lastSeen <= PINCH_HOLD_MS)) output.add(new Sample(track, observed));
        }
        return output;
    }

    private double assignmentCost(int index, Observation observation, long time, float aspect) {
        if (index < 0) return .10;
        Track track = tracks.get(index);
        float dt = Math.min(.12f, Math.max(0f, (time - track.lastSeen) / 1000f));
        float dx = center(observation.x) - track.cx - track.vx * dt;
        float dy = (center(observation.y) - track.cy - track.vy * dt) / aspect;
        float distance = (float)Math.hypot(dx, dy);
        float palm = palmSize(observation.x, observation.y, aspect);
        float gate = Math.max(.16f, Math.min(.40f, track.palm * 2.8f));
        if (distance > gate || palm / track.palm > 3.5f || track.palm / palm > 3.5f) return 1e6;
        float scaleChange = (float)Math.abs(Math.log(palm / track.palm));
        boolean sameLabel = observation.label != null && observation.label.equals(track.label);
        return distance * distance + .008f * scaleChange + (sameLabel || observation.score < .8f ? 0 : .0025f);
    }

    private static boolean valid(Observation observation, float aspect) {
        if (observation == null || observation.x == null || observation.y == null || observation.x.length < 21 || observation.y.length < 21) return false;
        for (int i = 0; i < 21; i++) {
            if (!finite(observation.x[i]) || !finite(observation.y[i]) || observation.x[i] < -.3f || observation.x[i] > 1.3f || observation.y[i] < -.3f || observation.y[i] > 1.3f) return false;
        }
        float palm = palmSize(observation.x, observation.y, aspect);
        return palm >= .012f && palm <= 1f;
    }

    private static float center(float[] values) { return (values[0] + values[5] + values[9] + values[13] + values[17]) * .2f; }
    private static boolean finite(float value) { return !Float.isNaN(value) && !Float.isInfinite(value); }
    private static float metricDistance(float[] x, float[] y, int a, int b, float aspect) {
        return (float)Math.hypot(x[a] - x[b], (y[a] - y[b]) / aspect);
    }
    private static float palmSize(float[] x, float[] y, float aspect) {
        // Longitudinal scale keeps a turned palm from looking artificially tiny.
        return Math.max(metricDistance(x, y, 5, 17, aspect), .75f * metricDistance(x, y, 0, 9, aspect));
    }
    private static float alpha(float cutoff, float dt) { return 1f / (1f + 1f / (2f * (float)Math.PI * cutoff * dt)); }

    private static final class Track {
        final String id;
        final float[] x = new float[21], y = new float[21], rawX = new float[21], rawY = new float[21], dx = new float[21], dy = new float[21];
        String label;
        float cx, cy, vx, vy, palm, ratio, score;
        long lastSeen, openSince = -1;
        int openSamples;
        boolean pinching, initialized;
        Track(String id) { this.id = id; }

        void update(Observation observation, long time, float aspect) {
            float dt = Math.max(.001f, Math.min(.25f, (time - lastSeen) / 1000f));
            boolean reset = !initialized || time - lastSeen > 300;
            float nextCx = center(observation.x), nextCy = center(observation.y);
            if (reset) { vx = 0; vy = 0; }
            else {
                vx = .5f * vx + .5f * Math.max(-2f, Math.min(2f, (nextCx - cx) / dt));
                vy = .5f * vy + .5f * Math.max(-2f, Math.min(2f, (nextCy - cy) / dt));
            }
            for (int i = 0; i < 21; i++) {
                if (reset) { x[i] = observation.x[i]; y[i] = observation.y[i]; dx[i] = 0; dy[i] = 0; }
                else {
                    float derivativeAlpha = alpha(1.2f, dt);
                    dx[i] += derivativeAlpha * ((observation.x[i] - rawX[i]) / dt - dx[i]);
                    dy[i] += derivativeAlpha * ((observation.y[i] - rawY[i]) / dt - dy[i]);
                    float speed = (float)Math.hypot(dx[i], dy[i] / aspect);
                    float positionAlpha = alpha(1.35f + 12f * speed, dt);
                    x[i] += positionAlpha * (observation.x[i] - x[i]);
                    y[i] += positionAlpha * (observation.y[i] - y[i]);
                }
                rawX[i] = observation.x[i]; rawY[i] = observation.y[i];
            }
            palm = palmSize(observation.x, observation.y, aspect);
            float measuredRatio = metricDistance(observation.x, observation.y, 4, 8, aspect) / palm;
            ratio = reset ? measuredRatio : ratio + alpha(8f, dt) * (measuredRatio - ratio);
            if (pinching) {
                if (ratio > .65f) {
                    if (openSince < 0) openSince = time;
                    openSamples++;
                    if (openSamples >= 2 && time - openSince >= 135) pinching = false;
                } else { openSince = -1; openSamples = 0; }
            } else if (ratio < .42f) { pinching = true; openSince = -1; openSamples = 0; }
            else { openSince = -1; openSamples = 0; }
            cx = nextCx; cy = nextCy; label = observation.label; score = observation.score;
            initialized = true; lastSeen = time;
        }
    }
}
