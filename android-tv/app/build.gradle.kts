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

// Release-Signatur NUR aus der Umgebung (CI dekodiert den Keystore selbst in eine Datei):
//   ANDROID_KEYSTORE_FILE (Pfad), ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
// Nichts gesetzt → unsigniertes Release (app-release-unsigned.apk) + Warnung.
// Teilweise gesetzt → Build-Fehler (sonst entstünde still eine falsch signierte APK).
fun env(name: String): String? = System.getenv(name)?.takeIf { it.isNotBlank() }

val signingEnvNames = listOf("ANDROID_KEYSTORE_FILE", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD")
val signingEnvSet = signingEnvNames.filter { env(it) != null }
val releaseKeystore: File? = env("ANDROID_KEYSTORE_FILE")?.let { file(it) }
val hasReleaseSigning = signingEnvSet.size == signingEnvNames.size
// Nur prüfen, wenn ein Release-Task gebaut wird – Debug-Builds bleiben davon unberührt.
val buildsRelease = gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }
if (buildsRelease && signingEnvSet.isNotEmpty() && !hasReleaseSigning) {
    throw GradleException(
        "Release-Signatur unvollständig: gesetzt ${signingEnvSet.joinToString()}, fehlt ${(signingEnvNames - signingEnvSet.toSet()).joinToString()}",
    )
}
if (buildsRelease && hasReleaseSigning && releaseKeystore?.isFile != true) {
    throw GradleException("ANDROID_KEYSTORE_FILE zeigt auf keine Datei: ${env("ANDROID_KEYSTORE_FILE")}")
}

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
                keyPassword = env("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                signingConfig = null
                logger.warn("CouchPlay: keine Release-Signatur (ANDROID_KEYSTORE_FILE …) – Release wird UNSIGNIERT gebaut.")
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
