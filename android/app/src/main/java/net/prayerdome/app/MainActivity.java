package net.prayerdome.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * The Prayer Dome Android shell.
 *
 * <p>In addition to loading the website, it registers {@link VerseWidgetPlugin}
 * so /widgets.html can style the home-screen and lock-screen verse widget, pin a
 * verse to it, and place a new widget without leaving the page.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VerseWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        // Tapping the widget while the app is already open must still tell the app
        // where the member came in (the plugin reads the `pd_route` extra).
        setIntent(intent);
        super.onNewIntent(intent);
    }
}
