const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');

const { createCorsOptions, parseAllowedOrigins } = require('../middleware/corsConfig');
const { createApp } = require('../server');

test('uses local frontend origins by default and validates exact configured HTTP origins', () => {
  assert.deepEqual(parseAllowedOrigins(''), [
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ]);
  assert.deepEqual(parseAllowedOrigins('https://medora.example, https://www.medora.example'), [
    'https://medora.example',
    'https://www.medora.example'
  ]);
  assert.throws(() => parseAllowedOrigins('*'), /Invalid FRONTEND_ORIGINS entry/);
  assert.throws(() => parseAllowedOrigins('https://medora.example/chat'), /must contain exact HTTP\(S\) origins/);

  const corsOptions = createCorsOptions(['https://medora.example']);
  corsOptions.origin(undefined, (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, true);
  });
  corsOptions.origin('https://other.example', (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, false);
  });
});

test('HTTP API enforces CORS, JSON limits, safe errors, and request rate limits', async t => {
  const server = createApp({ allowedOrigins: ['https://medora.example'] })
    .listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const allowedPreflight = await fetch(`${baseUrl}/api/chatbot/message`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://medora.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), 'https://medora.example');

  const rejectedPreflight = await fetch(`${baseUrl}/api/chatbot/message`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(rejectedPreflight.headers.get('access-control-allow-origin'), null);

  const malformedJson = await fetch(`${baseUrl}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"message":'
  });
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), { error: 'Request body must be valid JSON.' });

  const oversizedBody = await fetch(`${baseUrl}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: `"${'x'.repeat(65 * 1024)}"`
  });
  assert.equal(oversizedBody.status, 413);
  assert.deepEqual(await oversizedBody.json(), { error: 'Request body exceeds the 64 KB limit.' });

  const tooManyPatientDetails = await fetch(`${baseUrl}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'I have a headache.', patientDetails: { notes: 'x'.repeat(2100) } })
  });
  assert.equal(tooManyPatientDetails.status, 400);
  assert.deepEqual(await tooManyPatientDetails.json(), { error: 'Patient details exceed the 2000-byte limit.' });

  let lastResponse;
  for (let index = 0; index < 21; index += 1) {
    lastResponse = await fetch(`${baseUrl}/api/chatbot/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://medora.example'
      },
      body: JSON.stringify({ message: 'I cannot breathe.' })
    });
  }
  assert.equal(lastResponse.status, 429);
  assert.deepEqual(await lastResponse.json(), { error: 'Too many requests, please try again later.' });
  assert.ok(lastResponse.headers.get('ratelimit-limit'));
});
