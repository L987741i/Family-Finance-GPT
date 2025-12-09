module.exports = async function (req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const message = body.message || "";
    
    // proteção para context quebrado
    let context = body.context || null;
    if (typeof context === "string") {
      try { context = JSON.parse(context); } catch (err) { context = null; }
    }

    const intent = detectIntent(message);

    // ========== CANCELAR ==========
    if (intent.type === "cancel") {
      res.json({
        reply: "Tudo bem, cancelei para você 👍",
        action: "cancelled"
      });
      return;
    }

    // ========== CONSULTAS ==========
    if (intent.type === "query") {
      res.json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    // ========== CONFIRMAR ==========
    if (intent.type === "confirm") {
      if (!context || !context.pending_transaction) {
        res.json({
          reply: "Não encontrei nenhum lançamento pendente para confirmar 🤔 Me envie novamente.",
          action: "error"
        });
        return;
      }

      res.json({
        reply: "Perfeito! Vou registrar agora 👍",
        action: "success",
        data: context.pending_transaction
      });
      return;
    }

    // ========== TRANSAÇÃO ==========
    if (intent.type === "transaction") {
      const result = extractTransaction(message);

      if (result.needsMoreInfo) {
        res.json({
          reply: result.reply,
          action: "need_more_info",
          data: {
            missing_field: result.missingField,
            partial_data: result.partial
          }
        });
        return;
      }

      res.json({
        reply: result.confirmation,
        action: "awaiting_confirmation",
        data: result.fullData
      });
      return;
    }

    // ========== MENSAGEM GERAL ==========
    res.json({
      reply:
        "Sou seu assistente financeiro! Você pode me dizer coisas como:\n\n" +
        "• \"paguei 50 no mercado\"\n" +
        "• \"quanto gastei hoje?\"\n" +
        "• \"recebi 200 de salário\"\n" +
        "• \"qual o meu saldo?\"",
      action: "message"
    });

  } catch (error) {
    console.error("IA Error:", error);
    res.status(500).json({
      reply: "Opa… tive um problema ao processar isso agora 😕 Tente novamente.",
      action: "error",
      details: String(error)
    });
  }
};
