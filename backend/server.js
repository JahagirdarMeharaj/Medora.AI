// Main Express server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimiter = require('./middleware/rateLimiter');

const chatbotRoutes = require('./routes/chatbot');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(rateLimiter);

app.use('/api/chatbot', chatbotRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


