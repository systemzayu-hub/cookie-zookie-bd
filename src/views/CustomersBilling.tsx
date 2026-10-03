import type { CustomerMerge } from '../combine-customers'
import { useState } from 'react'
import { Users, HandCoins } from 'lucide-react'
import type { Customer, Sale } from '../types'
import { CustomersView } from './Customers'
import { CobrancaView } from './Cobranca'
import { SensitiveData } from '../components/SensitiveData'
import type { CustomerPayment, SaleTransfer } from '../sale-adjustments'
import '../customer-billing.css'

type PaymentRequest = CustomerPayment & { payment: Sale['payment']; date: string; receiptId: string; saleId?: string }

export function CustomersBillingView({ customers, setCustomers, sales, setSales: _setSales, pushToast, onCustomersCombined, onCustomerPayment, onSaleTransfer }: {
  onCustomerPayment: (request: PaymentRequest) => boolean | Promise<boolean>
  onSaleTransfer: (request: SaleTransfer) => boolean
  onCustomersCombined: (request: CustomerMerge) => boolean | Promise<boolean>
  customers: Customer[]
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  sales: Sale[]
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>
  pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [section, setSection] = useState<'clientes' | 'cobranca'>('clientes')

  return <SensitiveData label="Clientes e cobrança" level="financial">
    <div className="customer-billing-view">
      <div className="cb-section-switcher" role="tablist" aria-label="Área de clientes e cobrança">
        <button role="tab" aria-selected={section === 'clientes'} className={`btn ${section === 'clientes' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('clientes')}><Users size={16} /> Clientes</button>
        <button role="tab" aria-selected={section === 'cobranca'} className={`btn ${section === 'cobranca' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('cobranca')}><HandCoins size={16} /> Cobrança</button>
      </div>
      {section === 'clientes' ? <CustomersView onCustomersCombined={onCustomersCombined} onSaleTransfer={onSaleTransfer} customers={customers} setCustomers={setCustomers} sales={sales} pushToast={pushToast} /> : <CobrancaView sales={sales} setSales={_setSales} customers={customers} setCustomers={setCustomers} pushToast={pushToast} onCustomerPayment={onCustomerPayment} onSaleTransfer={onSaleTransfer} />}
    </div>
  </SensitiveData>
}
