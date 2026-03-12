import { describe, it, expect } from 'vitest'
import type { Game, AtBat, Pitch, Batter, Pitcher } from '../types'
import {
  getPitchStatsByType,
  getBatterLastAtBat,
  getCurrentCount,
  formatAtBatResult,
  getOutsFromResult,
  getTotalOuts,
  getOutsInInning,
  getInningsPitched,
  getWalks,
  getHits,
  getWHIP,
  getFirstPitchStrikePct,
  getSwingAndMissRateByType,
  getBAA,
  getPitchesPerBatter,
  formatPitchSequence,
} from './stats'

function createPitcher(overrides?: Partial<Pitcher>): Pitcher {
  return { id: 'p1', name: 'Test Pitcher', ...overrides }
}

function createBatter(overrides?: Partial<Batter>): Batter {
  return { id: 'b1', name: 'Test Batter', ...overrides }
}

function createPitch(overrides: Partial<Pitch>): Pitch {
  return {
    id: 'p1',
    gameId: 'g1',
    atBatId: 'ab1',
    pitchType: 'fastball',
    result: 'ball',
    sequenceIndex: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function createAtBat(overrides: Partial<AtBat>): AtBat {
  return {
    id: 'ab1',
    gameId: 'g1',
    batterId: 'b1',
    batter: createBatter(),
    pitcherId: 'p1',
    inning: 1,
    isTopInning: true,
    pitches: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function createGame(overrides?: Partial<Game>): Game {
  return {
    id: 'g1',
    date: '2025-01-15',
    opponent: 'Opponent',
    pitcherId: 'p1',
    pitcher: createPitcher(),
    isComplete: false,
    atBats: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('getPitchStatsByType', () => {
  it('returns zeros for empty game', () => {
    const game = createGame()
    const stats = getPitchStatsByType(game)
    expect(stats.fastball).toEqual({ thrown: 0, strikes: 0, balls: 0, contact: 0 })
  })

  it('counts pitches by type and result', () => {
    const game = createGame({
      atBats: [
        createAtBat({
          pitches: [
            createPitch({ pitchType: 'fastball', result: 'whiff' }),
            createPitch({ pitchType: 'fastball', result: 'ball' }),
            createPitch({ pitchType: 'slider', result: 'in_play' }),
          ],
        }),
      ],
    })
    const stats = getPitchStatsByType(game)
    expect(stats.fastball).toEqual({ thrown: 2, strikes: 1, balls: 1, contact: 0 })
    expect(stats.slider).toEqual({ thrown: 1, strikes: 0, balls: 0, contact: 1 })
  })
})

describe('getBatterLastAtBat', () => {
  it('returns undefined when no previous at-bats', () => {
    const game = createGame()
    const result = getBatterLastAtBat(game, { name: 'Batter', jerseyNumber: '1' })
    expect(result).toBeUndefined()
  })

  it('returns most recent at-bat for same batter, excluding current', () => {
    const batter = createBatter({ name: 'Smith', jerseyNumber: '5' })
    const atBat1 = createAtBat({ id: 'ab1', batter, result: 'out' })
    const atBat2 = createAtBat({ id: 'ab2', batter, result: 'hit' })
    const game = createGame({ atBats: [atBat1, atBat2] })
    const result = getBatterLastAtBat(game, { name: 'Smith', jerseyNumber: '5' }, 'ab2')
    expect(result?.id).toBe('ab1')
  })
})

describe('getCurrentCount', () => {
  it('returns 0-0 for no pitches', () => {
    const atBat = createAtBat({ pitches: [] })
    expect(getCurrentCount(atBat)).toEqual({ balls: 0, strikes: 0 })
  })

  it('counts balls and strikes correctly', () => {
    const atBat = createAtBat({
      pitches: [
        createPitch({ result: 'ball' }),
        createPitch({ result: 'ball' }),
        createPitch({ result: 'whiff' }),
      ],
    })
    expect(getCurrentCount(atBat)).toEqual({ balls: 2, strikes: 1 })
  })
})

describe('formatAtBatResult', () => {
  it('returns — for undefined', () => {
    expect(formatAtBatResult(undefined)).toBe('—')
  })

  it('formats known results', () => {
    expect(formatAtBatResult('strikeout')).toBe('K')
    expect(formatAtBatResult('walk')).toBe('BB')
    expect(formatAtBatResult('hit')).toBe('Hit')
  })
})

describe('getOutsFromResult', () => {
  it('returns 1 for out and strikeout', () => {
    expect(getOutsFromResult('out')).toBe(1)
    expect(getOutsFromResult('strikeout')).toBe(1)
  })

  it('returns 0 for other results', () => {
    expect(getOutsFromResult('walk')).toBe(0)
    expect(getOutsFromResult('hit')).toBe(0)
  })
})

describe('getTotalOuts', () => {
  it('sums outs from all at-bats', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'strikeout' }),
        createAtBat({ result: 'walk' }),
      ],
    })
    expect(getTotalOuts(game)).toBe(2)
  })
})

