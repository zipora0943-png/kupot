const {
  matchesRule, matchesAny, buildLocationClause, bestMatchSpecificity,
} = require('../../src/logic/userAssignment');

describe('matchesRule', () => {
  const card = {
    box_id: 42,
    city: 'בני ברק',
    neighborhood: 'רמת אלחנן',
    street: 'חזון איש',
  };

  test('city rule matches when city equals', () => {
    expect(matchesRule(card, { type: 'city', value: 'בני ברק' })).toBe(true);
  });
  test('city rule rejects different city', () => {
    expect(matchesRule(card, { type: 'city', value: 'ירושלים' })).toBe(false);
  });
  test('neighborhood rule requires both city and value', () => {
    expect(matchesRule(card, { type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' })).toBe(true);
    expect(matchesRule(card, { type: 'neighborhood', city: 'ירושלים', value: 'רמת אלחנן' })).toBe(false);
    expect(matchesRule(card, { type: 'neighborhood', city: 'בני ברק', value: 'ויזניץ' })).toBe(false);
  });
  test('street rule requires city + neighborhood + value', () => {
    expect(matchesRule(card, {
      type: 'street', city: 'בני ברק', neighborhood: 'רמת אלחנן', value: 'חזון איש'
    })).toBe(true);
    expect(matchesRule(card, {
      type: 'street', city: 'בני ברק', neighborhood: 'ויזניץ', value: 'חזון איש'
    })).toBe(false);
  });
  test('box rule compares numerically', () => {
    expect(matchesRule(card, { type: 'box', box_id: 42 })).toBe(true);
    expect(matchesRule(card, { type: 'box', box_id: '42' })).toBe(true);
    expect(matchesRule(card, { type: 'box', box_id: 99 })).toBe(false);
  });
  test('unknown type returns false', () => {
    expect(matchesRule(card, { type: 'galaxy', value: 'x' })).toBe(false);
  });
  test('null inputs return false', () => {
    expect(matchesRule(null, { type: 'city', value: 'x' })).toBe(false);
    expect(matchesRule(card, null)).toBe(false);
  });

  // ── Partial-key shape (created by the admin UI / UserModal) ──
  test('partial-key city rule matches', () => {
    expect(matchesRule(card, { city: 'בני ברק' })).toBe(true);
    expect(matchesRule(card, { city: 'ירושלים' })).toBe(false);
  });
  test('partial-key neighborhood rule requires city + neighborhood', () => {
    expect(matchesRule(card, { city: 'בני ברק', neighborhood: 'רמת אלחנן' })).toBe(true);
    expect(matchesRule(card, { city: 'ירושלים', neighborhood: 'רמת אלחנן' })).toBe(false);
  });
  test('partial-key street rule requires all three', () => {
    expect(matchesRule(card, {
      city: 'בני ברק', neighborhood: 'רמת אלחנן', street: 'חזון איש'
    })).toBe(true);
    expect(matchesRule(card, {
      city: 'בני ברק', neighborhood: 'ויזניץ', street: 'חזון איש'
    })).toBe(false);
  });
  test('partial-key box rule matches by box_id only', () => {
    expect(matchesRule(card, { box_id: 42 })).toBe(true);
    expect(matchesRule(card, { box_id: 99 })).toBe(false);
  });
});

describe('matchesAny', () => {
  const card = { box_id: 1, city: 'אשדוד', neighborhood: 'ה', street: 'הרצל' };

  test('returns false for empty rules', () => {
    expect(matchesAny(card, [])).toBe(false);
    expect(matchesAny(card, undefined)).toBe(false);
  });
  test('matches when at least one rule matches', () => {
    expect(matchesAny(card, [
      { type: 'city', value: 'ירושלים' },
      { type: 'city', value: 'אשדוד' },
    ])).toBe(true);
  });
  test('returns false when no rule matches', () => {
    expect(matchesAny(card, [
      { type: 'city', value: 'ירושלים' },
      { type: 'box', box_id: 999 },
    ])).toBe(false);
  });
});

describe('buildLocationClause', () => {
  test('returns null on empty input', () => {
    expect(buildLocationClause([], [])).toBeNull();
    expect(buildLocationClause(null, [])).toBeNull();
    expect(buildLocationClause(undefined, [])).toBeNull();
  });

  test('city rule binds one parameter', () => {
    const params = [];
    const clause = buildLocationClause([{ type: 'city', value: 'בני ברק' }], params);
    expect(clause).toBe('((c.city = $1))');
    expect(params).toEqual(['בני ברק']);
  });

  test('neighborhood rule binds two parameters in order', () => {
    const params = [];
    const clause = buildLocationClause(
      [{ type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' }],
      params
    );
    expect(clause).toBe('((c.city = $1 AND c.neighborhood = $2))');
    expect(params).toEqual(['בני ברק', 'רמת אלחנן']);
  });

  test('street rule binds three parameters', () => {
    const params = [];
    const clause = buildLocationClause(
      [{ type: 'street', city: 'X', neighborhood: 'Y', value: 'Z' }],
      params
    );
    expect(clause).toBe('((c.city = $1 AND c.neighborhood = $2 AND c.street = $3))');
    expect(params).toEqual(['X', 'Y', 'Z']);
  });

  test('box rule binds box_id as integer', () => {
    const params = [];
    const clause = buildLocationClause([{ type: 'box', box_id: '42' }], params);
    expect(clause).toBe('((b.id = $1))');
    expect(params).toEqual([42]);
  });

  test('multiple rules joined with OR', () => {
    const params = [];
    const clause = buildLocationClause([
      { type: 'city', value: 'בני ברק' },
      { type: 'box', box_id: 7 },
    ], params);
    expect(clause).toBe('((c.city = $1) OR (b.id = $2))');
    expect(params).toEqual(['בני ברק', 7]);
  });

  test('skips invalid / incomplete rules silently', () => {
    const params = [];
    const clause = buildLocationClause([
      { type: 'city' }, // no value
      { type: 'neighborhood', city: 'X' }, // no value
      { type: 'box', box_id: 'not-a-number' },
      { type: 'unknown', value: 'X' },
      { type: 'city', value: 'בני ברק' }, // valid
    ], params);
    expect(clause).toBe('((c.city = $1))');
    expect(params).toEqual(['בני ברק']);
  });

  test('appends to existing params array (does not reset)', () => {
    const params = ['existing'];
    buildLocationClause([{ type: 'city', value: 'X' }], params);
    expect(params).toEqual(['existing', 'X']);
  });

  test('returns null when all rules invalid', () => {
    expect(buildLocationClause([{ type: 'unknown' }], [])).toBeNull();
  });

  // ── Partial-key shape ──
  test('partial-key city rule binds one parameter', () => {
    const params = [];
    const clause = buildLocationClause([{ city: 'בני ברק' }], params);
    expect(clause).toBe('((c.city = $1))');
    expect(params).toEqual(['בני ברק']);
  });

  test('partial-key neighborhood rule binds city + neighborhood', () => {
    const params = [];
    const clause = buildLocationClause(
      [{ city: 'בני ברק', neighborhood: 'רמת אלחנן' }],
      params
    );
    expect(clause).toBe('((c.city = $1 AND c.neighborhood = $2))');
    expect(params).toEqual(['בני ברק', 'רמת אלחנן']);
  });

  test('partial-key box rule binds b.id', () => {
    const params = [];
    const clause = buildLocationClause([{ box_id: 42 }], params);
    expect(clause).toBe('((b.id = $1))');
    expect(params).toEqual([42]);
  });

  test('mixed shapes (tagged + partial) joined with OR', () => {
    const params = [];
    const clause = buildLocationClause([
      { type: 'city', value: 'בני ברק' },
      { city: 'ירושלים' },
    ], params);
    expect(clause).toBe('((c.city = $1) OR (c.city = $2))');
    expect(params).toEqual(['בני ברק', 'ירושלים']);
  });
});

describe('bestMatchSpecificity', () => {
  const card = {
    box_id: 42,
    city: 'בני ברק',
    neighborhood: 'רמת אלחנן',
    street: 'חזון איש',
  };

  test('returns 0 when no rules match', () => {
    expect(bestMatchSpecificity(card, [{ type: 'city', value: 'אחר' }])).toBe(0);
  });

  test('returns 0 for empty / missing rules', () => {
    expect(bestMatchSpecificity(card, [])).toBe(0);
    expect(bestMatchSpecificity(card, undefined)).toBe(0);
  });

  test('returns city specificity (1) for a city-only match', () => {
    expect(bestMatchSpecificity(card, [{ type: 'city', value: 'בני ברק' }])).toBe(1);
  });

  test('returns neighborhood specificity (2) over a city match', () => {
    expect(bestMatchSpecificity(card, [
      { type: 'city',         value: 'בני ברק' },
      { type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' },
    ])).toBe(2);
  });

  test('returns street specificity (3) when street matches', () => {
    expect(bestMatchSpecificity(card, [
      { type: 'city',         value: 'בני ברק' },
      { type: 'street',       city: 'בני ברק', neighborhood: 'רמת אלחנן', value: 'חזון איש' },
    ])).toBe(3);
  });

  test('box rule wins (specificity 4) over any location rule', () => {
    expect(bestMatchSpecificity(card, [
      { type: 'street', city: 'בני ברק', neighborhood: 'רמת אלחנן', value: 'חזון איש' },
      { type: 'box',    box_id: 42 },
    ])).toBe(4);
  });

  // ── Partial-key shape ──
  test('partial-key shapes score by deepest field', () => {
    expect(bestMatchSpecificity(card, [{ city: 'בני ברק' }])).toBe(1);
    expect(bestMatchSpecificity(card, [
      { city: 'בני ברק', neighborhood: 'רמת אלחנן' },
    ])).toBe(2);
    expect(bestMatchSpecificity(card, [
      { city: 'בני ברק', neighborhood: 'רמת אלחנן', street: 'חזון איש' },
    ])).toBe(3);
    expect(bestMatchSpecificity(card, [{ box_id: 42 }])).toBe(4);
  });

  test('mixed-shape rules pick the highest score', () => {
    expect(bestMatchSpecificity(card, [
      { city: 'בני ברק' },                                                 // partial, score 1
      { type: 'street', city: 'בני ברק', neighborhood: 'רמת אלחנן',
        value: 'חזון איש' },                                                // tagged, score 3
    ])).toBe(3);
  });
});
