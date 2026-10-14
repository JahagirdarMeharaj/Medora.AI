const DEFAULT_FRONTEND_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

function parseAllowedOrigins(value = process.env.FRONTEND_ORIGINS) {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_FRONTEND_ORIGINS.slice();
  }

  const origins = value.split(',').map(origin => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid FRONTEND_ORIGINS entry: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(`FRONTEND_ORIGINS must contain exact HTTP(S) origins: ${origin}`);
    }
  }

  return origins;
}

function createCorsOptions(allowedOrigins = parseAllowedOrigins()) {
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600
  };
}

module.exports = { createCorsOptions, parseAllowedOrigins };
