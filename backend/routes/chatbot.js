const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatbotController');
const rateLimiter = require('../middleware/rateLimiter');

// POST endpoint for chatbot messages
router.post('/message', rateLimiter, handleChat);

module.exports = router;
