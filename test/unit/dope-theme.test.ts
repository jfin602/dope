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

test('custom side panels use the Explorer background without recoloring center or bottom widgets', () => {
  assert.match(css, /\.theia-side-panel :is\(\.dope-mind-view, \.dope-smap-view, \.dope-chat-panel\) \{ background: var\(--theia-sideBar-background\); \}/);
  for (const selector of ['dope-mind-view', 'dope-smap-view', 'dope-chat-panel']) {
    assert.match(css, new RegExp(`\\.${selector} \\{[^}]*background: var\\(--theia-editor-background\\);`));
  }
  assert.doesNotMatch(css, /\.dope-chat-panel \{[^}]*background: var\(--theia-sideBar-background\)/);
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

test('current dark palette is centralized and widget rules consume semantic tokens', () => {
  const themeStart = css.indexOf('.dope-dark {');
  assert.ok(themeStart > 0);
  const widgetCss = css.slice(0, themeStart);
  const themeCss = css.slice(themeStart).split('\n}')[0];
  for (const [name, color] of Object.entries({
    background: '#1F1F1F', primary: '#336699', 'control-background': '#303030',
    'control-border': '#484848', 'on-primary': '#FFFFFF',
  })) {
    assert.match(themeCss, new RegExp(`--dope-${name}: ${color};`, 'i'));
    assert.equal(css.match(new RegExp(color, 'gi'))?.length, 1, color);
  }
  assert.doesNotMatch(css, /#(?:FF7A1A|FFB15C|C75100|4FA3A5|34787A|78BFC0)\b/i);
  assert.doesNotMatch(widgetCss, /#[0-9a-f]{6}\b/i);
  assert.doesNotMatch(widgetCss, /--theia-[\w-]+:\s*var\(--dope-/);
  assert.match(themeCss, /--dope-text-accent: color-mix\(in srgb, var\(--dope-primary\) 55%, white\);/);
  assert.match(themeCss, /--dope-focus: color-mix\(in srgb, var\(--dope-primary\) 65%, white\);/);
  assert.match(themeCss, /--dope-selected-background: color-mix\(in srgb, var\(--dope-primary\) 25%, var\(--dope-control-background\)\);/);
  assert.match(themeCss, /--dope-action-hover: color-mix\(in srgb, var\(--dope-primary\) 85%, var\(--dope-background\)\);/);
  assert.match(themeCss, /--dope-action-pressed: color-mix\(in srgb, var\(--dope-primary\) 70%, var\(--dope-background\)\);/);
  assert.match(themeCss, /--dope-ready: var\(--theia-testing-iconPassed, var\(--theia-foreground\)\);/);
  for (const token of ['editor-background', 'focusBorder', 'button-background', 'button-hoverBackground',
    'textLink-foreground', 'activityBar-activeBorder', 'tab-activeBorder', 'list-activeSelectionBackground',
    'editor-selectionBackground', 'badge-background', 'progressBar-background']) {
    assert.match(themeCss, new RegExp(`--theia-${token}:`));
  }
  for (const token of ['pickerGroup-foreground',
    'notificationLink-foreground', 'list-highlightForeground', 'list-focusHighlightForeground',
    'editorSuggestWidget-highlightForeground', 'editorSuggestWidget-focusHighlightForeground',
    'editorHoverWidget-highlightForeground', 'editorLink-activeForeground', 'selection-background']) {
    assert.match(themeCss, new RegExp(`--theia-${token}: var\\(--dope-(?:text-accent|selected-background)\\);`));
  }
  for (const token of ['focusBorder', 'list-focusOutline', 'inputOption-activeBorder', 'radio-activeBorder']) {
    assert.match(themeCss, new RegExp(`--theia-${token}: var\\(--dope-focus\\);`));
  }
  for (const token of ['menu-selectionBackground', 'quickInputList-focusBackground',
    'editorActionList-focusBackground', 'editorSuggestWidget-selectedBackground']) {
    assert.match(themeCss, new RegExp(`--theia-${token}: var\\(--dope-selected-background\\);`));
  }
  assert.match(themeCss, /--theia-button-background: var\(--dope-control-background\);/);
  assert.match(themeCss, /--theia-button-hoverBackground: var\(--dope-control-hover\);/);
  assert.match(themeCss, /--theia-button-secondaryBackground: var\(--dope-control-background\);/);
  assert.match(themeCss, /--theia-button-secondaryHoverBackground: var\(--dope-control-hover\);/);
  assert.match(themeCss, /--theia-input-border: var\(--dope-control-border\);/);
  assert.match(themeCss, /--theia-widget-border: var\(--dope-control-border\);/);
  assert.match(themeCss, /--theia-editor-selectionBackground: color-mix\(in srgb, var\(--dope-primary\) 35%, transparent\);/);
  assert.match(themeCss, /--theia-activityBar-foreground: var\(--theia-foreground\);/);
  assert.match(css, /button\.dope-action-primary/);
  assert.match(css, /:is\(\.dope-ai-center, \.dope-smap-view\) button\.dope-action-primary \{\s*color: var\(--dope-on-primary, var\(--theia-button-foreground\)\);/);
  assert.match(css, /\.dope-smap-view button\.dope-action-outline \{\s*color: var\(--dope-text-accent, var\(--theia-button-foreground\)\);/);
  assert.match(css, /\.dope-ai-center button\.dope-ai-connection\[aria-current="true"\] \{[^}]*border-left-color: var\(--theia-focusBorder\); font-weight: 600;/);
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
    assert.match(css, new RegExp(`--theia-${token}: var\\(--theia-foreground\\);`));
  }
  assert.doesNotMatch(css, /--theia-statusBar-(?:foreground|noFolderForeground): var\(--dope-primary\)/);
  for (const id of ['0', '1']) {
    assert.match(css, new RegExp(`\\.dope-dark #theia-statusBar \\.area \\[id="status-bar-scm\\.status\\.${id}"\\]`));
  }
  assert.match(css, /background: var\(--dope-primary\);\s*color: var\(--dope-on-primary\);\s*box-shadow: calc\(-1 \* var\(--theia-ui-padding\)\) 0 0 var\(--dope-primary\);/);
  for (const [severity, token] of Object.entries({
    error: 'editorError-foreground', warning: 'editorWarning-foreground',
    info: 'editorInfo-foreground', hint: 'successBackground',
  })) {
    assert.match(css, new RegExp(`\\.dope-dark #status-bar-problem-marker-status \\.codicon-${severity} \\+ span \\{\\s*color: var\\(--theia-${token}\\);`));
  }
});
