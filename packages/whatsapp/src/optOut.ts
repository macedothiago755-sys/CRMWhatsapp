/**
 * Opt-out keyword detection — see docs/whatsapp/whatsapp-architecture.md §1
 * (opt-in/opt-out) and master prompt §12. A small, conservative keyword list;
 * exact-match on the trimmed/normalized body, not substring matching, to
 * avoid false positives on ordinary sentences that happen to contain a
 * keyword (e.g. "posso parar de pagar em 3x?").
 */
const OPT_OUT_KEYWORDS = new Set(["parar", "pare", "cancelar", "sair", "stop", "unsubscribe"]);

export function isOptOutMessage(bodyText: string | undefined): boolean {
  if (!bodyText) return false;
  const normalized = bodyText.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.has(normalized);
}
