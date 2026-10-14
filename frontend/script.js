const composerForm = document.getElementById('composerForm');
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const toggleMode = document.getElementById('toggleMode');
const healthPrivacyLink = document.querySelector('.nav a[href="#safety-note"]');
const safetyNote = document.getElementById('safety-note');
const newChatButtons = [
  document.getElementById('newChat'),
  document.getElementById('mobileNewChat')
].filter(Boolean);
const deleteActiveChatBtn = document.getElementById('deleteActiveChat');
const historyPanel = document.getElementById('chat-history');
const historyMenuToggle = document.getElementById('historyMenuToggle');
const historyMenuClose = document.getElementById('historyMenuClose');
const historyBackdrop = document.getElementById('historyBackdrop');
const conversationSidebar = document.getElementById('conversation-sidebar');
const statusMessage = document.getElementById('app-status');

let sessions = [];
let activeSessionId = null;
let isSending = false;

const STORAGE_KEY = 'medoraHealthChatbot.sessions.v1';
const ACTIVE_KEY = 'medoraHealthChatbot.activeSession.v1';
const THEME_KEY = 'medoraHealthChatbot.theme.v1';

function uid() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;
}

function setStatus(message) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('visible', Boolean(message));
}

function addMessage(role, text) {
  const element = document.createElement('div');
  element.className = `message ${role === 'user' ? 'user' : 'bot'}`;
  element.textContent = String(text ?? '');
  chatWindow.appendChild(element);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return element;
}

function addWelcomeMessage() {
  const welcome = document.createElement('div');
  welcome.className = 'welcome-state';
  welcome.innerHTML = `
    <div class="welcome-symbol-badge">
      <img src="assets/medora-symbol.png" alt="Medora AI" class="welcome-symbol-img" width="48" height="44" />
    </div>
    <span class="welcome-tagline">Better Health with AI</span>
    <h2>How can I help you today?</h2>
    <p>Describe your symptoms, ask health questions, or prepare for a clinician visit. I provide clear, evidence-based guidance and safer next steps.</p>
    <div class="welcome-prompts" role="group" aria-label="Suggested topics">
      <button type="button" class="prompt-chip" data-query="I have a mild fever and a headache. What symptoms should I monitor?">
        <span class="chip-title">Mild fever &amp; headache</span>
        <span class="chip-desc">What signs to watch for</span>
      </button>
      <button type="button" class="prompt-chip" data-query="What questions should I prepare for my upcoming doctor appointment?">
        <span class="chip-title">Doctor appointment</span>
        <span class="chip-desc">Key questions to prepare</span>
      </button>
      <button type="button" class="prompt-chip" data-query="What evidence-based non-medical habits can help improve sleep quality?">
        <span class="chip-title">Sleep improvement</span>
        <span class="chip-desc">Evidence-based habits</span>
      </button>
    </div>
  `;
  chatWindow.appendChild(welcome);
}

function addTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-label', 'Assistant is responding');
  indicator.innerHTML = '<span></span><span></span><span></span>';
  chatWindow.appendChild(indicator);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return indicator;
}

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Recently';
  }
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const storedSessions = raw ? JSON.parse(raw) : [];
    sessions = Array.isArray(storedSessions)
      ? storedSessions
        .filter(session =>
          session &&
          typeof session.id === 'string' &&
          Array.isArray(session.messages)
        )
        .map(session => ({
          id: session.id,
          createdAt: Number(session.createdAt) || Date.now(),
          messages: session.messages.filter(message =>
            message &&
            typeof message.user === 'string' &&
            typeof message.bot === 'string'
          )
        }))
      : [];
  } catch {
    sessions = [];
    setStatus('Saved chat history could not be read in this browser.');
  }

  try {
    activeSessionId = localStorage.getItem(ACTIVE_KEY) || null;
  } catch {
    activeSessionId = null;
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVE_KEY, activeSessionId || '');
  } catch (error) {
    setStatus('Chat history could not be saved in this browser. This chat will remain available until you leave this page.');
    console.error('Unable to save chat history:', error);
  }
}

function getSessionById(id) {
  return sessions.find(session => session.id === id) || null;
}

function computeSessionTitle(session) {
  const firstUserMessage = session.messages[0]?.user;
  return firstUserMessage?.trim()
    ? firstUserMessage.trim().slice(0, 32)
    : 'New chat';
}

