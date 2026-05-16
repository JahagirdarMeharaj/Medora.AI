const axios = require('axios');

function buildPrompt(patientDetails, message) {
  return `
You are a hospital chatbot.

Patient Details:
${JSON.stringify(patientDetails)}

Patient Symptoms:
${message}

IMPORTANT RULES:
1. Reply ONLY in bullet points.
2. Give ONLY 5 to 8 bullet points.
3. Each bullet point must be SHORT.
4. Maximum total response = 100 words.
5. NO introductions.
6. NO greetings.
7. NO headings.
8. NO paragraphs.
9. ONLY simple health advice.
10. End with one short disclaimer line.

Example format:
• Drink warm water
• Take proper rest
• Avoid cold drinks

Now generate response.
`;
}

exports.generateAIResponse = async (patientDetails, message) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    return 'Server misconfiguration: GEMINI_API_KEY is missing.';
  }

  const prompt = buildPrompt(patientDetails, message);

  try {
    // Gemini Generative Language API: generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "Sorry, I couldn't process your request. Please try again.";
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('Gemini API Error:', status, data || error.message);
    return 'Sorry, I could not process your request. Please try again.';
  }
};

