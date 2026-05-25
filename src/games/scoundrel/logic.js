// Barrel re-export. The actual implementation lives in ./logic/*.
// External code (components, tests) imports from './logic' so the
// internal split is invisible to callers.

export {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH, RANK_LABEL,
  BASE_MAX_HP, SIGIL_TARGET, FORGE_SIGILS, ROOM_SIZE,
  isMonster, isWeapon, isPotion, rankLabel, suitColor,
} from './constants'

export { THEMES, getTheme } from './themes'
export { BOONS, getBoon } from './boons'

export { TUTORIAL_LESSONS, tutorialAllLessonsDone } from './logic/helpers'

export {
  buildBaseDeck,
  shuffle,
  computeCurrentDeck,
} from './logic/deck'

export {
  playCard,
  playCardBare,
} from './logic/combat'

export {
  createRun,
  startNewRun,
  descend,
  retireRun,
  fleeRoom,
} from './logic/lifecycle'

export {
  pickBoon,
  openForgeAction,
  closeForgeView,
  skipForge,
  applyStrike,
  applyTransmute,
  applyHeft,
  getStrikeOptions,
  getTransmuteOptions,
  getHeftOptions,
  isWeaponUsableFor,
  previewMonsterDamage,
  getActiveThemesForState,
  describeMaxHp,
  describeWeaponStrength,
  describeDamage,
  describePotion,
  STRIKE_OFFERING_RANGE,
  HEFT_BONUS,
  HEFT_RANK_CAP,
} from './logic/sanctuary'