describe('getOutsInInning', () => {
  it('counts outs in a specific inning', () => {
    const game = createGame({
      atBats: [
        createAtBat({ inning: 1, isTopInning: true, result: 'out' }),
        createAtBat({ inning: 1, isTopInning: true, result: 'strikeout' }),
        createAtBat({ inning: 1, isTopInning: false, result: 'out' }),
      ],
    })
    expect(getOutsInInning(game, 1, true)).toBe(2)
    expect(getOutsInInning(game, 1, false)).toBe(1)
  })
})

describe('getInningsPitched', () => {
  it('returns 0 for no outs', () => {
    expect(getInningsPitched(createGame())).toBe(0)
  })

  it('calculates innings from outs', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
      ],
    })
    expect(getInningsPitched(game)).toBe(1)
  })

  it('handles partial innings', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
      ],
    })
    expect(getInningsPitched(game)).toBeCloseTo(0.666, 2)
  })
})

describe('getWalks', () => {
  it('counts walks', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'walk' }),
        createAtBat({ result: 'walk' }),
      ],
    })
    expect(getWalks(game)).toBe(2)
  })
})

describe('getHits', () => {
  it('counts hits', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'hit' }),
        createAtBat({ result: 'out' }),
      ],
    })
    expect(getHits(game)).toBe(1)
  })
})

describe('getWHIP', () => {
  it('returns — for zero innings', () => {
    expect(getWHIP(createGame())).toBe('—')
  })

  it('calculates WHIP', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'walk' }),
        createAtBat({ result: 'hit' }),
      ],
    })
    expect(getWHIP(game)).toBe('2.00')
  })
})

describe('getFirstPitchStrikePct', () => {
  it('returns — for no at-bats with pitches', () => {
    expect(getFirstPitchStrikePct(createGame())).toBe('—')
  })

  it('calculates first-pitch strike percentage', () => {
    const game = createGame({
      atBats: [
        createAtBat({
          pitches: [createPitch({ result: 'whiff' })],
        }),
        createAtBat({
          pitches: [createPitch({ result: 'ball' })],
        }),
      ],
    })
    expect(getFirstPitchStrikePct(game)).toBe('50.0')
  })
})

describe('getSwingAndMissRateByType', () => {
  it('calculates whiff rate for swings', () => {
    const game = createGame({
      atBats: [
        createAtBat({
          pitches: [
            createPitch({ pitchType: 'fastball', result: 'whiff' }),
            createPitch({ pitchType: 'fastball', result: 'foul' }),
          ],
        }),
      ],
    })
    const rates = getSwingAndMissRateByType(game)
    expect(rates.fastball?.rate).toBe('50.0')
  })
})

describe('getBAA', () => {
  it('returns — for no official ABs', () => {
    const game = createGame({
      atBats: [createAtBat({ result: 'walk' })],
    })
    expect(getBAA(game)).toBe('—')
  })

  it('calculates batting average against', () => {
    const game = createGame({
      atBats: [
        createAtBat({ result: 'hit' }),
        createAtBat({ result: 'out' }),
        createAtBat({ result: 'out' }),
      ],
    })
    expect(getBAA(game)).toBe('0.333')
  })
})

describe('getPitchesPerBatter', () => {
  it('returns — for no at-bats', () => {
    expect(getPitchesPerBatter(createGame())).toBe('—')
  })

  it('calculates average pitches per batter', () => {
    const game = createGame({
      atBats: [
        createAtBat({
          pitches: [
            createPitch({}),
            createPitch({}),
            createPitch({}),
          ],
        }),
        createAtBat({
          pitches: [createPitch({})],
        }),
      ],
    })
    expect(getPitchesPerBatter(game)).toBe('2.0')
  })
})

describe('formatPitchSequence', () => {
  it('formats pitch sequence', () => {
    const pitches = [
      createPitch({ pitchType: 'fastball' }),
      createPitch({ pitchType: 'slider' }),
      createPitch({ pitchType: 'curveball' }),
    ]
    expect(formatPitchSequence(pitches)).toBe('FB, SL, CB')
  })
})
