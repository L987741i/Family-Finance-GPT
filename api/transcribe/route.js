export const runtime = "nodejs";

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

    // 🔎 Logs reais
    console.log("Audio recebido:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
    });

    if (!audio.size || audio.size === 0) {
      return new Response(
        JSON.stringify({ error: "Arquivo de áudio vazio" }),
        { status: 400 }
      );
    }

    // Converter para ArrayBuffer
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Criar FormData MANUAL para OpenAI
    const openaiForm = new FormData();
    openaiForm.append(
      "file",
      new Blob([buffer], { type: "audio/wav" }),
      "audio.wav"
    );
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "pt");

    // 🔥 CHAMADA DIRETA À API DA OPENAI (SEM SDK)
    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: openaiForm,
      }
    );

    const result = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI RAW ERROR:", result);
      return new Response(
        JSON.stringify({
          error: "Erro OpenAI",
          detail: result,
        }),
        { status: 500 }
      );
    }

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
