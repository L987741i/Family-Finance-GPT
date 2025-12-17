// /api/chat.js — IA Financeira + Family Finance
// VERSÃO FINAL 2025
// ✔ Classificação com IA
// ✔ Categoria obrigatória
// ✔ Descrição inteligente
// ✔ WhatsApp / Lovable Ready

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//
// ======================================================================
// 🔢 NÚMEROS POR EXTENSO (PT-BR)
// ======================================================================
//

const NUMBER_WORDS = {
  zero: 0,
  um: 1, uma: 1,
  dois: 2, duas: 2,
  três: 3, tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14, catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
  mil: 1000
};

function parseNumberFromTextPT(text) {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const value = NUMBER_WORDS[w];
      if (value === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else {
        current += value;
      }
    }
  }

  total += current;
  return found ? total : null;
}

//
// ======================================================================
// 🧠 CATEGORIAS (FONTE DA VERDADE)
// ======================================================================
//

const ALL_CATEGORIES = {
  expense: [
    "Moradia / Aluguel",
    "Moradia / Financiamento / Prestação",
    "Moradia / Condomínio",
    "Moradia / IPTU",
    "Moradia / Reformas e manutenção",
    "Moradia / Limpeza da casa",
    "Moradia / Mobília e decoração",
    "Moradia / Serviços domésticos",

    "Alimentação / Supermercado",
    "Alimentação / Açougue / Peixaria",
    "Alimentação / Hortifruti",
    "Alimentação / Padaria",
    "Alimentação / Delivery",
    "Alimentação / Restaurante / Lanches fora",
    "Alimentação / Água (galão / filtro)",

    "Transporte / Combustível",
    "Transporte / Ônibus / Trem / Metrô",
    "Transporte / Uber / 99",
    "Transporte / Estacionamento",
    "Transporte / Manutenção do veículo",
    "Transporte / Seguro do carro/moto",
    "Transporte / Documentação (IPVA / licenciamento)",

    "Contas Mensais / Energia",
    "Contas Mensais / Água",
    "Contas Mensais / Gás",
    "Contas Mensais / Internet",
    "Contas Mensais / Telefone",
    "Contas Mensais / Streaming",
    "Contas Mensais / Plano de celular",

    "Saúde / Plano de saúde",
    "Saúde / Consulta médica",
    "Saúde / Psicólogo / Terapia",
    "Saúde / Exames",
    "Saúde / Farmácia",
    "Saúde / Dentista",
    "Saúde / Ótica",

    "Educação / Mensalidade escolar",
    "Educação / Material escolar",
    "Educação / Cursos",
    "Educação / Livros",
    "Educação / Transporte escolar",
    "Educação / Faculdade",

    "Lazer / Cinema / Teatro",
    "Lazer / Viagens",
    "Lazer / Piquenique / Passeios",
    "Lazer / Assinaturas de jogos",
    "Lazer / Academia / Esportes",

    "Mercado & Casa / Produtos de higiene",
    "Mercado & Casa / Produtos de limpeza",
    "Mercado & Casa / Descartáveis",
    "Mercado & Casa / Utensílios domésticos",
    "Mercado & Casa / Pequenos reparos",

    "Compras Pessoais / Roupas",
    "Compras Pessoais / Calçados",
    "Compras Pessoais / Acessórios",
    "Compras Pessoais / Cosméticos",
    "Compras Pessoais / Celular / Eletrônicos",
    "Compras Pessoais / Presentes",

    "Família & Filhos / Fraldas",
    "Família & Filhos / Roupa infantil",
    "Família & Filhos / Brinquedos",
    "Família & Filhos / Mesada",
    "Família & Filhos / Saúde infantil",
    "Família & Filhos / Atividades infantis",
    "Família & Filhos / Babá / Cuidador",

    "Trabalho & Negócios / Ferramentas",
    "Trabalho & Negócios / Equipamentos",
    "Trabalho & Negócios / Uniforme",
    "Trabalho & Negócios / Cursos profissionais",
    "Trabalho & Negócios / Materiais de trabalho",

    "Impostos e Documentos / IPVA",
    "Impostos e Documentos / IRPF",
    "Impostos e Documentos / Taxas diversas",
    "Impostos e Documentos / Documentos pessoais",

    "Banco & Tarifas / Tarifas bancárias",
    "Banco & Tarifas / Anuidade cartão",
    "Banco & Tarifas / Juros de cartão",
    "Banco & Tarifas / Multas",

    "Investimentos / Aportes",
    "Investimentos / Tesouro Direto",
    "Investimentos / Renda fixa",
    "Investimentos / Fundos",
    "Investimentos / Cripto",
    "Investimentos / Ações",

    "Doações & Igreja / Dízimo",
    "Doações & Igreja / Oferta",
    "Doações & Igreja / Missões",
    "Doações & Igreja / Ajudas sociais",

    "Animais de Estimação / Ração",
    "Animais de Estimação / Petshop",
    "Animais de Estimação / Veterinário",
    "Animais de Estimação / Medicamentos",

    "Emergências / Saúde",
    "Emergências / Casa",
    "Emergências / Carro",

    "Outros / Outros"
  ],

  income: [
    "Receita / Salário",
    "Receita / Extra",
    "Receita / Freelancer",
    "Receita / Venda",
    "Receita / Empréstimo",
    "Receita / Juros",
    "Receita / Benefícios",
    "Receita / Lanche Escolar"
  ]
};

