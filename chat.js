const API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Prompt positivo y didáctico
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual educativa creada por Innova Space y OpenAI.

Responde siempre de forma clara, natural y ordenada, como ChatGPT. Utiliza títulos, listas, tablas y explicaciones sencillas.

Cuando te pidan una fórmula, ecuación o función:
- Explica primero con una frase sencilla y clara lo que representa esa fórmula.
- Después, muestra la fórmula escrita en LaTeX para que se vea ordenada y bonita.

Al explicar el significado de cada variable, escribe el nombre y su significado en texto simple, así el usuario lo puede leer y escuchar fácilmente (ejemplo: v_m es la velocidad media).

Haz las explicaciones lo más comprensibles y didácticas posible, como para estudiantes de secundaria.
Corrige errores ortográficos automáticamente. Si la pregunta es ambigua, interpreta o pide aclaración.
Mantén el hilo de la conversación y responde a preguntas de seguimiento (“otro ejemplo”, “explícalo de nuevo”, etc.) teniendo en cuenta el contexto anterior.

Responde siempre en español, a menos que el usuario indique otro idioma.
`;

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
  let text = markdown
    .split('\n')
    .filter(line =>
      !line.trim().startsWith('$$') && !line.trim().endsWith('$$') && // No fórmulas centradas
      !line.includes('$') && // No fórmulas inline
      !/^ {0,3}`/.test(line) // No bloques de código
    )
    .join('. ') // Une cada línea con punto y espacio para mejorar pausas
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Quita negritas
    .replace(/\*([^*]+)\*/g, '$1')      // Quita cursivas
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/([.,;:!?\)])([^\s.])/g, '$1 $2') // Asegura espacio después de puntuación
    .replace(/\s+/g, ' ')
    .trim();

  // Elimina puntos dobles (por unir dos líneas con punto)
  text = text.replace(/\.{2,}/g, '.');
  // Elimina punto final extra si está repetido
  text = text.replace(/\. \./g, '. ');

  return text;
}

// Voz y halo solo en texto limpio
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

// Saludo hablado inicial (al cargar la página)
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    speak("¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);
});

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
      // Preguntas típicas de presentación, incluso con faltas
      if (
        /kien eres|quien eres|kien es mira|quien es mira|k eres|q eres|qué eres|ke eres|q puedes aser|qué puedes hacer|q asés|qué haces|qué asés|ke funcion tienes|qué funcion tienes|de donde vienes|de donde bvienes|presentate|preséntate|que puedes hacer|quien eres tu|quien sos|quien sos vos|quien soy|quien estoy|quien/.test(userMessage.toLowerCase())
      ) {
        aiReply = "Soy MIRA, una asistente virtual creada por Innova Space y OpenAI. Estoy diseñada para ayudarte a aprender y resolver tus dudas de manera clara, amigable y personalizada, en todas las materias escolares. Puedes preguntarme sobre matemáticas, ciencias, historia, tecnología y mucho más.";
      } else {
        // Busca en Wikipedia
        const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
        const wikiData = await wiki.json();
        aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
      }
    }

    // Agrega respuesta al historial para mantener el hilo
    chatHistory.push({ role: "assistant", content: aiReply });

    document.getElementById("thinking")?.remove();
    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += `
      <div>
        <strong>MIRA:</strong>
        <span class="chat-markdown">${html}</span>
      </div>
    `;
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
