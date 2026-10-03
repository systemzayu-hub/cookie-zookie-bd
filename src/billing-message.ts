import { Customer, Sale, fmtBRL, saleOutstanding, salePaidAmount } from './types'

const saleDate = (date: string) => new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const itemSummary = (sale: Sale) => sale.items.map(item => `${item.qty}x ${item.name}${item.paid ? ' (pago)' : ' (pendente)'}`).join(', ')

export function billingMessage(name: string, sales: Sale[]) {
  const pending = sales.filter(s => s.status === 'Pendente' && saleOutstanding(s) > 0)
  const details = pending.map(s => {
    const received = salePaidAmount(s)
    const receivedText = received > 0 ? ` · já recebido ${fmtBRL(received)}` : ''
    return `${saleDate(s.date)}: ${itemSummary(s)} — falta ${fmtBRL(saleOutstanding(s))}${receivedText}`
  })
  const total = pending.reduce((n, s) => n + Math.round(saleOutstanding(s) * 100), 0) / 100
  return `Oi, ${name}! Tudo bem? Confira os valores em aberto dos seus cookies:\n\n${details.join('\n')}\n\nTotal a pagar: ${fmtBRL(total)}.\nOs valores já pagos foram considerados. Se você pagou recentemente, envie o comprovante para conferirmos. Obrigado!`
}

export function billingWhatsApp(customer: Customer, sales: Sale[]) {
  let phone = customer.contact.normalize('NFKC').replace(/\D/g, '')
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (!/^55\d{10,11}$/.test(phone)) return null
  const pending = sales.filter(s => s.customerId === customer.id && s.status === 'Pendente' && saleOutstanding(s) > 0)
  return pending.length ? `https://wa.me/${phone}?text=${encodeURIComponent(billingMessage(customer.name, pending))}` : null
}
