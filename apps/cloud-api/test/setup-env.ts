// Test-only environment, loaded before any module boots. ConfigModule's zod
// validation (src/config/configuration.ts) requires JWT_SECRET; production
// and local dev values come from .env. Keep test values out of the scripts.
process.env.JWT_SECRET ??= "test-secret-at-least-8";
