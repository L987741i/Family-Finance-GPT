export const runtime = "nodejs";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return res.status(400).json({ error: "Áudio não enviado" });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "pt",
    });

    return res.status(200).json({
      text: transcription.text,
    });
  } catch (err) {
    console.error("ERRO REAL:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
