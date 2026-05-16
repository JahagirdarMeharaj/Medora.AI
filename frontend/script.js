const form = document.getElementById('detailsForm');
const chatSection = document.getElementById('chat-section');
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearChat');
const toggleMode = document.getElementById('toggleMode');

let patientDetails = {};
let chatHistory = [];

function addMessage(role, text) {
  const el = document.createElement('div');
  el.className = `message ${role === 'user' ? 'user' : 'bot'}`;
  el.textContent = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

function escapeForText(s) {
  // Using textContent anyway, so this is just a safety placeholder.
  return String(s ?? '');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  patientDetails = Object.fromEntries(formData.entries());

  form.classList.add('hidden');
  chatSection.classList.remove('hidden');
});

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

clearBtn.addEventListener('click', () => {
  chatWindow.innerHTML = '';
  chatHistory = [];
  localStorage.removeItem('chatHistory');
});

toggleMode.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage('user', escapeForText(message));
  userInput.value = '';

  const typingEl = addMessage('bot', 'Typing...');

  try {
    const response = await fetch('https://chatbot-project-backend-liuc.onrender.com/api/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientDetails, message })
    });

    const data = await response.json();
    const reply = escapeForText(data?.reply ?? 'Sorry, I could not process your request.');

    typingEl.textContent = reply;
    chatHistory.push({ user: message, bot: reply });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  } catch (error) {
    typingEl.textContent = 'Sorry, something went wrong. Please check the server and try again.';
    console.error(error);
  }
}

// Optional: restore previous chat
try {
  const stored = localStorage.getItem('chatHistory');
  if (stored) {
    chatHistory = JSON.parse(stored) || [];
    chatHistory.forEach(({ user, bot }) => {
      addMessage('user', escapeForText(user));
      addMessage('bot', escapeForText(bot));
    });
  }
} catch (_) {
  // ignore
}


function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'message bot typing-indicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage('user', escapeForText(message));
  userInput.value = '';

  const typingEl = addTypingIndicator();

  try {
    const response = await fetch('https://chatbot-project-backend-liuc.onrender.com/api/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientDetails, message })
    });

    const data = await response.json();
    const reply = escapeForText(data?.reply ?? 'Sorry, I could not process your request.');

    typingEl.classList.remove('typing-indicator');
    typingEl.textContent = reply;

    chatHistory.push({ user: message, bot: reply });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  } catch (error) {
    typingEl.textContent = 'Sorry, something went wrong. Please check the server and try again.';
    console.error(error);
  }
}


