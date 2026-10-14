const { generateAIResponse } = require('../utils/aiPrompt');
const { assessEmergency } = require('../services/emergencySafety');
const { validateConversationHistory } = require('../services/conversationMemory');
const { createApiResponse, createFallbackResponse } = require('../services/structuredResponse');

const MAX_CURRENT_MESSAGE_LENGTH = 2000;
const MAX_PATIENT_DETAILS_BYTES = 2000;

exports.handleChat = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { patientDetails, message, recentUserMessages, conversationHistory } = body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (message.length > MAX_CURRENT_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message is limited to 2000 characters.' });
    }
    if (patientDetails !== undefined && patientDetails !== null) {
      if (typeof patientDetails !== 'object' || Array.isArray(patientDetails)) {
        return res.status(400).json({ error: 'Patient details must be an object.' });
      }
      if (Buffer.byteLength(JSON.stringify(patientDetails), 'utf8') > MAX_PATIENT_DETAILS_BYTES) {
        return res.status(400).json({ error: 'Patient details exceed the 2000-byte limit.' });
      }
    }

    const historyResult = validateConversationHistory(conversationHistory);
    if (!historyResult.valid) {
      return res.status(400).json({ error: historyResult.error });
    }

    const safetyResult = assessEmergency(message, recentUserMessages);
    if (safetyResult.status === 'possible-emergency') {
      return res.json(createApiResponse({
        message: safetyResult.reply,
        urgency: 'emergency',
        selfCare: [],
        warningSigns: [],
        followUpQuestions: [],
        sources: [],
        status: 'emergency-safeguard'
      }));
    }
    if (safetyResult.status === 'unable-to-assess') {
      return res.json(createApiResponse(createFallbackResponse(
        'I could not screen this message reliably. If you may be experiencing a medical emergency, contact your local emergency number now. This initial safeguard is not a clinically validated triage system.'
      )));
    }

    const structured = await generateAIResponse(patientDetails, message, historyResult.messages);

    res.json(createApiResponse(structured));
  } catch (error) {
    console.error('Chat request failed:', error.name || 'Error');
    res.status(500).json({ error: "Server error" });
  }
};
