import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return new Response(
        JSON.stringify({ error: "Áudio não enviado" }),
        { status: 400 }
      );
    }

    // 🔎 LOGS DE SANIDADE (IMPORTANTES)
    console.log("Audio recebido:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
      constructor: audio.constructor?.name,
    });

    if (!audio.size || audio.size === 0) {
      return new Response(
        JSON.stringify({ error: "Arquivo de áudio vazio" }),
        { status: 400 }
      );
    }

    // ✅ CONVERSÃO CRÍTICA (WHATSAPP SAFE)
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: {
        value: buffer,
        options: {
          filename: audio.name || "audio.ogg",
          contentType: audio.type || "audio/ogg",
        },
      },
      model: "whisper-1",
      language: "pt",
    });

    return new Response(
      JSON.stringify({ text: transcription.text }),
      { status: 200 }
    );
  } catch (err) {
    console.error("ERRO REAL OPENAI:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Erro interno na transcrição",
      }),
      { status: 500 }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ error: "Use POST" }),
    { status: 405 }
  );
}
