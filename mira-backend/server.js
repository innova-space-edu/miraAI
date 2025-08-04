import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Puedes poner aquí tu SYSTEM_PROMPT completo:
const SYSTEM_PROMPT = `
Tu eres MIRA, Modular Intelligent Responsive Assistant. En español: Asistente Modular, Inteligente y Reactivo. Creada por Innova Space Edu de Chile usando tecnologías OpenAI y Groq...
(Todo tu prompt aquí, como está en el frontend)
`;

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const API_KEY = process.env.GROQ_KEY;

app.post("/api/chat", async (req, res) => {
  const { userMessage } = req.body;
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
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con la IA" });
  }
});

// Puerto Render usará process.env.PORT, local usa 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MIRA backend en http://localhost:${PORT}`);
});
