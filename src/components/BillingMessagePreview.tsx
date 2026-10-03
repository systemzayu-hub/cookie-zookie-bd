import { useRef, useState } from 'react'
import { Copy, MessageSquare, X } from 'lucide-react'
import { billingMessage, billingWhatsApp } from '../billing-message'
import type { Customer, Sale } from '../types'
import { Modal } from './Modal'

export function BillingMessagePreview({ customer, sales, onClose, pushToast }: {
  customer: Customer
  sales: Sale[]
  onClose: () => void
  pushToast?: (message: string, type?: 'success' | 'error') => void
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  const [manualCopy, setManualCopy] = useState(false)
  const message = billingMessage(customer.name, sales)
  const whatsappUrl = billingWhatsApp(customer, sales)

  const copy = async () => {
    let copiedByApi = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
        copiedByApi = true
      }
    } catch { copiedByApi = false }
    if (copiedByApi) {
      setCopied(true)
      setManualCopy(false)
      pushToast?.('Mensagem copiada!')
      return
    }
    const textarea = textRef.current
    textarea?.focus()
    textarea?.select()
    setManualCopy(true)
    setCopied(false)
    pushToast?.('A cópia automática não está disponível. A mensagem foi selecionada; use Ctrl+C.', 'error')
  }

  const openWhatsApp = () => {
    if (!whatsappUrl) return
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    pushToast?.('WhatsApp aberto com a mensagem pronta. Revise antes de enviar.')
  }

  return <Modal label={`Prévia da cobrança para ${customer.name}`} onClose={onClose}>
    <div className="cb-message-dialog">
      <div className="modal-header">
        <div>
          <h3>Prévia da cobrança</h3>
          <p className="cb-message-note">Confira o valor e os itens antes de copiar ou abrir o WhatsApp.</p>
        </div>
        <button className="modal-close" aria-label="Fechar prévia" onClick={onClose}><X size={20} /></button>
      </div>
      <label htmlFor="billing-message-preview" className="field-label">Mensagem para {customer.name}</label>
      <textarea id="billing-message-preview" ref={textRef} readOnly value={message} onFocus={event => event.currentTarget.select()} />
      {manualCopy && <p className="cb-message-note" role="status">Mensagem selecionada. Pressione Ctrl+C ou use o menu de cópia.</p>}
      {copied && <p className="cb-message-note" role="status">Mensagem copiada para a área de transferência.</p>}
      {!whatsappUrl && <p className="cb-message-note" role="status">Cadastre um telefone válido com DDD para abrir o WhatsApp.</p>}
      <div className="cb-message-actions">
        <button className="btn btn-secondary" onClick={copy}><Copy size={15} /> Copiar mensagem</button>
        <button className="btn btn-primary" onClick={openWhatsApp} disabled={!whatsappUrl}><MessageSquare size={15} /> Abrir WhatsApp</button>
        <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  </Modal>
}
