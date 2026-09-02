/* ================= TIPOS ================= */
export type Product = { id: string; name: string; price: number; category: string; stock: number; emoji?: string }
export type SaleItem = { productId: string; qty: number }
export type SaleItemFull = { productId: string; name: string; qty: number; unitPrice: number }
export type Sale = {
  id: string; date: string; items: SaleItemFull[];
  payment: 'dinheiro' | 'cartão' | 'pix'; total: number; channel: 'loja' | 'delivery' | 'encomenda'; customerId?: string;
  status?: 'Pago' | 'Pendente' | 'Debitado' | 'Presente'
}
export type Customer = { id: string; name: string; contact: string; createdAt: string }
export type Pendencia = { nome: string; qtd: number; total: number; produtos: string; telefone: string; instagram: string; pago: boolean; pagoEm?: string }
export type Tab = 'dashboard' | 'vendas' | 'produtos' | 'relatorios' | 'estoque' | 'clientes' | 'cobranca'

export const CHANNELS: Sale['channel'][] = ['loja', 'delivery', 'encomenda']
export const PAYMENTS: Sale['payment'][] = ['dinheiro', 'cartão', 'pix']
export const CATEGORIES = ['tradicional', 'especial', 'sazonal']
export const CAT_LABEL: Record<string, string> = { tradicional: 'Tradicional', especial: 'Especial', sazonal: 'Sazonal' }
export const LOW_STOCK_THRESHOLD = 10

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
