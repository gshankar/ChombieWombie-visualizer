import { expect, test } from 'vitest'
import { STYLES, DEFAULT_CONFIG } from '../config'

test('Styles configuration has 2D and 3D categories', () => {
  expect(STYLES).toHaveProperty('2d');
  expect(STYLES).toHaveProperty('3d');
});

test('2D styles contain circular and bars', () => {
  const ids = STYLES['2d'].map(s => s.id);
  expect(ids).toContain('circular');
  expect(ids).toContain('bars');
});

test('Default config has correct engine', () => {
  expect(DEFAULT_CONFIG.engine).toBe('2d');
});
