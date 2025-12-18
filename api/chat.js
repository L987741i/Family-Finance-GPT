// /api/chat.js — Family Finance IA
// Ajustado para manter contexto e solicitar dados faltantes

// ======================================================================
// 🎭 PERSONALIDADE & FORMATADORES
// ======================================================================

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatText = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// ======================================================================
// 🧠 PARSERS (NÚMEROS E TEXTO)
// ======================================================================

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100, mil: 1000
  // ... adicione mais se necessário
};

function parseNumberFromTextPT(text) {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0, current = 0, found = false;
  // Lógica simplificada de parser
  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const v = NUMBER_WORDS[w];
      if (v === 1000) { current = (current || 1) * 1000; total += current; current = 0; }
      else current += v;
    }
  }
  return found ? total + current : null;
}

function inferDescription(msg) {
  let t = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|na|no|com|de|para)/gi, "")
    .replace(/\d+[.,]?\d*/g, "") // Remove números
    .replace(/\b(reais|real)\b/gi, "")
    .trim();
  
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Lançamento Geral";
}

// ======================================================================
// 💳 DETECÇÃO DE CONTA E CATEGORIA
// ======================================================================

function detectWallet(msg, wallets = []) {
  const t = msg.toLowerCase();
  // Procura pelo nome exato ou parcial da carteira na mensagem
  return wallets.find(w => t.includes(w.name.toLowerCase())) || null;
}

function askForWallet(wallets) {
  // Lista dinâmica conforme solicitado
  const walletList = wallets.map(w => `• [${w.name}]`).join("\n");
  
  return `De qual conta saiu ou entrou? 💳\n\n${walletList}`;
}

function detectCategoryLocal(msg, categories = []) {
  const t = msg.toLowerCase();
  for (const c of categories) {
    if (t.includes(c.name.toLowerCase())) return c.name;
  }
  return null;
}

// ======================================================================
// ✏️ EDIÇÃO DE CONTEXTO
// ======================================================================

function handleEdit(msg, pending, wallets, categories) {
  const t = msg.toLowerCase();
  let updated = false;

  // Detecta alteração de VALOR
  if (/valor|r\$|reais/.test(t)) {
    const v = parseNumberFromTextPT(t) || Number(t.match(/(\d+[.,]?\d*)/)?.[1]?.replace(",", "."));
    if (v) { pending.amount = v; updated = true; }
  }

  // Detecta alteração de DESCRIÇÃO
  if (/descrição|descricao|nome/.test(t)) {
    // Remove a palavra comando e pega o resto
    const newDesc = t.replace(/.*(descrição|descricao|nome)( é| ser)?/i, "").trim();
    if(newDesc) { pending.description = inferDescription(newDesc); updated = true; }
  }

  // Detecta alteração de CONTA
  if (/conta|carteira|banco/.test(t)) {
    const w = detectWallet(t, wallets);
    if (w) { pending.wallet = w; updated = true; }
  }

  return { pending, updated };
}

// ======================================================================
// 🚀 HANDLER PRINCIPAL
// ======================================================================

export default async function handler(req, res) {
  const { message, context } = req.body;
  const msg = message.toLowerCase().trim();

  // Recupera dados do Contexto (Payload vindo do webhook)
  const wallets = context?.wallets || [];
  // Se você tiver cards separados e quiser buscar neles também, concatene aqui:
  const allAccounts = [...wallets, ...(context?.cards || [])]; 
  const categories = context?.categories || [];
  
  // Verifica se JÁ existe uma transação pendente aguardando info ou confirmação
  let pending = context?.pending_transaction || null;

  // 1. CENÁRIO: USUÁRIO RESPONDENDO A PERGUNTA DA CONTA
  // Se temos dados pendentes mas falta a carteira, e o usuário mandou uma msg
  if (pending && !pending.wallet) {
    const foundWallet = detectWallet(msg, allAccounts);
    
    if (foundWallet) {
      // JUNTAR A INFORMAÇÃO (Merge)
      pending.wallet = foundWallet;
      
      // Agora está completo, pede confirmação
      return res.json({
        reply: buildConfirmationMessage(pending),
        action: "awaiting_confirmation",
        data: { pending_transaction: pending } // Atualiza o contexto
      });
    } else {
      // Usuário respondeu algo que não é conta, insiste na pergunta
      return res.json({
        reply: `Não entendi qual conta usar. 😅\n\n${askForWallet(allAccounts)}`,
        action: "need_wallet",
        data: { pending_transaction: pending } // Mantém o que já tinha
      });
    }
  }

  // 2. CENÁRIO: EDIÇÃO (O usuário quer corrigir algo antes de confirmar)
  // Ex: "O valor é 200" ou "Muda a conta para Nubank"
  if (pending && /(muda|altera|valor|conta|descrição|é na verdade)/i.test(msg)) {
    const { pending: updatedPending, updated } = handleEdit(msg, pending, allAccounts, categories);
    
    if (updated) {
      return res.json({
        reply: `Entendido! Fiz o ajuste. 😉\n\n${buildConfirmationMessage(updatedPending)}`,
        action: "awaiting_confirmation",
        data: { pending_transaction: updatedPending }
      });
    }
  }

  // 3. CENÁRIO: NOVA TRANSAÇÃO (Início da conversa ou novo comando)
  // Se chegou aqui, não é continuação de fluxo (ou o fluxo anterior foi finalizado)

  const type = /(recebi|ganhei|sal[aá]rio|venda|entrada|deposito)/i.test(msg) ? "income" : "expense";
  
  // Extração de Valor
  const numericMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = numericMatch 
    ? Number(numericMatch[1].replace(",", ".")) 
    : parseNumberFromTextPT(msg);

  // Se não achou valor, pode ser apenas um papo aleatório (implementar IA de conversa aqui se quiser)
  if (!amount && !pending) {
     return res.json({ reply: "Olá! Posso te ajudar a registrar gastos ou ganhos. Diga algo como 'Gastei 50 reais na padaria'. 🚀" });
  }

  const description = inferDescription(msg);
  const wallet = detectWallet(msg, allAccounts);
  const category = detectCategoryLocal(msg, categories);

  const newTransaction = {
    type,
    amount,
    description,
    category,
    wallet: wallet || null, // Se não achou, fica null
    frequency: "Variável" // Default conforme pedido
  };

  // 4. VERIFICAÇÃO FINAL: FALTOU ALGO?

  // Faltou Conta?
  if (!newTransaction.wallet) {
    return res.json({
      reply: askForWallet(allAccounts),
      action: "need_wallet", // Sinaliza para o frontend/backend que estamos esperando isso
      data: { pending_transaction: newTransaction } // Salva o estado parcial
    });
  }

  // Tudo certo? Pede confirmação
  return res.json({
    reply: buildConfirmationMessage(newTransaction),
    action: "awaiting_confirmation",
    data: { pending_transaction: newTransaction }
  });
}

// ======================================================================
// 📟 MENSAGEM DE CONFIRMAÇÃO PADRÃO
// ======================================================================

function buildConfirmationMessage(t) {
  const icon = t.type === 'income' ? '🟢' : '🔴';
  
  return `Confirma o lançamento?

${icon} **${t.type === 'income' ? 'Entrada' : 'Saída'}**
💰 Valor: ${formatCurrency(t.amount)}
📝 Descrição: ${formatText(t.description)}
💳 Conta: ${t.wallet?.name || 'Não informada'}
📂 Categoria: ${formatText(t.category || 'Geral')}
📅 Frequência: ${t.frequency}

Responda **Sim** para salvar ou digite o que quer alterar (ex: "valor é 100").`;
}
