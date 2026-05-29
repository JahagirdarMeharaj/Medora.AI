const form = document.getElementById('detailsForm');
const chatSection = document.getElementById('chat-section');
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearChat');
const toggleMode = document.getElementById('toggleMode');
const newChatBtn = document.getElementById('newChat');
const historyPanel = document.getElementById('chat-history');

let patientDetails = {};

// Chat sessions: [{id, createdAt, patientDetails, messages:[{user, bot, timestamp}]}]
let sessions = [];
let activeSessionId = null;


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

  // If no session exists yet, create one.
  if (!activeSessionId) {
    createNewSession(true);
  }
});

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

clearBtn.addEventListener('click', () => {
  if (!activeSessionId) return;
  deleteActiveSession();
});

newChatBtn.addEventListener('click', () => {
  createNewSession(false);
});

toggleMode.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// async function sendMessage() {
//   const message = userInput.value.trim();
//   if (!message) return;

//   addMessage('user', escapeForText(message));
//   userInput.value = '';

//   const typingEl = addMessage('bot', 'Typing...');

//   try {
//     const response = await fetch('http://localhost:5000/api/chatbot/message', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ patientDetails, message })
//     });

//     const data = await response.json();
//     const reply = escapeForText(data?.reply ?? 'Sorry, I could not process your request.');

//     typingEl.textContent = reply;
//     chatHistory.push({ user: message, bot: reply });
//     localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
//   } catch (error) {
//     typingEl.textContent = 'Sorry, something went wrong. Please check the server and try again.';
//     console.error(error);
//   }
// }

// Sessions persistence
const STORAGE_KEY = 'hospitalChatbot.sessions.v1';
const ACTIVE_KEY = 'hospitalChatbot.sessions.active.v1';

function uid() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    sessions = raw ? JSON.parse(raw) : [];
  } catch {
    sessions = [];
  }
  try {
    activeSessionId = localStorage.getItem(ACTIVE_KEY);
  } catch {
    activeSessionId = null;
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  localStorage.setItem(ACTIVE_KEY, activeSessionId || '');
}

function getSessionById(id) {
  return sessions.find(s => s.id === id) || null;
}

function setActiveSession(id) {
  activeSessionId = id;
  renderHistory();
  const s = getSessionById(id);
  if (s) renderChatFromSession(s);
  saveSessions();
}

function clearChatWindow() {
  chatWindow.innerHTML = '';
}

function renderChatFromSession(session) {
  clearChatWindow();
  if (!session.messages) return;
  session.messages.forEach(({ user, bot }) => {
    addMessage('user', escapeForText(user));
    addMessage('bot', escapeForText(bot));
  });
}

function computeSessionTitle(session) {
  const firstUser = session?.messages?.[0]?.user;
  if (typeof firstUser === 'string' && firstUser.trim()) {
    return firstUser.trim().slice(0, 28);
  }
  return (session?.patientDetails?.symptoms || 'New chat').toString().slice(0, 28);
}

function renderHistory() {
  if (!historyPanel) return;
  historyPanel.innerHTML = '';
  sessions
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach(session => {
      const item = document.createElement('div');
      item.className = `history-item glass ${session.id === activeSessionId ? 'active' : ''}`;
      item.dataset.sessionId = session.id;

      const title = computeSessionTitle(session);
      const meta = session.messages?.length ? `${session.messages.length} exchanges` : 'Empty';

      item.innerHTML = `
        <div class="history-title">${escapeForText(title)}</div>
        <div class="history-meta">
          <span>${escapeForText(meta)}</span>
          <span>${escapeForText(formatTime(session.createdAt))}</span>
        </div>
      `;

      item.addEventListener('click', () => setActiveSession(session.id));
      historyPanel.appendChild(item);
    });
}

function createNewSession(autoSelect = false) {
  const now = Date.now();
  const session = {
    id: uid(),
    createdAt: now,
    patientDetails: patientDetails || {},
    messages: []
  };
  sessions.push(session);
  saveSessions();
  renderHistory();
  setActiveSession(session.id);
}

function deleteSessionById(id) {
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return;
  sessions.splice(idx, 1);

  if (activeSessionId === id) {
    const next = sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    activeSessionId = next ? next.id : null;
  }

  saveSessions();
  renderHistory();
  if (activeSessionId) {
    renderChatFromSession(getSessionById(activeSessionId));
  } else {
    clearChatWindow();
  }
}

function deleteActiveSession() {
  if (!activeSessionId) return;
  deleteSessionById(activeSessionId);
}

// init
loadSessions();
if (sessions.length) {
  // restore active if possible; else select most recent
  const exists = activeSessionId && getSessionById(activeSessionId);
  const chosen = exists ? activeSessionId : sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0].id;
  activeSessionId = chosen;
}

renderHistory();
if (activeSessionId) {
  const s = getSessionById(activeSessionId);
  if (s) renderChatFromSession(s);
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

  // Ensure session exists
  if (!activeSessionId) {
    createNewSession(true);
  }

  addMessage('user', escapeForText(message));
  userInput.value = '';

  const typingEl = addTypingIndicator();

  try {
    const response = await fetch('https://chatbot-project-1rrr.onrender.com/api/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientDetails, message })
    });

    const data = await response.json();
    const reply = escapeForText(data?.reply ?? 'Sorry, I could not process your request.');

    typingEl.classList.remove('typing-indicator');
    typingEl.textContent = reply;

    const s = getSessionById(activeSessionId);
    if (s) {
      s.messages = s.messages || [];
      s.messages.push({ user: message, bot: reply, timestamp: Date.now() });
      saveSessions();
      renderHistory();
    }
  } catch (error) {
    typingEl.textContent = 'Sorry, something went wrong. Please check the server and try again.';
    console.error(error);
  }
}




