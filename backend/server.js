// Main Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const chatbotRoutes = require('./routes/chatbot');
const { createCorsOptions } = require('./middleware/corsConfig');

function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(createCorsOptions(options.allowedOrigins)));
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/chatbot', chatbotRoutes);

  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body exceeds the 64 KB limit.' });
    }
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    console.error('Unhandled request error:', error.name || 'Error');
    return res.status(500).json({ error: 'Server error' });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  createApp().listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = { createApp };
