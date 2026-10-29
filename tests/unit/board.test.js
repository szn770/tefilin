import { describe, expect, it } from 'vitest';
import { boardRows, needsMyRankLine, rankLabel } from '../../src/online/board.js';

const ROWS = [
  { id: 'a', nickname: 'דודי', total_served: 50, best_level: 7 },
  { id: 'b', nickname: 'מנדי', total_served: 40, best_level: 9 },
  { id: 'c', nickname: 'יוסי', total_served: 30, best_level: 4 },
  { id: 'd', nickname: 'שמוליק', total_served: 10, best_level: 2 },
];

describe('לוח השיאים', () => {
  it('מדליות לשלושת הראשונים, ומספרים לשאר', () => {
    expect([1, 2, 3, 4].map(rankLabel)).toEqual(['🥇', '🥈', '🥉', '4']);
  });
  it('שומר על הסדר שהגיע מ-Supabase ונותן מקומות', () => {
    const rows = boardRows(ROWS);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows[1]).toMatchObject({ nickname: 'מנדי', total: 40, level: 9, isMe: false });
  });
  it('מסמן את השחקן המחובר', () => {
    expect(boardRows(ROWS, 'c').filter((r) => r.isMe).map((r) => r.nickname)).toEqual(['יוסי']);
  });
  it('שורת "אתם במקום X" רק למי ששיחק ולא מופיע בלוח', () => {
    const rows = boardRows(ROWS, 'c');
    expect(needsMyRankLine(rows, { id: 'c', total: 30 })).toBe(false);
    expect(needsMyRankLine(boardRows(ROWS, 'z'), { id: 'z', total: 3 })).toBe(true);
    expect(needsMyRankLine(boardRows(ROWS, 'z'), { id: 'z', total: 0 })).toBe(false);
    expect(needsMyRankLine(rows, null)).toBe(false);
  });
});
