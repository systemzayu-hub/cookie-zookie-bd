import { useState } from 'react'
import { Users, HandCoins } from 'lucide-react'
import { Customer, Sale } from '../types'
import { CustomersView } from './Customers'
import { CobrancaView } from './Cobranca'
import { SensitiveData } from '../components/SensitiveData'

export function CustomersBillingView({ customers, setCustomers, sales, setSales, pushToast }: {
  customers: Customer[]; setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>; sales: Sale[]; setSales: React.Dispatch<React.SetStateAction<Sale[]>>; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [section, setSection] = useState<'clientes' | 'cobranca'>('clientes')

  return (
    <SensitiveData label="Clientes e cobrança" level="financial">
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <button className={`btn ${section === 'clientes' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('clientes')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Users size={16} /> Clientes
        </button>
        <button className={`btn ${section === 'cobranca' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('cobranca')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <HandCoins size={16} /> Cobrança
        </button>
      </div>
      {section === 'clientes' ? (
        <CustomersView customers={customers} setCustomers={setCustomers} sales={sales} pushToast={pushToast} />
      ) : (
        <CobrancaView sales={sales} setSales={setSales} customers={customers} pushToast={pushToast} />
      )}
    </SensitiveData>
  )
}
