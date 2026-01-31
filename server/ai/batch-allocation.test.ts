/**
 * Unit Tests for CourseGenV2 Batch Allocation
 * 
 * Run with: npx tsx server/ai/batch-allocation.test.ts
 */

import {
  calculateTotalQuestions,
  calculateBatchCount,
  percentagesToCounts,
  validateTypeCounts,
  calculateGlobalQuotas,
  allocateQuotasToBatches,
  createBatchPlans,
  getDefaultCourseGenV2Settings,
} from './parsers';
import type { CourseGenV2Settings, BatchPlan } from '../../shared/types';
import { BATCH_SIZE, COURSE_SIZE_CONFIG } from '../../shared/types';

// Test helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}. Expected ${expected}, got ${actual}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error: any) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n=== CourseGenV2 Batch Allocation Tests ===\n');

// Test 1: Calculate total questions for each size
test('calculateTotalQuestions: S = 12', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'S',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  assertEqual(calculateTotalQuestions(settings), 12, 'S should give 12 questions');
});

test('calculateTotalQuestions: M = 24', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'M',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  assertEqual(calculateTotalQuestions(settings), 24, 'M should give 24 questions');
});

test('calculateTotalQuestions: L = 36', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'L',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  assertEqual(calculateTotalQuestions(settings), 36, 'L should give 36 questions');
});

test('calculateTotalQuestions: Custom = specified value', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'Custom',
    customTotalQuestions: 30,
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  assertEqual(calculateTotalQuestions(settings), 30, 'Custom should give specified value');
});

// Test 2: Calculate batch counts
test('calculateBatchCount: 12 questions = 1 batch', () => {
  assertEqual(calculateBatchCount(12), 1, '12 questions = 1 batch');
});

test('calculateBatchCount: 24 questions = 2 batches', () => {
  assertEqual(calculateBatchCount(24), 2, '24 questions = 2 batches');
});

test('calculateBatchCount: 36 questions = 3 batches', () => {
  assertEqual(calculateBatchCount(36), 3, '36 questions = 3 batches');
});

test('calculateBatchCount: 30 questions = 3 batches (ceil)', () => {
  assertEqual(calculateBatchCount(30), 3, '30 questions = 3 batches');
});

test('calculateBatchCount: 13 questions = 2 batches', () => {
  assertEqual(calculateBatchCount(13), 2, '13 questions = 2 batches');
});

// Test 3: Percentages to counts
test('percentagesToCounts: 60/30/10 for 12 questions', () => {
  const counts = percentagesToCounts(
    12,
    { mcq: 60, open: 30, roleplay: 10 },
    { mcq: true, open: true, roleplay: true }
  );
  const sum = counts.mcq + counts.open + counts.roleplay;
  assertEqual(sum, 12, 'Sum should equal total');
  assert(counts.mcq >= 6 && counts.mcq <= 8, `MCQ should be ~7 (got ${counts.mcq})`);
  assert(counts.open >= 3 && counts.open <= 4, `Open should be ~4 (got ${counts.open})`);
  assert(counts.roleplay >= 1 && counts.roleplay <= 2, `Roleplay should be ~1 (got ${counts.roleplay})`);
});

test('percentagesToCounts: disabled types get 0', () => {
  const counts = percentagesToCounts(
    12,
    { mcq: 60, open: 30, roleplay: 10 },
    { mcq: true, open: true, roleplay: false }
  );
  assertEqual(counts.roleplay, 0, 'Disabled roleplay should be 0');
  const sum = counts.mcq + counts.open + counts.roleplay;
  assertEqual(sum, 12, 'Sum should still equal total');
});

test('percentagesToCounts: only mcq enabled', () => {
  const counts = percentagesToCounts(
    12,
    { mcq: 60, open: 30, roleplay: 10 },
    { mcq: true, open: false, roleplay: false }
  );
  assertEqual(counts.mcq, 12, 'All questions should be MCQ');
  assertEqual(counts.open, 0, 'Open should be 0');
  assertEqual(counts.roleplay, 0, 'Roleplay should be 0');
});

