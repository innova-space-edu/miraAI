// ===============================
// Chat MIRA - Frontend completo
// (con fallback Wikipedia inteligente + contexto corto de seguimiento)
// ===============================

// ----- Halo animado -----
function setAvatarTalking(isTalking) {
  const avatar = document.getElementById("avatar-mira");
  if (!avatar) return;
  avatar.classList.toggle("pulse", isTalking);
  avatar.classList.toggle("still", !isTalking);
}

// ----- Enter para enviar -----
document.getElementById("user-input").addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// ----- Indicador de carga -----
function showThinking() {
  const chatBox = document.getElementById("chat-box");
  const thinking = document.createElement("div");
  thinking.id = "thinking";
  thinking.className = "text-purple-300 italic";
  thinking.innerHTML = `<span class="animate-pulse">MIRA está pensando<span class="animate-bounce">...</span></span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ----- Quitar negritas/cursivas y bloques LaTeX: voz limpia -----
function plainTextForVoice(markdown) {
  let text = markdown.replace(/\*\*([^*]+)\*\*/g, '$1'); // **negrita**
  text = text.replace(/\*([^*]+)\*/g, '$1');             // *cursiva*
  text = text.replace(/__([^_]+)__/g, '$1');             // __negrita__
  text = text.replace(/_([^_]+)_/g, '$1');               // _cursiva_
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');         // $$...$$
  text = text.replace(/\$[^$]*\$/g, ' ');                // $...$
  text = text.replace(/```[\s\S]*?```/g, ' ');           // bloques de código
  text = text.replace(/`[^`]*`/g, ' ');                  // código inline
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// ----- Voz y halo solo en texto limpio -----
function speak(text) {
  try {
    const plain = plainTextForVoice(text);
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

// ----- Render Markdown y MathJax -----
function renderMarkdown(text) {
  return marked.parse(text);
}

// ----- Limpia $...$ en listas de variables y reemplaza letras griegas -----
function cleanVariablesLatex(text) {
  return text.replace(
    /^(\s*[-*]\s+)\$\\?([a-zA-Z_0-9]+|Delta|theta|phi|pi|lambda|mu|sigma|alpha|beta|gamma)\$ ?/gm,
    (_, prefix, variable) => {
      variable = variable
        .replace("Delta", "Δ")
        .replace("theta", "θ")
        .replace("phi", "φ")
        .replace("pi", "π")
        .replace("lambda", "λ")
        .replace("mu", "μ")
        .replace("sigma", "σ")
        .replace("alpha", "α")
        .replace("beta", "β")
        .replace("gamma", "γ");
      return prefix + `**${variable}** `;
    }
  );
}

// ----- PROMPT como variable JS (no se envía al backend) -----
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial (Modular Intelligent Responsive Assistant). Creada por Innova Space Edu (Chile) con tecnología Open AI y Groq.

Cuando te pidan una fórmula, ecuación, función matemática o científica, sigue estos pasos:

1. Explica primero con palabras sencillas el concepto o significado antes de mostrar la fórmula.
2. Luego muestra la fórmula en LaTeX (usando signos de dólar: $... para fórmulas en línea o $$...$$ para fórmulas centradas).
3. Después de la fórmula, explica cada variable o símbolo en texto plano (sin LaTeX ni signos de dólar, solo texto normal o Markdown). Escribe, por ejemplo:
   - **v_m** es la velocidad media
   - **Δx** es el cambio en la posición
   - **Δt** es el intervalo de tiempo
4. Ofrece un ejemplo práctico o aplicación si corresponde.

Ejemplo de estructura ideal:

La velocidad media es la variación de la posición dividida por la variación del tiempo.

La fórmula es:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$

Donde:
- **v_m** es la velocidad media
- **Δx** es el cambio en la posición
- **Δt** es el intervalo de tiempo

¿Quieres un ejemplo de cómo aplicar esta fórmula?

Regla importante:
Cuando expliques las variables o símbolos de la fórmula, nunca uses LaTeX ni signos de dólar ($). Solo texto plano, negrita o cursiva si lo deseas.

Otras instrucciones importantes:
- Si hay un error ortográfico o la pregunta no está clara, intenta interpretarla y responde de la mejor manera posible.
- Si la pregunta es ambigua, pide aclaración de forma breve y amable.
- Usa títulos, listas, negrita (Markdown), y estructura visualmente agradable.
- Si la respuesta es extensa, puedes ofrecer un resumen al final.
- Si te preguntan varias veces sobre el mismo tema, mantén el contexto y responde como una conversación.
- Si alguna variable contiene letras griegas (como Δx o θ), escribe el símbolo directamente, pero sin LaTeX.

Responde siempre con amabilidad y usando buen ritmo, pausas, y frases bien puntuadas para facilitar la lectura en voz alta.
`;

// ===============================
// Mejoras nuevas
// ===============================

// Contexto corto para seguimientos tipo “más largo”, “otro ejemplo”, etc.
let lastTopic = null;

function isFollowup(message) {
  const t = message.toLowerCase().trim();
  return (
    t === "otro" || t.includes("otro ejemplo") || t.includes("más largo") ||
    t.includes("un poco más") || t.includes("continúa") || t.includes("sigue") ||
    t.startsWith("y ") || t === "y" || t.includes("amplía") || t.includes("ampliar")
  );
}

function isIdentityQuestion(q) {
  const t = q.toLowerCase().trim();
  return (
    t.includes("quien eres") || t.includes("quién eres") ||
    t.includes("dime quien eres") || t.includes("dime quién eres") ||
    t.includes("qué eres") || t.includes("quien es mira") || t.includes("quién es mira")
  );
}

// Wikipedia: primero buscar título, luego summary; fallback ES→EN
async function fetchWikipediaSummarySmart(query, lang = "es", abortSignal = undefined) {
  const searchUrl = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=1`;
  const s = await fetch(searchUrl, { signal: abortSignal });
  if (!s.ok) {
    if (lang === "es") return fetchWikipediaSummarySmart(query, "en", abortSignal);
    return null;
  }
  const data = await s.json();
  const pages = data?.pages || [];
  if (!pages.length) {
    if (lang === "es") return fetchWikipediaSummarySmart(query, "en", abortSignal);
    return null;
  }
  const title = pages[0].title;

  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const r = await fetch(summaryUrl, { signal: abortSignal });
  if (!r.ok) {
    if (lang === "es") {
      const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: abortSignal });
      if (!r2.ok) return null;
      return await r2.json();
    }
    return null;
  }
  return await r.json();
}

