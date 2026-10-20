# JS-Brücke: Methoden mit @JavascriptInterface dürfen nicht umbenannt/entfernt werden.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