// Test 4: Validate type counts
test('validateTypeCounts: valid counts', () => {
  const result = validateTypeCounts(
    12,
    { mcq: 7, open: 4, roleplay: 1 },
    { mcq: true, open: true, roleplay: true }
  );
  assert(result.valid, 'Should be valid');
  assertEqual(result.errors.length, 0, 'No errors');
});

test('validateTypeCounts: sum mismatch', () => {
  const result = validateTypeCounts(
    12,
    { mcq: 7, open: 4, roleplay: 0 }, // sum = 11, not 12
    { mcq: true, open: true, roleplay: true }
  );
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('sum')), 'Error should mention sum');
});

test('validateTypeCounts: disabled type has count > 0', () => {
  const result = validateTypeCounts(
    12,
    { mcq: 7, open: 4, roleplay: 1 },
    { mcq: true, open: true, roleplay: false }
  );
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('disabled')), 'Error should mention disabled');
});

// Test 5: Allocate quotas to batches
test('allocateQuotasToBatches: S (1 batch)', () => {
  const batches = allocateQuotasToBatches(1, 12, { mcq: 7, open: 4, roleplay: 1 });
  assertEqual(batches.length, 1, 'Should have 1 batch');
  
  const b = batches[0];
  assertEqual(b.questionCount, 12, 'Batch should have 12 questions');
  assertEqual(b.typeQuotas.mcq, 7, 'MCQ quota should be 7');
  assertEqual(b.typeQuotas.open, 4, 'Open quota should be 4');
  assertEqual(b.typeQuotas.roleplay, 1, 'Roleplay quota should be 1');
});

test('allocateQuotasToBatches: M (2 batches)', () => {
  const batches = allocateQuotasToBatches(2, 24, { mcq: 14, open: 8, roleplay: 2 });
  assertEqual(batches.length, 2, 'Should have 2 batches');
  
  // Sum should match
  const totalMcq = batches.reduce((sum, b) => sum + b.typeQuotas.mcq, 0);
  const totalOpen = batches.reduce((sum, b) => sum + b.typeQuotas.open, 0);
  const totalRoleplay = batches.reduce((sum, b) => sum + b.typeQuotas.roleplay, 0);
  
  assertEqual(totalMcq, 14, 'Total MCQ should be 14');
  assertEqual(totalOpen, 8, 'Total Open should be 8');
  assertEqual(totalRoleplay, 2, 'Total Roleplay should be 2');
  
  // Each batch should have 12 questions
  batches.forEach((b, i) => {
    assertEqual(b.questionCount, 12, `Batch ${i} should have 12 questions`);
    const batchSum = b.typeQuotas.mcq + b.typeQuotas.open + b.typeQuotas.roleplay;
    assertEqual(batchSum, 12, `Batch ${i} quotas should sum to 12`);
  });
});

test('allocateQuotasToBatches: L (3 batches)', () => {
  const batches = allocateQuotasToBatches(3, 36, { mcq: 22, open: 11, roleplay: 3 });
  assertEqual(batches.length, 3, 'Should have 3 batches');
  
  const totalMcq = batches.reduce((sum, b) => sum + b.typeQuotas.mcq, 0);
  const totalOpen = batches.reduce((sum, b) => sum + b.typeQuotas.open, 0);
  const totalRoleplay = batches.reduce((sum, b) => sum + b.typeQuotas.roleplay, 0);
  const totalQuestions = batches.reduce((sum, b) => sum + b.questionCount, 0);
  
  assertEqual(totalMcq, 22, 'Total MCQ should be 22');
  assertEqual(totalOpen, 11, 'Total Open should be 11');
  assertEqual(totalRoleplay, 3, 'Total Roleplay should be 3');
  assertEqual(totalQuestions, 36, 'Total questions should be 36');
});

