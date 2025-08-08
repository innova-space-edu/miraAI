// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// En Node 18+ fetch ya existe; si usas Node <=16 descomenta la siguiente línea:
// import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* =============================
   CONFIGURACIÓN
============================= */

// Modelo por defecto (puedes sobreescribir con env MODEL)
const MODEL = process.env.MODEL || "llama-3.1-70b-versatile";

// Acepta GROQ_API_KEY o GROQ_KEY
const API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY;

// Prompt de sistema (deja el tuyo completo aquí)
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial (Modular Intelligent Responsive Assistant). Creada por Innova Space Edu (Chile) con tecnología OpenAI y Groq.

Cuando te pidan una fórmula, ecuación, función matemática o científica, sigue estos pasos:

1. Explica primero con palabras sencillas el concepto o significado antes de mostrar la fórmula.
2. Luego muestra la fórmula en LaTeX (usando signos de dólar: \$...\$ para fórmulas en línea o \$\$...\$\$ para fórmulas centradas).
3. Después de la fórmula, explica cada variable o símbolo en texto plano (sin LaTeX ni signos de dólar, solo texto normal o Markdown). Escribe, por ejemplo:
   - **v_m** es la velocidad media
   - **Δx** es el cambio en la posición
   - **Δt** es el intervalo de tiempo
4. Ofrece un ejemplo práctico o aplicación si corresponde.

Ejemplo de estructura ideal:

La velocidad media es la variación de la posición dividida por la variación del tiempo.

La fórmula es:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$

Donde:
- **v_m** es la velocidad media
- **Δx** es el cambio en la posición
- **Δt** es el intervalo de tiempo

¿Quieres un ejemplo de cómo aplicar esta fórmula?

Regla importante:
Cuando expliques las variables o símbolos de la fórmula, nunca uses LaTeX ni signos de dólar (\$). Solo texto plano, negrita o cursiva si lo deseas.

Otras instrucciones importantes:
- Si hay un error ortográfico o la pregunta no está clara, intenta interpretarla y responde de la mejor manera posible.
- Si la pregunta es ambigua, pide aclaración de forma breve y amable.
- Usa títulos, listas, negrita (Markdown), y estructura visualmente agradable.
- Si la respuesta es extensa, puedes ofrecer un resumen al final.
- Si te preguntan varias veces sobre el mismo tema, mantén el contexto y responde como una conversación.
- Si alguna variable contiene letras griegas (como Δx o θ), escribe el símbolo directamente, pero sin LaTeX.

Responde siempre con amabilidad y usando buen ritmo, pausas, y frases bien puntuadas para facilitar la lectura en voz alta.
`;

/* =============================
   UTILIDADES
============================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGroq(messages, {
  model = MODEL,
  temperature = 0.7,
  max_tokens = 1024,
  top_p = 0.95,
  retries = 2,
  timeoutMs = 20_000
} = {}) {
  if (!API_KEY) {
    throw new Error("Falta la API key (GROQ_API_KEY o GROQ_KEY).");
  }

  const body = {
    model,
    messages,
    temperature,
    top_p,
    max_tokens,
    // Mantén stream: false porque tu frontend espera JSON completo
    stream: false
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });

      clearTimeout(t);

      // Groq devuelve JSON tipo OpenAI
      const data = await resp.json();

      if (!resp.ok) {
        // Estructura de error de Groq (por si llega)
        const msg = data?.error?.message || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      // Validación mínima para asegurar que el front no se rompa
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("Respuesta vacía del modelo.");
      }

      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        // backoff exponencial suave
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    }
  }
}

/* =============================
   RUTAS
============================= */

// Healthcheck para Render
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

// Endpoint principal: mantiene el formato que tu frontend espera
app.post("/api/chat", async (req, res) => {
  const { userMessage, context } = req.body || {};
  const content = (userMessage || "").toString().trim();

  if (!content) {
    return res.status(400).json({ error: "userMessage es requerido." });
  }

  // Mensajes a enviar a Groq (puedes inyectar historial si quieres en 'context')
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(Array.isArray(context) ? context : []),
    { role: "user", content }
  ];

  try {
    const data = await callGroq(messages, {
      model: MODEL,
      temperature: 0.7,
      max_tokens: 800,
      top_p: 0.95,
      retries: 2,
      timeoutMs: 25_000
    });

    // Devuelve tal cual para tu front actual
    return res.json(data);
  } catch (error) {
    console.error("[/api/chat] Error:", error?.message || error);

    // Respuesta de reserva para que el front **siempre** muestre algo
    return res.status(200).json({
      id: "fallback",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              "Lo siento, tuve un problema al conectar con la IA. Pero no te dejo en blanco. Si quieres, vuelve a intentarlo o formula la pregunta de otra manera (por ejemplo: “dime la fórmula de la velocidad media con ejemplo”)."
          },
          finish_reason: "stop"
        }
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
});

/* =============================
   ARRANQUE
============================= */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MIRA backend escuchando en http://localhost:${PORT}`);
  console.log(`Modelo: ${MODEL}`);
});
