import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Campo 'message' é obrigatório." });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Você é a IA oficial do aplicativo FF – Family Finance.
Ajude os usuários a analisar entradas, saídas e gastos.
Peça mais detalhes quando necessário.
Nunca invente valores.
Seja claro, simples e objetivo.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content || "Não consegui gerar resposta.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Erro na API ChatGPT:", error);
    return res.status(500).json({ error: "Erro interno ao chamar a IA." });
  }
}
