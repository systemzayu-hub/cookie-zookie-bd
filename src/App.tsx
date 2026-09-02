import { useEffect, useRef, useState, Suspense, lazy } from 'react'
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Boxes, Users, Sun, Moon, Cookie, Download, Upload, HandCoins, LogIn, LogOut } from 'lucide-react'
import { Product, Sale, Customer, Tab, Pendencia } from './types'
import { seedProducts, seedCustomers, seedSales, load, save } from './data'
import { baixarBackup, aplicarBackup } from './db'
import { authLoginGoogle, authLogout, authOnChange, firebaseReady } from './sync'

const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })))
const SalesView = lazy(() => import('./views/Sales').then(m => ({ default: m.SalesView })))
const ProductsView = lazy(() => import('./views/Products').then(m => ({ default: m.ProductsView })))
const ReportsView = lazy(() => import('./views/Reports').then(m => ({ default: m.ReportsView })))
const StockView = lazy(() => import('./views/Stock').then(m => ({ default: m.StockView })))
const CustomersView = lazy(() => import('./views/Customers').then(m => ({ default: m.CustomersView })))
const CobrancaView = lazy(() => import('./views/Cobranca').then(m => ({ default: m.CobrancaView })))

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dark, setDark] = useState<boolean>(() => load('cc_theme', false))
  const [products, setProducts] = useState<Product[]>(() => load<Product[]>('cc_products', seedProducts))
  const [sales, setSales] = useState<Sale[]>(() => load<Sale[]>('cc_sales', seedSales))
  const [customers, setCustomers] = useState<Customer[]>(() => load<Customer[]>('cc_customers', seedCustomers))
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([])
  const [user, setUser] = useState<{ email: string | null; name: string | null } | null>(null)
  const [firebaseOn, setFirebaseOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firebaseReady().then(on => setFirebaseOn(on))
    const unsub = authOnChange(u => setUser(u ? { email: u.email, name: u.displayName } : null))
    return () => unsub()
  }, [])

  const doLogin = async () => {
    const u = await authLoginGoogle()
    if (u) pushToast(`Olá, ${u.displayName ?? u.email ?? 'funcionário(a)'}! 🍪`)
    else pushToast('Login cancelado ou falhou.', 'error')
  }

  const doLogout = async () => {
    await authLogout()
    pushToast('Você saiu da conta.')
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    save('cc_theme', dark)
  }, [dark])
  useEffect(() => save('cc_products', products), [products])
  useEffect(() => save('cc_sales', sales), [sales])
  useEffect(() => save('cc_customers', customers), [customers])

  const pushToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }

  const handleSaleAdded = (s: Sale) => {
    setSales(prev => [s, ...prev])
    setProducts(prev => prev.map(p => {
      const item = s.items.find(i => i.productId === p.id)
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p
    }))
    pushToast('Venda registrada!')
  }

  const onImport = async (file: File) => {
    try {
      await aplicarBackup(file, (data) => {
        setProducts(data.products)
        setSales(data.sales)
        setCustomers(data.customers)
        pushToast('Backup restaurado com sucesso!')
      })
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  const nav: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="icon" /> },
    { id: 'vendas', label: 'Nova Venda', icon: <ShoppingCart className="icon" /> },
    { id: 'produtos', label: 'Produtos', icon: <Package className="icon" /> },
    { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="icon" /> },
    { id: 'estoque', label: 'Estoque', icon: <Boxes className="icon" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="icon" /> },
    { id: 'cobranca', label: 'Cobrança', icon: <HandCoins className="icon" /> },
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><Cookie size={24} /></div>
          <div>
            <div className="brand-name">Cookie Zookie</div>
            <div className="brand-sub">Banco de Dados</div>
          </div>
        </div>
        {nav.map(n => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            {n.icon} {n.label}
          </button>
        ))}
        <div className="sidebar-footer">
          <div className="auth-box">
            {user ? (
              <>
                <div className="auth-user" title={user.email ?? ''}>
                  <span className="auth-dot" /> {user.name ?? user.email}
                </div>
                <button className="theme-toggle" onClick={doLogout}>
                  <LogOut size={16} /> Sair
                </button>
              </>
            ) : (
              <button className="theme-toggle auth-login" onClick={doLogin}>
                <LogIn size={16} /> Entrar com Google
              </button>
            )}
            {!firebaseOn && (
              <div className="auth-offline">⚠️ sincronização desligada</div>
            )}
          </div>
          <button className="theme-toggle" onClick={() => setDark(d => !d)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Tema claro' : 'Tema escuro'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            <button className="theme-toggle" onClick={() => baixarBackup(products, sales, customers)}>
              <Download size={16} /> Exportar backup
            </button>
            <button className="theme-toggle" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar backup
            </button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={e => {
              const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''
            }} />
          </div>
        </div>
      </aside>

      <main className="main">
        <Suspense fallback={<div className="loading">Carregando...</div>}>
          {tab === 'dashboard' && <Dashboard sales={sales} products={products} customers={customers} onNewSale={() => setTab('vendas')} />}
          {tab === 'vendas' && <SalesView products={products} customers={customers} sales={sales} onSaleAdded={handleSaleAdded} />}
          {tab === 'produtos' && <ProductsView products={products} setProducts={setProducts} pushToast={pushToast} />}
          {tab === 'relatorios' && <ReportsView sales={sales} />}
          {tab === 'estoque' && <StockView products={products} setProducts={setProducts} pushToast={pushToast} />}
          {tab === 'clientes' && <CustomersView customers={customers} setCustomers={setCustomers} sales={sales} pushToast={pushToast} />}
          {tab === 'cobranca' && <CobrancaView />}
        </Suspense>
      </main>

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type === 'success' ? 'toast-success' : 'toast-error'}`}>
              {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
