import { calculateBudgetState } from '@/lib/budget';

describe('calculateBudgetState', () => {
  describe('no budget (limit <= 0)', () => {
    it('handles limit = 0', () => {
      const result = calculateBudgetState(0, 0);
      expect(result.state).toBe('none');
      expect(result.percentage).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.label).toBe('No budget set');
    });

    it('handles negative limit', () => {
      const result = calculateBudgetState(1000, -100);
      expect(result.state).toBe('none');
      expect(result.label).toBe('No budget set');
    });

    it('handles spent > 0 with limit = 0', () => {
      const result = calculateBudgetState(5000, 0);
      expect(result.state).toBe('none');
      expect(result.label).toBe('No budget set');
    });
  });

  describe('under budget', () => {
    it('handles zero spent', () => {
      const result = calculateBudgetState(0, 10000);
      expect(result.state).toBe('under');
      expect(result.percentage).toBe(0);
      expect(result.remaining).toBe(10000);
      expect(result.label).toBe('left');
    });

    it('handles 50% spent', () => {
      const result = calculateBudgetState(5000, 10000);
      expect(result.state).toBe('under');
      expect(result.percentage).toBe(50);
      expect(result.remaining).toBe(5000);
      expect(result.label).toBe('left');
    });

    it('handles 79% spent (just under threshold)', () => {
      const result = calculateBudgetState(7900, 10000);
      expect(result.state).toBe('under');
      expect(result.percentage).toBe(79);
      expect(result.remaining).toBe(2100);
      expect(result.label).toBe('left');
    });
  });

  describe('close to limit', () => {
    it('handles exactly 80% spent', () => {
      const result = calculateBudgetState(8000, 10000);
      expect(result.state).toBe('close');
      expect(result.percentage).toBe(80);
      expect(result.remaining).toBe(2000);
      expect(result.label).toBe('Close to limit');
    });

    it('handles 95% spent', () => {
      const result = calculateBudgetState(9500, 10000);
      expect(result.state).toBe('close');
      expect(result.percentage).toBe(95);
      expect(result.remaining).toBe(500);
      expect(result.label).toBe('Close to limit');
    });

    it('handles 99% spent', () => {
      const result = calculateBudgetState(9900, 10000);
      expect(result.state).toBe('close');
      expect(result.remaining).toBe(100);
      expect(result.label).toBe('Close to limit');
    });
  });

  describe('exactly at limit', () => {
    it('handles spent === limit', () => {
      const result = calculateBudgetState(10000, 10000);
      expect(result.state).toBe('at');
      expect(result.percentage).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.label).toBe('At limit');
    });
  });

  describe('over limit', () => {
    it('handles slightly over (101%)', () => {
      const result = calculateBudgetState(10100, 10000);
      expect(result.state).toBe('over');
      expect(result.percentage).toBe(101);
      expect(result.remaining).toBe(-100);
      expect(result.label).toBe('Over by');
    });

    it('handles significantly over (150%)', () => {
      const result = calculateBudgetState(15000, 10000);
      expect(result.state).toBe('over');
      expect(result.percentage).toBe(150);
      expect(result.remaining).toBe(-5000);
      expect(result.label).toBe('Over by');
    });

    it('handles double the limit', () => {
      const result = calculateBudgetState(20000, 10000);
      expect(result.state).toBe('over');
      expect(result.percentage).toBe(200);
      expect(result.remaining).toBe(-10000);
      expect(result.label).toBe('Over by');
    });
  });

  describe('negative spent (clamped to 0)', () => {
    it('clamps negative spent to zero', () => {
      const result = calculateBudgetState(-1000, 10000);
      expect(result.state).toBe('under');
      expect(result.percentage).toBe(0);
      expect(result.remaining).toBe(10000);
    });

    it('clamps negative spent with zero limit', () => {
      const result = calculateBudgetState(-1000, 0);
      expect(result.state).toBe('none');
      expect(result.label).toBe('No budget set');
    });
  });

  describe('edge cases', () => {
    it('handles very small amounts', () => {
      const result = calculateBudgetState(1, 100);
      expect(result.state).toBe('under');
      expect(result.percentage).toBe(1);
      expect(result.remaining).toBe(99);
    });

    it('handles large amounts', () => {
      const result = calculateBudgetState(9999999, 10000000);
      expect(result.state).toBe('close');
      expect(result.percentage).toBeCloseTo(99.99999, 4);
      expect(result.remaining).toBe(1);
    });
  });
});
