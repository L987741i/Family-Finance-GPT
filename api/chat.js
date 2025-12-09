// /api/chat.js — IA Financeira + Lovable
// Versão 2025 — Categorização Inteligente Baseada em Regras

let globalContext = {};

// ======================================================================
// 🧠 BASE DE CONHECIMENTO (As categorias que você definiu)
// ======================================================================
const CATEGORY_MAP = {
  expense: [
    // 🏠 Moradia
    { name: "Aluguel", keywords: ["aluguel", "alugue", "moradia"] },
    { name: "Financiamento / Prestação", keywords: ["financiamento", "prestação", "prestacao", "financiado"] },
    { name: "Condomínio", keywords: ["condomínio", "condominio", "predio"] },
    { name: "IPTU", keywords: ["iptu", "imposto casa"] },
    
    // ⚡ Contas Essenciais
    { name: "Energia", keywords: ["energia", "luz", "eletricidade", "enel", "light"] },
    { name: "Água", keywords: ["água", "agua", "cedae", "sabesp"] },
    { name: "Gás", keywords: ["gás", "gas", "botijão"] },
    { name: "Internet", keywords: ["internet", "wifi", "banda larga", "vivo", "claro", "tim"] },
    { name: "Telefonia", keywords: ["telefonia", "telefone", "celular", "recarga", "plano"] },

    // 🛒 Alimentação
    { name: "Supermercado", keywords: ["supermercado", "mercado", "compra do mês", "compras", "assai", "atacadao", "carrefour"] },
    { name: "Padaria", keywords: ["padaria", "pão", "pao", "leite", "café da manhã"] },
    { name: "Açougue", keywords: ["açougue", "acougue", "carne", "frango", "churrasco"] },
    { name: "Feira", keywords: ["feira", "hortifruti", "legumes", "frutas"] },
    { name: "Restaurante", keywords: ["restaurante", "almoço", "jantar", "comida fora"] },
    { name: "Lanche", keywords: ["lanche", "ifood", "burger", "pizza", "mc donalds", "delivery"] },

    // 🚗 Transporte
    { name: "Combustível", keywords: ["combustível", "combustivel", "gasolina", "etanol", "diesel", "abastecer", "posto"] },
    { name: "Estacionamento", keywords: ["estacionamento", "zona azul", "shopping"] },
    { name: "Pedágio", keywords: ["pedágio", "pedagio", "sem parar"] },
    { name: "Manutenção Veicular", keywords: ["manutenção", "mecânico", "oficina", "peça carro", "óleo"] },
    { name: "Seguro Auto", keywords: ["seguro auto", "seguro carro", "ipva"] },
    // Adicionado Uber genérico em transporte
    { name: "Transporte App / Público", keywords: ["uber", "99", "táxi", "ônibus", "metrô", "passagem"] },

    // 💊 Saúde
    { name: "Farmácia", keywords: ["farmácia", "farmacia", "remédio", "remedio", "drogaria"] },
    { name: "Consultas", keywords: ["consulta", "médico", "dentista", "psicólogo"] },
    { name: "Exames", keywords: ["exame", "laboratório", "sangue"] },
    { name: "Hospital", keywords: ["hospital", "pronto socorro"] },
    { name: "Plano de Saúde", keywords: ["plano de saúde", "convênio", "unimed", "bradesco saúde"] },

    // 🎓 Educação
    { name: "Escola", keywords: ["escola", "colégio", "mensalidade escolar", "matrícula"] },
    { name: "Cursos", keywords: ["curso", "inglês", "faculdade", "universidade", "udemy"] },
    { name: "Material Escolar", keywords: ["material escolar", "livro", "caderno", "papelaria"] },

    // 🎉 Lazer
    { name: "Cinema", keywords: ["cinema", "filme", "pipoca"] },
    { name: "Viagem", keywords: ["viagem", "passagem aerea", "hotel", "pousada", "férias"] },
    { name: "Passeios", keywords: ["passeio", "parque", "ingresso", "show", "teatro"] },
    { name: "Streaming", keywords: ["streaming", "netflix", "spotify", "prime", "disney", "assinatura"] },

    // 👕 Vestuário
    { name: "Roupas", keywords: ["roupas", "camisa", "camiseta", "vestido", "calça", "loja de roupa"] },
    { name: "Calçados", keywords: ["calçados", "tênis", "sapato", "chinelo"] },
    { name: "Acessórios", keywords: ["acessórios", "bolsa", "relógio", "joia"] },

    // 🏦 Financeiro
    { name: "Tarifa Bancária", keywords: ["tarifa", "taxa", "banco", "cesta"] },
    { name: "Anuidade Cartão", keywords: ["anuidade", "cartão de crédito"] },
    { name: "Juros", keywords: ["juros", "cheque especial"] },
    { name: "Multas", keywords: ["multa", "atraso"] },

    // 📦 Casa & Manutenção
    { name: "Reforma", keywords: ["reforma", "pedreiro", "pintor", "obra", "material de construção"] },
    { name: "Móveis", keywords: ["móveis", "sofá", "cama", "mesa", "cadeira"] },
    { name: "Ferramentas", keywords: ["ferramentas", "furadeira"] },

    // 🐾 Pets
    { name: "Ração", keywords: ["ração", "pet", "gato", "cachorro"] },
    { name: "Veterinário", keywords: ["veterinário", "vacina pet"] },
    { name: "Higiene Pet", keywords: ["banho e tosa", "petshop"] },

    // 🎁 Outros
    { name: "Presentes", keywords: ["presente", "aniversário"] },
    { name: "Doações", keywords: ["doação", "dízimo", "caridade"] },
    { name: "Emergências", keywords: ["emergência", "imprevisto"] }
  ],
  income: [
    { name: "Salário", keywords: ["salário", "salario", "pagamento", "holerite", "mensal"] },
    { name: "Investimentos", keywords: ["investimento", "dividendo", "rendimento", "aplicação", "cdb", "ações"] },
    { name: "Extras", keywords: ["extra", "freela", "bico", "bônus", "serviço"] },
    { name: "Presentes", keywords: ["presente", "ganhei dinheiro"] },
    { name: "Venda", keywords: ["venda", "vendi", "desapego"] },
    { name: "Empréstimo", keywords: ["empréstimo", "peguei emprestado"] },
    { name: "Juros Recebidos", keywords: ["juros"] },
    { name: "Benefícios", keywords: ["benefício", "vr", "va", "vale", "reembolso"] }
  ]
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body || {};

    globalContext = context || {};
    const pending = context?.pending_transaction || null;
    const missing = context?.missing_field || null;

    if (!message || typeof message !== "string") {
      return res.status(200).json({
        reply: "Não entendi 🤔 pode repetir?",
        action: "message"
      });
    }

    const msgLower = message.toLowerCase().trim();

    // ======================================================================
    // 1) CONTINUAÇÃO DE CAMPO FALTANTE
    // ======================================================================
    if (pending && missing) {
      const updated = { ...pending };

      // (A) Valor
      if (missing === "amount") {
        const parsed = Number(message.replace(",", "."));
        if (!parsed || isNaN(parsed)) {
          return res.status(200).json({
            reply: "Me diga um valor válido 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }
        updated.amount = parsed;
      }

      // (B) Conta
      if (missing === "account_name") {
        // Se usuário tentar mudar categoria agora, permitimos a edição inteligente
        if (msgLower.startsWith("categoria") || msgLower.includes("muda categoria")) {
           // Deixa passar para o bloco 2
        } else {
           updated.account_name = msgLower;
        }
      }

      // (C) Categoria (Aqui entra a IA de associação também)
      if (missing === "category_name") {
        // Tenta achar a categoria nativa com base no que o usuário digitou
        const typeContext = updated.type || "expense"; // Default expense se não souber
        const { bestMatch } = findBestCategory(msgLower, typeContext);
        
        updated.category_name = bestMatch ? bestMatch : msgLower; // Usa a nativa ou o que ele digitou
      }

      // (D) Tipo
      if (missing === "type") {
        if (msgLower.includes("entrada") || msgLower.includes("receita")) {
          updated.type = "income";
        } else if (msgLower.includes("saída") || msgLower.includes("despesa")) {
          updated.type = "expense";
        } else {
          return res.status(200).json({
            reply: "Isso foi *entrada* ou *saída*? 🤔",
            action: "need_more_info",
            data: { missing_field: "type", partial_data: updated }
          });
        }
      }

      // Se completou, confirma e limpa o missing
      return sendConfirmation(res, updated);
    }

    // ======================================================================
    // 2) EDIÇÃO INTELIGENTE (DURANTE CONFIRMAÇÃO)
    // ======================================================================
    if (pending) {
      const updated = { ...pending };
      const text = msgLower;

      // 2.1) FREQUÊNCIA
      const isFreqFixa = ["fixa", "fixo", "mensal", "recorrente"].some(t => text.includes(t));
      const isFreqVariavel = ["variável", "variavel", "eventual"].some(t => text.includes(t));

      if (isFreqFixa) {
        updated.frequency = "fixed";
        return sendConfirmation(res, updated);
      }
      if (isFreqVariavel) {
        updated.frequency = "variable";
        return sendConfirmation(res, updated);
      }

      // 2.2) MUDAR CATEGORIA (COM RACIOCÍNIO)
      if (
        text.startsWith("categoria") ||
        text.includes("muda categoria") ||
        text.includes("troca categoria") ||
        text.includes("é categoria")
      ) {
        // Remove comandos para pegar só o "conteúdo"
        const rawCategory = text
          .replace("categoria é", "")
          .replace("categoria", "")
          .replace("muda", "")
          .replace("troca", "")
          .trim();

        if (rawCategory.length > 0) {
          // Busca a categoria nativa correspondente
          const { bestMatch } = findBestCategory(rawCategory, updated.type);
          updated.category_name = bestMatch || rawCategory;
          return sendConfirmation(res, updated);
        }
      }

      // Usuário mandou só o nome da categoria solto (ex: "Alimentação")
      if (
        text.split(" ").length <= 3 &&
        !["sim", "não", "nao", "ok", "confirmar", "cancelar"].includes(text) &&
        !text.includes("conta") &&
        !text.includes("descrição")
      ) {
        // Tenta ver se é uma categoria válida
        const { bestMatch, score } = findBestCategory(text, updated.type);
        if (score > 0) {
            updated.category_name = bestMatch;
            return sendConfirmation(res, updated);
        }
      }

      // 2.3) MUDAR CONTA
      if (text.includes("conta") || text.includes("carteira") || text.includes("banco")) {
        const newAcc = text
          .replace(/conta|troca|muda|usa|carteira|banco|no|na/g, "")
          .trim();
        if (newAcc.length > 0) {
          updated.account_name = newAcc;
          return sendConfirmation(res, updated);
        }
      }

      // 2.4) MUDAR DESCRIÇÃO
      if (text.includes("descrição") || text.includes("descricao")) {
        const newDesc = text
          .replace(/descrição|descricao|muda|troca|é/g, "")
          .trim();
        if (newDesc.length > 0) {
          updated.description = newDesc;
          return sendConfirmation(res, updated);
        }
      }
    }

    // ======================================================================
    // 3) INTENÇÃO DO USUÁRIO
    // ======================================================================
    const intent = detectIntent(msgLower);

    if (intent.type === "cancel") {
      return res.status(200).json({ reply: "Cancelado 👍", action: "cancelled" });
    }

    if (intent.type === "confirm") {
      if (!pending) return res.status(200).json({ reply: "Nada para confirmar.", action: "message" });
      return res.status(200).json({ reply: "Registrado! 🚀", action: "success", data: pending });
    }

    if (intent.type === "query") {
      return res.status(200).json({ reply: intent.reply, action: intent.action, data: intent.data || {} });
    }

    // ======================================================================
    // 4) EXTRAÇÃO DE NOVA TRANSAÇÃO
    // ======================================================================
    const parsed = extractTransaction(msgLower);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: {
          missing_field: parsed.missingField,
          partial_data: parsed.partial
        }
      });
    }

    return res.status(200).json({
      reply: parsed.confirmation,
      action: "awaiting_confirmation",
      data: parsed.fullData
    });

  } catch (err) {
    console.error("Erro:", err);
    return res.status(500).json({ reply: "Erro técnico 😕", action: "error" });
  }
}

