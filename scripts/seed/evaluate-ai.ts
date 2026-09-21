import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ClaudeProvider } from '../../functions/src/ai/claudeProvider';
import { scoreScenario, summarize, type Scenario, type ScenarioResult } from '../../functions/src/ai/evaluation';
import { MockProvider } from '../../functions/src/ai/mockProvider';
import { answerInquiry } from '../../functions/src/ai/orchestrator';
import type { AIProvider } from '../../functions/src/ai/types';
import { redactPersonalData } from '../../functions/src/shared/sanitize';
import { DEFAULT_KNOWLEDGE_BASE } from './knowledgeBase';

/**
 * Run the capstone scenarios (docs/testing/scenarios.json) through the full orchestration pipeline
 * and report correct-handling accuracy against the targets (>= 85% overall, >= 90% escalation).
 *
 *   npm run ai:evaluate                                # deterministic mock provider (no key needed)
 *   ANTHROPIC_API_KEY=sk-ant-... npm run ai:evaluate -- --provider claude [--model claude-opus-5]
 *   npm run ai:evaluate -- --out docs/testing/results/latest.md
 *
 * The key is read from the environment only. Scenarios cost real API calls when --provider claude.
 */
const { values } = parseArgs({
  options: {
    provider: { type: 'string', default: 'mock' },
    model: { type: 'string', default: process.env['CLAUDE_MODEL'] ?? 'claude-opus-5' },
    out: { type: 'string' },
  },
});

function buildProvider(): AIProvider {
  if (values.provider === 'claude') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Export it in your shell for this run (do not put it in a file).');
    return new ClaudeProvider({ apiKey, model: values.model });
  }
  return new MockProvider();
}

function toMarkdown(providerName: string, results: ScenarioResult[]): string {
  const s = summarize(results);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines = [
    '# AI evaluation results',
    '',
    `- Provider: \`${providerName}\``,
    `- Run at: ${new Date().toISOString()}`,
    `- Correct handling: **${s.correct}/${s.total} (${pct(s.accuracy)})** - target >= 85% - ${s.accuracy >= 0.85 ? 'PASS' : 'FAIL'}`,
    `- Escalation accuracy: **${s.escalationCorrect}/${s.escalationTotal} (${pct(s.escalationAccuracy)})** - target >= 90% - ${s.escalationAccuracy >= 0.9 ? 'PASS' : 'FAIL'}`,
    '',
    '| ID | Category | Question | Expected | Result | Source | Notes |',
    '|----|----------|----------|----------|--------|--------|-------|',
    ...results.map(
      (r) =>
        `| ${r.scenario.id} | ${r.scenario.category} | ${r.scenario.question.replace(/\|/g, '\\|')} | ${r.scenario.expected} | ${r.correct ? 'PASS' : 'FAIL'} | ${r.outcome.source} | ${r.reason} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const scenarios = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../docs/testing/scenarios.json'), 'utf8')) as Scenario[];
  const provider = buildProvider();
  const articles = DEFAULT_KNOWLEDGE_BASE.map((a) => ({ ...a }));
  console.log(`Evaluating ${scenarios.length} scenarios with provider "${provider.name}"...\n`);

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const started = Date.now();
    const outcome = await answerInquiry({ message: redactPersonalData(scenario.question), history: [], articles, provider });
    const result = scoreScenario(scenario, outcome);
    results.push(result);
    console.log(
      `${result.correct ? 'PASS' : 'FAIL'}  ${scenario.id.padEnd(7)} ${String(Date.now() - started).padStart(5)}ms  [${outcome.source}]  ${scenario.question}` +
        (result.correct ? '' : `\n      -> ${result.reason}: "${outcome.response.answer.slice(0, 140)}"`),
    );
  }

  const s = summarize(results);
  console.log(
    `\nCorrect handling:    ${s.correct}/${s.total} = ${(s.accuracy * 100).toFixed(1)}%  (target >= 85%)` +
      `\nEscalation accuracy: ${s.escalationCorrect}/${s.escalationTotal} = ${(s.escalationAccuracy * 100).toFixed(1)}%  (target >= 90%)`,
  );

  if (values.out) {
    writeFileSync(resolve(values.out), toMarkdown(provider.name, results));
    console.log(`\nWrote ${values.out}`);
  }
  if (s.accuracy < 0.85 || s.escalationAccuracy < 0.9) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('\nEvaluation failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
