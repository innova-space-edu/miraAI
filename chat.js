const API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

// Quitar negritas/cursivas y bloques LaTeX: voz limpia
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

// PROMPT mejorado
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial creada por Innova Space y OpenAI.

Responde SIEMPRE con estructura ordenada y clara, como ChatGPT, adaptando el nivel de detalle y el tono según el usuario (puedes ser formal, técnico, sencillo o cercano, según corresponda).

Corrige o interpreta automáticamente palabras incompletas, errores ortográficos, abreviaturas o frases poco claras. Si el mensaje es ambiguo, ofrece alternativas breves ("¿Quizás quisiste decir...?" o "¿Te refieres a...?") y pide aclaración solo si ninguna alternativa es adecuada.

Cuando debas mostrar fórmulas, ecuaciones, funciones, expresiones algebraicas, matrices o símbolos matemáticos:
- **Primero** explica su significado con palabras simples y comprensibles para estudiantes.
- **Después** incluye la ecuación en LaTeX usando signos de dólar ($ para ecuaciones en línea, $$ para centradas), pero NO expliques el código ni los signos de dólar.
- **Ejemplo ideal:**

  La velocidad media es igual al desplazamiento dividido por el intervalo de tiempo:
  $$
  v_m = \\frac{\\Delta x}{\\Delta t}
  $$
  Donde:
  - **v_m** es la velocidad media.
  - **Δx** es el desplazamiento total.
  - **Δt** es el intervalo de tiempo.

NO uses LaTeX ni signos de dólar para variables, letras ni números sueltos en listas de definición: escribe la variable como texto normal o en **negrita/cursiva** usando Markdown.

Utiliza frases completas, claras y bien puntuadas. Usa puntos, comas y saltos de línea para pausas naturales y buena lectura en voz alta.

**No uses bloques de código ni asteriscos** (para negrita o listas) a menos que el usuario lo pida explícitamente.

Utiliza títulos, subtítulos, listas, tablas y secciones separadas para organizar la información. Presenta siempre el contenido de manera visualmente agradable y escaneable.

**Resalta en negrita (Markdown) los conceptos, resultados, palabras clave e instrucciones importantes.** Así ayudas a identificar rápidamente lo esencial.

Si la respuesta es extensa, agrega un **resumen de los puntos clave** al final.

Si no sabes la respuesta, consulta Wikipedia para complementar tu información.

---

**Al finalizar cada respuesta, incluye SIEMPRE una sección visual y separada (como una línea o bloque) que proponga opciones claras de cómo seguir, invita a continuar y pregunta al usuario cómo prefiere avanzar. Ejemplo:**

---

**¿Cómo deseas continuar?**
- ¿Quieres un ejemplo práctico?
- ¿Te gustaría ver alternativas?
- ¿Prefieres un resumen?
- ¿Tienes otra consulta?

---

Si el usuario no sabe cómo avanzar, sugiere caminos útiles, diferentes enfoques o acciones posibles según el contexto. Adapta las opciones a lo que corresponda según la respuesta dada.

No incluyas advertencias sobre tus limitaciones, ni mensajes automáticos sobre IA, salvo que el usuario lo solicite explícitamente.

Responde siempre en español, a menos que el usuario pida otro idioma.
`;

// Autosaludo inicial
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    speak("¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);
});

// Bloque de opciones de avance (sin botón copiar)
function miraAdvanceBlock() {
  return `
    <div class="mira-advance" style="margin-top:1em;">
      <strong>¿Cómo deseas continuar?</strong><br>
      - ¿Quieres un ejemplo práctico?<br>
      - ¿Te gustaría ver alternativas?<br>
      - ¿Prefieres un resumen?<br>
      - ¿Tienes otra consulta?<br>
    </div>
  `;
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

async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");

  const userMessage = input.value.trim();
  if (!userMessage) return;

  chatBox.innerHTML += `<div><strong>Tú:</strong> ${escapeHtml(userMessage)}</div>`;
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
    let aiReply = data.choices?.[0]?.message?.content || "";

    if (!aiReply || aiReply.toLowerCase().includes("no se pudo")) {
      // Consulta Wikipedia solo si es necesario
      const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
      const wikiData = await wiki.json();
      aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
    }

    // Renderiza la respuesta, añade bloque de opciones sin botón copiar
    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += `
      <div>
        <strong>MIRA:</strong>
        <span class="chat-markdown">${html}</span>
        ${miraAdvanceBlock()}
      </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    // Voz + halo animado SOLO para el texto limpio
    speak(aiReply);

    // Re-renderizar MathJax para fórmulas
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
