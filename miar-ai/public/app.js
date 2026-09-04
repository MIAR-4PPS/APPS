// MIAR AI — front-end real. Toda ação aqui bate no backend de verdade.
const API = '';
let stories = [], activeStory = null, activeConversation = null;
let providers = [];
let lastAssistantText = '';
let speechUtterance = null;
let recognizing = false;
let silenceTimer = null;
let recognition = null;
let mediaStream = null;

const $ = (id) => document.getElementById(id);
const menuBtn=$('menuBtn'), overlay=$('overlay'), drawer=$('drawer'), storyList=$('storyList');
const newStoryBtn=$('newStoryBtn'), storyLabel=$('storyLabel'), chatArea=$('chatArea');
const msgInput=$('msgInput'), sendBtn=$('sendBtn'), apiWarning=$('apiWarning');
const settingsBtn=$('settingsBtn'), settingsDrawer=$('settingsDrawer'), providerList=$('providerList');
const addProviderForm=$('addProviderForm'), memoryList=$('memoryList'), memWarning=$('memWarning');
const themeToggle=$('themeToggle'), micBtn=$('micBtn'), ttsBtn=$('ttsBtn'), camBtn=$('camBtn');
const attachBtn=$('attachBtn'), fileInput=$('fileInput'), readAllFloatBtn=$('readAllFloatBtn');
const fullContextCheckbox=$('fullContextCheckbox'), selfEditCheckbox=$('selfEditCheckbox');

