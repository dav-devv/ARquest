package br.com.mrcompanion;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;

/** Geometry in ARCore plane coordinates: polygon axes X/Z and surface normal Y. */
public final class PlaneGeometry {
    private PlaneGeometry() {}

    public static final class Fit {
        public final int inliers, projected;
        public final float support, offset;

        Fit(int inliers, int projected, float offset) {
            this.inliers = inliers;
            this.projected = projected;
            this.support = projected == 0 ? 0f : inliers / (float) projected;
            this.offset = offset;
        }
    }

    public static boolean containsXZ(float x, float z, float[] polygon) {
        if (!finite(x) || !finite(z) || polygon == null || polygon.length < 6 || polygon.length % 2 != 0)
            return false;
        for (float coordinate : polygon) if (!finite(coordinate)) return false;
        boolean inside = false;
        int count = polygon.length / 2;
        for (int i = 0, j = count - 1; i < count; j = i++) {
            float ax = polygon[j * 2], az = polygon[j * 2 + 1];
            float bx = polygon[i * 2], bz = polygon[i * 2 + 1];
            float dx = bx - ax, dz = bz - az;
            float lengthSquared = dx * dx + dz * dz;
            float t = lengthSquared > 0f ? ((x - ax) * dx + (z - az) * dz) / lengthSquared : 0f;
            if (t >= 0f && t <= 1f) {
                float ex = x - (ax + t * dx), ez = z - (az + t * dz);
                if (ex * ex + ez * ez <= 1e-10f) return true;
            }
            if ((az > z) != (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax)
                inside = !inside;
        }
        return inside;
    }

    /** Robust signed distance from the plane, using points already transformed to its local frame. */
    public static Fit fitDepth(Collection<float[]> localPoints, float[] polygon, float maxNormalDistance) {
        ArrayList<Float> residuals = new ArrayList<>();
        int projected = 0;
        if (localPoints == null || !finite(maxNormalDistance) || maxNormalDistance <= 0f)
            return new Fit(0, 0, 0f);
        for (float[] point : localPoints) {
            if (point == null || point.length < 3 || !finite(point[1]) || !containsXZ(point[0], point[2], polygon))
                continue;
            projected++;
            if (Math.abs(point[1]) <= maxNormalDistance) residuals.add(point[1]);
        }
        if (residuals.isEmpty()) return new Fit(0, projected, 0f);
        Collections.sort(residuals);
        int middle = residuals.size() / 2;
        float median = residuals.size() % 2 == 0
            ? (residuals.get(middle - 1) + residuals.get(middle)) * .5f
            : residuals.get(middle);
        return new Fit(residuals.size(), projected, median);
    }

    /** A correction along the local surface normal, for Pose.compose(). */
    public static float[] normalTranslation(float correction) {
        if (!finite(correction)) throw new IllegalArgumentException("Invalid plane correction");
        return new float[]{0f, correction, 0f};
    }

    private static boolean finite(float value) {
        return !Float.isNaN(value) && !Float.isInfinite(value);
    }
}
