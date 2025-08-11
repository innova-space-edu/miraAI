// =============== CONFIG ===============
const API_KEY = "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"; // ⚠️ Visible en el frontend
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Prompt del sistema
const SYSTEM_PROMPT = `
Tú eres MIRA (Modular Intelligent Responsive Assistant), creada por Innova Space.
Responde SIEMPRE en español, ordenada y clara, con buen uso de puntuación.
Primero explica con palabras simples; luego, si corresponde, muestra la fórmula en LaTeX usando $...$ o $$...$$.
No expliques el código LaTeX ni los signos de dólar. Usa listas y títulos cuando ayuden.
Si el texto del usuario está incompleto o mal escrito, interprétalo y ofrece 1–2 alternativas breves.
Si no estás segura, da una respuesta tentativa y pide una aclaración corta.
`;

// ============ AVATAR ANIMACIÓN ============
function setAvatarTalking(isTalking) {
  const avatar = document.getElementById("avatar-mira");
  if (!avatar) return;
  avatar.classList.toggle("pulse", !!isTalking);
  avatar.classList.toggle("still", !isTalking);
}

// ============ UTILIDADES UI ===============
function appendHTML(html) {
  const chatBox = document.getElementById("chat-box");
  chatBox.insertAdjacentHTML("beforeend", html);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(role, contentHTML) {
  const who = role === "user" ? "Tú" : "MIRA";
  appendHTML(`<div class="my-2"><strong>${who}:</strong> <span class="chat-markdown">${contentHTML}</span></div>`);
}

function showThinking() {
  const chatBox = document.getElementById("chat-box");
  if (document.getElementById("thinking")) return;
  const thinking = document.createElement("div");
  thinking.id = "thinking";
  thinking.className = "text-purple-300 italic my-1";
  thinking.innerHTML = `<span class="animate-pulse">MIRA está pensando<span class="animate-bounce">...</span></span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideThinking() {
  document.getElementById("thinking")?.remove();
}

// ============ TTS (voz) ===================
function plainTextForVoice(markdown) {
  let text = markdown
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
  text = text.replace(/\$\$[\s\S]*?\$\$/g, " ");
  text = text.replace(/\$[^$]*\$/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function speak(markdown) {
  try {
    const plain = plainTextForVoice(markdown);
    if (!plain) return;
    const msg = new SpeechSynthesisUtterance(plain);
    msg.lang = "es-ES";
    window.speechSynthesis.cancel();
    setAvatarTalking(true);
    msg.onend = () => setAvatarTalking(false);
    msg.onerror = () => setAvatarTalking(false);
    window.speechSynthesis.speak(msg);
  } catch {
    setAvatarTalking(false);
  }
}

/* ========= TTS sin botones (auto y desbloqueo por primer gesto) =========
   - Intenta hablar de inmediato (Edge/Chrome escritorio suele permitirlo).
   - Si está bloqueado (iOS/Android/Safari/Opera), guarda el texto y lo habla
     automáticamente en el PRIMER gesto del usuario (tap/click/scroll/tecla).
*/
const TTS = (() => {
  const state = {
    supported: ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window),
    ready: false,                 // true cuando logramos hablar o tras primer gesto
    voices: [],
    preferredLangs: ['es-CL','es-419','es-MX','es-AR','es-ES','es-US'],
    keepAliveTimer: null,
    pendingText: null,            // texto a leer apenas se pueda
  };

  function loadVoices() {
    if (!state.supported) return;
    const list = window.speechSynthesis.getVoices() || [];
    if (!list.length) return;
    state.voices = list;
  }

  function pickVoice() {
    return state.voices.find(v => state.preferredLangs.includes(v.lang))
        || state.voices.find(v => v.lang?.startsWith('es'))
        || state.voices.find(v => v.default)
        || state.voices[0]
        || null;
  }

  function resumeWorkaround() {
    try { window.speechSynthesis.resume(); } catch(e){}
    if (state.keepAliveTimer) clearInterval(state.keepAliveTimer);
    state.keepAliveTimer = setInterval(() => {
      try { window.speechSynthesis.resume(); } catch(e){}
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        clearInterval(state.keepAliveTimer);
        state.keepAliveTimer = null;
      }
    }, 500);
  }

  function reallySpeak(markdown, opts = {}) {
    const cleaned = plainTextForVoice(markdown);
    if (!cleaned) return;
    try { window.speechSynthesis.cancel(); } catch(e){}

    const u = new SpeechSynthesisUtterance(cleaned);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang   = (voice && voice.lang) || opts.lang || 'es-ES';
    u.rate   = (opts.rate  != null) ? opts.rate  : 1.0;
    u.pitch  = (opts.pitch != null) ? opts.pitch : 1.0;
    u.volume = (opts.volume!= null) ? opts.volume: 1.0;

    setAvatarTalking(true);
    u.onend = () => setAvatarTalking(false);
    u.onerror = () => setAvatarTalking(false);

    resumeWorkaround();
    window.speechSynthesis.speak(u);
  }

  function tryImmediateSpeak(markdown) {
    if (!state.supported) return false;
    try {
      reallySpeak(markdown);
      state.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  function addFirstGestureUnlock() {
    const unlock = () => {
      try { window.speechSynthesis.cancel(); } catch(e){}
      const u = new SpeechSynthesisUtterance('OK');
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'es-ES'; }
      window.speechSynthesis.speak(u);
      state.ready = true;

      if (state.pendingText) {
        const text = state.pendingText;
        state.pendingText = null;
        setTimeout(() => reallySpeak(text), 80);
      }
      removeListeners();
    };

    function removeListeners() {
      ['pointerdown','touchstart','click','keydown','wheel','scroll','focus'].forEach(ev => {
        window.removeEventListener(ev, unlock, true);
      });
      document.removeEventListener('visibilitychange', unlock, true);
    }

    ['pointerdown','touchstart','click','keydown','wheel','scroll','focus'].forEach(ev => {
      window.addEventListener(ev, unlock, { once: true, capture: true, passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') unlock();
    }, { once: true, capture: true, passive: true });
  }

  function init() {
    if (!state.supported) return;
    loadVoices();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    addFirstGestureUnlock();
  }

  function queueSpeak(markdown, opts = {}) {
    if (!state.supported) return;
    if (state.ready) {
      reallySpeak(markdown, opts);
      return;
    }
    const ok = tryImmediateSpeak(markdown);
    if (!ok) {
      state.pendingText = markdown; // hablará en el primer gesto
    }
  }

  return { init, queueSpeak };
})();

// ============ RENDER ======================
function renderMarkdown(text) {
  return typeof marked !== "undefined" ? marked.parse(text) : text;
}

// ============ WIKIPEDIA FALLBACK ==========
async function wikiFallback(query) {
  try {
    const res = await fetch(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.extract || null;
  } catch {
    return null;
  }
}

// ============ ENVÍO MENSAJE ===============
async function sendMessage() {
  const input = document.getElementById("user-input");
  const userMessage = (input.value || "").trim();
  if (!userMessage) return;

  appendMessage("user", renderMarkdown(userMessage));
  input.value = "";
  showThinking();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const raw = await response.text();
    console.log("Groq raw response:", raw);

    hideThinking();

    if (!response.ok) {
      console.error("Groq error:", response.status, raw);
      let msg = "Error al conectar con la IA.";
      if (response.status === 401) msg += " (401: clave inválida o expirada)";
      else if (response.status === 403) msg += " (403: CORS o acceso denegado)";
      else if (response.status === 429) msg += " (429: límite de uso alcanzado)";
      else msg += ` (HTTP ${response.status})`;
      appendMessage("assistant", msg);
      setAvatarTalking(false);
      return;
    }

    const data = JSON.parse(raw);
    let aiReply = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!aiReply) {
      aiReply = (await wikiFallback(userMessage)) || "Lo siento, no encontré una respuesta adecuada.";
    }

    const html = renderMarkdown(aiReply);
    appendMessage("assistant", html);

    // ======= HABLA SIN BOTONES: intento inmediato + desbloqueo por primer gesto =======
    TTS.queueSpeak(aiReply);
    // speak(aiReply); // (fallback legacy, mantengo línea original comentada)

    if (window.MathJax?.typesetPromise) MathJax.typesetPromise();

  } catch (err) {
    hideThinking();
    appendMessage("assistant", "Error de red o CORS al conectar con la IA.");
    setAvatarTalking(false);
    console.error("Network/JS error:", err);
  }
}

// ============ INICIO ======================
function initChat() {
  // Iniciar TTS sin botones
  TTS.init();

  const input = document.getElementById("user-input");
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("send-btn")?.addEventListener("click", sendMessage);

  setTimeout(() => {
    const chatBox = document.getElementById("chat-box");
    const hasGreeting = chatBox && chatBox.textContent.trim().length > 0;
    if (!hasGreeting) {
      const saludo = "¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?";
      appendMessage("assistant", renderMarkdown(saludo));

      // Intento hablar de inmediato; si el navegador lo bloquea, se hablará en el primer gesto
      TTS.queueSpeak(saludo);
      // speak(saludo); // (fallback legacy, mantengo línea original comentada)

      if (window.MathJax?.typesetPromise) MathJax.typesetPromise();
    }
  }, 900);

  setAvatarTalking(false);
}

window.addEventListener("DOMContentLoaded", initChat);
