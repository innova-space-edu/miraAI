const API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Prompt positivo y didáctico
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial creada por Innova Space. creada para apoyar a estudiantes y profesores en todas las materias escolares. Responde siempre en español, con explicaciones claras, ordenadas y fáciles de entender, adaptando el nivel de detalle según el usuario.

Cuando te pidan una **fórmula, ecuación, función matemática o científica**, sigue estos pasos:

1. **Explica primero con palabras sencillas** el concepto o significado antes de mostrar la fórmula.
2. **Luego muestra la fórmula en LaTeX** (usando signos de dólar: \$...\$ para fórmulas en línea o \$\$...\$\$ para fórmulas centradas).
3. **Después de la fórmula, explica cada variable o símbolo en texto plano (NO uses LaTeX ni signos de dólar, solo texto normal o Markdown)**. Escribe, por ejemplo: - **vm** es la velocidad media, - **Δx** es el cambio en la posición, - **Δt** es el intervalo de tiempo.
4. **Ofrece un ejemplo práctico o aplicación si corresponde**.

**Ejemplo de estructura ideal:**

---
La velocidad media es la variación de la posición dividida por la variación del tiempo.

La fórmula es:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$

Donde:
- **vm** es la velocidad media
- **Δx** es el cambio en la posición
- **Δt** es el intervalo de tiempo

¿Quieres un ejemplo de cómo aplicar esta fórmula?
---

**Regla importante**:  
Cuando expliques las variables o símbolos de la fórmula, **nunca uses LaTeX ni signos de dólar ($)**. Solo texto plano, negrita o cursiva si lo deseas.

**Otras instrucciones importantes:**
- Si hay un error ortográfico o la pregunta no está clara, intenta interpretarla y responde de la mejor manera posible.
- Si la pregunta es ambigua, pide aclaración de forma breve y amable.
- Usa títulos, listas, negrita (Markdown), y estructura visualmente agradable.
- Si la respuesta es extensa, puedes ofrecer un resumen al final.
- Si te preguntan varias veces sobre el mismo tema, mantén el contexto y responde como una conversación.
- Si no sabes la respuesta, busca alternativas, ejemplos, o intenta explicarlo con lo que sabes, pero nunca respondas con negaciones.
- Si alguna variable contiene letras griegas (como Δx o θ), escribe el símbolo directamente, pero SIN LaTeX.

Responde siempre con amabilidad y usando buen ritmo, pausas, y frases bien puntuadas para facilitar la lectura en voz alta.
`;

// Quita $...$ solo cuando es variable o símbolo al inicio de la línea (en las listas tipo Donde:)
function cleanVariablesLatex(text) {
  return text.replace(/^(\s*)\$\\?([a-zA-Z_0-9]+|Delta|theta|phi|pi|lambda|mu|sigma|alpha|beta|gamma)\$ ?/gm, (_, s, v) => {
    v = v.replace("Delta", "Δ")
         .replace("theta", "θ")
         .replace("phi", "φ")
         .replace("pi", "π")
         .replace("lambda", "λ")
         .replace("mu", "μ")
         .replace("sigma", "σ")
         .replace("alpha", "α")
         .replace("beta", "β")
         .replace("gamma", "γ");
    return s + `**${v}**`;
  });
}

// Halo animado solo cuando habla
function setAvatarTalking(isTalking) {
  const avatar = document.getElementById("avatar-mira");
  if (!avatar) return;
  if (isTalking) {
    avatar.classList.add("pulse");
  } else {
    avatar.classList.remove("pulse");
  }
}

// Enter para enviar
document.getElementById("user-input").addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

// Indicador de carga
function showThinking() {
  const chatBox = document.getElementById("chat-box");
  const thinking = document.createElement("div");
  thinking.id = "thinking";
  thinking.className = "text-purple-300 italic";
  thinking.innerHTML = `<span class="animate-pulse">MIRA está pensando<span class="animate-bounce">...</span></span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Solo lee líneas normales, no fórmulas ni LaTeX, y agrega pausas naturales
function plainTextForVoice(markdown) {
  // Convierte el Markdown a solo el texto plano explicativo, sin fórmulas, sin LaTeX, y manteniendo el ritmo de la puntuación
  let text = markdown
    .split('\n')
    .filter(line =>
      !line.trim().startsWith('$$') && !line.trim().endsWith('$$') && // No fórmulas centradas
      !line.includes('$') && // No fórmulas inline
      !/^ {0,3}/.test(line) // No bloques de código
    )
    .join('. ')
    // Mantiene las pausas naturales: cada punto, coma y salto de línea es una pausa
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Quita negritas
    .replace(/\*([^*]+)\*/g, '$1')      // Quita cursivas
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/([.,;:!?\)])([^\s.])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  // Pausas extra en puntos suspensivos o doble punto
  text = text.replace(/\.{2,}/g, '.');
  text = text.replace(/\. \./g, '. ');

  // Pausas más largas después de puntos y saltos de línea
  text = text.replace(/([.!?])\s+/g, '$1 [PAUSA] ');

  // Opcional: puedes agregar más pausas para mejorar la voz
  return text.replace(/\[PAUSA\]/g, '... ');
}

