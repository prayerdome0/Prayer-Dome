package net.prayerdome.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

/**
 * Wakes the verse widget at the start of each of the four moments of the day.
 *
 * <p>A widget cannot run a timer, so instead of polling every few minutes the
 * widget asks the system for a single wake-up at the next slot boundary
 * (midnight, 11:00, 14:00 and 18:00 — the boundaries PD_VERSES.currentSlot()
 * uses) and re-arms itself each time it runs. That is four wake-ups a day, which
 * is both battery-friendly and enough to keep the lock screen in step with the
 * website.
 *
 * <p>{@code setAndAllowWhileIdle} is used rather than an exact alarm: the verse
 * is not time-critical to the second, and exact alarms would demand the
 * SCHEDULE_EXACT_ALARM permission on Android 12+.
 */
final class VerseWidgetScheduler {

    private static final int REQUEST_TICK = 102;

    private VerseWidgetScheduler() {
    }

    static void schedule(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        PendingIntent tick = tick(context);
        alarms.cancel(tick);

        long delay = VerseWidgetData.get(context).millisUntilNextBoundary(Calendar.getInstance());
        long triggerAt = System.currentTimeMillis() + delay;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, tick);
        } else {
            alarms.set(AlarmManager.RTC_WAKEUP, triggerAt, tick);
        }
    }

    static void cancel(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(tick(context));
    }

    private static PendingIntent tick(Context context) {
        Intent intent = new Intent(context, VerseWidgetProvider.class);
        intent.setAction(VerseWidgetProvider.ACTION_TICK);
        return PendingIntent.getBroadcast(context, REQUEST_TICK, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
