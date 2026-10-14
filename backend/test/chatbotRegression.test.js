const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');

const { handleChat } = require('../controllers/chatbotController');

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

function structuredPayload(overrides = {}) {
  return {
    message: 'General information only; a clinician can advise based on your situation.',
    urgency: 'routine',
    selfCare: [],
    warningSigns: [],
    followUpQuestions: [],
    sources: [],
    ...overrides
  };
}

async function withProvider(response, run) {
  const originalPost = axios.post;
  const originalApiKey = process.env.GEMINI_API_KEY;
  let calls = 0;
  let requestBody;

  axios.post = async (url, body) => {
    calls += 1;
    requestBody = body;
    if (response instanceof Error) throw response;
    return response;
  };
  process.env.GEMINI_API_KEY = 'test-key';

  try {
    await run({
      get calls() {
        return calls;
      },
      get requestBody() {
        return requestBody;
      }
    });
  } finally {
    axios.post = originalPost;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
}

test('normal symptom requests preserve the existing reply field and structured response fields', async () => {
  await withProvider({
    data: {
      candidates: [{
        content: { parts: [{ text: JSON.stringify(structuredPayload({
          message: 'A fever can have several causes.',
          selfCare: ['Rest and drink fluids if you can.'],
          warningSigns: ['Seek urgent help for difficulty breathing.']
        })) }] }
      }]
    }
  }, async provider => {
    const response = createResponse();
    await handleChat({
      body: { message: 'I have a fever and a runny nose.' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.body.reply, /A fever can have several causes/);
    assert.equal(response.body.structured.urgency, 'routine');
    assert.deepEqual(response.body.structured.selfCare, ['Rest and drink fluids if you can.']);
    assert.deepEqual(response.body.structured.sources, []);
    assert.equal(provider.calls, 1);
  });
});

test('ambiguous health requests can return unknown urgency and a focused follow-up question', async () => {
  await withProvider({
    data: {
      candidates: [{
        content: { parts: [{ text: JSON.stringify(structuredPayload({
          message: 'I do not have enough information to assess this.',
          urgency: 'unknown',
          followUpQuestions: ['What symptoms are you experiencing, and when did they start?']
        })) }] }
      }]
    }
  }, async provider => {
    const response = createResponse();
    await handleChat({ body: { message: 'What could this be?' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.structured.urgency, 'unknown');
    assert.equal(response.body.structured.followUpQuestions.length, 1);
    assert.match(response.body.reply, /What symptoms are you experiencing/);
    assert.equal(provider.calls, 1);
  });
});

test('medication questions include the medication safety instructions in the model request', async () => {
  await withProvider({
    data: {
      candidates: [{
        content: { parts: [{ text: JSON.stringify(structuredPayload({
          message: 'A pharmacist or clinician can check what is appropriate for you.',
          urgency: 'unknown',
          followUpQuestions: ['Which medication are you asking about?']
        })) }] }
      }]
    }
  }, async provider => {
    const response = createResponse();
    await handleChat({ body: { message: 'What dose of pain medicine should I take?' } }, response);

    const prompt = provider.requestBody.contents.at(-1).parts[0].text;
    assert.match(prompt, /Do not recommend prescription medicines, medication changes, or specific medication doses/);
    assert.match(prompt, /checking with a licensed clinician or pharmacist/);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.structured.urgency, 'unknown');
    assert.equal(provider.calls, 1);
  });
});

test('malformed Gemini JSON becomes a safe structured fallback at the API boundary', async () => {
  await withProvider({
    data: {
      candidates: [{
        content: { parts: [{ text: '{"message":' }] }
      }]
    }
  }, async provider => {
    const response = createResponse();
    await handleChat({ body: { message: 'I have a headache.' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.structured.status, 'fallback');
    assert.equal(response.body.structured.urgency, 'unknown');
    assert.deepEqual(response.body.structured.sources, []);
    assert.match(response.body.reply, /seek emergency care now/i);
    assert.equal(provider.calls, 1);
  });
});

test('provider failures return safe fallback content without breaking the API response format', async () => {
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...values) => loggedErrors.push(values);
  try {
    const providerError = Object.assign(new Error('private provider response'), {
      code: 'ECONNABORTED',
      response: { status: 503, data: { message: 'private provider response' } }
    });
    await withProvider(providerError, async provider => {
      const response = createResponse();
      await handleChat({ body: { message: 'I have a headache.' } }, response);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.structured.status, 'fallback');
      assert.equal(response.body.structured.urgency, 'unknown');
      assert.match(response.body.reply, /could not prepare a response/i);
      assert.equal(provider.calls, 1);
      assert.deepEqual(loggedErrors, [['Gemini API Error:', 503, 'ECONNABORTED']]);
    });
  } finally {
    console.error = originalConsoleError;
  }
});
