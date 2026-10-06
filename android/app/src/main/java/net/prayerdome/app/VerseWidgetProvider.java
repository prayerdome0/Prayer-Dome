package net.prayerdome.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import java.util.Calendar;

/**
 * The Prayer Dome verse widget — God's Word on the phone, outside the app.
 *
 * <p>The widget appears in the Android widget picker as "Daily Verse" and can be
 * placed on the home screen, and on the lock screen wherever Android shows
 * widgets there (Android 15 QPR1 and later tablets, Android 16 QPR1 and later
 * phones, plus launchers and OEM lock screens that support the keyguard
 * category). Android shares every widget with the lock screen automatically —
 * no separate lock screen build is needed — and the verse is rendered without
 * unlocking the phone.
 *
 * <p>Three things keep the verse current:
 * <ul>
 *   <li>the system's APPWIDGET_UPDATE when a widget is added or the phone
 *       restarts;</li>
 *   <li>the alarm in {@link VerseWidgetScheduler}, armed for the next slot
 *       boundary;</li>
 *   <li>the refresh target on the card itself, for a member who wants to see the
 *       next verse immediately.</li>
 * </ul>
 *
 * <p>Preferences changed in the app (theme, text size, a pinned verse) arrive
 * through {@link VerseWidgetPlugin}, which calls {@link #refresh(Context)}.
 */
public class VerseWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "VerseWidget";

    /** Redraw now (refresh target, settings changed, boot, package replaced). */
    public static final String ACTION_REFRESH = "net.prayerdome.app.action.VERSE_WIDGET_REFRESH";
    /** The slot-boundary alarm fired: redraw and arm the next one. */
    public static final String ACTION_TICK = "net.prayerdome.app.action.VERSE_WIDGET_TICK";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        VerseWidgetStore store = VerseWidgetStore.get(context);
        Calendar now = Calendar.getInstance();
        for (int appWidgetId : appWidgetIds) {
            manager.updateAppWidget(appWidgetId,
                    VerseWidgetRenderer.build(context, store, now, manager.getAppWidgetOptions(appWidgetId)));
        }
        VerseWidgetScheduler.schedule(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle options) {
        // A resize is a redraw: the card re-wraps the Scripture text, and a cell
        // that has become small enough switches to the compact card.
        manager.updateAppWidget(appWidgetId,
                VerseWidgetRenderer.build(context, VerseWidgetStore.get(context), Calendar.getInstance(), options));
    }

    @Override
    public void onEnabled(Context context) {
        VerseWidgetScheduler.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        VerseWidgetScheduler.cancel(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_REFRESH.equals(action) || ACTION_TICK.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            try {
                refresh(context);
            } catch (RuntimeException error) {
                Log.w(TAG, "Verse widget refresh failed", error);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    /** Redraw every placed widget and re-arm the boundary alarm. */
    static void refresh(Context context) {
        VerseWidgetRenderer.refreshAll(context);
        VerseWidgetScheduler.schedule(context);
    }
}
