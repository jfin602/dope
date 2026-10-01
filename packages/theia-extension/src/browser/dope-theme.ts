import type { Theme } from '@theia/core/lib/common/theme';

export const dopeDarkTheme: Theme = {
    id: 'dope-dark',
    label: 'Dope Dark',
    type: 'dark',
    editorTheme: 'dark-theia',
    activate: () => document.body.classList.add('dope-dark'),
    deactivate: () => document.body.classList.remove('dope-dark'),
};
