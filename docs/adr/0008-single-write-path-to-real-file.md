# 0008 — Accept is the only write path to the real file

Version history's `restore()` (revert to a previous accepted state) does not write the real file directly. It creates a new draft from the recorded snapshot and routes it through the normal Accept flow, so the user reviews a revert the same way they review any other edit.

The alternative — `restore()` calling `fs.copyFile` straight to the real path — was rejected because it would create a second, parallel path that bypasses the preview/accept safety mechanism issue #4 exists to build. A future reader optimizing `restore()` into a direct copy would silently reintroduce the exact risk (unreviewed writes to the real file) the draft lifecycle was designed to prevent. Keeping Accept as the sole write path means that invariant only has to be verified in one place.
