// ============================================================
// api/chat.js — Vercel Serverless Function
// Backend seguro que conecta con Hugging Face.
// El token NUNCA está expuesto en el navegador del usuario.
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

    // El token se lee de la variable "geminiapikey" que ya está en Vercel
    const hfToken = process.env.geminiapikey;

    if (!hfToken) {
        console.error('ERROR: La variable de entorno geminiapikey no está configurada en Vercel.');
        return res.status(500).json({ error: 'El servidor no tiene el token configurado.' });
    }

    const HF_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

    // Formato de prompt que entiende Mistral Instruct
    const inputText = `<s>[INST] Eres Robotito, un robot pequeño, amigable y divertido que vive en un ESP32. Responde de forma muy breve, amigable y un poco graciosa (máximo 2 oraciones cortas en español). El humano te dice: "${prompt}" [/INST]`;

    const payload = {
        inputs: inputText,
        parameters: {
            max_new_tokens: 120,
            temperature: 0.8,
            return_full_text: false, // Solo devuelve la respuesta, no el prompt completo
        }
    };

    try {
        const hfResponse = await fetch(HF_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + hfToken
            },
            body: JSON.stringify(payload)
        });

        const data = await hfResponse.json();

        if (!hfResponse.ok) {
            console.error('Error de Hugging Face:', data);
            return res.status(hfResponse.status).json({ error: data.error || 'Error en Hugging Face.' });
        }

        // Hugging Face devuelve un array, tomamos el primer resultado
        const texto = data[0]?.generated_text?.trim();

        if (!texto) {
            return res.status(500).json({ error: 'Hugging Face respondió pero sin texto generado.' });
        }

        return res.status(200).json({ respuesta: texto });

    } catch (error) {
        console.error('Error de red llamando a Hugging Face:', error);
        return res.status(500).json({ error: 'Error de red al contactar a Hugging Face.' });
    }
}
