// Loaded by Jest before any test files via jest.config.js → setupFiles.
process.env.NODE_ENV = 'test';
process.env.CACHE_DISABLED = '1';        // skip caching in unit tests by default
process.env.USE_REDIS_MOCK = '1';        // any cache tests use ioredis-mock
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
// Prevent db.js initializeDatabase from running real Postgres connections.
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.SEED_OWNER_PASSWORD = 'secret12345';
