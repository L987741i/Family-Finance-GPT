import FormData from "form-data";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const incomingForm = await request.formData();
    const audio = incomingForm.get("audio");

    if (!audio) {
      return new Response(
        JSON.stringify({ error: "Áudio não enviado" }),
        { status: 400 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Audio recebido:", {
      name: audio.name,
      type: audio.type,
      size: buffer.length,
    });

    // 🔥 FormData REAL (Node-safe)
    const form = new FormData();
    form.append("file", buffer, {
      filename: "audio.wav",
      contentType: "audio/wav",
    });
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(), // ⚠️ boundary correto
        },
        body: form,
      }
    );

    const resultText = await openaiRes.text();

    if (!openaiRes.ok) {
      console.error("OpenAI error:", resultText);
      return new Response(
        JSON.stringify({
          error: "Erro OpenAI",
          detail: resultText,
        }),
        { status: 500 }
      );
    }

    const result = JSON.parse(resultText);

    return new Response(
      JSON.stringify({ text: result.text }),
      { status: 200 }
    );
  } catch (err) {
    console.error("ERRO FATAL:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
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
