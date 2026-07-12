package com.mytraty.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * Обёртка-приложение: показывает офлайн-PWA «Мои траты» из ассетов в WebView.
 * Все данные хранятся локально (DOM Storage / localStorage внутри WebView).
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // нужно для localStorage
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Приложение полностью локальное — грузим из assets.
        web.loadUrl("file:///android_asset/index.html");

        setContentView(web);
    }

    // Аппаратная кнопка «Назад» листает историю WebView, а не закрывает приложение сразу.
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
