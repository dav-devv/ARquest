import br.com.mrcompanion.PlaneGeometry;
import java.util.ArrayList;
import java.util.Arrays;

public final class PlaneGeometryTest {
    static int checks;
    static void yes(boolean value) { checks++; if (!value) throw new AssertionError(); }
    static void near(float a, float b) { checks++; if (Math.abs(a - b) > 1e-6f) throw new AssertionError(a + " != " + b); }
    public static void main(String[] args) {
        float[] polygon = {-1, 1, 1, 1, 1, 3, -1, 3};
        yes(PlaneGeometry.containsXZ(0, 2, polygon));
        yes(!PlaneGeometry.containsXZ(0, .02f, polygon));
        yes(!PlaneGeometry.containsXZ(2, 2, polygon));
        yes(PlaneGeometry.containsXZ(1, 2, polygon));
        yes(PlaneGeometry.containsXZ(-1, 1, polygon));
        float[] reversed = {-1, 3, 1, 3, 1, 1, -1, 1};
        yes(PlaneGeometry.containsXZ(0, 2, reversed));
        float[] concave = {0, 0, 3, 0, 3, 1, 1, 1, 1, 3, 0, 3};
        yes(PlaneGeometry.containsXZ(.5f, 2, concave));
        yes(!PlaneGeometry.containsXZ(2, 2, concave));
        yes(!PlaneGeometry.containsXZ(Float.NaN, 2, polygon));
        yes(!PlaneGeometry.containsXZ(0, 2, new float[]{0, 0, 1}));

        // Z measures distance along the plane; only Y measures error normal to it.
        ArrayList<float[]> floor = new ArrayList<>(Arrays.asList(
            new float[]{0, .01f, 1.2f}, new float[]{.1f, .02f, 2},
            new float[]{-.1f, .03f, 2.5f}, new float[]{0, .08f, 2},
            new float[]{0, -.4f, 2}, new float[]{5, .01f, 2},
            new float[]{0, Float.NaN, 2}));
        PlaneGeometry.Fit fit = PlaneGeometry.fitDepth(floor, polygon, .12f);
        yes(fit.inliers == 4); yes(fit.projected == 5);
        near(fit.support, .8f); near(fit.offset, .025f);

        // A vertical wall is a rigid rotation of the same local plane. Transform world
        // samples back from wall coordinates and verify the fit is orientation independent.
        ArrayList<float[]> wall = new ArrayList<>();
        for (float[] local : floor) {
            float[] world = {local[0] + 4, -local[2] + 7, local[1] - 3};
            wall.add(new float[]{world[0] - 4, world[2] + 3, 7 - world[1]});
        }
        PlaneGeometry.Fit wallFit = PlaneGeometry.fitDepth(wall, polygon, .12f);
        yes(wallFit.inliers == fit.inliers); yes(wallFit.projected == fit.projected);
        near(wallFit.offset, fit.offset); near(wallFit.support, fit.support);
        float[] correction = PlaneGeometry.normalTranslation(-.03f);
        near(correction[0], 0); near(correction[1], -.03f); near(correction[2], 0);
        PlaneGeometry.Fit absent = PlaneGeometry.fitDepth(Arrays.asList(new float[]{0, .5f, 2}), polygon, .12f);
        yes(absent.inliers == 0); near(absent.support, 0); near(absent.offset, 0);
        System.out.println("Plane geometry: " + checks + " checks passed");
    }
}
