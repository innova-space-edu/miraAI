// Halo animado
function setAvatarTalking(isTalking) {
  const avatar = document.getElementById("avatar-mira");
  if (!avatar) return;
  avatar.classList.toggle("pulse", isTalking);
  avatar.classList.toggle("still", !isTalking);
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

// Quitar negritas/cursivas y bloques LaTeX: voz limpia
function plainTextForVoice(markdown) {
  // Quitar todas las negritas/cursivas Markdown
  let text = markdown.replace(/\*\*([^*]+)\*\*/g, '$1'); // **negrita**
  text = text.replace(/\*([^*]+)\*/g, '$1');             // *cursiva*
  text = text.replace(/__([^_]+)__/g, '$1');             // __negrita__
  text = text.replace(/_([^_]+)_/g, '$1');               // _cursiva_
  // Elimina todos los bloques $$...$$ (fórmulas centradas)
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  // Elimina todos los bloques $...$ (en línea)
  text = text.replace(/\$[^$]*\$/g, ' ');
  // Limpia exceso de espacios
  text = text.replace(/\s+/g, ' ').trim();
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

// PROMPT mejorado: explicación previa, luego fórmula bonita
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial (Modular Intelligent Responsive Assistant). Creada por Innova Space Edu (Chile) con tecnología OpenAI y Groq.
Cada vez que el usuario solicite una fórmula, ecuación, ley, función, propiedad matemática, física o química:
- Explica primero en palabras simples.
- Luego escribe SIEMPRE la fórmula usando código LaTeX real (con \\ en todos los comandos como \\frac, \\Delta, \\sum, \\mu, \\sqrt, \\mathrm, etc.).
- La fórmula debe ir centrada entre dobles signos de dólar ($$ ... $$), para que la web la muestre como una ecuación profesional.
- No uses negrita ni encabezados para fórmulas, ni escribas ecuaciones con solo texto plano.
- Para que te guies te dejo dos ejemplos:
Ejemplo 1:
Pregunta: ¿Cuál es la fórmula de velocidad media?
Respuesta:
La velocidad media corresponde al desplazamiento dividido por el intervalo de tiempo:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$
Donde:
- **v_m**: velocidad media.
- **Δx**: desplazamiento total.
- **Δt**: intervalo de tiempo.

Ejemplo 2:
Pregunta: ¿Cómo se calcula el área de un círculo?
Respuesta:
El área de un círculo se calcula con:
$$
A = \\pi r^2
$$
Donde:
- **A**: área del círculo.
- **r**: radio del círculo.

Luego continúa la explicación según sea necesario. Usa Markdown solo para listas, tablas y resúmenes.
Siempre sigue esta estructura para cualquier fórmula matemática, física, química o estadística.
`;


// Autosaludo inicial
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    speak("¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);
});

// Nueva función para agregar mensajes de la IA, renderizando Markdown y MathJax
function addAssistantMessage(markdownText) {
  const chatBox = document.getElementById('chat-box');
  const html = `<div><strong>MIRA:</strong> <span class="chat-markdown">${renderMarkdown(markdownText)}</span></div>`;
  chatBox.insertAdjacentHTML('beforeend', html);
  chatBox.scrollTop = chatBox.scrollHeight;
  // Procesa LaTeX con MathJax
  if (window.MathJax) setTimeout(() => MathJax.typesetPromise(), 60);
  // Voz y animación
  speak(markdownText);
}

async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");

  const userMessage = input.value.trim();
  if (!userMessage) return;

  chatBox.innerHTML += `<div><strong>Tú:</strong> ${userMessage}</div>`;
  input.value = "";
  showThinking();

  try {
    // Ahora consulta tu backend seguro en Render
    const response = await fetch("https://miraai-1.onrender.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userMessage })
    });

    const data = await response.json();
    document.getElementById("thinking")?.remove();
    let aiReply = data.choices?.[0]?.message?.content || "";

    if (!aiReply || aiReply.toLowerCase().includes("no se pudo")) {
      // Consulta Wikipedia solo si es necesario
      const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
      const wikiData = await wiki.json();
      aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
    }

    addAssistantMessage(aiReply);

  } catch (error) {
    document.getElementById("thinking")?.remove();
    chatBox.innerHTML += `<div><strong>MIRA:</strong> Error al conectar con la IA.</div>`;
    setAvatarTalking(false);
    console.error(error);
  }
}

// Halo arranca quieto
setAvatarTalking(false);
