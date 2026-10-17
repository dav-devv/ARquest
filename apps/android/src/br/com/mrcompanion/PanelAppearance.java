package br.com.mrcompanion;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

/** Cached panel artwork; render only when its title or interaction state changes. */
public final class PanelAppearance {
    public static final int WIDTH = 1024, HEIGHT = 640;
    public static final float LEFT = 24, TOP = 24, RIGHT = 1000, BOTTOM = 552;
    public static final float RADIUS = 32;
    public static final float CLOSE_LEFT = 892, CLOSE_TOP = 44, CLOSE_RIGHT = 976, CLOSE_BOTTOM = 128;
    public static final float GRAB_LEFT = 368, GRAB_TOP = 578, GRAB_RIGHT = 656, GRAB_BOTTOM = 618;

    // Renderer UV coordinates: u grows to the right; v grows from the bottom up.
    public static final float CLOSE_U_MIN = CLOSE_LEFT / WIDTH, CLOSE_U_MAX = CLOSE_RIGHT / WIDTH;
    public static final float CLOSE_V_MIN = 1 - CLOSE_BOTTOM / HEIGHT, CLOSE_V_MAX = 1 - CLOSE_TOP / HEIGHT;
    public static final float GRAB_U_MIN = 328f / WIDTH, GRAB_U_MAX = 696f / WIDTH;
    public static final float GRAB_V_MIN = 1 - 632f / HEIGHT, GRAB_V_MAX = 1 - 564f / HEIGHT;
    public static final float PANEL_U_MIN = LEFT / WIDTH, PANEL_U_MAX = RIGHT / WIDTH;
    public static final float PANEL_V_MIN = 1 - BOTTOM / HEIGHT, PANEL_V_MAX = 1 - TOP / HEIGHT;

    private static final int TEXT = Color.rgb(245, 248, 252);
    private static final int MUTED = Color.rgb(172, 186, 204);
    private static final int ACCENT = Color.rgb(159, 214, 255);
    private static final Typeface REGULAR = Typeface.create("sans-serif", Typeface.NORMAL);
    private static final Typeface MEDIUM = Typeface.create("sans-serif-medium", Typeface.NORMAL);

    private PanelAppearance() {}

    public static boolean isClose(float u, float v) {
        return inside(u, v, CLOSE_U_MIN, CLOSE_V_MIN, CLOSE_U_MAX, CLOSE_V_MAX);
    }

    public static boolean isGrab(float u, float v) {
        return inside(u, v, GRAB_U_MIN, GRAB_V_MIN, GRAB_U_MAX, GRAB_V_MAX);
    }

    public static boolean isSurface(float u, float v) {
        float x = u * WIDTH, y = (1 - v) * HEIGHT;
        if (!inside(x, y, LEFT, TOP, RIGHT, BOTTOM)) return false;
        float dx = Math.max(Math.max(LEFT + RADIUS - x, 0), x - (RIGHT - RADIUS));
        float dy = Math.max(Math.max(TOP + RADIUS - y, 0), y - (BOTTOM - RADIUS));
        return dx * dx + dy * dy <= RADIUS * RADIUS;
    }

    /** Corner order matches the renderer: bottom left, bottom right, top right, top left. */
    public static int cornerAt(float u, float v) {
        float x = u * WIDTH, y = (1 - v) * HEIGHT;
        for (int i = 0; i < 4; i++) {
            float dx = x - (i == 0 || i == 3 ? 44 : 980), dy = y - (i < 2 ? 532 : 44);
            if (dx * dx + dy * dy <= 58 * 58) return i;
        }
        return -1;
    }

