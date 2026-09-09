import { IngredientPurchase, IngredientUnit, normalizedPrice, purchaseDue, purchaseTotal } from '../ingredients'
import { fmtBRL } from '../types'
export type PurchaseDraft = IngredientPurchase & { text: string; editingBefore?: IngredientPurchase }
export function PurchaseEditor({ draft, change, busy, onSave, onClose, onPhoto, onProcess, ignored }: {
  draft: PurchaseDraft; change: (draft: PurchaseDraft) => void; busy: boolean; onSave: () => void; onClose: () => void
  onPhoto: (file: File) => void; onProcess: () => void; ignored: string[]
}) {
  const patch = (part: Partial<PurchaseDraft>) => change({ ...draft, ...part })
  const total = purchaseTotal(draft)
  return <section className="purchase-editor" aria-label={draft.editingBefore ? 'Editar compra' : 'Nova compra'}>
    <div className="purchase-section-heading"><h2>{draft.editingBefore ? 'Editar compra' : 'Nova compra'}</h2><button className="btn btn-ghost" disabled={busy} onClick={onClose}>Fechar · manter rascunho</button></div>
    <fieldset disabled={busy}>
      <div className="purchase-fields"><label>Data da compra<input type="date" required value={draft.date} onChange={e => patch({ date: e.target.value })} /></label><label>Local / estabelecimento<input value={draft.shop} maxLength={200} placeholder="Ex.: Mercado X" onChange={e => patch({ shop: e.target.value })} /></label></div>
      <details className="purchase-import" open={!draft.items.length || undefined}><summary>Adicionar pela foto ou pelo texto</summary>
        <label className="purchase-upload">Foto da nota<input aria-label="Foto da nota" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} /></label>
        <label>Produtos e valores<textarea rows={4} value={draft.text} placeholder={'Farinha - 12,50\n2 caixas de leite - 11,00'} onChange={e => patch({ text: e.target.value })} /></label>
        <div className="purchase-section-heading"><small>Um produto por linha; o último valor é o total da linha, incluindo todas as unidades.</small><button className="btn btn-secondary" onClick={onProcess}>Preparar itens</button></div>
        {ignored.length > 0 && <details><summary>{ignored.length} linhas não incluídas · conferir</summary><pre>{ignored.join('\n')}</pre></details>}
      </details>
      {draft.photo && <details><summary>Nota anexada</summary><img className="receipt-photo" src={draft.photo} alt="Nota anexada à compra" /><button className="btn btn-ghost" onClick={() => patch({ photo: undefined })}>Remover foto</button></details>}
      <div className="purchase-section-heading"><h3>Produtos</h3><button className="btn btn-secondary" onClick={() => patch({ items: [...draft.items, { name: '', total: 0 }] })}>+ Adicionar produto</button></div>
      {draft.items.length === 0 && <p className="purchase-muted">Adicione um produto ou leia uma nota para começar.</p>}
      {draft.items.map((item, index) => {
        const updateItem = (part: Partial<typeof item>) => patch({ items: draft.items.map((i,n) => n === index ? { ...i, ...part } : i) })
        const normalized = normalizedPrice(item)
        return <div className="purchase-item-editor" key={index}>
          <div className="purchase-item-main"><label>Produto {index + 1}<input value={item.name} maxLength={500} onChange={e => updateItem({ name: e.target.value })} /></label><label>Total da linha (R$)<input aria-label={`Total do produto ${index + 1}`} type="number" min="0.01" max="1000000" step="0.01" value={item.total || ''} onChange={e => updateItem({ total: Number(e.target.value) })} /></label><button className="btn btn-ghost" aria-label={`Remover produto ${index + 1}`} onClick={() => patch({ items: draft.items.filter((_,n) => n !== index) })}>Remover</button></div>
          <details><summary>Quantidade / embalagem {normalized ? `· ${fmtBRL(normalized.value)}/${normalized.unit}` : '· opcional, para comparar preços'}</summary>
            <div className="purchase-fields purchase-package"><label>Quantidade de embalagens<input aria-label={`Embalagens do produto ${index + 1}`} type="number" min="0.001" step="any" value={item.quantity ?? ''} placeholder="Ex.: 2" onChange={e => updateItem({ quantity: e.target.value ? Number(e.target.value) : undefined })} /></label><label>Conteúdo de cada embalagem<input aria-label={`Conteúdo do produto ${index + 1}`} type="number" min="0.001" step="any" value={item.packageSize ?? ''} placeholder="Ex.: 500" onChange={e => updateItem({ packageSize: e.target.value ? Number(e.target.value) : undefined })} /></label><label>Unidade<select aria-label={`Unidade do produto ${index + 1}`} value={item.unit || ''} onChange={e => updateItem({ unit: (e.target.value || undefined) as IngredientUnit | undefined })}><option value="">Não informada</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">litro</option><option value="un">unidade</option></select></label></div>
            <small>Ex.: 2 pacotes de 500 g = 1 kg no total. Para itens avulsos, use quantidade × 1 unidade.</small>
          </details>
        </div>
      })}
      <div className="purchase-payment"><div className="purchase-fields"><label>Situação do pagamento<select value={draft.paymentStatus || 'paid'} onChange={e => patch({ paymentStatus: e.target.value as 'paid' | 'pending', paidAmount: undefined, paidAt: undefined })}><option value="paid">✓ Pago</option><option value="pending">○ A pagar</option></select></label><div className="purchase-editor-total"><small>Total da compra</small><strong>{fmtBRL(total)}</strong></div></div>
        {draft.paymentStatus === 'pending' && <><div className="purchase-fields"><label>Para quem devo<input value={draft.creditor || ''} placeholder={draft.shop || 'Local ou pessoa'} maxLength={200} onChange={e => patch({ creditor: e.target.value })} /></label><label>Valor ainda devido (R$)<input type="number" min="0" max={total} step="0.01" value={purchaseDue(draft)} onChange={e => { const due = Number(e.target.value); patch({ paidAmount: Math.round((total - due) * 100) / 100 }) }} /></label><label>Vencimento (opcional)<input type="date" value={draft.dueDate || ''} onChange={e => patch({ dueDate: e.target.value })} /></label></div><small>Se parte já foi paga, informe somente o que falta. O restante entra em “Total pago”.</small></>}
        <details open={draft.note ? true : undefined}><summary>Observação (opcional)</summary><textarea aria-label="Observação da compra" value={draft.note || ''} rows={2} maxLength={2000} onChange={e => patch({ note: e.target.value })} /></details>
      </div>
      <div className="purchase-section-heading"><small>Confira produtos e valores da nota antes de salvar.</small><button className="btn btn-primary" disabled={!draft.items.length} onClick={onSave}>{draft.editingBefore ? 'Salvar alterações' : 'Salvar compra'}</button></div>
    </fieldset>
  </section>
}
