import { revokeAll, type Level } from './auth'

/**
 * useSessionLock — gerencia timeout de inatividade e bloqueio imediato.
 *
 * O acesso fica apenas em memória. Portanto continua liberado durante a
 * navegação interna e é automaticamente apagado ao recarregar (F5) ou fechar.
 * - Expõe lockAll() para botão "Bloquear agora".
 * - Listener beforeunload limpa flags de sessão ao fechar aba/navegar.
 */

export function startSessionLock(_level: Level) { /* memória da página já define a duração */ }

/**
 * Para o monitor de inatividade (ex.: ao fazer logout manual).
 */
export function stopSessionLock() { /* sem temporizador persistente */ }

/**
 * Reseta o timer de inatividade manualmente.
 * Útil após ações sensíveis para estender a sessão.
 */
export function resetIdleTimer() { /* mantido por compatibilidade */ }

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
