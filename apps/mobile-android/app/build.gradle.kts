plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }

val ddakdamaApiOrigin = providers.gradleProperty("ddakdamaApiOrigin")
  // The free public beta must use the same Worker as the website, GPTs,
  // ChatGPT app and extension. A branded domain can override this later.
  .orElse("https://ddakdama.artemis-clunk.workers.dev")
  .get()

val ddakdamaGptUrl = providers.gradleProperty("ddakdamaGptUrl")
  .orElse("https://chatgpt.com/g/g-6a5ec60a6c308191bc5b342f67c2772d-ddagdama-syoping-doumi")
  .get()

android {
  namespace = "app.ddakdama.mobile"
  compileSdk = 35
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
  defaultConfig { applicationId = "app.ddakdama.mobile"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
  buildFeatures { compose = true; buildConfig = true }
  buildTypes {
    debug {
      buildConfigField("boolean", "REAL_COUPANG_AUTOMATION_ENABLED", "false")
      buildConfigField("String", "API_ORIGIN", "\"$ddakdamaApiOrigin\"")
      buildConfigField("String", "GPT_URL", "\"$ddakdamaGptUrl\"")
    }
    release {
      isMinifyEnabled = false
      buildConfigField("boolean", "REAL_COUPANG_AUTOMATION_ENABLED", "false")
      buildConfigField("String", "API_ORIGIN", "\"$ddakdamaApiOrigin\"")
      buildConfigField("String", "GPT_URL", "\"$ddakdamaGptUrl\"")
    }
  }
}
dependencies {
  implementation(platform("androidx.compose:compose-bom:2024.12.01"))
  implementation("androidx.activity:activity-compose:1.10.0")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("io.coil-kt:coil-compose:2.7.0")
  debugImplementation("androidx.compose.ui:ui-tooling")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
