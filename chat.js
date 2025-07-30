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

// ============ MEJORA PARA LIMPIAR VARIABLES ============= //
// Quita $...$ solo cuando es variable o símbolo al inicio de la línea (en listas)
function cleanVariablesLatex(text) {
  return text.replace(/^(\s*[-*]\s+)\$\\?([a-zA-Z_0-9]+|Delta|theta|phi|pi|lambda|mu|sigma|alpha|beta|gamma)\$ ?/gm, (_, prefix, variable) => {
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
  });
}

// ========= NUEVA FUNCIÓN PARA FORMATO LATEX CORRECTO ========= //
function limpiarLatex(texto) {
  // Fórmulas centradas: reemplaza $$...$$ por \[...\]
  texto = texto.replace(/\$\$(.*?)\$\$/gs, (_, formula) => `\\[${formula.trim()}\\]`);

  // Fórmulas en línea: reemplaza $...$ por \(...\), evitando dobles
  texto = texto.replace(/(?<!\$)\$(.+?)\$(?!\$)/g, (_, formula) => `\\(${formula.trim()}\\)`);

  return texto;
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
  let text = markdown
    .split('\n')
    .filter(line =>
      !line.trim().startsWith('$$') && !line.trim().endsWith('$$') &&
      !line.includes('$') &&
      !/^ {0,3}`/.test(line)
    )
    .join('. ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/([.,;:!?\)])([^\s.])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(/\.{2,}/g, '.');
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

// Saludo hablado inicial
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

  chatHistory.push({ role: "user", content: userMessage });

  if (chatHistory.length > 9) {
    chatHistory.splice(1, chatHistory.length - 8);
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
        const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
        const wikiData = await wiki.json();
        aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
      }
    }

    // LIMPIEZA COMPLETA DE LATEX Y VARIABLES
    aiReply = limpiarLatex(cleanVariablesLatex(aiReply));

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
