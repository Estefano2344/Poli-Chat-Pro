// Poli Chat Pro - client JS
document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const joinBtn = document.getElementById('joinBtn');
  const usernameInput = document.getElementById('usernameInput');

  const usersList = document.getElementById('usersList');
  const myStatus = document.getElementById('myStatus');

  const messages = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  const chatTitle = document.getElementById('chatTitle');
  const chatStatus = document.getElementById('chatStatus');

  // state
  let ws;
  let connected = false;
  let currentUsername = '';

  // theme initial
  if (!document.documentElement.getAttribute('data-theme')) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // --- Events: Login ---
  joinBtn.addEventListener('click', joinChat);
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinChat();
  });

  function joinChat() {
    const name = usernameInput.value.trim();
    if (!name) { usernameInput.focus(); return; }

    currentUsername = name;
    // show app
    loginScreen.style.display = 'none';
    app.style.display = 'flex';

    // set header
    chatTitle.textContent = 'Chat General';
    chatStatus.textContent = 'Conectando...';

    // connect ws
    connectWebSocket();
  }

  // --- WebSocket connection and logic ---
  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // connect to same hostname port 8080 (adjust if your backend uses different port)
    ws = new WebSocket(`ws://172.31.103.16:8080`);

    ws.onopen = () => {
      connected = true;
      myStatus.textContent = 'Conectado';
      chatStatus.textContent = 'Conectado';
      sendBtn.disabled = false;

      // Inform the server who joined
      ws.send(JSON.stringify({ type: 'join', username: currentUsername }));
    };

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch (err) {
        console.warn('Mensaje no JSON recibido', ev.data);
        return;
      }

      // Handle types from server:
      // - type: "users" -> { type: 'users', users: [{username, lastSeen?}], me: 'name' }
      // - type: "message" -> { type: 'message', username, text, timestamp }

      if (data.type === 'users' && Array.isArray(data.users)) {
        updateUsersList(data.users);
      } else if (data.type === 'message') {
        const messageType = (data.username === currentUsername) ? 'sent' : 'received';
        addMessageToDOM(data.username, data.text, data.timestamp || timeNow(), messageType);
      } else if (data.type === 'system') {
        // optional: display system notices in chat
        addSystemMessage(data.text || '');
      } else {
        // fallback: assume it's a message-like object
        if (data.username && data.text) {
          const mt = (data.username === currentUsername) ? 'sent' : 'received';
          addMessageToDOM(data.username, data.text, data.timestamp || timeNow(), mt);
        }
      }
    };

    ws.onclose = () => {
      connected = false;
      myStatus.textContent = 'Desconectado';
      chatStatus.textContent = 'Desconectado';
      sendBtn.disabled = true;

      // try reconnect after a short delay
      setTimeout(() => {
        // Only try to reconnect if user is still on app (i.e., didn't close)
        if (app.style.display !== 'none') connectWebSocket();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      ws.close();
    };
  }

  // --- Users list rendering ---
  function updateUsersList(users) {
    // users: [{ username, lastSeen? }]
    // place current user on top and mark as "me"
    usersList.innerHTML = '';

    // sort: me first then others alphabetical
    users.sort((a,b) => {
      if (a.username === currentUsername) return -1;
      if (b.username === currentUsername) return 1;
      return a.username.localeCompare(b.username);
    });

    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'user-item' + (u.username === currentUsername ? ' me' : '');
      item.dataset.username = u.username;

      item.innerHTML = `
        <div class="user-avatar">
          <!-- optional avatar initials -->
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#055;opacity:0.9;">
            ${escapeHTML((u.username || 'U').slice(0,2).toUpperCase())}
          </div>
          <div class="user-presence" title="${u.online ? 'En línea' : 'Desconectado'}" style="background:${u.online ? 'var(--accent)' : '#c4c4c4'}"></div>
        </div>
        <div class="user-info">
          <div class="user-name">${escapeHTML(u.username)}</div>
          <div class="user-last muted small">${u.status || (u.username === currentUsername ? 'Tú' : 'Activo')}</div>
        </div>
      `;

      // clicking a user could open a private chat; for now we keep single global chat
      item.addEventListener('click', () => {
        // visual feedback: highlight selection
        document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        chatTitle.textContent = u.username === currentUsername ? 'Chat General' : `Chat con ${u.username}`;
        chatStatus.textContent = u.online ? 'En línea' : 'Desconectado';
      });

      usersList.appendChild(item);
    });
  }

  // --- Messages DOM ---
  function addMessageToDOM(username, text, timestamp, type) {
    const container = document.createElement('div');
    container.className = 'msg ' + (type === 'sent' ? 'sent' : 'received');

    // hide username for our own messages
    const usernameBlock = (type === 'sent') ? '' : `<div class="username">${escapeHTML(username)}</div>`;

    container.innerHTML = `
      ${usernameBlock}
      <div class="text">${escapeHTML(text)}</div>
      <div class="meta"><span class="time">${escapeHTML(timestamp)}</span></div>
    `;

    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
  }

  function addSystemMessage(text){
    const s = document.createElement('div');
    s.style.alignSelf = 'center';
    s.style.fontSize = '13px';
    s.style.color = 'var(--muted)';
    s.style.margin = '8px 0';
    s.textContent = text;
    messages.appendChild(s);
    messages.scrollTop = messages.scrollHeight;
  }

  // --- Sending messages ---
  function sendMessage() {
    const txt = messageInput.value.trim();
    if (!txt) return;
    if (!connected || ws.readyState !== WebSocket.OPEN) {
      alert('Conexión no disponible.');
      return;
    }

    const payload = {
      type: 'message',
      username: currentUsername,
      text: txt,
      timestamp: timeNow()
    };

    ws.send(JSON.stringify(payload));

    // optimistic UI: add local message immediately (server may echo back too)
    addMessageToDOM(currentUsername, txt, payload.timestamp, 'sent');
    messageInput.value = '';
  }

  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // enable/disable send based on input
  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
  });

  // --- Theme toggle ---
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    themeIcon.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  });

  // --- Utilities ---
  function timeNow() {
    const d = new Date();
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  function escapeHTML(str = '') {
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m];
    });
  }

  // Optional: allow searching users client-side
  const searchUsers = document.getElementById('searchUsers');
  searchUsers && searchUsers.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.user-item').forEach(it => {
      const name = it.querySelector('.user-name')?.textContent?.toLowerCase() || '';
      it.style.display = name.includes(q) ? '' : 'none';
    });
  });

});
