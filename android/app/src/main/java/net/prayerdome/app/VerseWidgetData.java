package net.prayerdome.app;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * The daily-verse library the Android widget reads.
 *
 * <p>Scripture is written once, in {@code assets/pd-verse-data.js}, and shared by
 * the website, the service worker, the push notifications and this widget.
 * {@code scripts/build-widget-verses.mjs} copies that library into
 * {@code res/raw/pd_widget_verses.json} together with the exact rotation rule,
 * the slot boundaries and a set of checkpoints computed by the website library.
 *
 * <p>Two rules keep the widget and the website quoting the same verse:
 * <ol>
 *   <li>the widget applies the same rotation —
 *       {@code index = (dayIndex * slotCount + slotIndex) % poolSize}, where
 *       {@code dayIndex} counts whole days from local midnight of 31 December —
 *       so every device shows the same verse all day;</li>
 *   <li>{@link #selfCheck()} replays the website's own checkpoints through this
 *       implementation. A non-zero result means the packaged data and the site
 *       library disagree, and callers fall back to a static verse instead of
 *       displaying something the ministry did not publish.</li>
 * </ol>
 */
public final class VerseWidgetData {

    private static final String TAG = "VerseWidgetData";
    private static final long MILLIS_PER_DAY = 86400000L;
    private static final int[] DEFAULT_BOUNDARIES = {0, 11, 14, 18};

    /** A verse: the reference shown in gold and the Scripture text. */
    public static final class Verse {
        public final String reference;
        public final String text;

        Verse(String reference, String text) {
            this.reference = reference;
            this.text = text;
        }
    }

    /** Morning / midday / afternoon / evening — the four moments of the day. */
    public static final class Slot {
        public final String id;
        public final String label;
        public final String greeting;
        public final String defaultTime;

        Slot(String id, String label, String greeting, String defaultTime) {
            this.id = id;
            this.label = label;
            this.greeting = greeting;
            this.defaultTime = defaultTime;
        }
    }

    private static VerseWidgetData instance;

    private final List<Slot> slots = new ArrayList<>();
    private final List<List<Verse>> pools = new ArrayList<>();
    private final List<int[]> checkpoints = new ArrayList<>(); // {year, month, day, slotIndex}
    private final List<String> checkpointRefs = new ArrayList<>();
    private final int[] boundaries = DEFAULT_BOUNDARIES.clone();

    /** Safety net so the widget is never blank, even if the packaged data is unreadable. */
    private static final Verse FALLBACK =
            new Verse("John 3:16",
                    "For God so loved the world, that he gave his only begotten Son, "
                            + "that whosoever believeth in him should not perish, but have everlasting life.");

    public static synchronized VerseWidgetData get(Context context) {
        if (instance == null) instance = new VerseWidgetData(context.getApplicationContext());
        return instance;
    }

    private VerseWidgetData(Context context) {
        try {
            JSONObject root = new JSONObject(readRaw(context));
            JSONObject rotation = root.optJSONObject("rotation");
            JSONArray slotArray = root.optJSONArray("slots");
            JSONObject verseMap = root.optJSONObject("verses");

            if (slotArray != null) {
                for (int i = 0; i < slotArray.length(); i++) {
                    JSONObject slot = slotArray.getJSONObject(i);
                    slots.add(new Slot(
                            slot.optString("id", "morning"),
                            slot.optString("label", "Daily Verse"),
                            slot.optString("greeting", "Peace be with you"),
                            slot.optString("defaultTime", "06:30")));
                }
            }

            for (Slot slot : slots) {
                List<Verse> pool = new ArrayList<>();
                JSONArray array = verseMap == null ? null : verseMap.optJSONArray(slot.id);
                if (array != null) {
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject verse = array.getJSONObject(i);
                        pool.add(new Verse(verse.optString("ref", ""), verse.optString("text", "")));
                    }
                }
                pools.add(pool);
            }

            if (rotation != null) {
                JSONArray bounds = rotation.optJSONArray("slotBoundaries");
                if (bounds != null && bounds.length() == slots.size()) {
                    for (int i = 0; i < bounds.length(); i++) boundaries[i] = bounds.optInt(i, boundaries[i]);
                }
            }

            JSONArray samples = root.optJSONArray("checkpoints");
            if (samples != null) {
                for (int i = 0; i < samples.length(); i++) {
                    JSONObject sample = samples.getJSONObject(i);
                    String[] parts = sample.optString("date", "1970-01-01").split("-");
                    checkpoints.add(new int[]{
                            Integer.parseInt(parts[0]),
                            Integer.parseInt(parts[1]),
                            Integer.parseInt(parts[2]),
                            slotIndex(sample.optString("slot", "morning"))});
                    checkpointRefs.add(sample.optString("ref", ""));
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "The packaged daily verse library could not be read; using the fallback verse", error);
        }
    }

    /** Do the packaged verses exist, with at least one verse in every slot? */
    public boolean isUsable() {
        if (slots.isEmpty()) return false;
        for (List<Verse> pool : pools) {
            if (pool.isEmpty()) return false;
        }
        return true;
    }

    public List<Slot> slots() {
        return slots;
    }

    public int slotIndex(String slotId) {
        for (int i = 0; i < slots.size(); i++) {
            if (slots.get(i).id.equals(slotId)) return i;
        }
        return 0;
    }

    public Slot slot(String slotId) {
        if (slots.isEmpty()) return new Slot("morning", "Daily Verse", "Peace be with you", "06:30");
        return slots.get(slotIndex(slotId));
    }

    /** Which of the four moments of the day are we in? Mirrors PD_VERSES.currentSlot(). */
    public Slot currentSlot(Calendar now) {
        if (slots.isEmpty()) return slot("morning");
        int hour = now.get(Calendar.HOUR_OF_DAY);
        int index = 0;
        for (int i = 0; i < slots.size() && i < boundaries.length; i++) {
            if (hour >= boundaries[i]) index = i;
        }
        return slots.get(index);
    }

    /** The verse for a slot on a day — the same verse every Prayer Dome surface shows. */
    public Verse verseFor(String slotId, Calendar day) {
        if (!isUsable()) return FALLBACK;
        int index = slotIndex(slotId);
        List<Verse> pool = pools.get(index);
        long poolIndex = Math.floorMod(dayIndex(day) * slots.size() + index, (long) pool.size());
        return pool.get((int) poolIndex);
    }

    /** The verse the home screen and the lock screen should show right now. */
    public Verse currentVerse(Calendar now) {
        return verseFor(currentSlot(now).id, now);
    }

    /** Whole days since local midnight of 31 December — mirrors PD_VERSES.dayIndex(). */
    private long dayIndex(Calendar day) {
        Calendar start = Calendar.getInstance();
        start.set(day.get(Calendar.YEAR), Calendar.JANUARY, 1, 0, 0, 0);
        start.set(Calendar.MILLISECOND, 0);
        start.add(Calendar.DAY_OF_MONTH, -1);
        // floorDiv keeps the result identical to JavaScript's Math.floor on the
        // millisecond difference, including 23/25-hour daylight-saving days.
        return Math.floorDiv(day.getTimeInMillis() - start.getTimeInMillis(), MILLIS_PER_DAY);
    }

    /** Milliseconds from now until the next verse of the day begins. */
    public long millisUntilNextBoundary(Calendar now) {
        if (slots.isEmpty()) return MILLIS_PER_DAY;
        int hour = now.get(Calendar.HOUR_OF_DAY);

        Calendar next = (Calendar) now.clone();
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        for (int boundary : boundaries) {
            if (boundary > hour) {
                next.set(Calendar.HOUR_OF_DAY, boundary);
                return Math.max(60000L, next.getTimeInMillis() - now.getTimeInMillis());
            }
        }
        // Past the last boundary of the day: the next verse arrives at midnight.
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, boundaries[0]);
        return Math.max(60000L, next.getTimeInMillis() - now.getTimeInMillis());
    }

    /**
     * Replay the website's checkpoints through this implementation.
     *
     * @return the number of checkpoints that do not match the site library
     *         (0 when the widget and the app would show the same verse).
     */
    public int selfCheck() {
        if (!isUsable() || checkpoints.isEmpty()) return 0;
        int failures = 0;
        for (int i = 0; i < checkpoints.size(); i++) {
            int[] point = checkpoints.get(i);
            if (point[3] >= slots.size()) continue;
            Calendar day = Calendar.getInstance();
            day.set(point[0], point[1] - 1, point[2], 0, 0, 0);
            day.set(Calendar.MILLISECOND, 0);
            if (!verseFor(slots.get(point[3]).id, day).reference.equals(checkpointRefs.get(i))) failures++;
        }
        return failures;
    }

    public boolean isVerified() {
        return isUsable() && selfCheck() == 0;
    }

    /** The safety-net verse: shown when the packaged data cannot be trusted. */
    public Verse fallback() {
        return FALLBACK;
    }

    private static String readRaw(Context context) throws Exception {
        try (InputStream input = context.getResources().openRawResource(R.raw.pd_widget_verses)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
