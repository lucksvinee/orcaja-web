const fallbackPrices = (term) => {
  const lower = String(term || '').toLowerCase();
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
  const base = found ? found.price : Math.max(8, Math.min(220, String(term || '').length * 4 + 8));
  const variance = [0.92, 0.98, 1.02, 1.08, 1.12];

  return variance.map(factor => Math.round(base * factor * 100) / 100).map(price => ({
    title: `${term} (estimado)`,
    brand: 'Comparação rápida',
    price,
    store: 'Sugestão',
    thumbnail: '',
    link: ''
  }));
};

export default async function handler(req, res) {
  const q = String(req.query?.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório.' });
  }

  try {
    const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=5`, {
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
      title: item.title,
      brand: item.attributes?.find(attribute => attribute.id === 'BRAND')?.value_name || 'Mercado Livre',
      price: item.price,
      store: item.seller?.nickname || 'Mercado Livre',
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
  }
}
