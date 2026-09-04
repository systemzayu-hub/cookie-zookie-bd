import { useEffect, useRef, useState, Suspense, lazy } from 'react'
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Users, Sun, Moon, Download, Upload, LogIn, LogOut, Lock, Percent, ShieldCheck, Menu, X, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { Product, Sale, Customer, Tab, Pendencia, fmtBRL } from './types'
import { seedProducts, seedCustomers, seedSales, load, save, STORAGE_ERROR_EVENT } from './data'
import { baixarBackup, aplicarBackup } from './db'
import { authLoginGoogle, authLogout, authOnChange, authReauthenticateGoogle, firebaseReady, onRemoteChanges, syncPull, syncPush, importCustomerContacts } from './sync'
import { PasswordProvider } from './components/PasswordGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setAuditActor, logAction } from './audit'
import { lockAll } from './useSessionLock'
import { validateCustomers, validateProducts, validateSales } from './validation'
import logoUrl from './assets/logo.png'

const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })))
const SalesView = lazy(() => import('./views/Sales').then(m => ({ default: m.SalesView })))
const ProductsStockView = lazy(() => import('./views/ProductsStock').then(m => ({ default: m.ProductsStockView })))
const ReportsView = lazy(() => import('./views/Reports').then(m => ({ default: m.ReportsView })))
const CustomersBillingView = lazy(() => import('./views/CustomersBilling').then(m => ({ default: m.CustomersBillingView })))
const FinanceiroView = lazy(() => import('./views/Financeiro').then(m => ({ default: m.FinanceiroView })))
const AuditView = lazy(() => import('./views/Audit').then(m => ({ default: m.AuditView })))

