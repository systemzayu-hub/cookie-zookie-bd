import { revokeAll, type Level } from './auth'

/**
 * useSessionLock — gerencia timeout de inatividade e bloqueio imediato.
 *
 * - Quando a sessão está desbloqueada (qualquer level), inicia timer de 5 min.
 * - Qualquer atividade (mouse/teclado/toque/scroll) reseta o timer.
 * - Ao expirar: revoga todos os levels automaticamente.
 * - Expõe resetIdleTimer() para uso manual (ex.: após ação sensível).
 * - Expõe lockAll() para botão "Bloquear agora".
 * - Listener beforeunload limpa flags de sessão ao fechar aba/navegar.
 */

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos
let idleTimer: ReturnType<typeof setTimeout> | null = null
let isInitialized = false
let currentLevel: Level | null = null

function clearIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
}

function startIdleTimer(level: Level) {
  clearIdleTimer()
  currentLevel = level
  idleTimer = setTimeout(() => {
    // A mesma sessão pode ter liberado mais de uma área. Ao expirar,
    // revoga tudo para não deixar um segundo nível aberto por engano.
    revokeAll()
    currentLevel = null
  }, IDLE_TIMEOUT_MS)
}

function onActivity() {
  if (currentLevel) startIdleTimer(currentLevel)
}

function initGlobalListeners() {
  if (typeof window === 'undefined' || isInitialized) return
  const events = ['mousemove', 'keydown', 'touchstart', 'scroll'] as const
  for (const e of events) window.addEventListener(e, onActivity, { passive: true })
  window.addEventListener('beforeunload', () => { revokeAll() }, { passive: true })
  isInitialized = true
}

/**
 * Inicia/reativa o monitor de inatividade para o level informado.
 * Deve ser chamado quando a sessão for desbloqueada (ex.: no grant bem-sucedido).
 */
export function startSessionLock(level: Level) {
  initGlobalListeners()
  startIdleTimer(level)
}

/**
 * Para o monitor de inatividade (ex.: ao fazer logout manual).
 */
export function stopSessionLock() {
  clearIdleTimer()
  currentLevel = null
}

/**
 * Reseta o timer de inatividade manualmente.
 * Útil após ações sensíveis para estender a sessão.
 */
export function resetIdleTimer() {
  if (currentLevel) startIdleTimer(currentLevel)
}

/**
 * Bloqueia todos os levels imediatamente.
 * Para uso no botão "Bloquear agora".
 */
export function lockAll() {
  stopSessionLock()
  revokeAll()
}

/**
 * Hook React opcional: retorna funções de controle para a UI.
 * useSessionLock() -> { resetIdleTimer, lockAll }
 */
export function useSessionLock() {
  return { resetIdleTimer, lockAll }
}