// Voz y halo solo en texto limpio
function speak(text) {
  try {
    const plain = plainTextForVoice(text);
    if (!plain) return;
    const msg = new SpeechSynthesisUtterance(plain);
    msg.lang = "es-ES";
    msg.rate = 0.97; // velocidad un poco más pausada
    msg.pitch = 1.02;
    msg.volume = 1;
    window.speechSynthesis.cancel();
    setAvatarTalking(true);
    msg.onend = () => setAvatarTalking(false);
    msg.onerror = () => setAvatarTalking(false);
    window.speechSynthesis.speak(msg);
  } catch {
    setAvatarTalking(false);
  }
}

// Render Markdown y MathJax
function renderMarkdown(text) {
  return marked.parse(text);
}

// Para evitar problemas de inyección
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function (m) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m];
  });
}

// Memoria de conversación (hilo)
const chatHistory = [
  { role: "system", content: SYSTEM_PROMPT }
];

// ---- DESBLOQUEO DE VOZ POR PRIMERA ACCIÓN ----
let saludoDado = false;
function hablarSaludoSiFalta() {
  if (!saludoDado) {
    speak("¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
    saludoDado = true;
  }
  // Oculta info de voz (si existe)
  document.getElementById('voz-info')?.remove();
}
window.addEventListener("click", hablarSaludoSiFalta, { once: true });
window.addEventListener("keydown", hablarSaludoSiFalta, { once: true });

// ---- FIN DESBLOQUEO ----

// async/await para enviar mensaje
async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  const userMessage = input.value.trim();
  if (!userMessage) return;

  chatBox.innerHTML += `<div><strong>Tú:</strong> ${escapeHtml(userMessage)}</div>`;
  input.value = "";
  showThinking();

  // Agrega mensaje de usuario al historial
  chatHistory.push({ role: "user", content: userMessage });

  // Mantén solo los últimos 8 mensajes (puedes ajustar)
  if (chatHistory.length > 9) {
    chatHistory.splice(1, chatHistory.length - 8); // deja system y los últimos 8
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatHistory,
        temperature: 0.7
      })
    });

    const data = await response.json();
    let aiReply = data.choices?.[0]?.message?.content || "";

    // Si la respuesta es vacía o genérica, busca en Wikipedia
    if (
      !aiReply ||
      aiReply.toLowerCase().includes("no se pudo") ||
      aiReply.toLowerCase().includes("no encontré una respuesta")
    ) {
      if (
        /kien eres|quien eres|kien es mira|quien es mira|k eres|q eres|qué eres|ke eres|q puedes aser|qué puedes hacer|q asés|qué haces|qué asés|ke funcion tienes|qué funcion tienes|de donde vienes|de donde bvienes|presentate|preséntate|que puedes hacer|quien eres tu|quien sos|quien sos vos|quien soy|quien estoy|quien/.test(userMessage.toLowerCase())
      ) {
        aiReply = "Soy MIRA, una asistente virtual creada por Innova Space. Estoy diseñada para ayudarte a aprender y resolver tus dudas de manera clara, amigable y personalizada, en todas las materias escolares. Puedes preguntarme sobre matemáticas, ciencias, historia, tecnología y mucho más.";
      } else {
        // Busca en Wikipedia
        const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
        const wikiData = await wiki.json();
        aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
      }
    }

    // ========== LIMPIA VARIABLES $...$ ANTES DE MOSTRAR ==========
    aiReply = cleanVariablesLatex(aiReply);

    // Agrega respuesta al historial para mantener el hilo
    chatHistory.push({ role: "assistant", content: aiReply });

    document.getElementById("thinking")?.remove();
    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += 
      `<div>
        <strong>MIRA:</strong>
        <span class="chat-markdown">${html}</span>
      </div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    speak(aiReply);

    if (window.MathJax) MathJax.typesetPromise();

  } catch (error) {
    document.getElementById("thinking")?.remove();
    chatBox.innerHTML += `<div><strong>MIRA:</strong> Error al conectar con la IA.</div>`;
    setAvatarTalking(false);
    console.error(error);
  }
}

// Halo arranca quieto
setAvatarTalking(false);

// **¡Agrega este listener después de definir sendMessage!**
document.getElementById("send-btn").addEventListener("click", sendMessage);

// ------- (OPCIONAL) MENSAJE DE VOZ AL PIE DEL CHAT -------
if (!document.getElementById('voz-info')) {
  const chatBox = document.getElementById('chat-box');
  if (chatBox) {
    const vozDiv = document.createElement('div');
    vozDiv.id = 'voz-info';
    vozDiv.className = 'text-xs text-gray-300 mt-2 text-center';
    vozDiv.innerHTML = '<span>La voz se activará cuando hagas clic o escribas tu primera pregunta.</span>';
    chatBox.parentNode.appendChild(vozDiv);
  }
}