    private static boolean inside(float x, float y, float left, float top, float right, float bottom) {
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    public static Bitmap render(String name, boolean selected, boolean dragging) {
        Bitmap image = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(image);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        RectF surface = new RectF(LEFT, TOP, RIGHT, BOTTOM);

        // Small layered silhouette; no blur filter and no shadow drawn over text.
        for (int spread = 16; spread >= 2; spread -= 2) {
            paint.setColor(Color.argb(5, 3, 8, 15));
            canvas.drawRoundRect(new RectF(LEFT - spread, TOP - spread + 4,
                    RIGHT + spread, BOTTOM + spread + 4), RADIUS + spread, RADIUS + spread, paint);
        }
        paint.setShader(new LinearGradient(0, TOP, 0, BOTTOM,
                Color.argb(246, 35, 45, 59), Color.argb(246, 24, 31, 43), Shader.TileMode.CLAMP));
        canvas.drawRoundRect(surface, RADIUS, RADIUS, paint);
        paint.setShader(null);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dragging ? 3.5f : selected ? 2.5f : 1.5f);
        paint.setColor(dragging ? Color.rgb(195, 232, 255) : selected ? Color.argb(175, 159, 214, 255)
                : Color.argb(48, 210, 225, 245));
        canvas.drawRoundRect(surface, RADIUS, RADIUS, paint);
        paint.setStyle(Paint.Style.FILL);

        text(canvas, paint, "ARquest", 64, 67, 19, MUTED, MEDIUM, Paint.Align.LEFT);
        text(canvas, paint, fit(name == null || name.trim().isEmpty() ? "Painel" : name, paint, 790, 32),
                64, 108, 32, TEXT, MEDIUM, Paint.Align.LEFT);

        paint.setColor(Color.argb(30, 220, 233, 250));
        canvas.drawRoundRect(new RectF(906, 58, 962, 114), 28, 28, paint);
        paint.setStrokeWidth(2.8f);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(TEXT);
        canvas.drawLine(925, 77, 943, 95, paint);
        canvas.drawLine(943, 77, 925, 95, paint);
        paint.setStrokeCap(Paint.Cap.BUTT);

        paint.setColor(Color.argb(28, 210, 225, 245));
        canvas.drawRect(64, 135, 960, 136, paint);

        // The panel currently has no streamed desktop content; keep its empty state honest.
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2.5f);
        paint.setColor(Color.argb(200, 159, 214, 255));
        canvas.drawRoundRect(new RectF(480, 217, 544, 263), 10, 10, paint);
        canvas.drawLine(498, 278, 526, 278, paint);
        paint.setStyle(Paint.Style.FILL);
        text(canvas, paint, "Painel espacial", 512, 333, 38, TEXT, MEDIUM, Paint.Align.CENTER);
        text(canvas, paint, "Pinça na barra para mover no ambiente", 512, 385, 27, MUTED, REGULAR, Paint.Align.CENTER);
        text(canvas, paint, "Duas pinças para ajustar o tamanho", 512, 426, 27, MUTED, REGULAR, Paint.Align.CENTER);

        if (selected || dragging) {
            int color = dragging ? Color.rgb(195, 232, 255) : ACCENT;
            drawCorners(canvas, paint, color);
            text(canvas, paint, dragging ? "MOVENDO" : "SELECIONADO", 512, 505, 17,
                    color, MEDIUM, Paint.Align.CENTER);
        }

        paint.setColor(Color.argb(dragging ? 254 : selected ? 244 : 218, 39, 48, 62));
        canvas.drawRoundRect(new RectF(GRAB_LEFT, GRAB_TOP, GRAB_RIGHT, GRAB_BOTTOM), 20, 20, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.5f);
        paint.setColor(selected || dragging ? Color.argb(185, 159, 214, 255) : Color.argb(64, 220, 233, 250));
        canvas.drawRoundRect(new RectF(GRAB_LEFT, GRAB_TOP, GRAB_RIGHT, GRAB_BOTTOM), 20, 20, paint);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(dragging ? Color.WHITE : selected ? ACCENT : Color.rgb(190, 202, 216));
        canvas.drawRoundRect(new RectF(458, 595, 566, 601), 3, 3, paint);
        return image;
    }

    private static void drawCorners(Canvas canvas, Paint paint, int color) {
        paint.setColor(color);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeWidth(3.5f);
        float inset = 15, length = 19;
        float x1 = LEFT + inset, x2 = RIGHT - inset, y1 = TOP + inset, y2 = BOTTOM - inset;
        canvas.drawLine(x1, y1 + length, x1, y1 + 7, paint);
        canvas.drawLine(x1 + 7, y1, x1 + length, y1, paint);
        canvas.drawLine(x2 - length, y1, x2 - 7, y1, paint);
        canvas.drawLine(x2, y1 + 7, x2, y1 + length, paint);
        canvas.drawLine(x1, y2 - length, x1, y2 - 7, paint);
        canvas.drawLine(x1 + 7, y2, x1 + length, y2, paint);
        canvas.drawLine(x2 - length, y2, x2 - 7, y2, paint);
        canvas.drawLine(x2, y2 - length, x2, y2 - 7, paint);
        paint.setStrokeCap(Paint.Cap.BUTT);
        paint.setStyle(Paint.Style.FILL);
    }

    private static void text(Canvas canvas, Paint paint, String value, float x, float baseline,
                             float size, int color, Typeface typeface, Paint.Align align) {
        paint.setColor(color);
        paint.setTypeface(typeface);
        paint.setTextSize(size);
        paint.setTextAlign(align);
        canvas.drawText(value, x, baseline, paint);
    }

    private static String fit(String value, Paint paint, float maxWidth, float size) {
        paint.setTypeface(MEDIUM);
        paint.setTextSize(size);
        String line = value.replace('\n', ' ').replace('\r', ' ');
        if (paint.measureText(line) <= maxWidth) return line;
        int end = line.length();
        while (end > 0 && paint.measureText(line.substring(0, end) + "…") > maxWidth) end--;
        if (end > 0 && Character.isHighSurrogate(line.charAt(end - 1))) end--;
        return line.substring(0, end) + "…";
    }
}
