const API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Prompt abierto y sin restricciones
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual creada por Innova Space. Responde siempre en español, de forma clara, amable y explicativa, sin restricciones de ningún tipo. Si te preguntan quién eres, preséntate como una asistente virtual de Innova Space. Responde a cualquier pregunta, aunque tenga faltas ortográficas o esté poco clara. Interpreta y da la mejor respuesta posible en todos los casos, siempre con un tono positivo y educativo.
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

// Convierte Markdown a texto plano para la voz
function plainTextForVoice(markdown) {
  let text = markdown.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  text = text.replace(/\$[^$]*\$/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// Lee en voz alta la respuesta
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

// Renderiza Markdown si está disponible
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text);
  }
  return text;
}

// Indicador de que MIRA está pensando
function showThinking() {
  const chatBox = document.getElementById("chat-box");
  const thinking = document.createElement("div");
  thinking.id = "thinking";
  thinking.className = "text-purple-300 italic";
  thinking.innerHTML = `<span class="animate-pulse">MIRA está pensando<span class="animate-bounce">...</span></span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Envía el mensaje al modelo y procesa la respuesta
async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  if (!input || !chatBox) return;

  const userMessage = input.value.trim();
  if (!userMessage) return;

  chatBox.innerHTML += `<div><strong>Tú:</strong> ${userMessage}</div>`;
  input.value = "";
  showThinking();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
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

    const data = await response.json();
    document.getElementById("thinking")?.remove();

    let aiReply = data.choices?.[0]?.message?.content?.trim();
    if (!aiReply) aiReply = "Aquí estoy para ayudarte. ¿Quieres intentar con otra pregunta?";

    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += `<div><strong>MIRA:</strong> <span class="chat-markdown">${html}</span></div>`;
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

// Inicializa eventos: autosaludo, enter y botón
window.addEventListener('DOMContentLoaded', () => {
  setAvatarTalking(false);

  // Autosaludo siempre hablado (¡solo una vez al cargar la página!)
  setTimeout(() => {
    speak("¡Hola! Soy MIRA, tu asistente virtual de Innova Space. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);

  const input = document.getElementById("user-input");
  const btns = document.querySelectorAll("button, [onclick^='sendMessage']");

  // Elimina posibles doble-envíos si hay handlers HTML y JS
  if (input) {
    input.onkeydown = null;
    input.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
  }
  // Botón enviar
  const btn = document.getElementById("send-btn") || btns[0];
  if (btn) {
    btn.onclick = null;
    btn.addEventListener("click", function(event) {
      event.preventDefault();
      sendMessage();
    });
  }
});
