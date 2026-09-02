import { useEffect, useRef, useState, Suspense, lazy } from 'react'
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Boxes, Users, Sun, Moon, Cookie, Download, Upload, HandCoins, LogIn, LogOut, Lock, AlertTriangle, Percent, ClipboardPaste, ShieldCheck } from 'lucide-react'
import { Product, Sale, Customer, Tab, Pendencia, fmtBRL } from './types'
import { seedProducts, seedCustomers, seedSales, load, save } from './data'
import { baixarBackup, aplicarBackup } from './db'
import { authLoginGoogle, authLogout, authOnChange, firebaseReady } from './sync'
import { PasswordProvider } from './components/PasswordGate'
import { setAuditActor, logAction } from './audit'
import logoUrl from './assets/logo.png'

const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })))
const SalesView = lazy(() => import('./views/Sales').then(m => ({ default: m.SalesView })))
const ProductsView = lazy(() => import('./views/Products').then(m => ({ default: m.ProductsView })))
const ReportsView = lazy(() => import('./views/Reports').then(m => ({ default: m.ReportsView })))
const StockView = lazy(() => import('./views/Stock').then(m => ({ default: m.StockView })))
const CustomersView = lazy(() => import('./views/Customers').then(m => ({ default: m.CustomersView })))
const CobrancaView = lazy(() => import('./views/Cobranca').then(m => ({ default: m.CobrancaView })))
const PerdasView = lazy(() => import('./views/Perdas').then(m => ({ default: m.PerdasView })))
const CustosView = lazy(() => import('./views/Custos').then(m => ({ default: m.CustosView })))
const AuditView = lazy(() => import('./views/Audit').then(m => ({ default: m.AuditView })))
const QuickSaleView = lazy(() => import('./views/QuickSale').then(m => ({ default: m.QuickSaleView })))

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dark, setDark] = useState<boolean>(() => load('cc_theme', false))
  const [products, setProducts] = useState<Product[]>(() => load<Product[]>('cc_products', seedProducts))
  const [sales, setSales] = useState<Sale[]>(() => load<Sale[]>('cc_sales', seedSales))
  const [customers, setCustomers] = useState<Customer[]>(() => load<Customer[]>('cc_customers', seedCustomers))
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([])
  const [user, setUser] = useState<{ email: string | null; name: string | null } | null>(null)
  const [firebaseOn, setFirebaseOn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firebaseReady().then(on => setFirebaseOn(on))
    const unsub = authOnChange(u => {
      setUser(u ? { email: u.email, name: u.displayName } : null)
      setAuditActor(u?.displayName || u?.email || null, u?.email || null)
      setAuthLoading(false)
    })
    return () => unsub()
  }, [])

  const doLogin = async () => {
    try {
      const u = await authLoginGoogle()
      if (u) {
        pushToast(`Olá, ${u.displayName ?? u.email ?? 'funcionário(a)'}! 🍪`)
        logAction('login', `${u.displayName || u.email || 'alguém'} entrou no sistema`)
      }
    } catch (e) {
      const emsg = (e as { code?: string; message?: string }).message || String(e)
      console.error('[login]', e)
      pushToast(`Falha no login: ${emsg}`.slice(0, 120), 'error')
    }
  }

  const doLogout = async () => {
    logAction('login', `${user?.name || user?.email || 'alguém'} saiu do sistema`)
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
    const det = s.items.map(i => `${i.qty}x ${i.name}`).join(' + ')
    const cliente = customers.find(c => c.id === s.customerId)?.name
    logAction('venda', `${det} — ${fmtBRL(s.total)} (${s.status})${cliente ? ` · ${cliente}` : ''}`)
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
    { id: 'venda-rapida', label: 'Venda Rápida', icon: <ClipboardPaste className="icon" /> },
    { id: 'produtos', label: 'Produtos', icon: <Package className="icon" /> },
    { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="icon" /> },
    { id: 'estoque', label: 'Estoque', icon: <Boxes className="icon" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="icon" /> },
    { id: 'cobranca', label: 'Cobrança', icon: <HandCoins className="icon" /> },
    { id: 'perdas', label: 'Perdas', icon: <AlertTriangle className="icon" /> },
    { id: 'custos', label: 'Custos', icon: <Percent className="icon" /> },
    { id: 'audit', label: 'Auditoria', icon: <ShieldCheck className="icon" /> },
  ]

  // Tela de carregamento/verificação de login obrigatório
  if (authLoading) {
    return (
      <div className="login-gate login-loading">
        <img src={logoUrl} alt="Cookie Zookie" className="login-cookie" />
        <div>Cookie Zookie</div>
        <div className="login-sub">Carregando...</div>
      </div>
    )
  }

  // LOGIN OBRIGATÓRIO — sem conta Google autenticada, bloqueia todo o dashboard
  if (!user) {
    return (
      <div className="login-gate">
        <div className="login-gate-card">
          <div className="login-logo"><img src={logoUrl} alt="Cookie Zookie" /></div>
          <h1 className="login-title">Cookie Zookie</h1>
          <div className="login-sub">Banco de Dados · Área restrita</div>
          <p className="login-desc">
            Este painel é privado. Entre com sua conta Google para acessar as informações
            e sincronizar os dados com a equipe.
          </p>
          <button className="login-button" onClick={doLogin}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.09 3.57-5.17 3.57-8.8z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"/>
              <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"/>
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79L20.14 2.98A12 12 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.27 6.88 8.93 4.77 12 4.77z"/>
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <PasswordProvider>
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><img src={logoUrl} alt="Cookie Zookie" /></div>
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
          {tab === 'perdas' && <PerdasView />}
          {tab === 'custos' && <CustosView />}
          {tab === 'audit' && <AuditView />}
          {tab === 'venda-rapida' && <QuickSaleView products={products} customers={customers} onSaleAdded={handleSaleAdded} pushToast={pushToast} />}
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
    </PasswordProvider>
  )
}
