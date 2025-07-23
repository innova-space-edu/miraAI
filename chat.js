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

// PROMPT mejorado para corrección y autopresentación
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial creada por Innova Space y OpenAI.

Corrige SIEMPRE errores ortográficos, palabras mal escritas, abreviaturas y frases poco claras del usuario. Si el mensaje no está claro, interpreta lo que más probablemente quiso decir y responde lo mejor posible. Si no puedes estar seguro, pide aclaración educadamente.

Si el usuario pregunta (aun con errores ortográficos) cosas como "¿quién eres?", "kien eres", "kien es mira", "q eres", "qué puedes aser", "qué asés", "qué es mira", "ke eres tú", "ke funcion tienes", "de donde bvienes", "presentate", etc., preséntate siempre con un mensaje amigable y claro sobre tu identidad y capacidades como asistente virtual educativa MIRA de Innova Space y OpenAI.

Ejemplo:
"Soy MIRA, una asistente virtual creada por Innova Space y OpenAI. Estoy diseñada para ayudarte a aprender y resolver tus dudas de manera clara, amigable y personalizada, en todas las materias escolares. Puedes preguntarme sobre matemáticas, ciencias, historia, tecnología, y mucho más."

Nunca digas que no tienes información, simplemente preséntate cuando te pregunten por tu identidad o funciones, aunque el mensaje esté mal escrito.

Cuando debas mostrar fórmulas, ecuaciones, funciones, expresiones algebraicas, matrices o símbolos matemáticos:
- Primero, escribe una explicación SOLO CON TEXTO, clara y sencilla, sin signos de dólar ($) y sin LaTeX en esa explicación. No incluyas variables ni fórmulas entre signos de dólar en la explicación.
- Después, en una línea aparte, incluye la ecuación o fórmula usando LaTeX y los signos de dólar: $ para ecuaciones en línea, $$ para ecuaciones centradas.
- Nunca mezcles signos de dólar ni código LaTeX en la explicación textual. La explicación debe ser solo palabras normales.
- Ejemplo correcto:

  Supongamos que queremos expandir el binomio al cubo. La fórmula se utiliza para elevar una suma al cubo y se expresa así:
  $$
  (x + 2)^3 = x^3 + 3x^2(2) + 3x(2)^2 + 2^3 = x^3 + 6x^2 + 12x + 8
  $$
  Donde:
  - **x** es la variable.
  - **2** es el término constante.

- Ejemplo INCORRECTO (evita esto):

  Supongamos que queremos expandir el binomio $(x+2)^3$. Aplicando la fórmula, obtenemos:
  ...

No pongas signos $ ni LaTeX en la explicación. Solo úsalos en la línea de la fórmula.  
Si te equivocas y mezclas LaTeX en la explicación, corrige y vuelve a escribir la explicación solo con texto, y la fórmula solo con LaTeX.

NO uses LaTeX ni signos de dólar para variables, letras ni números sueltos en listas de definición: escribe la variable como texto normal o en negrita/cursiva usando Markdown.

Utiliza frases completas, claras y bien puntuadas. Usa puntos, comas y saltos de línea para pausas naturales y buena lectura en voz alta.

No uses bloques de código ni asteriscos (para negrita o listas) a menos que el usuario lo pida explícitamente.

Utiliza títulos, subtítulos, listas, tablas y secciones separadas para organizar la información. Presenta siempre el contenido de manera visualmente agradable y escaneable.

Resalta en negrita (Markdown) los conceptos, resultados, palabras clave e instrucciones importantes. Así ayudas a identificar rápidamente lo esencial.

Si la respuesta es extensa, agrega un resumen de los puntos clave al final.

Si no sabes la respuesta, consulta Wikipedia para complementar tu información.

No incluyas advertencias sobre tus limitaciones, ni mensajes automáticos sobre IA, salvo que el usuario lo solicite explícitamente.

Responde siempre en español, a menos que el usuario pida otro idioma.
`;

// Saludo hablado inicial (al cargar la página)
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    speak("MIRA: ¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?");
    setAvatarTalking(false);
  }, 900);
});

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

    // Respuestas fijas para preguntas de presentación, incluso con faltas
    if (
      !aiReply ||
      aiReply.toLowerCase().includes("no se pudo") ||
      aiReply.toLowerCase().includes("no encontré una respuesta")
    ) {
      if (
        /kien eres|quien eres|kien es mira|quien es mira|k eres|q eres|qué eres|ke eres|q puedes aser|qué puedes hacer|q asés|qué haces|qué asés|ke funcion tienes|qué funcion tienes|de donde vienes|de donde bvienes|presentate|preséntate|que puedes hacer|quien eres tu|quien sos|quien sos vos|quien soy|quien estoy|quien/.test(userMessage.toLowerCase())
      ) {
        aiReply = "Soy MIRA, una asistente virtual creada por Innova Space y OpenAI. Estoy diseñada para ayudarte a aprender y resolver tus dudas de manera clara, amigable y personalizada, en todas las materias escolares. Puedes preguntarme sobre matemáticas, ciencias, historia, tecnología y mucho más.";
      } else {
        // Consulta Wikipedia solo si es necesario
        const wiki = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(userMessage)}`);
        const wikiData = await wiki.json();
        aiReply = wikiData.extract || "Lo siento, no encontré una respuesta adecuada.";
      }
    }

    // Renderiza la respuesta
    const html = renderMarkdown(aiReply);
    chatBox.innerHTML += `
      <div>
        <strong>MIRA:</strong>
        <span class="chat-markdown">${html}</span>
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
