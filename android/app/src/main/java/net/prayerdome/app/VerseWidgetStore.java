package net.prayerdome.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/**
 * Member preferences for the Prayer Dome verse widget.
 *
 * <p>The widget itself, the Capacitor bridge ({@link VerseWidgetPlugin}) and the
 * settings screen at /widgets.html all read and write this one store, so a theme
 * chosen in the app is on the lock screen the next time the widget refreshes.
 *
 * <p>The widget normally rotates through the four daily verses. A member can also
 * pin one verse — "Be still, and know that I am God" over a hard week — and the
 * widget then shows that verse until it is unpinned.
 */
public final class VerseWidgetStore {

    public static final String THEME_MIDNIGHT = "midnight";
    public static final String THEME_DOME = "dome";
    public static final String THEME_DAWN = "dawn";
    public static final String THEME_PAPER = "paper";
    public static final String[] THEMES = {THEME_MIDNIGHT, THEME_DOME, THEME_DAWN, THEME_PAPER};

    public static final String MODE_AUTO = "auto";
    public static final String MODE_PINNED = "pinned";

    private static final String STORE = "pd_verse_widget";
    private static final String KEY_THEME = "theme";
    private static final String KEY_TEXT_SCALE = "textScale";
    private static final String KEY_SHOW_GREETING = "showGreeting";
    private static final String KEY_SHOW_REFERENCE = "showReference";
    private static final String KEY_SHOW_BRAND = "showBrand";
    private static final String KEY_MODE = "mode";
    private static final String KEY_PINNED_REF = "pinnedRef";
    private static final String KEY_PINNED_TEXT = "pinnedText";
    private static final String KEY_PINNED_LABEL = "pinnedLabel";

    private final SharedPreferences preferences;

    private VerseWidgetStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    public static VerseWidgetStore get(Context context) {
        return new VerseWidgetStore(context);
    }

    public String theme() {
        String value = preferences.getString(KEY_THEME, THEME_MIDNIGHT);
        for (String theme : THEMES) {
            if (theme.equals(value)) return theme;
        }
        return THEME_MIDNIGHT;
    }

    public void setTheme(String theme) {
        for (String known : THEMES) {
            if (known.equals(theme)) {
                preferences.edit().putString(KEY_THEME, known).apply();
                return;
            }
        }
    }

    /** 0.85 – 1.35; the widget scales the Scripture text and nothing else. */
    public float textScale() {
        float value = preferences.getFloat(KEY_TEXT_SCALE, 1f);
        return Math.max(0.85f, Math.min(1.35f, value));
    }

    public void setTextScale(float scale) {
        preferences.edit().putFloat(KEY_TEXT_SCALE, Math.max(0.85f, Math.min(1.35f, scale))).apply();
    }

    public boolean showGreeting() {
        return preferences.getBoolean(KEY_SHOW_GREETING, true);
    }

    public boolean showReference() {
        return preferences.getBoolean(KEY_SHOW_REFERENCE, true);
    }

    public boolean showBrand() {
        return preferences.getBoolean(KEY_SHOW_BRAND, true);
    }

    public boolean isPinned() {
        return MODE_PINNED.equals(preferences.getString(KEY_MODE, MODE_AUTO)) && !pinnedText().isEmpty();
    }

    public String pinnedReference() {
        return preferences.getString(KEY_PINNED_REF, "");
    }

    public String pinnedText() {
        return preferences.getString(KEY_PINNED_TEXT, "");
    }

    public String pinnedLabel() {
        return preferences.getString(KEY_PINNED_LABEL, "");
    }

    public void pin(String reference, String text, String label) {
        preferences.edit()
                .putString(KEY_MODE, MODE_PINNED)
                .putString(KEY_PINNED_REF, reference == null ? "" : reference)
                .putString(KEY_PINNED_TEXT, text == null ? "" : text)
                .putString(KEY_PINNED_LABEL, label == null ? "" : label)
                .apply();
    }

    public void unpin() {
        preferences.edit().remove(KEY_MODE).apply();
    }

    /** Apply a preference payload sent from /widgets.html through the Capacitor bridge. */
    public void applyPreferences(JSONObject payload) {
        if (payload == null) return;
        SharedPreferences.Editor editor = preferences.edit();
        if (payload.has(KEY_THEME)) {
            String theme = payload.optString(KEY_THEME, THEME_MIDNIGHT);
            for (String known : THEMES) {
                if (known.equals(theme)) editor.putString(KEY_THEME, known);
            }
        }
        if (payload.has(KEY_TEXT_SCALE)) {
            editor.putFloat(KEY_TEXT_SCALE, (float) Math.max(0.85, Math.min(1.35, payload.optDouble(KEY_TEXT_SCALE, 1))));
        }
        if (payload.has(KEY_SHOW_GREETING)) editor.putBoolean(KEY_SHOW_GREETING, payload.optBoolean(KEY_SHOW_GREETING, true));
        if (payload.has(KEY_SHOW_REFERENCE)) editor.putBoolean(KEY_SHOW_REFERENCE, payload.optBoolean(KEY_SHOW_REFERENCE, true));
        if (payload.has(KEY_SHOW_BRAND)) editor.putBoolean(KEY_SHOW_BRAND, payload.optBoolean(KEY_SHOW_BRAND, true));
        editor.apply();
    }

    /** Everything the settings screen needs to render the current state. */
    public JSONObject toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("theme", theme());
            json.put("textScale", textScale());
            json.put("showGreeting", showGreeting());
            json.put("showReference", showReference());
            json.put("showBrand", showBrand());
            json.put("mode", isPinned() ? MODE_PINNED : MODE_AUTO);
            json.put("pinnedReference", pinnedReference());
            json.put("pinnedText", pinnedText());
            json.put("pinnedLabel", pinnedLabel());
            json.put("themes", new org.json.JSONArray(THEMES));
        } catch (Exception ignored) {
            // JSONObject.put only throws for non-serialisable values; never for these.
        }
        return json;
    }
}
