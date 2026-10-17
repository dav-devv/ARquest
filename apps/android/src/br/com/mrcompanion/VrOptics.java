package br.com.mrcompanion;

/** Pixel translations only: alignment must never change camera magnification. */
public final class VrOptics {
    private VrOptics() {}
    public static float bounded(double value,float min,float max) {
        if(Double.isNaN(value)||Double.isInfinite(value)||value<min||value>max)
            throw new IllegalArgumentException("Ajuste fora do intervalo permitido.");
        return (float)value;
    }
    public static float shiftX(float convergence,int eyeWidth,boolean right) {
        return (right?-1:1)*2f*convergence/Math.max(1,eyeWidth);
    }
    public static float shiftY(float height,float balance,int screenHeight,boolean right) {
        return 2f*(height+(right?-.5f:.5f)*balance)/Math.max(1,screenHeight);
    }
    public static float displayX(float cameraX,int eyeWidth,float shiftX) {
        return cameraX+shiftX*.5f*eyeWidth;
    }
    public static float displayY(float cameraY,int screenHeight,float shiftY) {
        return cameraY-shiftY*.5f*screenHeight;
    }
}