// ======================================================================
// 🧠 LÓGICA DE INTELIGÊNCIA DE CATEGORIAS
// ======================================================================

function findBestCategory(text, type = "expense") {
  // Seleciona a lista certa (despesa ou receita)
  const list = CATEGORY_MAP[type] || CATEGORY_MAP.expense;
  
  let bestMatch = null;
  let maxScore = 0;
  let candidates = [];

  // 1. Normalização
  const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  list.forEach(cat => {
    let score = 0;
    const catName = cat.name.toLowerCase();
    
    // Match Exato no nome
    if (cleanText === catName) score += 100;
    else if (cleanText.includes(catName)) score += 50;

    // Match nas Keywords
    cat.keywords.forEach(word => {
        const cleanWord = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanText.includes(cleanWord)) {
            // Palavras maiores valem mais para evitar falsos positivos curtos
            score += 20 + (cleanWord.length * 2);
        }
    });

    if (score > 0) {
      candidates.push({ name: cat.name, score });
      if (score > maxScore) {
        maxScore = score;
        bestMatch = cat.name;
      }
    }
  });

  // Ordena candidatos por score
  candidates.sort((a, b) => b.score - a.score);

  // Retorna o melhor, e uma lista de top 3 sugestões se houver ambiguidade
  const suggestions = candidates.slice(0, 3).map(c => c.name);

  return { bestMatch, score: maxScore, suggestions };
}

