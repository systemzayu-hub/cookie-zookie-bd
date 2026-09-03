import { useState } from 'react'
import { Percent, AlertTriangle } from 'lucide-react'
import { CustosView } from './Custos'
import { PerdasView } from './Perdas'
import { SensitiveData } from '../components/SensitiveData'

export function FinanceiroView() {
  const [section, setSection] = useState<'custos' | 'perdas'>('custos')

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <button className={`btn ${section === 'custos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('custos')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Percent size={16} /> Custos de produção
        </button>
        <button className={`btn ${section === 'perdas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSection('perdas')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <AlertTriangle size={16} /> Perdas & desperdício
        </button>
      </div>
      <SensitiveData label="Desbloquear dados financeiros">
        {section === 'custos' ? <CustosView /> : <PerdasView />}
      </SensitiveData>
    </>
  )
}
