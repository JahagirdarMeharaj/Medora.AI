const { generateAIResponse } = require('../utils/aiPrompt');

exports.handleChat = async (req, res) => {
  try {
    const { patientDetails, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const aiResponse = await generateAIResponse(patientDetails, message);

    res.json({ reply: aiResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
