import "dotenv/config";

// Integration tests use TEST_DATABASE_URL when set so they never touch dev data.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
