const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');

const { assessEmergency } = require('../services/emergencySafety');
const { handleChat } = require('../controllers/chatbotController');

test('matches direct emergency warning signs', () => {
  const examples = [
    'I am struggling to breathe.',
    'I have severe chest pain.',
    'My father suddenly became confused.',
    'She is having a seizure.',
    'His face is drooping and his speech is slurred.',
    'My throat is swelling after eating.',
    'The bleeding will not stop.',
    'I may have taken an overdose.'
  ];

  for (const message of examples) {
    assert.equal(assessEmergency(message).status, 'possible-emergency', message);
  }
});

test('does not match clearly negated warning signs', () => {
  const examples = [
    'I have no chest pain.',
    'I am not experiencing shortness of breath.',
    'She has never had a seizure.',
    'There is no sudden confusion.'
  ];

  for (const message of examples) {
    assert.equal(assessEmergency(message).status, 'no-match', message);
  }
});

test('matches indirect descriptions of urgent symptoms', () => {
  const examples = [
    'I can only speak a few words before needing air.',
    'It feels like an elephant is sitting on my chest.',
    'He is impossible to wake up.',
    'One side of my body suddenly feels weak.'
  ];

  for (const message of examples) {
    assert.equal(assessEmergency(message).status, 'possible-emergency', message);
  }
});

test('does not match routine symptom descriptions', () => {
  const examples = [
    'I have a mild headache.',
    'I have a fever and a runny nose.',
    'My muscles ache after exercise.',
    'I feel a little tired today.'
  ];

  for (const message of examples) {
    assert.equal(assessEmergency(message).status, 'no-match', message);
  }
});

test('checks recent user messages without treating a clean message as proof of safety', () => {
  assert.equal(
    assessEmergency('The fever is still there.', ['I have chest pressure.']).status,
    'possible-emergency'
  );
  assert.equal(assessEmergency('I feel okay now.').status, 'no-match');
});

test('handles malformed input without throwing', () => {
  assert.deepEqual(assessEmergency(null), { status: 'unable-to-assess' });
  assert.deepEqual(assessEmergency('   '), { status: 'unable-to-assess' });
  assert.equal(assessEmergency('I have a cold.', [null, {}, '']).status, 'no-match');
});

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

test('rejects a missing message before safety screening or LLM processing', async () => {
  for (const body of [null, { message: '   ' }]) {
    const response = createResponse();
    await handleChat({ body }, response);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Message is required' });
  }
});

test('recent emergency context bypasses the LLM and preserves the reply response shape', async () => {
  const originalPost = axios.post;
  let providerCalls = 0;
  axios.post = async () => {
    providerCalls += 1;
    throw new Error('The LLM must not be called for this test.');
  };

  try {
    const response = createResponse();
    await handleChat({
      body: {
        patientDetails: {},
        message: 'My fever is still there.',
        recentUserMessages: ['I have chest pressure.']
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(typeof response.body.reply, 'string');
    assert.match(response.body.reply, /local emergency number/i);
    assert.match(response.body.reply, /not a clinically validated triage system/i);
    assert.equal(response.body.structured.urgency, 'emergency');
    assert.deepEqual(response.body.structured.sources, []);
    assert.equal(providerCalls, 0);
  } finally {
    axios.post = originalPost;
  }
});

test('ordinary messages continue through the existing LLM response format', async () => {
  const originalPost = axios.post;
  const originalApiKey = process.env.GEMINI_API_KEY;
  let providerCalls = 0;
  let providerRequest;
  axios.post = async (url, body) => {
    providerCalls += 1;
    providerRequest = body;
    return {
      data: {
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            message: 'General guidance from the assistant.',
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
        message: 'I have a mild headache.'
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.structured.message, 'General guidance from the assistant.');
    assert.match(response.body.reply, /General guidance from the assistant/);
    assert.equal(providerCalls, 1);

    const prompt = providerRequest.contents[0].parts[0].text;
    assert.match(prompt, /Respond with empathy/);
    assert.match(prompt, /Never diagnose, claim certainty/);
    assert.match(prompt, /ask at most one clear, relevant follow-up question/);
    assert.match(prompt, /Do not recommend prescription medicines, medication changes, or specific medication doses/);
    assert.match(prompt, /Put urgent escalation advice first/);
    assert.match(prompt, /<latest_patient_message>\s*I have a mild headache\.\s*<\/latest_patient_message>/);
  } finally {
    axios.post = originalPost;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});
