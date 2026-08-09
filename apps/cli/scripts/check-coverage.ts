// Coverage gate: fail the build if line coverage across src/ falls below the
// threshold. Reads the lcov report produced by `bun test --coverage-reporter=lcov`.
import { readFileSync } from 'node:fs';

const threshold = Number(process.argv[2] ?? 80);
const text = readFileSync('coverage/lcov.info', 'utf-8');

let hits = 0;
let found = 0;
const perFile: Array<[string, number]> = [];

for (const block of text.split('end_of_record')) {
  const sf = block.match(/^SF:(.+)$/m)?.[1];
  if (!sf || !sf.includes('src/')) continue;
  const lf = Number(block.match(/^LF:(\d+)$/m)?.[1] ?? 0);
  const lh = Number(block.match(/^LH:(\d+)$/m)?.[1] ?? 0);
  hits += lh;
  found += lf;
  if (lf > 0) perFile.push([sf, (lh / lf) * 100]);
}

if (found === 0) {
  console.error('check-coverage: no src/ files found in coverage/lcov.info');
  process.exit(1);
}

const pct = (hits / found) * 100;
console.log(`src coverage: ${pct.toFixed(1)}% (${hits}/${found}), threshold ${threshold}%`);

if (pct < threshold) {
  perFile
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .forEach(([f, p]) => console.log(`  ${p.toFixed(1).padStart(5)}%  ${f}`));
  console.error(`FAIL: coverage below ${threshold}%`);
  process.exit(1);
}