// ---------- Tema (claro verde / escuro verde / sistema) ----------
function applyTheme(t) {
  if (t === 'system') {
    document.documentElement.setAttribute('data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
  localStorage.setItem('miar-theme', t);
}
themeToggle.addEventListener('click', () => {
  const order = ['light', 'dark', 'system'];
  const current = localStorage.getItem('miar-theme') || 'light';
  const next = order[(order.indexOf(current) + 1) % order.length];
  applyTheme(next);
  themeToggle.textContent = `🌓 ${next}`;
});
applyTheme(localStorage.getItem('miar-theme') || 'light');

// ---------- Drawers ----------
function openDrawer(){overlay.classList.add('open');drawer.classList.add('open');}
function closeDrawer(){overlay.classList.remove('open');drawer.classList.remove('open');settingsDrawer.classList.remove('open');}
menuBtn.addEventListener('click', openDrawer);
overlay.addEventListener('click', closeDrawer);
settingsBtn.addEventListener('click', () => { settingsDrawer.classList.toggle('open'); overlay.classList.toggle('open'); });

// ---------- Histórias ----------
async function loadStories() {
  stories = await (await fetch(`${API}/api/stories`)).json();
  renderStoryList();
}
function renderStoryList() {
  storyList.innerHTML = '';
  stories.forEach(s => {
    const li = document.createElement('li');
    li.className = s.id === activeStory?.id ? 'active' : '';
    li.innerHTML = `<span class="dot" style="background:${s.color}"></span><span>${escapeHtml(s.name)}</span><span class="del" data-id="${s.id}">✕</span>`;
    li.addEventListener('click', (e) => { if (e.target.classList.contains('del')) return; selectStory(s); closeDrawer(); });
    li.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Excluir a história "${s.name}" e todas as conversas dela?`)) return;
      await fetch(`${API}/api/stories/${s.id}`, { method: 'DELETE' });
      if (activeStory?.id === s.id) { activeStory = null; activeConversation = null; renderChat([]); }
      loadStories();
    });
    storyList.appendChild(li);
  });
}
newStoryBtn.addEventListener('click', async () => {
  const name = prompt('Nome da história (opcional, sobre o que é):') || '';
  const color = prompt('Cor de identificação (hex, ex: #2e7d32):', '#2e7d32') || '#2e7d32';
  const res = await fetch(`${API}/api/stories`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, color }) });
  const story = await res.json();
  await loadStories();
  selectStory(story);
  closeDrawer();
});

async function selectStory(story) {
  activeStory = story;
  storyLabel.textContent = story.name;
  renderStoryList();
  let convs = await (await fetch(`${API}/api/stories/${story.id}/conversations`)).json();
  if (convs.length === 0) {
    activeConversation = await (await fetch(`${API}/api/stories/${story.id}/conversations`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title: 'Conversa 1' }) })).json();
  } else {
    activeConversation = convs[convs.length - 1];
  }
  msgInput.disabled = false; sendBtn.disabled = false;
  await loadMessages();
}

async function loadMessages() {
  if (!activeConversation) return;
  const messages = await (await fetch(`${API}/api/conversations/${activeConversation.id}/messages`)).json();
  renderChat(messages);
}
function renderChat(messages) {
  chatArea.innerHTML = '';
  if (messages.length === 0) { chatArea.innerHTML = '<div class="empty-state">Sem mensagens ainda.</div>'; return; }
  messages.forEach(m => chatArea.appendChild(renderMsg(m)));
  chatArea.scrollTop = chatArea.scrollHeight;
  const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
  if (lastAi) { lastAssistantText = lastAi.content; ttsBtn.style.display = 'inline-block'; }
}
function renderMsg(m) {
  const div = document.createElement('div');
  div.className = `msg ${m.role}`;
  div.textContent = m.content;
  if (m.role !== 'system') {
    const meta = document.createElement('div');
    meta.className = 'meta';
    const d = new Date(m.createdAt || Date.now());
    const hhmmss = d.toTimeString().slice(0,8);
    const dateStr = d.toLocaleDateString('pt-BR');
    meta.innerHTML = `<span class="time" title="${dateStr}">${hhmmss}</span><span class="copyBtn" title="Copiar mensagem">📋</span>`;
    meta.querySelector('.copyBtn').addEventListener('click', () => navigator.clipboard.writeText(m.content));
    div.appendChild(meta);
  }
  return div;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// ---------- Caixa de texto expansível ----------
msgInput.addEventListener('input', () => { msgInput.style.height='auto'; msgInput.style.height=Math.min(msgInput.scrollHeight,160)+'px'; });
msgInput.addEventListener('keydown', (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
sendBtn.addEventListener('click', sendMessage);

async function sendMessage(overrideText) {
  const text = (overrideText ?? msgInput.value).trim();
  if (!text || !activeConversation) return;
  if (!overrideText) { msgInput.value=''; msgInput.style.height='auto'; }
  sendBtn.disabled = true;

  await loadMessages();
  document.querySelector('.empty-state')?.remove();
  chatArea.appendChild(renderMsg({ role:'user', content:text, createdAt: Date.now() }));
  chatArea.scrollTop = chatArea.scrollHeight;

  const activeProvider = providers.find(p => p.enabled);
  const res = await fetch(`${API}/api/chat`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      conversationId: activeConversation.id, storyId: activeStory.id, message: text,
      providerId: activeProvider?.id,
      useFullStoryContext: fullContextCheckbox.checked,
      allowSelfEdit: selfEditCheckbox.checked,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    chatArea.appendChild(renderMsg({ role:'system', content: data.message || 'Erro ao falar com a IA.', createdAt: Date.now() }));
  } else {
    await loadMessages();
  }
  sendBtn.disabled = false;
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ---------- Providers (Configurações) ----------
async function loadProviders() {
  providers = await (await fetch(`${API}/api/providers`)).json();
  renderProviders();
  apiWarning.style.display = providers.some(p=>p.enabled) ? 'none' : 'block';
}
function renderProviders() {
  providerList.innerHTML = '';
  providers.forEach(p => {
    const div = document.createElement('div');
    div.className = 'provider-row';
    div.innerHTML = `
      <div class="top">
        <strong>${p.label} (${p.name})</strong>
        <span>${p.enabled ? '🟢' : '⚪'}</span>
      </div>
      <div style="font-size:11px;color:var(--muted)">Chave: ${p.apiKeyMasked || '—'} · Modelo: ${p.model || 'padrão'}</div>
      <input type="password" placeholder="Editar chave (olho mágico: deixe em branco pra manter)" class="editKey" />
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="toggleBtn">${p.enabled ? 'Desligar' : 'Ligar'}</button>
        <button class="saveKeyBtn">Salvar chave</button>
        <button class="delBtn">Excluir</button>
      </div>`;
    div.querySelector('.toggleBtn').addEventListener('click', async () => {
      await fetch(`${API}/api/providers/${p.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled: !p.enabled }) });
      loadProviders();
    });
    div.querySelector('.saveKeyBtn').addEventListener('click', async () => {
      const newKey = div.querySelector('.editKey').value;
      if (!newKey) return alert('Digite uma chave nova pra atualizar, ou use o olho mágico deixando em branco pra não mexer.');
      await fetch(`${API}/api/providers/${p.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ apiKey: newKey }) });
      loadProviders();
    });
    div.querySelector('.delBtn').addEventListener('click', async () => {
      if (!confirm(`Excluir provider ${p.label}?`)) return;
      await fetch(`${API}/api/providers/${p.id}`, { method:'DELETE' });
      loadProviders();
    });
    providerList.appendChild(div);
  });
}
addProviderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('newProviderName').value, label = $('newProviderLabel').value, model = $('newProviderModel').value, apiKey = $('newProviderKey').value;
  if (!apiKey) return alert('Cole a API key.');
  await fetch(`${API}/api/providers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, label: label||name, model, apiKey }) });
  addProviderForm.reset();
  loadProviders();
});

