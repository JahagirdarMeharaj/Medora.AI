const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_CHARACTERS = 12000;

function validateConversationHistory(history) {
  if (history === undefined || history === null) {
    return { valid: true, messages: [] };
  }

  if (!Array.isArray(history)) {
    return { valid: false, error: 'Conversation history must be an array.' };
  }

  if (history.length > MAX_HISTORY_MESSAGES) {
    return { valid: false, error: 'Conversation history is limited to five exchanges.' };
  }

  let totalCharacters = 0;
  const messages = [];

  for (let index = 0; index < history.length; index += 1) {
    const item = history[index];
    const expectedRole = index % 2 === 0 ? 'user' : 'assistant';
    if (!item || item.role !== expectedRole || typeof item.content !== 'string' || !item.content.trim()) {
      return {
        valid: false,
        error: 'Conversation history must contain alternating, non-empty user and assistant messages.'
      };
    }

    const content = item.content.trim();
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: 'Each conversation message is limited to 2000 characters.' };
    }

    totalCharacters += content.length;
    if (totalCharacters > MAX_HISTORY_CHARACTERS) {
      return { valid: false, error: 'Conversation history exceeds the allowed size.' };
    }

    messages.push({ role: item.role, content });
  }

  if (messages.length % 2 !== 0) {
    return { valid: false, error: 'Conversation history must contain complete exchanges.' };
  }

  return { valid: true, messages };
}

module.exports = { validateConversationHistory };
