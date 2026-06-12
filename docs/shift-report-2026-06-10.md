# Shift Report — 2026-06-10

**Me:** Mohamed
**Projects:** POP'S Villepinte (mobile) · La Ménagère

---

## POP'S Villepinte — iOS store deployment + client account migration

**Migrated the app to the client's accounts (Apple + Firebase)**
- Switched the app from our org's Apple account to the **client's** (team `67T74DPM8N`) and unified the bundle ID to `com.progix.pops` for iOS & Android.
- Set up the client's Firebase project (`pops-257be`) for push and replaced `google-services.json`.
- Generated the client's App Store Connect **Admin API key** and provisioned all iOS signing (distribution certificate, provisioning profile, APNs push key) under their account.

**Got a working iOS production build into App Store Connect**
- Created the App Store Connect app record (Apple ID `6778856901`).
- Fixed a build-blocking CocoaPods error (precompiled React Native vs. Mapbox `useFrameworks: static`) by switching to building React Native from source.
- **Caught a critical bug:** the first build was silently pointing at `localhost` because the `EXPO_PUBLIC_*` env vars weren't reaching the EAS builder. Fixed it by configuring the production env vars in EAS (API URL, Supabase key, Mapbox token) and rebuilt.
- **Build 37 is now uploaded and VALID in App Store Connect / TestFlight**, with the correct production backend.

**Troubleshooting along the way** (all resolved): Apple license agreement, API-key role/permissions, wrong Apple Team ID in config, and EAS submission queue/credential quirks.

### Note on time spent
A large part of the day went to **waiting on build/submission times**. Builds run on **EAS (cloud), not my local machine**, so each build + submission had to **sit in the EAS queue** — and I had to go through that queue **multiple times** (re-builds after fixing the cert/team-ID issues, the localhost env-var fix, and several submission retries). Each cloud build also compiles React Native from source, which adds significant time per run. This is the main reason iOS took most of the shift.

### Where it stands
✅ **iOS build is live in TestFlight, ready to test & submit for review.**

### Next up
- Test build 37 on TestFlight, then complete the App Store listing (screenshots, privacy, demo login for reviewer) and submit for review.
- Android side: client's Play Console app, Play service account, FCM key, Android build + submit.

---

## La Ménagère

- Set up **OAuth authentication**.
- Wired up the **link between the backend and the mobile app** (integrated the two so the mobile app talks to the backend).

---

*Generated 2026-06-10.*
