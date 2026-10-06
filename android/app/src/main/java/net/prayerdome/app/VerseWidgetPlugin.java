package net.prayerdome.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Calendar;

/**
 * Capacitor bridge between /widgets.html and the native verse widget.
 *
 * <p>The settings page is a normal web page, so it can only touch the widget
 * through the app it runs in. This plugin is that door:
 *
 * <ul>
 *   <li>{@code getState} — what the widget is showing, which theme is set and
 *       whether a widget has been placed yet;</li>
 *   <li>{@code setPreferences} — theme, text size and the greeting/reference/
 *       brand toggles;</li>
 *   <li>{@code pinVerse} / {@code clearPin} — keep one verse on the widget;</li>
 *   <li>{@code refresh} — redraw immediately;</li>
 *   <li>{@code requestPin} — ask Android to place the widget on the home screen
 *       (Android 8.0+, where the launcher supports the request);</li>
 *   <li>{@code pendingRoute} — where a member tapped in from, so the app can
 *       open the verse studio when the widget was the entry point.</li>
 * </ul>
 *
 * <p>On the website (no Capacitor) every call is answered by
 * {@code assets/pd-widget.js} with {@code available: false}, and the page shows
 * the manual instructions instead.
 */
@CapacitorPlugin(name = "VerseWidget")
public class VerseWidgetPlugin extends Plugin {

    private static final String TAG = "VerseWidgetPlugin";

    /* ------------------------------------------------------------- state */
    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(state());
    }

    /* ------------------------------------------------------- preferences */
    @PluginMethod
    public void setPreferences(PluginCall call) {
        JSONObject payload = call.getData();
        if (payload != null && payload.has("preferences")) {
            payload = payload.optJSONObject("preferences");
        }
        if (payload == null) {
            call.reject("No preferences were sent");
            return;
        }
        VerseWidgetStore.get(getContext()).applyPreferences(payload);
        VerseWidgetProvider.refresh(getContext());
        call.resolve(state());
    }

    /* -------------------------------------------------------- pin a verse */
    @PluginMethod
    public void pinVerse(PluginCall call) {
        String reference = call.getString("reference", "").trim();
        String text = call.getString("text", "").trim();
        if (reference.isEmpty() || text.isEmpty()) {
            call.reject("A pinned verse needs both a reference and the Scripture text");
            return;
        }
        String label = call.getString("label", "Pinned verse");
        VerseWidgetStore.get(getContext()).pin(reference, text, label);
        VerseWidgetProvider.refresh(getContext());
        call.resolve(state());
    }

    @PluginMethod
    public void clearPin(PluginCall call) {
        VerseWidgetStore.get(getContext()).unpin();
        VerseWidgetProvider.refresh(getContext());
        call.resolve(state());
    }

    /* ------------------------------------------------------------ redraw */
    @PluginMethod
    public void refresh(PluginCall call) {
        VerseWidgetProvider.refresh(getContext());
        call.resolve(state());
    }

    /* ---------------------------------------------- add the widget itself */
    @PluginMethod
    public void requestPin(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("requested", false);
            result.put("reason", "unsupported");
            call.resolve(result);
            return;
        }
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        if (!manager.isRequestPinAppWidgetSupported()) {
            result.put("requested", false);
            result.put("reason", "launcher");
            call.resolve(result);
            return;
        }
        ComponentName provider = new ComponentName(getContext(), VerseWidgetProvider.class);
        manager.requestPinAppWidget(provider, null, null);
        result.put("requested", true);
        call.resolve(result);
    }

    /* ------------------------------------------- where the member came in */
    @PluginMethod
    public void pendingRoute(PluginCall call) {
        JSObject result = new JSObject();
        String route = "";
        try {
            if (getActivity() != null && getActivity().getIntent() != null) {
                route = getActivity().getIntent().getStringExtra("pd_route");
                if (route != null && !route.isEmpty()) {
                    getActivity().getIntent().removeExtra("pd_route");
                }
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not read the launch route", error);
        }
        result.put("route", route == null ? "" : route);
        call.resolve(result);
    }

    /* ------------------------------------------------------------ helpers */
    private JSObject state() {
        VerseWidgetStore store = VerseWidgetStore.get(getContext());
        VerseWidgetData data = VerseWidgetData.get(getContext());
        JSObject state = new JSObject();

        int[] placed = new int[0];
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
            placed = manager.getAppWidgetIds(new ComponentName(getContext(), VerseWidgetProvider.class));
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not list placed widgets", error);
        }

        state.put("available", true);
        state.put("placed", placed.length);
        state.put("canPin", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        state.put("verified", data.isVerified());
        state.put("preferences", store.toJson());

        Calendar now = Calendar.getInstance();
        VerseWidgetData.Verse verse = VerseWidgetRenderer.resolveVerse(getContext(), store, now);
        JSObject current = new JSObject();
        current.put("reference", verse.reference);
        current.put("text", verse.text);
        current.put("slot", store.isPinned() ? "pinned" : data.currentSlot(now).id);
        current.put("slotLabel", store.isPinned() ? "Pinned verse" : data.currentSlot(now).label);
        current.put("greeting", store.isPinned() ? "Pinned verse" : data.currentSlot(now).greeting);
        current.put("translation", "KJV");
        state.put("verse", current);

        JSArray slots = new JSArray();
        for (VerseWidgetData.Slot slot : data.slots()) {
            JSObject item = new JSObject();
            item.put("id", slot.id);
            item.put("label", slot.label);
            item.put("greeting", slot.greeting);
            item.put("defaultTime", slot.defaultTime);
            slots.put(item);
        }
        state.put("slots", slots);
        return state;
    }
}