function renderChatFromSession(session) {
  chatWindow.replaceChildren();
  if (!session || session.messages.length === 0) {
    addWelcomeMessage();
    return;
  }

  session.messages.forEach(({ user, bot }) => {
    addMessage('user', user);
    addMessage('bot', bot);
  });
}

function renderHistory() {
  historyPanel.replaceChildren();
  deleteActiveChatBtn.disabled = !getSessionById(activeSessionId);

  if (sessions.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'history-empty';
    emptyState.textContent = 'Your conversations will appear here.';
    historyPanel.appendChild(emptyState);
    return;
  }

  sessions
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(session => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `history-item ${session.id === activeSessionId ? 'active' : ''}`;
      item.setAttribute('aria-current', session.id === activeSessionId ? 'true' : 'false');
      item.setAttribute('aria-label', `${computeSessionTitle(session)}, ${session.messages.length} exchanges, ${formatTime(session.createdAt)}`);

      const title = document.createElement('span');
      title.className = 'history-title';
      title.textContent = computeSessionTitle(session);

      const meta = document.createElement('span');
      meta.className = 'history-meta';
      const count = session.messages.length;
      meta.textContent = `${count} ${count === 1 ? 'exchange' : 'exchanges'} · ${formatTime(session.createdAt)}`;
      item.append(title, meta);
      item.addEventListener('click', () => setActiveSession(session.id));
      historyPanel.appendChild(item);
    });
}

function setActiveSession(id) {
  const session = getSessionById(id);
  if (!session) return;

  activeSessionId = id;
  renderHistory();
  renderChatFromSession(session);
  saveSessions();
  closeHistoryMenu();
}

function createNewSession() {
  const session = {
    id: uid(),
    createdAt: Date.now(),
    messages: []
  };

  sessions.push(session);
  activeSessionId = session.id;
  saveSessions();
  renderHistory();
  renderChatFromSession(session);
}

function deleteSessionById(id) {
  const index = sessions.findIndex(session => session.id === id);
  if (index === -1) return;

  sessions.splice(index, 1);
  if (activeSessionId === id) {
    const newestSession = sessions.slice().sort((a, b) => b.createdAt - a.createdAt)[0];
    activeSessionId = newestSession?.id || null;
  }

  saveSessions();
  renderHistory();
  renderChatFromSession(getSessionById(activeSessionId));
}

function openHistoryMenu() {
  conversationSidebar.classList.add('is-open');
  historyBackdrop.classList.add('is-visible');
  historyMenuToggle.setAttribute('aria-expanded', 'true');
  historyMenuClose.focus();
}

function closeHistoryMenu() {
  conversationSidebar.classList.remove('is-open');
  historyBackdrop.classList.remove('is-visible');
  historyMenuToggle.setAttribute('aria-expanded', 'false');
}

function getResponseFallback(message) {
  const normalized = message.toLowerCase();
  const safetyNote = ' This is general information, not a diagnosis. If symptoms are severe, sudden, or rapidly worsening, contact a clinician or local emergency services as appropriate.';

  if (normalized.includes('fever') || normalized.includes('temperature')) {
    return `Fever can have many causes. Rest, drink fluids if you can, and monitor how you feel. Contact a clinician if it is high, persists, or you feel very unwell.${safetyNote}`;
  }

  if (normalized.includes('headache') || normalized.includes('pain')) {
    return `Headaches can have many causes. Rest and fluids may help. A sudden, severe headache or one with weakness, confusion, fainting, or vision changes needs urgent medical assessment.${safetyNote}`;
  }

  if (normalized.includes('cough') || normalized.includes('cold')) {
    return `A cough can have many causes. Rest, fluids, and avoiding smoke may help. Seek medical advice if it worsens, persists, or comes with difficulty breathing.${safetyNote}`;
  }

  if (normalized.includes('dizziness') || normalized.includes('nausea')) {
    return `Dizziness or nausea can have many causes. Sit or lie down somewhere safe and sip fluids if you can. Seek urgent help for fainting, chest pain, confusion, or trouble breathing.${safetyNote}`;
  }

  return `I can't determine the cause from a message. Monitor how you feel and contact a clinician if symptoms persist, worsen, or concern you.${safetyNote}`;
}

