const MAX_QUERY_LENGTH = 80;
const EXTERNAL_TIMEOUT_MS = 4500;

const sanitizeText = (value, fallback = '', limit = 160) => String(value || fallback).trim().slice(0, limit);

const fallbackPrices = (term) => {
  const safeTerm = sanitizeText(term, 'Item', MAX_QUERY_LENGTH);
  const lower = safeTerm.toLowerCase();
  const mapping = [
    { match: 'chuveiro', price: 249.9 },
    { match: 'cabo', price: 5.95 },
    { match: 'disjuntor', price: 22.5 },
    { match: 'palito', price: 0.85 },
    { match: 'fio', price: 4.4 },
    { match: 'tomada', price: 18.9 },
    { match: 'interruptor', price: 12.9 }
  ];

  const found = mapping.find(item => lower.includes(item.match));
  const base = found ? found.price : Math.max(8, Math.min(220, safeTerm.length * 4 + 8));
  const variance = [0.92, 0.98, 1.02, 1.08, 1.12];

  return variance.map(factor => Math.round(base * factor * 100) / 100).map(price => ({
    title: `${safeTerm} (estimado)`,
    brand: 'Comparação rápida',
    price,
    store: 'Sugestão',
    thumbnail: '',
    link: ''
  }));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const q = String(req.query?.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório.' });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Busca muito longa. Use até ${MAX_QUERY_LENGTH} caracteres.` });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=5`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'OrcaJa/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Mercado Livre respondeu com HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = (data.results || []).slice(0, 5).map(item => ({
      title: sanitizeText(item.title, 'Produto'),
      brand: sanitizeText(item.attributes?.find(attribute => attribute.id === 'BRAND')?.value_name, 'Mercado Livre', 80),
      price: Number(item.price || 0),
      store: sanitizeText(item.seller?.nickname, 'Mercado Livre', 80),
      thumbnail: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : '',
      link: item.permalink || ''
    }));

    return res.status(200).json({
      query: q,
      items: items.length ? items : fallbackPrices(q),
      source: items.length ? 'mercadolivre' : 'fallback'
    });
  } catch (error) {
    console.error('Erro na API comparar-precos:', error);
    return res.status(200).json({
      query: q,
      items: fallbackPrices(q),
      source: 'fallback',
      warning: 'Resultados estimados porque a busca externa falhou.'
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
