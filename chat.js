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
- Si alguna variable contiene letras griegas (como Δx o θ), escribe el símbolo directamente, pero SIN LaTeX.

Responde siempre con amabilidad y usando buen ritmo, pausas, y frases bien puntuadas para facilitar la lectura en voz alta.
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
