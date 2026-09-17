# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# OTA versioning

Every EAS Update (OTA) must bump `expo.version` / `package.json` `version` via `node scripts/bump-ota-version.js` (or `npm run update:preview`) so the in-app Version stamp changes. Do not change `runtimeVersion` for JS-only OTAs — it stays pinned for native binary compatibility.
