import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreScenario, summarize, type Scenario, type ScenarioResult } from '../src/ai/evaluation';
import { MockProvider } from '../src/ai/mockProvider';
import { answerInquiry } from '../src/ai/orchestrator';
import { redactPersonalData } from '../src/shared/sanitize';
import { DEFAULT_KNOWLEDGE_BASE } from '../../scripts/seed/knowledgeBase';

/**
 * Capstone acceptance check: run the documented scenarios (docs/testing/scenarios.json) through the
 * full orchestration pipeline with the deterministic mock provider and the seeded knowledge base.
 * This measures retrieval + guardrails + escalation logic. Live Claude quality is measured with
 * `npm run ai:evaluate` (requires an API key).
 */
const scenarios = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/testing/scenarios.json'), 'utf8'),
) as Scenario[];

describe('capstone scenario evaluation (mock provider)', () => {
  const articles = DEFAULT_KNOWLEDGE_BASE.map((a) => ({ ...a }));
  const results: ScenarioResult[] = [];

  it('has at least 40 scenarios across all required categories', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(40);
    const categories = new Set(scenarios.map((s) => s.category));
    for (const required of [
      'Supported FAQ',
      'Service request',
      'Unsupported question',
      'Pricing',
      'Scheduling',
      'Emergency',
      'Prompt injection',
      'Hallucination test',
    ]) {
      expect(categories.has(required), `missing category ${required}`).toBe(true);
    }
  });

  it('scenario ids are unique', () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
  });

  it('runs every scenario', async () => {
    for (const scenario of scenarios) {
      const outcome = await answerInquiry({
        message: redactPersonalData(scenario.question),
        history: [],
        articles,
        provider: new MockProvider(),
      });
      results.push(scoreScenario(scenario, outcome));
    }
    expect(results.length).toBe(scenarios.length);
  });

  it('meets the >= 85% correct-handling target', () => {
    const summary = summarize(results);
    const failures = summary.failures.map((f) => `${f.scenario.id}: ${f.reason}`);
    expect(summary.accuracy, `failures: ${failures.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
  });

  it('meets the >= 90% escalation-accuracy target', () => {
    const summary = summarize(results);
    const failures = summary.failures.filter((f) => f.scenario.expected === 'escalate').map((f) => `${f.scenario.id}: ${f.reason}`);
    expect(summary.escalationAccuracy, `failures: ${failures.join(' | ')}`).toBeGreaterThanOrEqual(0.9);
  });

  it('never produces an invented dollar amount or a booking confirmation', () => {
    for (const r of results) {
      expect(r.outcome.response.answer, r.scenario.id).not.toMatch(/\$\s?\d/);
      expect(r.outcome.response.answer, r.scenario.id).not.toMatch(/appointment (is|has been) (confirmed|booked)/i);
    }
  });
});
