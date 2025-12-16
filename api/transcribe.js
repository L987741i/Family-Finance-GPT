import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const form = formidable({ multiples: false });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    if (!files.audio) {
      return res.status(400).json({ error: "Arquivo de áudio não enviado" });
    }

    const audioPath = files.audio.filepath;

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      language: "pt",
    });

    return res.status(200).json({
      text: transcription.text,
    });
  } catch (err) {
    console.error("ERRO REAL:", err);
    return res.status(500).json({
      error: "Erro interno na transcrição",
      detail: err.message,
    });
  }
}
