import { Customer, Sale, fmtBRL, saleOutstanding } from './types'
export function billingMessage(name: string, sales: Sale[]) {
 const pending=sales.filter(s=>s.status==='Pendente' && saleOutstanding(s)>0)
 const details=pending.map(s=>`${new Date(s.date).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}: ${s.items.map(i=>`${i.qty}x ${i.name}`).join(', ')} — falta ${fmtBRL(saleOutstanding(s))}`)
 const total=pending.reduce((n,s)=>n+Math.round(saleOutstanding(s)*100),0)/100
 return `Oi, ${name}! Tudo bem? Aqui é da Cookie Zookie. Ficou este valor em aberto dos seus cookies:

${details.join('\n')}

Total a pagar: ${fmtBRL(total)}.
Você consegue me dizer quando pode fazer o pagamento? Se já pagou, pode me enviar o comprovante para eu conferir? Obrigado!`
}
export function billingWhatsApp(customer: Customer, sales: Sale[]) {
 let phone=customer.contact.normalize('NFKC').replace(/\D/g,'')
 if(phone.length===10 || phone.length===11)phone='55'+phone
 if(!/^55\d{10,11}$/.test(phone))return null
 const pending=sales.filter(s=>s.customerId===customer.id && s.status==='Pendente' && saleOutstanding(s)>0)
 return pending.length ? `https://wa.me/${phone}?text=${encodeURIComponent(billingMessage(customer.name,pending))}` : null
}
