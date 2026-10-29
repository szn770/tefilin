const MEDALS = ['🥇', '🥈', '🥉'];

export function rankLabel(rank) {
  return MEDALS[rank - 1] ?? String(rank);
}

// שורות הלוח עם מקום, וסימון של השחקן המחובר
export function boardRows(rows, myId = null) {
  return rows.map((r, i) => ({
    rank: i + 1,
    label: rankLabel(i + 1),
    nickname: r.nickname,
    total: r.total_served,
    level: r.best_level,
    isMe: r.id === myId,
  }));
}

// צריך שורה נפרדת "אתה במקום X" רק למי ששיחק ולא מופיע בלוח
export function needsMyRankLine(rows, me) {
  return !!me && me.total > 0 && !rows.some((r) => r.isMe);
}
