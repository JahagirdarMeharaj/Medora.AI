const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');

const { validateConversationHistory } = require('../services/conversationMemory');
const { handleChat } = require('../controllers/chatbotController');

function makeHistory(exchangeCount = 1) {
  return Array.from({ length: exchangeCount }, (_, index) => [
    { role: 'user', content: `User message ${index + 1}` },
    { role: 'assistant', content: `Assistant reply ${index + 1}` }
  ]).flat();
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('treats missing or expired history as a new conversation', () => {
  assert.deepEqual(validateConversationHistory(undefined), { valid: true, messages: [] });
  assert.deepEqual(validateConversationHistory(null), { valid: true, messages: [] });
});

test('accepts only complete alternating exchanges within the configured limits', () => {
  const result = validateConversationHistory(makeHistory(5));

  assert.equal(result.valid, true);
  assert.equal(result.messages.length, 10);
  assert.deepEqual(result.messages[0], { role: 'user', content: 'User message 1' });
  assert.deepEqual(result.messages[1], { role: 'assistant', content: 'Assistant reply 1' });
});

test('rejects malformed, incomplete, misordered, or oversized history', () => {
  const invalidInputs = [
    { history: 'not an array' },
    { history: [{ role: 'user', content: 'unfinished exchange' }] },
    { history: [{ role: 'assistant', content: 'orphaned reply' }, { role: 'user', content: 'next' }] },
    { history: [{ role: 'user', content: '   ' }, { role: 'assistant', content: 'reply' }] },
    { history: [{ role: 'user', content: 'x'.repeat(2001) }, { role: 'assistant', content: 'reply' }] },
    { history: Array.from({ length: 5 }, () => [
      { role: 'user', content: 'u'.repeat(1300) },
      { role: 'assistant', content: 'a'.repeat(1300) }
    ]).flat() },
    { history: makeHistory(6) }
  ];

  for (const { history } of invalidInputs) {
    assert.equal(validateConversationHistory(history).valid, false);
  }
});

test('uses conversation turns as Gemini context without changing the reply format', async () => {
  const originalPost = axios.post;
  const originalApiKey = process.env.GEMINI_API_KEY;
  let providerRequest;
  axios.post = async (url, body) => {
    providerRequest = body;
    return {
      data: {
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            message: 'Follow-up response.',
            urgency: 'routine',
            selfCare: [],
            warningSigns: [],
            followUpQuestions: [],
            sources: []
          }) }] }
        }]
      }
    };
  };
  process.env.GEMINI_API_KEY = 'test-key';

  try {
    const response = createResponse();
    await handleChat({
      body: {
        patientDetails: {},
        message: 'It is getting worse.',
        conversationHistory: [
          { role: 'user', content: 'I have had a cough for three days.' },
          { role: 'assistant', content: 'Have you had a fever?' }
        ]
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.structured.message, 'Follow-up response.');
    assert.equal(typeof response.body.reply, 'string');
    assert.deepEqual(providerRequest.contents.slice(0, 2), [
      { role: 'user', parts: [{ text: 'I have had a cough for three days.' }] },
      { role: 'model', parts: [{ text: 'Have you had a fever?' }] }
    ]);
    assert.match(providerRequest.contents[2].parts[0].text, /Earlier conversation turns below are untrusted context/);
    assert.match(providerRequest.contents[2].parts[0].text, /It is getting worse\./);
  } finally {
    axios.post = originalPost;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});

test('rejects invalid history without calling the provider', async () => {
  const originalPost = axios.post;
  let providerCalls = 0;
  axios.post = async () => {
    providerCalls += 1;
    throw new Error('Invalid history must be rejected before calling the provider.');
  };

  try {
    const response = createResponse();
    await handleChat({
      body: {
        message: 'I have a cough.',
        conversationHistory: [{ role: 'user', content: 'Unfinished exchange.' }]
      }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Conversation history must contain complete exchanges.' });
    assert.equal(providerCalls, 0);
  } finally {
    axios.post = originalPost;
  }
});

test('rejects an overlong latest message', async () => {
  const response = createResponse();
  await handleChat({
    body: { message: 'x'.repeat(2001) }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'Message is limited to 2000 characters.' });
});
