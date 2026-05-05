const { escapeCell, rowsToCsv } = require('../../src/utils/csv');

describe('escapeCell', () => {
  test('returns empty string for null/undefined', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
  test('passes plain text through', () => {
    expect(escapeCell('hello')).toBe('hello');
    expect(escapeCell('שלום')).toBe('שלום');
    expect(escapeCell(42)).toBe('42');
  });
  test('quotes when value contains comma', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
  });
  test('quotes when value contains double quote (and doubles it)', () => {
    expect(escapeCell('he said "hi"')).toBe('"he said ""hi"""');
  });
  test('quotes when value contains newline', () => {
    expect(escapeCell('a\nb')).toBe('"a\nb"');
    expect(escapeCell('a\r\nb')).toBe('"a\r\nb"');
  });
});

describe('rowsToCsv', () => {
  test('returns empty string for empty array', () => {
    expect(rowsToCsv([])).toBe('﻿');
  });

  test('serializes rows with header', () => {
    const out = rowsToCsv(
      [{ a: 1, b: 'two' }, { a: 3, b: 'four' }],
      ['a', 'b']
    );
    expect(out).toBe('﻿a,b\r\n1,two\r\n3,four');
  });

  test('uses keys of first row when columns omitted', () => {
    const out = rowsToCsv([{ x: 1, y: 2 }]);
    expect(out).toBe('﻿x,y\r\n1,2');
  });

  test('handles missing keys (writes empty cell)', () => {
    const out = rowsToCsv(
      [{ a: 1, b: 2 }, { a: 3 }],
      ['a', 'b']
    );
    expect(out).toBe('﻿a,b\r\n1,2\r\n3,');
  });

  test('quotes Hebrew values containing comma', () => {
    const out = rowsToCsv([{ s: 'בני ברק, ויזניץ' }], ['s']);
    expect(out).toBe('﻿s\r\n"בני ברק, ויזניץ"');
  });

  test('starts with UTF-8 BOM (so Excel detects encoding)', () => {
    const out = rowsToCsv([{ a: 1 }], ['a']);
    expect(out.charCodeAt(0)).toBe(0xFEFF);
  });
});
