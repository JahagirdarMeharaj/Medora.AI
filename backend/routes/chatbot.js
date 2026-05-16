const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatbotController');

// POST endpoint for chatbot messages
router.post('/message', handleChat);

module.exports = router;
