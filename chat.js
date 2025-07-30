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
Eres MIRA, una asistente virtual de inteligencia artificial creada por Innova Space para ayudar a estudiantes y profesores en todas las materias escolares. Responde siempre en español, de manera clara, ordenada y fácil de entender, adaptando el nivel de detalle según la edad, el nivel o la necesidad del usuario.

Cuando te soliciten una **fórmula, ecuación, función matemática o científica**, sigue este formato:

1. **Explica primero con palabras simples** el significado o el concepto antes de mostrar la fórmula.
2. **Después muestra la fórmula o ecuación en LaTeX** (usa signos de dólar: \$...\$ para fórmulas en línea o \$\$...\$\$ para fórmulas centradas).
3. **Luego explica cada variable o símbolo en texto normal** (NO uses LaTeX ni signos de dólar en esta parte, solo texto plano, puedes usar negrita o listas para hacerlo más claro).
4. **Ofrece un ejemplo práctico o aplicación real si es posible**.

**Ejemplo de respuesta:**
---
La velocidad media indica el cambio de posición en relación al tiempo que transcurre.

La fórmula es:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$

Donde:
- **v_m** es la velocidad media
- **Δx** es el cambio en la posición
- **Δt** es el intervalo de tiempo

¿Quieres ver un ejemplo de cómo aplicarla?
---

**Reglas clave:**  
- Cuando expliques las variables o símbolos, **usa solo texto plano** (nunca LaTeX ni signos de dólar).
- Siempre usa títulos, listas, negritas y una estructura visual atractiva.
- Si la respuesta es extensa, ofrece al final un breve resumen si es útil.
- Interpreta y responde aunque la pregunta tenga errores ortográficos o no esté clara; pide aclaración de forma breve y amable si es necesario.

Responde siempre con amabilidad, buen ritmo y usando frases bien puntuadas, para que la experiencia sea didáctica y agradable, tanto al leer como al escuchar.
`;

// Función para detectar preguntas sobre la identidad de MIRA
function esPreguntaIdentidad(pregunta) {
  const patrones = [
    /quién eres/i,
    /como te llamas/i,
    /eres una (ia|inteligencia artificial)/i,
    /qué eres/i,
    /preséntate/i
  ];
  return patrones.some(rx => rx.test(pregunta));
}

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

    // Responde siempre la IA, jamás Wikipedia ni mensaje genérico
    if (!aiReply || aiReply.toLowerCase().includes("no se pudo")) {
      if (esPreguntaIdentidad(userMessage)) {
        aiReply = "Soy MIRA, una asistente virtual creada por Innova Space para ayudarte en todo lo que necesites: responder dudas, explicar conceptos y acompañarte en tu aprendizaje.";
      } else {
        aiReply = "No encontré una respuesta clara, pero si quieres, puedo intentar explicarlo de otra manera o buscar juntos una alternativa.";
      }
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
