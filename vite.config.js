import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function productSearchPlugin() {
  const fallbackPrices = term => {
    const lower = term.toLowerCase();
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
    const base = found ? found.price : Math.max(8, Math.min(220, term.length * 4 + 8));
    const variance = [0.92, 0.98, 1.02, 1.08, 1.12];

    return variance.map(f => Math.round(base * f * 100) / 100).map(price => ({
      title: `${term} (estimado)`,
      brand: 'Comparação rápida',
      price,
      store: 'Sugestão',
      thumbnail: '',
      link: ''
    }));
  };

  const handleSearch = async (req, res) => {
    const searchUrl = new URL(req.url || '', 'http://localhost')
    const q = searchUrl.searchParams.get('q')?.trim()

    if (!q) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Query parameter q is required' }))
      return
    }

    try {
      const fetchFn = globalThis.fetch
      if (!fetchFn) {
        throw new Error('Fetch API is not available in this Node version. Use Node 18+ or higher.');
      }
      const response = await fetchFn(`https://dummyjson.com/products/search?q=${encodeURIComponent(q)}`)
      const source = await response.json()
      let items = (source.products || []).slice(0, 5).map(product => ({
        title: product.title,
        brand: product.brand,
        price: product.price,
        store: product.store || 'DummyJSON',
        thumbnail: product.thumbnail,
        link: product.url || `https://dummyjson.com/products/${product.id}`
      }))

      if (!items.length) {
        items = fallbackPrices(q)
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ query: q, items }))
    } catch (error) {
      console.error('Product search API error:', error)
      const items = fallbackPrices(q)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ query: q, items, warning: 'Resultados estimados devido a falta de correspondência direta.' }))
    }
  }

  return {
    name: 'product-search-api',
    configureServer(server) {
      server.middlewares.use('/api/comparar-precos', async (req, res) => {
        await handleSearch(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/comparar-precos', async (req, res) => {
        await handleSearch(req, res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    productSearchPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'OrcaJa',
        short_name: 'OrcaJa',
        description: 'Aplicativo de Orçamentos',
        id: '/',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        lang: 'pt-BR',
        orientation: 'portrait',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
