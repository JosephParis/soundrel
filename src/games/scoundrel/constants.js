export const HEART = 'H'
export const DIAMOND = 'D'
export const CLUB = 'C'
export const SPADE = 'S'

export const SUIT_GLYPH = { H: '♥', D: '♦', C: '♣', S: '♠' }
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

export const BASE_MAX_HP = 20
export const SIGIL_TARGET = 7
export const FORGE_SIGILS = new Set([2, 4, 6])
export const ROOM_SIZE = 4

export function isMonster(c) { return !!c && (c.suit === CLUB || c.suit === SPADE) }
export function isWeapon(c) { return !!c && c.suit === DIAMOND }
export function isPotion(c) { return !!c && c.suit === HEART }
export function rankLabel(r) { return RANK_LABEL[r] ?? String(r) }
export function suitColor(suit) {
  return (suit === HEART || suit === DIAMOND) ? 'red' : 'black'
}
