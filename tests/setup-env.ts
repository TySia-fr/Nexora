import "dotenv/config";

// Integration tests run against TEST_DATABASE_URL and truncate every table, so
// they refuse to start unless that variable points at a database whose name
// contains "test".
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
// Offline Stripe credentials: enough to verify webhook signatures in tests.
process.env.STRIPE_SECRET_KEY = "sk_test_offline";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_offline_secret";
