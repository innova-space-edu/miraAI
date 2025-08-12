// netlify/functions/chat.js
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON" }; }

  const { model, messages, temperature = 0.7 } = payload;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, stream: false }),
  });

  const text = await res.text();
  return {
    statusCode: res.status,
    headers: {
      "Content-Type": "application/json",
      // CORS por si lo usas desde otro origen
      "Access-Control-Allow-Origin": "*",
    },
    body: text,
  };
}