export default function App() {
  const tabs: Tab[] = ['dashboard', 'vendas', 'produtos', 'relatorios', 'clientes', 'financeiro', 'audit']
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.slice(1) as Tab
    return tabs.includes(hash) ? hash : 'dashboard'
  })
  const [dark, setDark] = useState<boolean>(() => load('cc_theme', false))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>(() => validateProducts(load<unknown[]>('cc_products', seedProducts)) ?? seedProducts)
  const [sales, setSales] = useState<Sale[]>(() => validateSales(load<unknown[]>('cc_sales', seedSales)) ?? seedSales)
  const [customers, setCustomers] = useState<Customer[]>(() => validateCustomers(load<unknown[]>('cc_customers', seedCustomers)) ?? seedCustomers)
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([])
  const [user, setUser] = useState<{ email: string | null; name: string | null } | null>(null)
  const [firebaseOn, setFirebaseOn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncState, setSyncState] = useState<'offline' | 'syncing' | 'synced' | 'error'>('offline')
  const [online, setOnline] = useState(navigator.onLine)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const remoteHydrated = useRef(false)
  const skipNextPush = useRef(false)
  const importingContacts = useRef(false)

  useEffect(() => {
    let active = true
    let unsub = () => {}
    void firebaseReady().then(on => {
      if (!active) return
      setFirebaseOn(on)
      if (!on) { setSyncState('error'); setAuthLoading(false); return }
      unsub = authOnChange(u => {
        setUser(u ? { email: u.email, name: u.displayName } : null)
        setAuditActor(u?.displayName || u?.email || null, u?.email || null)
        setAuthLoading(false)
        if (u) {
          try { logAction('login', `${u.displayName || u.email || 'alguém'} entrou no sistema`) }
          catch { /* auditoria é best-effort */ }
        }
      })
    })
    return () => { active = false; unsub() }
  }, [])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${tab}`)
  }, [tab])

  // Firestore é a fonte compartilhada; o estado local continua como fallback offline.
  useEffect(() => {
    if (!user) { remoteHydrated.current = false; return }
    let active = true
    let unsubscribeRemote = () => {}
    void (async () => {
      setSyncState('syncing')
      const remote = await syncPull()
      if (!active) return
      if (remote) {
        skipNextPush.current = true
        setProducts(remote.products)
        setSales(remote.sales)
        setCustomers(remote.customers)
      }
      if (!active) return
      remoteHydrated.current = true
      setSyncState(remote ? 'synced' : 'offline')
      unsubscribeRemote = onRemoteChanges(data => {
        if (!active) return
        skipNextPush.current = true
        setProducts(data.products)
        setSales(data.sales)
        setCustomers(data.customers)
        setSyncState('synced')
      }, () => setSyncState(navigator.onLine ? 'error' : 'offline'))
    })()
    return () => { active = false; remoteHydrated.current = false; unsubscribeRemote() }
  }, [user?.email])

  const doLogin = async () => {
    try {
      const u = await authLoginGoogle()
      if (u) {
        pushToast(`Olá, ${u.displayName ?? u.email ?? 'funcionário(a)'}! 🍪`)
        // login é registrado na auditoria pelo authOnChange (evita duplicar)
      }
    } catch (e) {
      const code = (e as { code?: string }).code || ''
      console.error('[login]', e)
      const message = code.includes('popup-closed') || code.includes('cancelled')
        ? 'Login cancelado.'
        : code.includes('unauthorized-domain')
          ? 'Este endereço ainda não foi autorizado no Firebase.'
          : 'Não foi possível entrar com Google. Tente novamente.'
      pushToast(message, 'error')
    }
  }

  const doLogout = async () => {
    logAction('login', `${user?.name || user?.email || 'alguém'} saiu do sistema`)
    lockAll()
    await authLogout()
    pushToast('Você saiu da conta.')
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    save('cc_theme', dark)
  }, [dark])
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    const sidebar = sidebarRef.current
    const mobile = window.matchMedia('(max-width: 768px)').matches
    if (sidebar && mobile && !isMenuOpen) sidebar.setAttribute('inert', '')
    else sidebar?.removeAttribute('inert')
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen || !sidebarRef.current) return
    const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)'))
    focusable[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  useEffect(() => { save('cc_products', products) }, [products])
  useEffect(() => { save('cc_sales', sales) }, [sales])
  useEffect(() => { save('cc_customers', customers) }, [customers])
  useEffect(() => {
    if (!user || !remoteHydrated.current) return
    if (skipNextPush.current) { skipNextPush.current = false; return }
    setSyncState('syncing')
    const timer = window.setTimeout(() => {
      void syncPush(products, sales, customers).then(ok => {
        setSyncState(ok ? 'synced' : (navigator.onLine ? 'error' : 'offline'))
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [products, sales, customers, user])

  useEffect(() => {
    const onStorageError = () => pushToast('Não foi possível salvar neste aparelho. Verifique o espaço do navegador.', 'error')
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError)
  }, [])

  useEffect(() => {
    const importContacts = (event: Event) => {
      if (importingContacts.current || load('cc_contacts_import_v2_done', false)) return
      const contacts = (event as CustomEvent<Record<string, string>>).detail
      importingContacts.current = true
      void importCustomerContacts(contacts).then(result => {
        if (!result.missing.length) save('cc_contacts_import_v2_done', true)
        if (result.updated) {
          logAction('cliente', `Atualizou ${result.updated} telefone(s) de clientes cadastrados`)
          pushToast(`${result.updated} WhatsApp(s) salvo(s) no banco.`)
        }
        if (result.missing.length) pushToast(`Confira os nomes cadastrados: ${result.missing.join(', ')}.`, 'error')
      }).catch(() => {
        pushToast('WhatsApps não foram salvos. Confira a conexão e desbloqueie novamente para tentar.', 'error')
      }).finally(() => { importingContacts.current = false })
    }
    window.addEventListener('cookie-zookie:contact-import', importContacts)
    return () => window.removeEventListener('cookie-zookie:contact-import', importContacts)
  }, [])

  const pushToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }

  const handleSaleAdded = (s: Sale) => {
    setSales(prev => [s, ...prev])
    setProducts(prev => prev.map(p => {
      const quantity = s.items.filter(i => i.productId === p.id).reduce((total, item) => total + item.qty, 0)
      return quantity ? { ...p, stock: Math.max(0, p.stock - quantity) } : p
    }))
    const det = s.items.map(i => `${i.qty}x ${i.name}`).join(' + ')
    const cliente = customers.find(c => c.id === s.customerId)?.name
    logAction('venda', `${det} — ${fmtBRL(s.total)} (${s.status})${cliente ? ` · ${cliente}` : ''}`)
    pushToast('Venda registrada!')
  }

  const handleCustomersAdded = (newCustomers: Customer[]) => {
    if (newCustomers.length === 0) return
    setCustomers(previous => {
      const existing = new Set(previous.map(customer => customer.id))
      return [...previous, ...newCustomers.filter(customer => !existing.has(customer.id))]
    })
  }

  const onImport = async (file: File) => {
    try {
      await authReauthenticateGoogle()
      await aplicarBackup(file, (data) => {
        setProducts(data.products)
        setSales(data.sales)
        setCustomers(data.customers)
        logAction('backup', `Restaurou backup com ${data.sales.length} vendas, ${data.customers.length} clientes e ${data.products.length} produtos`)
        pushToast('Backup restaurado com sucesso!')
      })
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  const exportBackup = async () => {
    try {
      await authReauthenticateGoogle()
      baixarBackup(products, sales, customers)
      logAction('backup', 'Exportou um backup completo do painel')
      pushToast('Backup exportado com segurança.')
    } catch {
      pushToast('Confirmação Google cancelada. O backup não foi exportado.', 'error')
    }
  }

  const nav: { id: Tab; label: string; icon: React.ReactNode }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="icon" /> },
      { id: 'vendas', label: 'Vendas', icon: <ShoppingCart className="icon" /> },
      { id: 'produtos', label: 'Produtos & Estoque', icon: <Package className="icon" /> },
      { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="icon" /> },
      { id: 'clientes', label: 'Clientes & Cobrança', icon: <Users className="icon" /> },
      { id: 'financeiro', label: 'Financeiro', icon: <Percent className="icon" /> },
      { id: 'audit', label: 'Auditoria', icon: <ShieldCheck className="icon" /> },
    ]

  // Tela de carregamento/verificação de login obrigatório
  if (authLoading) {
    return (
      <div className="login-gate login-loading">
        <img src={logoUrl} alt="Cookie Zookie" className="login-cookie" />
        <div>Cookie Zookie</div>
        <div className="login-sub" role="status">Carregando…</div>
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
        <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
        <button ref={menuButtonRef} className={`menu-toggle ${isMenuOpen ? 'is-open' : ''}`} aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={isMenuOpen} aria-controls="main-navigation" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                          {isMenuOpen ? <X className="icon" /> : <Menu className="icon" />}
                        </button>
        <div className={`sidebar-overlay ${isMenuOpen ? 'open' : ''}`} aria-hidden="true" onClick={() => setIsMenuOpen(false)} />
        <aside ref={sidebarRef} id="main-navigation" className={`sidebar ${isMenuOpen ? 'open' : ''}`} aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-logo"><img src={logoUrl} alt="Cookie Zookie" /></div>
          <div>
            <div className="brand-name">Cookie Zookie</div>
            <div className="brand-sub">Banco de Dados</div>
          </div>
        </div>
        <nav className="sidebar-nav">
                  {nav.map(n => (
                    <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} aria-current={tab === n.id ? 'page' : undefined} onClick={() => { setTab(n.id); setIsMenuOpen(false); }}>
                      {n.icon} {n.label}
                    </button>
                  ))}
                </nav>
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
            {firebaseOn && (
              <div className={`sync-status sync-${!online ? 'offline' : syncState}`} role="status" aria-live="polite">
                {!online || syncState === 'offline' ? <CloudOff size={14} /> : syncState === 'syncing' ? <RefreshCw size={14} className="spin" /> : <Cloud size={14} />}
                {!online || syncState === 'offline' ? 'Offline · salvo neste aparelho' : syncState === 'syncing' ? 'Sincronizando…' : syncState === 'error' ? 'Falha na sincronização' : 'Sincronizado com a equipe'}
              </div>
            )}
          </div>
          <button className="theme-toggle" onClick={() => setDark(d => !d)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button className="theme-toggle" onClick={() => { lockAll(); pushToast('Áreas sensíveis bloqueadas.') }}>
            <Lock size={16} /> Bloquear áreas sensíveis
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            <button className="theme-toggle" onClick={() => void exportBackup()}>
              <Download size={16} /> Exportar backup
            </button>
            <button className="theme-toggle" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => {
              const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ''
            }} />
          </div>
        </div>
      </aside>

      <main id="main-content" className="main" tabIndex={-1}>
        <ErrorBoundary>
        <Suspense fallback={<div className="loading" role="status">Carregando tela…</div>}>
          {tab === 'dashboard' && <Dashboard sales={sales} products={products} customers={customers} onNewSale={() => setTab('vendas')} />}
          {tab === 'vendas' && <SalesView products={products} customers={customers} sales={sales} onSaleAdded={handleSaleAdded} onCustomersAdded={handleCustomersAdded} pushToast={pushToast} />}
          {tab === 'produtos' && <ProductsStockView products={products} setProducts={setProducts} sales={sales} pushToast={pushToast} />}
          {tab === 'relatorios' && <ReportsView sales={sales} />}
          {tab === 'clientes' && <CustomersBillingView customers={customers} setCustomers={setCustomers} sales={sales} setSales={setSales} pushToast={pushToast} />}
          {tab === 'financeiro' && <FinanceiroView />}
          {tab === 'audit' && <AuditView />}
        </Suspense>
        </ErrorBoundary>
      </main>

      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type === 'success' ? 'toast-success' : 'toast-error'}`} role={t.type === 'error' ? 'alert' : 'status'}>
              {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
          ))}
        </div>
      )}
      </div>
    </PasswordProvider>
  )
}
