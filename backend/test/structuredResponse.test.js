const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');

const { generateAIResponse } = require('../utils/aiPrompt');
const {
  createApiResponse,
  createFallbackResponse,
  normalizeGeneratedResponse
} = require('../services/structuredResponse');

function validPayload(overrides = {}) {
  return {
    message: 'A mild headache can have many causes.',
    urgency: 'routine',
    selfCare: ['Rest somewhere quiet.'],
    warningSigns: ['Seek urgent care for sudden severe pain.'],
    followUpQuestions: ['When did it begin?'],
    sources: [],
    ...overrides
  };
}

test('normalizes a complete structured response and keeps citations empty without retrieval evidence', () => {
  const result = normalizeGeneratedResponse(JSON.stringify(validPayload()));

  assert.deepEqual(result, {
    ...validPayload(),
    status: 'ok'
  });

  const apiResponse = createApiResponse(result);
  assert.equal(typeof apiResponse.reply, 'string');
  assert.match(apiResponse.reply, /Self-care:/);
  assert.match(apiResponse.reply, /Seek urgent care if:/);
  assert.match(apiResponse.reply, /When did it begin/);
  assert.equal(apiResponse.structured.urgency, 'routine');
});

test('uses a safe fallback for malformed JSON, missing fields, and invalid field values', () => {
  const invalidOutputs = [
    'not json',
    '{',
    JSON.stringify({ message: 'Incomplete response.' }),
    JSON.stringify(validPayload({ urgency: 'certainly safe' })),
    JSON.stringify(validPayload({ selfCare: ['x'.repeat(501)] })),
    JSON.stringify(validPayload({ sources: ['https://unverified.example'] }))
  ];

  for (const output of invalidOutputs) {
    const result = normalizeGeneratedResponse(output);
    assert.equal(result.status, 'fallback');
    assert.equal(result.urgency, 'unknown');
    assert.deepEqual(result.sources, []);
    assert.match(createApiResponse(result).reply, /not a diagnosis/i);
  }
});

test('returns a safe structured fallback when Gemini fails', async () => {
  const originalPost = axios.post;
  const originalApiKey = process.env.GEMINI_API_KEY;
  axios.post = async () => {
    throw new Error('Simulated provider failure');
  };
  process.env.GEMINI_API_KEY = 'test-key';
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const result = await generateAIResponse({}, 'I have a headache.');

    assert.equal(result.status, 'fallback');
    assert.equal(result.urgency, 'unknown');
    assert.deepEqual(result.sources, []);
    assert.match(result.message, /could not prepare a response/i);
  } finally {
    axios.post = originalPost;
    console.error = originalConsoleError;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});

test('returns a safe structured fallback when the API key is missing', async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const result = await generateAIResponse({}, 'I have a headache.');

    assert.equal(result.status, 'fallback');
    assert.equal(result.urgency, 'unknown');
    assert.match(result.message, /not configured/i);
  } finally {
    console.error = originalConsoleError;
    if (originalApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});

test('requests constrained JSON output and validates returned fields before use', async () => {
  const originalPost = axios.post;
  const originalApiKey = process.env.GEMINI_API_KEY;
  let requestBody;
  axios.post = async (url, body) => {
    requestBody = body;
    return {
      data: {
        candidates: [{
          content: { parts: [{ text: JSON.stringify(validPayload()) }] }
        }]
      }
    };
  };
  process.env.GEMINI_API_KEY = 'test-key';

  try {
    const result = await generateAIResponse({}, 'I have a headache.');

    assert.equal(result.status, 'ok');
    assert.equal(result.message, 'A mild headache can have many causes.');
    assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
    assert.equal(requestBody.generationConfig.responseSchema.type, 'OBJECT');
    assert.match(requestBody.contents.at(-1).parts[0].text, /Return only one valid JSON object/);
  } finally {
    axios.post = originalPost;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});
