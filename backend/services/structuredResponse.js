const URGENCY_LEVELS = new Set(['emergency', 'urgent', 'routine', 'unknown']);
const MAX_MESSAGE_LENGTH = 2000;
const MAX_LIST_ITEM_LENGTH = 500;
const MAX_LIST_ITEMS = 6;

function createFallbackResponse(message = 'I could not safely format a response. If symptoms are severe, sudden, or rapidly worsening, seek emergency care now. Otherwise, contact a licensed clinician for advice.') {
  return {
    message,
    urgency: 'unknown',
    selfCare: [],
    warningSigns: [],
    followUpQuestions: [],
    sources: [],
    status: 'fallback'
  };
}

function normalizeGeneratedResponse(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return createFallbackResponse();
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return createFallbackResponse();
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return createFallbackResponse();
  }

  const {
    message,
    urgency,
    selfCare,
    warningSigns,
    followUpQuestions,
    sources
  } = parsed;

  if (
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > MAX_MESSAGE_LENGTH ||
    !URGENCY_LEVELS.has(urgency) ||
    !Array.isArray(selfCare) ||
    !Array.isArray(warningSigns) ||
    !Array.isArray(followUpQuestions) ||
    !Array.isArray(sources) ||
    selfCare.length > MAX_LIST_ITEMS ||
    warningSigns.length > MAX_LIST_ITEMS ||
    followUpQuestions.length > 2 ||
    sources.length !== 0
  ) {
    return createFallbackResponse();
  }

  const lists = [selfCare, warningSigns, followUpQuestions];
  if (lists.some(items => items.some(item =>
    typeof item !== 'string' || !item.trim() || item.length > MAX_LIST_ITEM_LENGTH
  ))) {
    return createFallbackResponse();
  }

  return {
    message: message.trim(),
    urgency,
    selfCare: selfCare.map(item => item.trim()),
    warningSigns: warningSigns.map(item => item.trim()),
    followUpQuestions: followUpQuestions.map(item => item.trim()),
    sources: [],
    status: 'ok'
  };
}

function formatReply(response) {
  const sections = [response.message];
  if (response.urgency === 'emergency') {
    sections.unshift('Seek emergency care now.');
  } else if (response.urgency === 'urgent') {
    sections.unshift('Please seek prompt medical advice.');
  }
  if (response.selfCare.length) {
    sections.push(`Self-care:\n${response.selfCare.map(item => `• ${item}`).join('\n')}`);
  }
  if (response.warningSigns.length) {
    sections.push(`Seek urgent care if:\n${response.warningSigns.map(item => `• ${item}`).join('\n')}`);
  }
  if (response.followUpQuestions.length) {
    sections.push(response.followUpQuestions.map(item => `• ${item}`).join('\n'));
  }
  sections.push('General health information only; not a diagnosis.');
  return sections.join('\n\n');
}

function createApiResponse(structured) {
  return {
    reply: formatReply(structured),
    structured
  };
}

module.exports = {
  createApiResponse,
  createFallbackResponse,
  normalizeGeneratedResponse
};
