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
        else resolve({ fields, files });
      });
    });

    if (!files.audio) {
      return res.status(400).json({ error: "Áudio não enviado" });
    }

    const audioFile = fs.createReadStream(files.audio.filepath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt",
    });

    res.status(200).json({
      text: transcription.text,
    });
  } catch (error) {
    console.error("Erro transcrição:", error);
    res.status(500).json({ error: "Falha na transcrição" });
  }
}
