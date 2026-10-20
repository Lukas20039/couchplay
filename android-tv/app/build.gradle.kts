import java.util.Base64
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Server-URL: Gradle-Property `couchplay.serverUrl` (gradle.properties oder -P…).
val serverUrl: String = (findProperty("couchplay.serverUrl") as String?)
    ?.trim()?.trimEnd('/')
    ?.takeIf { it.isNotEmpty() }
    ?: "http://10.0.2.2:8080"
require(serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
    "couchplay.serverUrl muss mit http:// oder https:// beginnen: $serverUrl"
}

val appVersionCode: Int = (findProperty("couchplay.versionCode") as String?)?.toIntOrNull() ?: 1
val appVersionName: String = (findProperty("couchplay.versionName") as String?) ?: "0.1.0"

// Release-Signatur aus der Umgebung (CI):
//   ANDROID_KEYSTORE_BASE64 (Inhalt) oder ANDROID_KEYSTORE_FILE (Pfad),
//   ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
// Fehlt etwas, wird das Release mit dem Debug-Key signiert (installierbar, nicht für den Store).
fun env(name: String): String? = System.getenv(name)?.takeIf { it.isNotBlank() }

val releaseKeystore: File? = run {
    val b64 = env("ANDROID_KEYSTORE_BASE64")
    val path = env("ANDROID_KEYSTORE_FILE")
    when {
        b64 != null -> layout.buildDirectory.file("keystore/release.jks").get().asFile.also { f ->
            f.parentFile.mkdirs()
            f.writeBytes(Base64.getMimeDecoder().decode(b64))
        }
        path != null -> file(path).takeIf { it.isFile }
        else -> null
    }
}
val hasReleaseSigning = releaseKeystore != null &&
    env("ANDROID_KEYSTORE_PASSWORD") != null &&
    env("ANDROID_KEY_ALIAS") != null

android {
    namespace = "at.couchplay.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "at.couchplay.tv"
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = env("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = env("ANDROID_KEY_ALIAS")
                keyPassword = env("ANDROID_KEY_PASSWORD") ?: env("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                logger.warn("CouchPlay: keine Release-Signatur in der Umgebung – Release wird mit dem Debug-Key signiert.")
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        // Leanback-Checks aktiv lassen, Build aber nicht an Übersetzungs-/Icon-Hinweisen scheitern lassen.
        abortOnError = true
        disable += setOf("MissingTranslation", "IconMissingDensityFolder", "GradleDependency", "OldTargetApi")
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
