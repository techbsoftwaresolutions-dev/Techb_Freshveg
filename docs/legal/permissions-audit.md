# Permissions audit — customer app and delivery app

Method: read every `src/` file of both apps for permission-using APIs (location, camera, image picker, notifications, contacts, media, clipboard, storage), read `package.json` native modules, and evaluated the final Android manifest and iOS Info.plist with `npx expo config --type introspect` before and after the change (16 Oct 2026).

## Result

Neither app asks the user for any runtime permission. The only Android permissions left are install-time "normal" permissions.

| Permission | Before | After | Which feature needs it | When asked | Explanation shown | If denied |
|---|---|---|---|---|---|---|
| INTERNET | both apps | **kept** | everything (API calls) | install time, no prompt | n/a | n/a |
| VIBRATE | both apps | **kept** | React Native touch feedback / Expo default | install time, no prompt | n/a | n/a |
| READ_EXTERNAL_STORAGE | both apps (Expo template default) | **removed** (`blockedPermissions`) | nothing — no file access in either app | — | — | — |
| WRITE_EXTERNAL_STORAGE | both apps (Expo template default) | **removed** | nothing | — | — | — |
| SYSTEM_ALERT_WINDOW | both apps (Expo template default; dev-menu overlay) | **removed** | nothing in release builds | — | — | — |
| READ_SMS / RECEIVE_SMS | not in the evaluated manifest | **blocked defensively** (customer app) | nothing; Play restricts SMS permissions to default SMS apps | — | — | — |
| iOS usage descriptions (NS…UsageDescription) | none | none | — | — | — | — |

Native modules checked: `expo-clipboard` (copying referral code — no permission), `expo-video` (hero video playback — no permission), `expo-font`, `expo-constants`, `@react-native-async-storage/async-storage`, `react-native-razorpay` (Razorpay Checkout 1.6.41; its library manifest declares no permissions — `node_modules/react-native-razorpay/android/src/main/AndroidManifest.xml`; the Maven AAR's own manifest could not be inspected offline, which is why SMS is blocked explicitly and the merged manifest must be re-checked on the first EAS build).

## Location — and the manual alternative

- **Customer app:** no device location at all. The delivery location is the **pincode** typed on the Location screen (`customer-app/src/screens/LocationScreen.js`) and the addresses typed on Saved addresses — the manual path *is* the only path, which satisfies Apple 5.1.1(iv)'s "offer alternatives" without any prompt to deny.
- **Delivery app:** no device location. "Navigate" hands the address (or stored coordinates) to the phone's maps app (`delivery-app/src/components/ui.js` `openMaps`) and "Call" opens the dialer — both are system intents, no permission. The backend's ping endpoint (`POST /delivery/orders/:id/ping`) is unused by the app; it now refuses pings outside an active run.

## If a permission is added later (requirements to meet first)

| Feature | Permission | Must do first |
|---|---|---|
| Live rider tracking | foreground location (`ACCESS_FINE_LOCATION`/`COARSE`, iOS When-In-Use); background location only with Play declaration | in-app prominent disclosure + consent (Play User Data policy), purpose string, update delivery-app-privacy.md, Data safety (Location), App Privacy; only while on a run; manual fallback = current flow |
| Proof-of-delivery photo | camera (`expo-image-picker` camera or system picker) | purpose string; prefer system picker (no READ_MEDIA_*); privacy notice; retention of photos |
| Push notifications | `POST_NOTIFICATIONS` (Android 13+), iOS notification prompt | ask after an order, not at launch; app works fully without it (website-equivalent inbox exists) |
| Customer "use my location" | coarse location, When-In-Use | keep pincode entry as the alternative; never block checkout |

## Release check

After the first EAS build of each app, open the merged manifest (`android/app/build/intermediates/merged_manifests/...` or `aapt dump permissions`) and confirm only INTERNET and VIBRATE (plus ACCESS_NETWORK_STATE if a library adds it — normal permission, acceptable) remain, and that `targetSdkVersion` is 36.
