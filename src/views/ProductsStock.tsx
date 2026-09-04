import { useState } from 'react'
import { Package, Boxes } from 'lucide-react'
import { Product, Sale } from '../types'
import { ProductsView } from './Products'
import { StockView } from './Stock'

export function ProductsStockView({ products, setProducts, sales, pushToast }: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; sales: Sale[]; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [section, setSection] = useState<'catalogo' | 'estoque'>('catalogo')

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <button className={`btn ${section === 'catalogo' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('catalogo')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Package size={16} /> Catálogo de produtos
        </button>
        <button className={`btn ${section === 'estoque' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('estoque')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Boxes size={16} /> Controle de estoque
        </button>
      </div>
      {section === 'catalogo' ? (
        <ProductsView products={products} setProducts={setProducts} sales={sales} pushToast={pushToast} />
      ) : (
        <StockView products={products} setProducts={setProducts} pushToast={pushToast} />
      )}
    </>
  )
}
