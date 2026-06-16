// ============================================================
// api/chat.js — Vercel Serverless Function
// Este archivo NUNCA llega al navegador del usuario.
// Aquí vive la API Key de forma 100% segura.
// ============================================================

export default async function handler(req, res) {
    // Solo aceptamos peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Falta el campo "prompt" en el cuerpo de la petición.' });
    }

    // La clave se lee de las variables de entorno de Vercel — ¡nunca está en el código!
    const apiKey = process.env.geminiapikey;

    if (!apiKey) {
        console.error('ERROR: La variable de entorno geminiapikey no está configurada en Vercel.');
        return res.status(500).json({ error: 'El servidor no tiene la API Key configurada.' });
    }

    const GEMINI_MODEL = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{
                text: `Eres Robotito, un robot pequeño, amigable y divertido que vive en un ESP32. Responde de forma muy breve, amigable y un poco graciosa (máximo 2 oraciones cortas). El humano te dice: "${prompt}"`
            }]
        }],
        generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 150, // Respuestas cortas para el robot
        }
    };

    try {
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error('Error de la API de Gemini:', data);
            return res.status(geminiResponse.status).json({ error: data.error?.message || 'Error en Gemini.' });
        }

        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!texto) {
            return res.status(500).json({ error: 'Gemini respondió pero sin texto.' });
        }

        return res.status(200).json({ respuesta: texto });

    } catch (error) {
        console.error('Error de red llamando a Gemini:', error);
        return res.status(500).json({ error: 'Error de red al contactar a Gemini.' });
    }
}
