const API_KEY = "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";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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
Tu eres MIRA, Modular Intelligent Responsive Assistant. En español: Asistente Modular, Inteligente y Reactivo. Creada por Innova Space y OpenAi.
Responde SIEMPRE con estructura ordenada y clara, como ChatGPT.

Si el usuario escribe palabras incompletas, con errores ortográficos, abreviaturas o frases poco claras, intenta corregir o interpretar automáticamente el mensaje para dar la mejor respuesta posible usando el contexto. Si no es completamente claro, ofrece alternativas breves (por ejemplo: "¿Quizás quisiste decir...?" o "¿Te refieres a...?") y pide aclaración solo si ninguna alternativa es adecuada.

Cuando debas mostrar fórmulas, ecuaciones, funciones, expresiones algebraicas, matrices o símbolos matemáticos, primero escribe una frase explicando su significado con palabras simples y comprensibles para estudiantes (por ejemplo: "La velocidad media es igual al desplazamiento dividido por el intervalo de tiempo."). Después, incluye la ecuación en LaTeX usando los signos de dólar ($ para ecuaciones en línea, $$ para centradas), para que se vea como fórmula, pero NO expliques el código ni los signos de dólar.

Ejemplo de formato ideal:
"La velocidad media es igual al desplazamiento dividido por el intervalo de tiempo:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$
Donde:
- **v_m** es la velocidad media.
- **Δx** es el desplazamiento total.
- **Δt** es el intervalo de tiempo."

NO uses LaTeX ni signos de dólar para variables, letras ni números sueltos en listas de definición: escribe la variable como texto normal o en negrita/cursiva usando Markdown.

Utiliza frases completas, claras y bien puntuadas (usa puntos, comas y saltos de línea para pausas naturales y buena lectura en voz alta).

No uses bloques de código ni asteriscos a menos que el usuario lo pida explícitamente.

Utiliza listas, tablas y títulos para organizar la información. Resume si es posible.

Si no sabes la respuesta, consulta Wikipedia.
`;

// Autosaludo inicial
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
    let aiReply = data.choices?.[0]?.message?.content || "";

    if (!aiReply || aiReply.toLowerCase().includes("no se pudo")) {
      // Consulta Wikipedia solo si es necesario
      const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
      const wikiData = await wiki.json();
      aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
    }

    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += `<div><strong>MIRA:</strong> <span class="chat-markdown">${html}</span></div>`;
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
