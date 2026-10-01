import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { dopeDarkTheme } from '../../packages/theia-extension/src/browser/dope-theme.ts';

const root = new URL('../../', import.meta.url).pathname;
const css = readFileSync(join(root, 'packages/theia-extension/src/browser/dope.css'), 'utf8');
const moduleSource = readFileSync(join(root, 'packages/theia-extension/src/browser/frontend-module.ts'), 'utf8');

test('Dope Dark registers through the normal frontend contribution with the dark editor base', () => {
  assert.equal(dopeDarkTheme.id, 'dope-dark');
  assert.equal(dopeDarkTheme.label, 'Dope Dark');
  assert.equal(dopeDarkTheme.type, 'dark');
  assert.equal(dopeDarkTheme.editorTheme, 'dark-theia');
  assert.match(moduleSource, /get\(ThemeService\)\.register\(dopeDarkTheme\)/);
  assert.match(moduleSource, /import '\.\/dope\.css'/);
});

test('activation scope is removed on theme change', () => {
  const classes = new Set<string>();
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { body: { classList: {
    add: (value: string) => classes.add(value),
    remove: (value: string) => classes.delete(value),
  } } } });
  try {
    dopeDarkTheme.activate?.();
    assert.deepEqual([...classes], ['dope-dark']);
    dopeDarkTheme.deactivate?.();
    assert.equal(classes.size, 0);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});

test('locked palette is centralized and widget rules consume semantic tokens', () => {
  const themeStart = css.indexOf('.dope-dark {');
  assert.ok(themeStart > 0);
  const widgetCss = css.slice(0, themeStart);
  const themeCss = css.slice(themeStart);
  for (const [name, color] of Object.entries({
    background: '#1F1F1F', primary: '#FF7A1A', highlight: '#FFB15C', deep: '#C75100',
  })) {
    assert.match(themeCss, new RegExp(`--dope-${name}: ${color};`, 'i'));
    assert.equal(css.match(new RegExp(color, 'gi'))?.length, 1, color);
  }
  assert.doesNotMatch(widgetCss, /#[0-9a-f]{6}\b|--dope-/i);
  for (const token of ['editor-background', 'focusBorder', 'button-background', 'button-hoverBackground',
    'textLink-foreground', 'activityBar-activeBorder', 'tab-activeBorder', 'list-activeSelectionBackground',
    'editor-selectionBackground', 'badge-background', 'progressBar-background']) {
    assert.match(themeCss, new RegExp(`--theia-${token}:`));
  }
  for (const token of ['menu-selectionBackground', 'quickInputList-focusBackground',
    'editorActionList-focusBackground', 'editorSuggestWidget-selectedBackground', 'inputOption-activeBorder',
    'radio-activeBorder', 'sash-activeBorder', 'sash-hoverBorder', 'pickerGroup-foreground',
    'notificationLink-foreground', 'list-highlightForeground', 'list-focusHighlightForeground',
    'editorSuggestWidget-highlightForeground', 'editorSuggestWidget-focusHighlightForeground',
    'editorHoverWidget-highlightForeground', 'editorLink-activeForeground', 'selection-background']) {
    assert.match(themeCss, new RegExp(`--theia-${token}: var\\(--dope-(?:primary|highlight|deep)\\);`));
  }
  for (const app of ['browser', 'electron']) {
    const manifest = JSON.parse(readFileSync(join(root, `apps/${app}/package.json`), 'utf8'));
    assert.equal(manifest.theia.frontend.config.defaultTheme, 'dope-dark');
    assert.equal(manifest.theia.frontend.config.preferences['workbench.colorTheme'], undefined);
  }
});

test('Dope Dark status bar uses a dark base, one continuous Git accent, and semantic diagnostics', () => {
  for (const token of ['statusBar-background', 'statusBar-noFolderBackground']) {
    assert.match(css, new RegExp(`--theia-${token}: var\\(--dope-background\\);`));
  }
  for (const token of ['statusBar-foreground', 'statusBar-noFolderForeground']) {
    assert.match(css, new RegExp(`--theia-${token}: var\\(--dope-primary\\);`));
  }
  assert.doesNotMatch(css, /--theia-statusBar-background: var\(--dope-deep\)/);
  for (const id of ['0', '1']) {
    assert.match(css, new RegExp(`\\.dope-dark #theia-statusBar \\.area \\[id="status-bar-scm\\.status\\.${id}"\\]`));
  }
  assert.match(css, /background: var\(--dope-primary\);\s*color: var\(--dope-background\);\s*box-shadow: calc\(-1 \* var\(--theia-ui-padding\)\) 0 0 var\(--dope-primary\);/);
  for (const [severity, token] of Object.entries({
    error: 'editorError-foreground', warning: 'editorWarning-foreground',
    info: 'editorInfo-foreground', hint: 'successBackground',
  })) {
    assert.match(css, new RegExp(`\\.dope-dark #status-bar-problem-marker-status \\.codicon-${severity} \\+ span \\{\\s*color: var\\(--theia-${token}\\);`));
  }
});