function resizeComposer() {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isSending) return;

  if (!activeSessionId || !getSessionById(activeSessionId)) {
    createNewSession();
  }

  const session = getSessionById(activeSessionId);
  if (!session) return;

  const welcome = chatWindow.querySelector('.welcome-state');
  welcome?.remove();
  addMessage('user', message);
  userInput.value = '';
  resizeComposer();

  const typingIndicator = addTypingIndicator();
  isSending = true;
  sendBtn.disabled = true;
  setStatus('');

  try {
    const response = await fetch('http://localhost:5000/api/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientDetails: {},
        message,
        recentUserMessages: session.messages.slice(-5).map(exchange => exchange.user),
        conversationHistory: session.messages.slice(-5).flatMap(exchange => [
          { role: 'user', content: exchange.user },
          { role: 'assistant', content: exchange.bot }
        ])
      })
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = typeof data?.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : getResponseFallback(message);

    typingIndicator.className = 'message bot';
    typingIndicator.removeAttribute('aria-label');
    typingIndicator.textContent = reply;
    session.messages.push({ user: message, bot: reply, timestamp: Date.now() });
    saveSessions();
    renderHistory();
  } catch (error) {
    const reply = getResponseFallback(message);
    typingIndicator.className = 'message bot';
    typingIndicator.removeAttribute('aria-label');
    typingIndicator.textContent = reply;
    session.messages.push({ user: message, bot: reply, timestamp: Date.now() });
    saveSessions();
    renderHistory();
    setStatus('Could not reach the health assistant. Showing general safety information instead.');
    console.warn('Using offline chatbot fallback:', error);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function applyTheme(isDark) {
  document.body.classList.toggle('light-mode', !isDark);
  const label = toggleMode.querySelector('.theme-label');
  const icon = toggleMode.querySelector('.theme-icon');
  if (label) label.textContent = isDark ? 'Light' : 'Dark';
  if (icon) icon.textContent = isDark ? '☼' : '☾';
  toggleMode.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  toggleMode.setAttribute('aria-pressed', String(isDark));
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#202A27' : '#F7F8F5');
  }
}

function init() {
  loadSessions();
  if (sessions.length && !getSessionById(activeSessionId)) {
    activeSessionId = sessions.slice().sort((a, b) => b.createdAt - a.createdAt)[0].id;
  }

  renderHistory();
  renderChatFromSession(getSessionById(activeSessionId));

  let isDark = true;
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    isDark = storedTheme === null || storedTheme === 'dark';
  } catch {
    isDark = true;
  }
  applyTheme(isDark);

  composerForm.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage();
  });
  userInput.addEventListener('input', resizeComposer);
  userInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      composerForm.requestSubmit();
    }
  });

  chatWindow.addEventListener('click', event => {
    const chip = event.target.closest('.prompt-chip');
    if (!chip) return;
    const query = chip.getAttribute('data-query');
    if (query && !isSending) {
      userInput.value = query;
      resizeComposer();
      userInput.focus();
      composerForm.requestSubmit();
    }
  });

  newChatButtons.forEach(button => {
    button.addEventListener('click', () => {
      createNewSession();
      closeHistoryMenu();
      userInput.focus();
    });
  });

  deleteActiveChatBtn.addEventListener('click', () => {
    const session = getSessionById(activeSessionId);
    if (!session) return;

    if (window.confirm(`Delete "${computeSessionTitle(session)}" from this browser? This cannot be undone.`)) {
      deleteSessionById(session.id);
      closeHistoryMenu();
    }
  });

  historyMenuToggle.addEventListener('click', openHistoryMenu);
  historyMenuClose.addEventListener('click', closeHistoryMenu);
  historyBackdrop.addEventListener('click', closeHistoryMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && conversationSidebar.classList.contains('is-open')) {
      closeHistoryMenu();
      historyMenuToggle.focus();
    }
  });

  toggleMode.addEventListener('click', () => {
    const isDark = document.body.classList.contains('light-mode');
    applyTheme(isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (error) {
      setStatus('Your theme preference could not be saved in this browser.');
      console.error('Unable to save theme preference:', error);
    }
  });

  healthPrivacyLink.addEventListener('click', () => {
    safetyNote.open = true;
  });
}

init();