async function fallbackAnswer(query, abortSignal = undefined) {
  if (isIdentityQuestion(query)) {
    return "Soy MIRA, tu asistente virtual creada junto a Esthefano. Puedo ayudarte a buscar información, explicar contenidos, abrir apps, controlar tu PC y más. ¿Qué necesitas ahora?";
  }
  // Evitar llamar Wikipedia si el prompt es demasiado corto/ambiguo
  const trimmed = (query || "").trim();
  if (trimmed.length < 3 || ["ok", "ya", "vale", "y", "mmm"].includes(trimmed.toLowerCase())) {
    return "¿Puedes darme un poco más de contexto para ayudarte mejor?";
  }

  try {
    const summary = await fetchWikipediaSummarySmart(trimmed, "es", abortSignal);
    if (summary && (summary.extract || summary.description)) {
      const title = summary.title || "Wikipedia";
      const extract = summary.extract || summary.description || "";
      return `Según Wikipedia sobre **${title}**:\n\n${extract}`;
    }
  } catch (e) {
    console.warn("Wikipedia fallback error:", e);
  }

  return "No encontré una respuesta directa. ¿Quieres que lo busque en Google o que lo explique con más contexto?";
}

// Utilidad: scroll suave al final
function scrollChatToBottom() {
  const chatBox = document.getElementById("chat-box");
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
}

// ===============================
// Autosaludo inicial
// ===============================
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    speak("¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);
});

// ===============================
// Envío de mensaje
// ===============================
async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");

  let userMessage = input.value.trim();
  if (!userMessage) return;

  // Render usuario
  chatBox.innerHTML += `<div><strong>Tú:</strong> ${userMessage}</div>`;
  input.value = "";
  showThinking();
  scrollChatToBottom();

  // Si el usuario hace seguimiento corto, combinar con el último tema
  let effectiveMessage = userMessage;
  if (isFollowup(userMessage) && lastTopic) {
    effectiveMessage = `${lastTopic}. Ampliar: ${userMessage}`;
  } else if (userMessage.length > 12) {
    // si el mensaje actual es suficientemente informativo, lo marcamos como nuevo tema
    lastTopic = userMessage;
  }

  // Timeout para fetch (evitar que quede colgado)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s
  let aiReply = "";

  try {
    // Llamada a tu backend seguro
    const response = await fetch("https://miraai-1.onrender.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: effectiveMessage,
        // NO enviamos SYSTEM_PROMPT aquí para no exponerlo.
        // Si quieres usarlo, configúralo en el servidor.
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    document.getElementById("thinking")?.remove();

    // Validar respuesta del backend
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Si el backend devolvió texto plano o HTML
      data = {};
    }

    aiReply = data?.choices?.[0]?.message?.content || data?.content || "";

    // Fallback si no hay respuesta útil
    if (!aiReply || aiReply.toLowerCase().includes("no se pudo")) {
      // Wikipedia inteligente (search -> summary)
      aiReply = await fallbackAnswer(userMessage, controller.signal);
    }

    // Limpieza de variables LaTeX en listas tipo "Donde:"
    const cleanedReply = cleanVariablesLatex(aiReply);
    const html = renderMarkdown(cleanedReply);

    chatBox.innerHTML += `<div><strong>MIRA:</strong> <span class="chat-markdown">${html}</span></div>`;
    scrollChatToBottom();

    // Voz + halo animado solo para el texto limpio original
    speak(aiReply);

    // Re-renderizar MathJax para fórmulas
    if (window.MathJax && window.MathJax.typesetPromise) {
      try { await MathJax.typesetPromise(); } catch {}
    }

  } catch (error) {
    clearTimeout(timeout);
    document.getElementById("thinking")?.remove();

    let readable = "Error al conectar con la IA.";
    if (error?.name === "AbortError") {
      readable = "Se agotó el tiempo de espera. Intenta de nuevo.";
    }
    chatBox.innerHTML += `<div><strong>MIRA:</strong> ${readable}</div>`;
    setAvatarTalking(false);
    console.error(error);
    scrollChatToBottom();
  }
}

// Halo arranca quieto
setAvatarTalking(false);
