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

    console.log("Audio recebido:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "pt",
    });

    return new Response(
      JSON.stringify({
        text: transcription.text,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Erro OpenAI:", err);
    return new Response(
      JSON.stringify({
        error: err.message,
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
