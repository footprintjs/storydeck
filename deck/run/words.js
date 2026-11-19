// words — the small words two of the run's texts share.

/** A count with its word: 1 click, 2 clicks; a word that is its own plural (series) stays as it is. */
export const plural = (n, word) => `${n} ${word}${n === 1 || word.endsWith('s') ? '' : 's'}`;
