export const runtime = "nodejs";

export async function POST(request) {
  try {
    const incomingForm = await request.formData();
    const audio = incomingForm.get("audio");

    if (!audio) {
      return Response.json({ error: "Áudio não enviado" }, { status: 400 });
    }

    console.log("Audio recebido:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
    });

    const arrayBuffer = await audio.arrayBuffer();

    // 👉 Web FormData (NATIVO)
    const openaiForm = new FormData();
    openaiForm.append(
      "file",
      new Blob([arrayBuffer], { type: audio.type || "audio/ogg" }),
      "audio.ogg"
    );
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "pt");

    const res = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: openaiForm,
      }
    );

    const text = await res.text();

    if (!res.ok) {
      console.error("OpenAI error:", text);
      return Response.json(
        { error: "Erro OpenAI", detail: text },
        { status: 500 }
      );
    }

    const json = JSON.parse(text);

    return Response.json({ text: json.text });
  } catch (err) {
    console.error("CRASH:", err);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