//
// ======================================================================
// 🤖 CLASSIFICADOR COM IA
// ======================================================================
//

async function classifyWithAI(text, type) {
  const categories = ALL_CATEGORIES[type];

  const prompt = `
Classifique a frase abaixo em UMA das categorias listadas.
Responda SOMENTE com o texto EXATO da categoria.
Não explique. Não crie categorias.

Frase:
"${text}"

Categorias:
${categories.map(c => "- " + c).join("\n")}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });

  const result = response.choices[0].message.content.trim();

  return categories.includes(result)
    ? result
    : type === "expense"
      ? "Outros / Outros"
      : "Receita / Extra";
}

//
// ======================================================================
// 📝 DESCRIÇÃO INTELIGENTE
// ======================================================================
//

function inferDescription(msg, category) {
  if (category && !category.includes("Outros")) {
    return category.split("/")[1].trim();
  }

  let text = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi)/gi, "")
    .replace(/\d+[.,]?\d*/g, "");

  Object.keys(NUMBER_WORDS).forEach(w => {
    text = text.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
  });

  text = text.replace(/\b(por|reais|real|com|de|uma|um|uns|umas)\b/gi, "");
  text = text.replace(/\s+/g, " ").trim();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Lançamento";
}

//
// ======================================================================
// 📦 EXTRAÇÃO DE TRANSAÇÃO
// ======================================================================
//

async function extractTransaction(msg) {
  const type = /(recebi|ganhei|salário|venda|freelancer)/i.test(msg)
    ? "income"
    : "expense";

  const numericMatch = msg.match(/(\d+[.,]?\d*)/);
  let amount = numericMatch
    ? Number(numericMatch[1].replace(",", "."))
    : parseNumberFromTextPT(msg);

  let category = "Outros / Outros";

  if (type === "income") {
    category = await classifyWithAI(msg, "income");
  } else {
    category = await classifyWithAI(msg, "expense");
  }

  const description = inferDescription(msg, category);

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual o valor de *${description}*? 💰`,
      partial: { type, description, category_name: category }
    };
  }

  return {
    needsMoreInfo: false,
    fullData: {
      type,
      amount,
      description,
      category_name: category,
      frequency: "variable"
    }
  };
}

//
// ======================================================================
// 🎯 INTENÇÃO
// ======================================================================
//

function detectIntent(msg) {
  if (/^(sim|ok|confirmo)$/i.test(msg)) return "confirm";
  if (/^(não|nao|cancelar)$/i.test(msg)) return "cancel";
  return "transaction";
}

//
// ======================================================================
// 🚀 HANDLER PRINCIPAL
// ======================================================================
//

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body;
    const msg = message.toLowerCase().trim();
    const pending = context?.pending_transaction || null;

    if (pending) {
      const intent = detectIntent(msg);
      if (intent === "confirm") {
        return res.status(200).json({
          reply: "Registrado com sucesso ✅",
          action: "success",
          data: pending
        });
      }
      if (intent === "cancel") {
        return res.status(200).json({
          reply: "Transação cancelada ❌",
          action: "cancelled"
        });
      }
    }

    const parsed = await extractTransaction(msg);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: parsed.partial
      });
    }

    return res.status(200).json({
      reply: `🔴 ${parsed.fullData.type === "income" ? "Receita" : "Despesa"} | 📅 Variável
💰 Valor: R$ ${parsed.fullData.amount.toFixed(2)}
📝 Descrição: ${parsed.fullData.description}
📁 Categoria: ${parsed.fullData.category_name}

Confirma o lançamento? (Sim/Não)`,
      action: "awaiting_confirmation",
      data: parsed.fullData
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      reply: "Erro interno 😕",
      action: "error"
    });
  }
}
