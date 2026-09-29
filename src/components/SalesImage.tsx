import { useEffect, useRef, useState } from 'react'
import { getApp } from 'firebase/app'
import { SALES_IMAGE_INSTRUCTIONS, salesReadingToText } from '../sales-image-reading'
export function SalesImage({onText, productNames = []}: {onText:(text:string)=>void; productNames?: string[]}) {
  const [photo,setPhoto]=useState(''),[mime,setMime]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[message,setMessage]=useState('')
  const generation=useRef(0), controller=useRef<AbortController | null>(null)
  useEffect(()=>()=>{generation.current++;controller.current?.abort()},[])
  const select = async (file:File) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>10*1024*1024) {setMessage('Use JPG, PNG ou WebP de até 10 MB.');return}
    const version=++generation.current
    try {const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})
      if(version===generation.current){setPhoto(data);setMime(file.type);setResult('');setMessage('Imagem pronta. Confira se todas as linhas estão visíveis.')}} catch {setMessage('Não foi possível abrir a imagem.')}
  }
  const transcribe=async()=>{
    if(busy || !photo)return
    const version=++generation.current; const abort=new AbortController();controller.current=abort; const timer=setTimeout(()=>abort.abort(),45000);setBusy(true);setMessage('Transcrevendo com IA… (limite de 45 segundos)')
    try {
      const {getAI,GoogleAIBackend,getGenerativeModel,Schema}=await import('firebase/ai')
      const schema=Schema.object({properties:{rows:Schema.array({items:Schema.object({properties:{quantity:Schema.string(),product:Schema.string(),customer:Schema.string(),paymentMark:Schema.enumString({enum:['C','D','--','vazio','incerto']}),receivedAmount:Schema.string(),uncertain:Schema.boolean()}})})}})
      const model=getGenerativeModel(getAI(getApp(),{backend:new GoogleAIBackend()}),{model:'gemini-3.5-flash-lite',systemInstruction:SALES_IMAGE_INSTRUCTIONS,generationConfig:{maxOutputTokens:8192,responseMimeType:'application/json',responseSchema:schema}})
      const response=await model.generateContent([{text:`Transcreva as vendas da foto. Catálogo de produtos: ${JSON.stringify(productNames)}. Retorne somente os campos do esquema, preservando todas as linhas.`}, {inlineData:{data:photo.split(',')[1],mimeType:mime}}],{signal:abort.signal})
      if(version!==generation.current)return
      const reading=salesReadingToText(response.response.text().trim())
      setResult(reading.text);setMessage(`${reading.count} linha(s) lida(s); ${reading.uncertain} precisam de conferência. Sem C, a venda fica pendente. Confira nomes, quantidades e recebimentos com a foto antes de usar.`)
    }catch{if(version===generation.current)setMessage(abort.signal.aborted ? 'A leitura foi interrompida ou passou de 45 segundos. Tente uma foto com menos linhas. Seu texto foi preservado.' : 'Não foi possível transcrever agora. Tente novamente em instantes; seu texto foi preservado.')}
    finally{clearTimeout(timer);if(version===generation.current){setBusy(false);controller.current=null}}
  }
  return <details style={{marginBottom:16}}><summary>Transcrever imagem com IA</summary><p>A foto será enviada ao Google Gemini ao clicar em Transcrever. Revise antes de usar; nenhuma venda é salva nesta etapa.</p>
    <label>Selecionar imagem<input aria-label="Imagem das vendas" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void select(file);e.target.value=''}}/></label>
    {photo && <><img src={photo} alt="Caderno de vendas para conferência" style={{display:'block',maxWidth:'100%',maxHeight:500,objectFit:'contain',margin:'12px auto'}}/><button className="btn btn-secondary" disabled={busy} onClick={()=>void transcribe()}>{busy?'Transcrevendo…':'Transcrever com IA'}</button>{busy && <button className="btn btn-ghost" onClick={()=>{generation.current++;controller.current?.abort();setBusy(false);setMessage('Leitura cancelada. Seu texto foi preservado.')}}>Cancelar leitura</button>}</>}
    {message && <p role="status">{message}</p>}
    {result && <><label>Revisar transcrição<textarea aria-label="Transcrição da imagem" rows={12} style={{width:'100%'}} value={result} onChange={e=>setResult(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy || !result.trim()} onClick={()=>{onText(result);setResult('');setMessage('Transcrição adicionada ao texto. Revise e clique em Processar texto.')}}>Adicionar ao texto das vendas</button></>}
  </details>
}