// ---------- Memória ----------
async function loadMemory() {
  const data = await (await fetch(`${API}/api/memory`)).json();
  memWarning.style.display = data.overloaded ? 'block' : 'none';
  memoryList.innerHTML = '';
  data.facts.forEach(f => {
    const div = document.createElement('div');
    div.className = 'mem-item';
    div.innerHTML = `<span>${escapeHtml(f.fact)}</span><span class="del" style="cursor:pointer">✕</span>`;
    div.querySelector('.del').addEventListener('click', async () => { await fetch(`${API}/api/memory/${f.id}`, {method:'DELETE'}); loadMemory(); });
    memoryList.appendChild(div);
  });
}
$('clearMemoryBtn').addEventListener('click', async () => {
  if (!confirm('Apagar TODA a memória?')) return;
  await fetch(`${API}/api/memory`, { method:'DELETE' });
  loadMemory();
});

// ---------- Voz: texto -> fala (feminina, 0x-3x, play/pause/stop) ----------
function pickFemaleVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => /female|mulher|feminin/i.test(v.name)) || voices.find(v => /pt-BR|pt_PT/i.test(v.lang)) || voices[0];
}
ttsBtn.addEventListener('click', () => {
  if (!lastAssistantText) return;
  if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); ttsBtn.textContent='▶️'; return; }
  if (speechSynthesis.paused) { speechSynthesis.resume(); ttsBtn.textContent='⏸️'; return; }
  speechUtterance = new SpeechSynthesisUtterance(lastAssistantText);
  speechUtterance.voice = pickFemaleVoice();
  speechUtterance.rate = 1;
  speechUtterance.onend = () => { ttsBtn.textContent='🔊'; };
  speechSynthesis.speak(speechUtterance);
  ttsBtn.textContent = '⏸️';
});
ttsBtn.addEventListener('dblclick', () => { speechSynthesis.cancel(); ttsBtn.textContent='🔊'; });

// ---------- Voz: fala -> texto (auto-envia após 3s de silêncio) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    msgInput.value = transcript;
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => { if (recognizing) { stopListening(); sendMessage(); } }, 3000);
  };
  recognition.onend = () => { recognizing = false; micBtn.textContent = '🎤'; };
}
function startListening() { if (!recognition) return alert('Reconhecimento de voz não suportado neste navegador.'); recognition.start(); recognizing = true; micBtn.textContent = '🔴'; }
function stopListening() { if (recognition) recognition.stop(); recognizing = false; micBtn.textContent = '🎤'; clearTimeout(silenceTimer); }
micBtn.addEventListener('click', () => recognizing ? stopListening() : startListening());

// ---------- Câmera ----------
camBtn.addEventListener('click', async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = mediaStream; video.autoplay = true;
    video.style.cssText = 'position:fixed;bottom:80px;right:16px;width:200px;border-radius:10px;z-index:30;box-shadow:0 3px 12px rgba(0,0,0,.4)';
    document.body.appendChild(video);
    video.addEventListener('click', () => { mediaStream.getTracks().forEach(t=>t.stop()); video.remove(); });
  } catch (e) { alert('Não consegui acessar a câmera: ' + e.message); }
});

// ---------- Upload sem limite ----------
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/api/upload`, { method:'POST', body: formData });
  const data = await res.json();
  if (res.ok) sendMessage(`[arquivo anexado: ${data.filename}](${data.url})`);
  fileInput.value = '';
});

// ---------- Botão flutuante arrastável (ler todas as conversas) ----------
function makeDraggable(el, id) {
  let dragging = false, offX=0, offY=0;
  el.addEventListener('pointerdown', (e) => { dragging=true; offX=e.clientX-el.getBoundingClientRect().left; offY=e.clientY-el.getBoundingClientRect().top; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; el.style.left=(e.clientX-offX)+'px'; el.style.top=(e.clientY-offY)+'px'; el.style.right='auto'; el.style.bottom='auto'; });
  el.addEventListener('pointerup', async (e) => {
    dragging=false;
    const rect = el.getBoundingClientRect();
    await fetch(`${API}/api/button-positions`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ [id]: { x: rect.left, y: rect.top } }) });
  });
}
makeDraggable(readAllFloatBtn, 'readAllFloatBtn');
readAllFloatBtn.addEventListener('click', async () => {
  if (!activeStory) return alert('Escolha uma história primeiro.');
  fullContextCheckbox.checked = true;
  await sendMessage('Releia toda esta história antes de responder e me diga que já releu.');
});

async function restoreButtonPositions() {
  const positions = await (await fetch(`${API}/api/button-positions`)).json();
  Object.entries(positions).forEach(([id, pos]) => {
    const el = document.getElementById(id);
    if (el) { el.style.left = pos.x+'px'; el.style.top = pos.y+'px'; el.style.right='auto'; el.style.bottom='auto'; }
  });
}

// ---------- Inicialização ----------
loadStories();
loadProviders();
loadMemory();
restoreButtonPositions();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
