import { readFileSync } from 'fs';
import { resolve } from 'path';

// Boot Mastra (env validation + AIMock + storage)
import { mastra } from '../src/mastra/index';
import { env } from '../src/lib/env';
import {
  faithfulnessScorer,
  answerRelevancyScorer,
  contextRelevanceScorer,
} from '../src/mastra/scorers/_example.scorers';

// ── types ─────────────────────────────────────────────────────────────────────

interface EvalCase {
  name: string;
  input: string;
  expectedSourceFile?: string;
  expectedKeywords?: string[];
  expectedRefusal?: boolean;
  weight?: number;
}

interface Dataset {
  agentId: string;
  thresholds: Record<string, number>;
  cases: EvalCase[];
}

interface CaseResult {
  name: string;
  pass: boolean;
  assertionErrors: string[];
  scores: Record<string, number | null>;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const REFUSAL_PHRASES = [
  "i cannot answer",
  "i can't answer",
  "outside the documentation",
  "not in the documentation",
  "i don't have",
  "i do not have",
  "cannot answer from",
  "not able to answer",
  "beyond the scope",
];

function checkAssertions(text: string, evalCase: EvalCase): string[] {
  const errors: string[] = [];
  const lower = text.toLowerCase();

  if (evalCase.expectedRefusal) {
    const refused = REFUSAL_PHRASES.some((p) => lower.includes(p));
    if (!refused) {
      errors.push(`expected a refusal but got: "${text.slice(0, 120)}..."`);
    }
  }

  if (evalCase.expectedSourceFile) {
    // Accept the filename anywhere in the response (agent may format citation differently)
    const filenameLower = evalCase.expectedSourceFile.toLowerCase();
    const basenameNoExt = filenameLower.replace(/\.md$/, '');
    if (!lower.includes(filenameLower) && !lower.includes(basenameNoExt)) {
      errors.push(`expected reference to "${evalCase.expectedSourceFile}" not found in response`);
    }
  }

  if (evalCase.expectedKeywords) {
    for (const kw of evalCase.expectedKeywords) {
      if (!lower.includes(kw.toLowerCase())) {
        errors.push(`expected keyword "${kw}" not found in response`);
      }
    }
  }

  return errors;
}

// ── main ──────────────────────────────────────────────────────────────────────

const datasetPath =
  process.argv[2] ?? resolve(process.cwd(), 'src/mastra/scorers/datasets/_example.json');

const dataset: Dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
const agent = mastra.getAgent(dataset.agentId);

if (!agent) {
  console.error(red(`Agent "${dataset.agentId}" not found in Mastra instance.`));
  process.exit(1);
}

console.log(bold(`\n🧪 Eval: ${dataset.agentId} — ${dataset.cases.length} cases\n`));

const results: CaseResult[] = [];
const scoreTotals: Record<string, number[]> = {
  faithfulness: [],
  answerRelevancy: [],
  contextRelevance: [],
};

for (const evalCase of dataset.cases) {
  process.stdout.write(`  ${evalCase.name} ... `);

  let text: string;
  let scoringInput: unknown;
  let scoringOutput: unknown;

  try {
    // returnScorerData triggers inline scorer LLM calls; skip under AIMock to avoid
    // fixture schema mismatches — scores will be n/a but assertion checks still gate CI.
    const generateOpts = env.USE_AIMOCK
      ? {}
      : { returnScorerData: true };

    const result = await agent.generate(
      [{ role: 'user', content: evalCase.input }],
      generateOpts as Parameters<typeof agent.generate>[1],
    );

    text = result.text ?? '';
    scoringInput = (result as any).scoringData?.input;
    scoringOutput = (result as any).scoringData?.output;
  } catch (err) {
    console.log(red('ERROR'));
    console.error(`    ${err}`);
    results.push({
      name: evalCase.name,
      pass: false,
      assertionErrors: [`generate failed: ${err}`],
      scores: {},
    });
    continue;
  }

  // Assertion checks
  const assertionErrors = checkAssertions(text, evalCase);

  // Scorer runs (manual, using scoringData from generate)
  const scores: Record<string, number | null> = {};

  if (!env.USE_AIMOCK && scoringInput !== undefined && scoringOutput !== undefined) {
    try {
      const [faithResult, relevancyResult, contextResult] = await Promise.all([
        faithfulnessScorer.run({ input: scoringInput as any, output: scoringOutput as any }),
        answerRelevancyScorer.run({ input: scoringInput as any, output: scoringOutput as any }),
        contextRelevanceScorer.run({ input: scoringInput as any, output: scoringOutput as any }),
      ]);
      scores.faithfulness = faithResult.score;
      scores.answerRelevancy = relevancyResult.score;
      scores.contextRelevance = contextResult.score;
    } catch (err) {
      console.error(yellow(`\n    ⚠ scorer error: ${err}`));
    }
  }

  // Don't include refusal cases in scorer aggregation — a 0 score on a correct
  // refusal is expected behavior, not a failure.
  if (!evalCase.expectedRefusal) {
    for (const [key, val] of Object.entries(scores)) {
      if (val !== null) scoreTotals[key]?.push(val);
    }
  }

  const pass = assertionErrors.length === 0;
  results.push({ name: evalCase.name, pass, assertionErrors, scores });

  if (pass) {
    console.log(green('PASS'));
  } else {
    console.log(red('FAIL'));
    for (const err of assertionErrors) console.log(`    ${red('✗')} ${err}`);
  }

  const scoreStr = Object.entries(scores)
    .map(([k, v]) => `${k}=${v !== null ? v.toFixed(2) : 'n/a'}`)
    .join(' ');
  if (scoreStr) console.log(`    scores: ${scoreStr}`);
}

// ── aggregate summary ─────────────────────────────────────────────────────────

console.log(bold('\n── Aggregate Scores ─────────────────────────────────────────'));

const scorerPass: Record<string, boolean | 'skip'> = {};
for (const [scorer, values] of Object.entries(scoreTotals)) {
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const threshold = dataset.thresholds[scorer] ?? 0;
  const pass = avg === null ? 'skip' : avg >= threshold;
  scorerPass[scorer] = pass;

  const avgStr = avg !== null ? avg.toFixed(3) : 'n/a';
  const label =
    avg === null
      ? yellow(`  ${scorer}: ${avgStr} (skipped — no scorer data)`)
      : pass
        ? green(`  ${scorer}: ${avgStr} ≥ ${threshold} ✓`)
        : red(`  ${scorer}: ${avgStr} < ${threshold} ✗`);
  console.log(label);
}

const assertionFailCount = results.filter((r) => !r.pass).length;
console.log(bold('\n── Assertion Checks ──────────────────────────────────────────'));
console.log(`  ${results.length - assertionFailCount}/${results.length} cases passed`);

const allScorersPassed = Object.values(scorerPass).every((v) => v === true || v === 'skip');
const allAssertionsPassed = assertionFailCount === 0;
const exitCode = allAssertionsPassed && allScorersPassed ? 0 : 1;

if (exitCode === 0) {
  console.log(bold(green('\n✅ All checks passed\n')));
} else {
  console.log(bold(red('\n❌ Some checks failed\n')));
}

process.exit(exitCode);
