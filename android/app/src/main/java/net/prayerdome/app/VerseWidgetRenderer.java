package net.prayerdome.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;

/**
 * Builds the RemoteViews for the Prayer Dome verse widget.
 *
 * <p>Everything the widget shows — the living verse of the moment, the reference
 * and the Prayer Dome mark — is assembled here, so the home screen widget, the
 * lock screen panel (Android 15 QPR1 tablets and Android 16 QPR1 phones and
 * later) and the in-app preview at /widgets.html describe the same card.
 *
 * <p>The four themes mirror the theme picker on /widgets.html. A theme is a
 * background drawable plus four text colours, because RemoteViews can only be
 * styled through values set on real views.
 */
final class VerseWidgetRenderer {

    private VerseWidgetRenderer() {
    }

    /** Colours per theme: verse, reference, greeting, brand line. */
    private static final class Theme {
        final int background;
        final int verse;
        final int reference;
        final int greeting;
        final int brand;

        Theme(int background, int verse, int reference, int greeting, int brand) {
            this.background = background;
            this.verse = verse;
            this.reference = reference;
            this.greeting = greeting;
            this.brand = brand;
        }
    }

    private static Theme theme(Context context, String id) {
        switch (id) {
            case VerseWidgetStore.THEME_DOME:
                return new Theme(R.drawable.widget_verse_background_dome,
                        context.getColor(R.color.pd_white),
                        context.getColor(R.color.pd_gold_soft),
                        context.getColor(R.color.pd_blue_light),
                        context.getColor(R.color.pd_white_70));
            case VerseWidgetStore.THEME_DAWN:
                return new Theme(R.drawable.widget_verse_background_dawn,
                        context.getColor(R.color.pd_ink),
                        context.getColor(R.color.pd_rust),
                        context.getColor(R.color.pd_amber_deep),
                        context.getColor(R.color.pd_rust));
            case VerseWidgetStore.THEME_PAPER:
                return new Theme(R.drawable.widget_verse_background_paper,
                        context.getColor(R.color.pd_ink),
                        context.getColor(R.color.pd_navy),
                        context.getColor(R.color.pd_gold_deep),
                        context.getColor(R.color.pd_slate));
            case VerseWidgetStore.THEME_MIDNIGHT:
            default:
                return new Theme(R.drawable.widget_verse_background,
                        context.getColor(R.color.pd_white),
                        context.getColor(R.color.pd_gold_soft),
                        context.getColor(R.color.pd_gold),
                        context.getColor(R.color.pd_blue_light));
        }
    }

    /** The verse the widget shows right now — a pinned verse wins over the rotation. */
    static VerseWidgetData.Verse resolveVerse(Context context, VerseWidgetStore store, Calendar now) {
        VerseWidgetData data = VerseWidgetData.get(context);
        if (store.isPinned()) {
            return new VerseWidgetData.Verse(store.pinnedReference(), store.pinnedText());
        }
        if (!data.isVerified()) {
            // The packaged data and the website library disagree: show the
            // static fallback rather than a verse nobody approved.
            return data.fallback();
        }
        return data.currentVerse(now);
    }

    /* A placed cell smaller than this gets the compact card: the Scripture and
       the reference, with the greeting line and brand row dropped. The default
       4x2 widget reports roughly 250dp x 110dp, so a standard placement keeps
       the full card and only genuinely small cells (or the narrow single column
       some lock screens use) switch. */
    private static final int COMPACT_MIN_WIDTH_DP = 220;
    private static final int COMPACT_MIN_HEIGHT_DP = 90;
    private static final int DEFAULT_WIDTH_DP = 250;
    private static final int DEFAULT_HEIGHT_DP = 110;

    /** Should this cell use the compact card? Null options mean "the default size". */
    static boolean isCompact(Bundle options) {
        if (options == null) return false;
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, DEFAULT_WIDTH_DP);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, DEFAULT_HEIGHT_DP);
        return width < COMPACT_MIN_WIDTH_DP || height < COMPACT_MIN_HEIGHT_DP;
    }

    static RemoteViews build(Context context, VerseWidgetStore store, Calendar now) {
        return build(context, store, now, null);
    }

    static RemoteViews build(Context context, VerseWidgetStore store, Calendar now, Bundle options) {
        VerseWidgetData data = VerseWidgetData.get(context);
        VerseWidgetData.Verse verse = resolveVerse(context, store, now);
        VerseWidgetData.Slot slot = data.currentSlot(now);
        Theme theme = theme(context, store.theme());
        boolean compact = isCompact(options);

        RemoteViews views = new RemoteViews(context.getPackageName(),
                compact ? R.layout.verse_widget_compact : R.layout.verse_widget);
        views.setInt(R.id.widgetCard, "setBackgroundResource", theme.background);
        views.setTextViewText(R.id.widgetVerse, verse.text);
        views.setTextViewText(R.id.widgetReference, "— " + verse.reference);

        float scale = store.textScale();
        views.setTextViewTextSize(R.id.widgetVerse, TypedValue.COMPLEX_UNIT_SP, (compact ? 14f : 15f) * scale);
        views.setTextViewTextSize(R.id.widgetReference, TypedValue.COMPLEX_UNIT_SP, (compact ? 11f : 12f) * scale);
        views.setTextColor(R.id.widgetVerse, theme.verse);
        views.setTextColor(R.id.widgetReference, theme.reference);
        views.setViewVisibility(R.id.widgetReference, store.showReference() ? View.VISIBLE : View.GONE);

        // The greeting line, the refresh target and the brand row only exist in
        // the full card, so they are only touched when that layout is inflated.
        if (!compact) {
            String greeting = store.isPinned() ? "Pinned verse" : slot.greeting;
            views.setTextViewText(R.id.widgetGreeting, greeting);
            views.setTextColor(R.id.widgetGreeting, theme.greeting);
            views.setViewVisibility(R.id.widgetGreeting, store.showGreeting() ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.widgetBrandRow, store.showBrand() ? View.VISIBLE : View.GONE);
            views.setTextColor(R.id.widgetBrandText, theme.brand);
            views.setImageViewResource(R.id.widgetBrandIcon, R.mipmap.ic_launcher);
            // Re-read the clock and redraw without leaving the lock screen.
            views.setOnClickPendingIntent(R.id.widgetRefresh, refresh(context));
        }

        // Tapping anywhere on the card opens the app at the verse studio.
        views.setOnClickPendingIntent(R.id.widgetCard, openApp(context));
        return views;
    }

    private static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("https://prayerdome.net/widgets"));
        intent.putExtra("pd_route", "/widgets.html");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 100, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent refresh(Context context) {
        Intent intent = new Intent(context, VerseWidgetProvider.class);
        intent.setAction(VerseWidgetProvider.ACTION_REFRESH);
        return PendingIntent.getBroadcast(context, 101, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Redraw every placed widget (called by the provider, the alarm and the app). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, VerseWidgetProvider.class));
        if (ids.length == 0) return;
        VerseWidgetStore store = VerseWidgetStore.get(context);
        Calendar now = Calendar.getInstance();
        for (int id : ids) {
            // Each widget is rebuilt with its own cell size, so a member who
            // resized one card does not resize the others.
            manager.updateAppWidget(id, build(context, store, now, manager.getAppWidgetOptions(id)));
        }
    }
}