test('allocateQuotasToBatches: Custom 30 questions (3 batches: 12+12+6)', () => {
  const batches = allocateQuotasToBatches(3, 30, { mcq: 18, open: 9, roleplay: 3 });
  assertEqual(batches.length, 3, 'Should have 3 batches');
  
  // First two batches have 12, last has 6
  assertEqual(batches[0].questionCount, 12, 'Batch 0 should have 12 questions');
  assertEqual(batches[1].questionCount, 12, 'Batch 1 should have 12 questions');
  assertEqual(batches[2].questionCount, 6, 'Batch 2 should have 6 questions');
  
  const totalMcq = batches.reduce((sum, b) => sum + b.typeQuotas.mcq, 0);
  const totalOpen = batches.reduce((sum, b) => sum + b.typeQuotas.open, 0);
  const totalRoleplay = batches.reduce((sum, b) => sum + b.typeQuotas.roleplay, 0);
  const totalQuestions = batches.reduce((sum, b) => sum + b.questionCount, 0);
  
  assertEqual(totalMcq, 18, 'Total MCQ should be 18');
  assertEqual(totalOpen, 9, 'Total Open should be 9');
  assertEqual(totalRoleplay, 3, 'Total Roleplay should be 3');
  assertEqual(totalQuestions, 30, 'Total questions should be 30');
});

// Test 6: Full createBatchPlans
test('createBatchPlans: S size', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'S',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans.length, 1, 'S should have 1 batch');
  assertEqual(plans[0].questionCount, 12, 'Batch should have 12 questions');
  
  const total = plans[0].typeQuotas.mcq + plans[0].typeQuotas.open + plans[0].typeQuotas.roleplay;
  assertEqual(total, 12, 'Sum should be 12');
});

test('createBatchPlans: M size', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'M',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans.length, 2, 'M should have 2 batches');
  
  const totalQuestions = plans.reduce((sum, p) => sum + p.questionCount, 0);
  assertEqual(totalQuestions, 24, 'Total questions should be 24');
});

test('createBatchPlans: L size', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'L',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'percentages',
    typePercentages: { mcq: 60, open: 30, roleplay: 10 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans.length, 3, 'L should have 3 batches');
  
  const totalQuestions = plans.reduce((sum, p) => sum + p.questionCount, 0);
  assertEqual(totalQuestions, 36, 'Total questions should be 36');
});

test('createBatchPlans: explicit counts mode', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'S',
    enabledTypes: { mcq: true, open: true, roleplay: true },
    quotaMode: 'counts',
    typeCounts: { mcq: 10, open: 1, roleplay: 1 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans.length, 1, 'S should have 1 batch');
  
  assertEqual(plans[0].typeQuotas.mcq, 10, 'MCQ should be 10');
  assertEqual(plans[0].typeQuotas.open, 1, 'Open should be 1');
  assertEqual(plans[0].typeQuotas.roleplay, 1, 'Roleplay should be 1');
});

// Test 7: Edge cases
test('createBatchPlans: only MCQ enabled', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'S',
    enabledTypes: { mcq: true, open: false, roleplay: false },
    quotaMode: 'percentages',
    typePercentages: { mcq: 100, open: 0, roleplay: 0 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans[0].typeQuotas.mcq, 12, 'All 12 should be MCQ');
  assertEqual(plans[0].typeQuotas.open, 0, 'Open should be 0');
  assertEqual(plans[0].typeQuotas.roleplay, 0, 'Roleplay should be 0');
});

test('createBatchPlans: 50/50 MCQ/Open', () => {
  const settings: CourseGenV2Settings = {
    courseSize: 'S',
    enabledTypes: { mcq: true, open: true, roleplay: false },
    quotaMode: 'percentages',
    typePercentages: { mcq: 50, open: 50, roleplay: 0 },
  };
  
  const plans = createBatchPlans(settings);
  assertEqual(plans[0].typeQuotas.mcq, 6, 'MCQ should be 6');
  assertEqual(plans[0].typeQuotas.open, 6, 'Open should be 6');
  assertEqual(plans[0].typeQuotas.roleplay, 0, 'Roleplay should be 0');
});

console.log('\n=== All tests completed ===\n');
