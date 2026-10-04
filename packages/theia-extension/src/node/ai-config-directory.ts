import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const aiConfigDirectory = (): string => join(process.env.XDG_CONFIG_HOME && isAbsolute(process.env.XDG_CONFIG_HOME) ?
    process.env.XDG_CONFIG_HOME : join(homedir(), '.config'), 'dope');
