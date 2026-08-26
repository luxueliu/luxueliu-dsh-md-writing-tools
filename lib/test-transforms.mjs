// Isolated transform checks for snippet.txt (no CodeMirror).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const snippet = readFileSync(join(here, 'snippet.txt'), 'utf8');
const prelude = snippet.split('const mdwtKeymap')[0];
const ctx = new Function(
  prelude +
    '; return { mdwtTransformInlineSelection, mdwtChangeHeading, mdwtDetectOuterMarkers, mdwtApplyMarkers };',
)();

const cases = [
  ['bold-on', ctx.mdwtTransformInlineSelection('hello', '**'), '**hello**'],
  ['bold-off', ctx.mdwtTransformInlineSelection('**hello**', '**'), 'hello'],
  ['italic-on', ctx.mdwtTransformInlineSelection('hello', '*'), '*hello*'],
  ['strike-on', ctx.mdwtTransformInlineSelection('hello', '~~'), '~~hello~~'],
  ['heading-smaller', ctx.mdwtChangeHeading('# Title', 1), '## Title'],
  ['heading-larger', ctx.mdwtChangeHeading('## Title', -1), '# Title'],
  ['heading-in-quote', ctx.mdwtChangeHeading('> # Title', 1), '> ## Title'],
  ['list-keeps-prefix', ctx.mdwtTransformInlineSelection('- item', '**'), '- **item**'],
  ['multiline', ctx.mdwtTransformInlineSelection('foo\nbar', '**'), '**foo**\n**bar**'],
  ['table-cell', ctx.mdwtTransformInlineSelection('| cell |', '**'), '| **cell** |'],
  ['table-delimiter', ctx.mdwtTransformInlineSelection('| --- |', '**'), '| --- |'],
  ['detect-bold', JSON.stringify(ctx.mdwtDetectOuterMarkers('**hello**').markers), JSON.stringify(['**'])],
  ['apply-markers', ctx.mdwtApplyMarkers('hello', ['**', '*']), '***hello***'],
];

let failed = 0;
for (const [name, got, want] of cases) {
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  } else {
    console.log(`PASS ${name}`);
  }
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
