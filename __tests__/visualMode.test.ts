import { describe, expect, it } from '@jest/globals';
import { visualModeFromUrgencies } from '@/src/domain/attention/visualMode';

describe('visualModeFromUrgencies', () => {
  it('is red when any item is overdue', () => {
    expect(visualModeFromUrgencies(['green', 'yellow', 'red'])).toBe('red');
  });

  it('is yellow when any item is urgent and none are overdue', () => {
    expect(visualModeFromUrgencies(['green', 'yellow'])).toBe('yellow');
    expect(visualModeFromUrgencies(['orange', 'green'])).toBe('yellow');
  });

  it('is green when nothing needs care', () => {
    expect(visualModeFromUrgencies([])).toBe('green');
    expect(visualModeFromUrgencies(['green', 'green'])).toBe('green');
  });
});