// ======================================================================
// AUXILIARES
// ======================================================================

function sendConfirmation(res, data) {
  // Limpa missing_field para evitar loop
  const responseData = { ...data, missing_field: null };
  return res.status(200).json({
    reply: formatConfirmation(data),
    action: "awaiting_confirmation",
    data: responseData
  });
}

function detectIntent(msg) {
  if (/^(cancelar|cancela|esquece)$/.test(msg)) return { type: "cancel" };
  if (/^(sim|ok|confirmo|tá certo)$/.test(msg)) return { type: "confirm" };
  
  // Queries simples
  if (/saldo/.test(msg)) return { type: "query", action: "query_balance", reply: "Calculando saldo..." };
  if (/gastei hoje/.test(msg)) return { type: "query", action: "query_spent_today", reply: "Vendo gastos de hoje..." };
  
  if (/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi)/.test(msg)) return { type: "transaction" };
  
  return { type: "general" };
}

function extractTransaction(msg) {
  const wallets = globalContext.wallets || [];
  
  // 1. Detectar Tipo
  const type = /(recebi|ganhei|entrou|salario|venda)/.test(msg) ? "income" : "expense";

  // 2. Detectar Valor
  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  // 3. Detectar Frequência
  const isFixed = /(fixo|fixa|mensal|recorrente)/i.test(msg);
  const frequency = isFixed ? "fixed" : "variable";

  // 4. Descrição Limpa
  const description = inferDescription(msg);

  // 5. Detectar Conta
  const account = inferWallet(description, wallets);

  // 6. Detectar Categoria (AI Logic)
  const { bestMatch, suggestions, score } = findBestCategory(description, type);

  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: bestMatch, // Pode ser null se score for baixo
    frequency
  };

  // --- Validações ---

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual o valor de *${description}*? 💰`,
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `De qual conta? 💳\n\n${list || "• Carteira"}`,
      partial
    };
  }

  // Lógica de Ambiguidade da Categoria
  if (!bestMatch) {
    // Se não achou nada ou está confuso, pergunta usando as sugestões
    let replyText = "Qual categoria seria?";
    
    if (suggestions && suggestions.length > 0) {
       replyText = `Qual seria a categoria que melhor se encaixa a esse lançamento?\n\n` + 
                   suggestions.map(s => `• ${s}`).join("\n");
    } else {
        // Fallback genérico se não tiver sugestão
        const genericList = type === 'expense' 
            ? "• Alimentação\n• Transporte\n• Lazer" 
            : "• Salário\n• Extras";
        replyText = `Qual seria a categoria?\n${genericList}`;
    }

    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: replyText,
      partial
    };
  }

  // Se chegou aqui, temos tudo
  return {
    needsMoreInfo: false,
    fullData: partial,
    confirmation: formatConfirmation(partial)
  };
}

function formatConfirmation(data) {
  const amount = Number(data.amount || 0);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description || "-"}
💳 Conta: ${data.account_name || "-"}
📁 Categoria: ${data.category_name || "-"}
_${today}_

Confirma? (Sim/Não)`;
}

function inferDescription(msg) {
  return msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/gi, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .replace(/(fixo|fixa|mensal|recorrente)/gi, "")
    .trim() || "Lançamento";
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;
  const d = desc.toLowerCase();
  const found = wallets.find(w => d.includes(w.name.toLowerCase()));
  return found ? found.name : null;
}
