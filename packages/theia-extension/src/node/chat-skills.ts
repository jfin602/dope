import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ChatSkill, ChatSkillChange, ChatSkillSnapshot } from '@dope/chat/lib/service';

const skillsPath = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'dope', 'chat-skills.json');
const reserved = new Set(['docs-review', 'docs-apply', 'roadmap', 'skill']);
const builtins: ChatSkill[] = [{ id: 'builtin:explain', name: 'explain',
    description: 'Explain a topic clearly using the current conversation.',
    body: 'Explain the requested topic clearly. Use the current conversation for context. Do not claim to have changed files.',
    enabled: true, provenance: 'builtin', version: 1 }];
let serial = Promise.resolve();

export function validateSkill(name: string, description: string, body: string): void {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64 || reserved.has(name))
        throw new Error('Use a unique lowercase skill name (letters, digits, hyphens; 1–64 characters)');
    if (!description.trim() || description.length > 240 || !body.trim() || body.length > 1500 ||
        /[\x00-\x08\x0b-\x1f\x7f]/u.test(description + body))
        throw new Error('Skill needs a description and plain-text instructions (up to 1,500 characters)');
}
async function readUsers(): Promise<ChatSkill[]> {
    const path = skillsPath();
    let raw: string;
    try { raw = await readFile(path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('Saved skills are invalid');
    const names = new Set(builtins.map(item => item.name));
    return parsed.map(item => {
        if (!item || typeof item !== 'object') throw new Error('Saved skill is invalid');
        const skill = item as ChatSkill;
        if (skill.provenance !== 'user' || typeof skill.id !== 'string' || !skill.id ||
            typeof skill.name !== 'string' || typeof skill.description !== 'string' ||
            typeof skill.body !== 'string' || typeof skill.enabled !== 'boolean' ||
            !Number.isSafeInteger(skill.version) || skill.version < 1) throw new Error('Saved skill is invalid');
        validateSkill(skill.name, skill.description, skill.body);
        if (names.has(skill.name)) throw new Error('Saved skill names collide');
        names.add(skill.name);
        return skill;
    });
}
async function writeUsers(skills: ChatSkill[]): Promise<void> {
    const path = skillsPath();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(skills), { mode: 0o600 });
    await rename(temporary, path);
}
export async function listChatSkills(): Promise<ChatSkill[]> { return [...builtins, ...await readUsers()]; }
export function changeChatSkill(change: ChatSkillChange): Promise<ChatSkill[]> {
    const action = serial.then(async () => {
        const users = await readUsers();
        if (change.type === 'add') {
            validateSkill(change.name, change.description, change.body);
            if (users.some(item => item.name === change.name) || builtins.some(item => item.name === change.name))
                throw new Error('Skill name already exists');
            users.push({ id: randomUUID(), name: change.name, description: change.description.trim(),
                body: change.body.trim(), enabled: true, provenance: 'user', version: 1 });
        } else {
            const index = users.findIndex(item => item.id === change.id);
            if (index < 0) throw new Error('Only user-created skills can be changed');
            if (change.type === 'delete') users.splice(index, 1);
            else if (change.type === 'enable') users[index] = { ...users[index], enabled: change.enabled,
                version: users[index].version + 1 };
            else {
                validateSkill(change.name, change.description, change.body);
                if (builtins.some(item => item.name === change.name) ||
                    users.some((item, at) => at !== index && item.name === change.name))
                    throw new Error('Skill name already exists');
                users[index] = { ...users[index], name: change.name, description: change.description.trim(),
                    body: change.body.trim(), version: users[index].version + 1 };
            }
        }
        await writeUsers(users);
        return [...builtins, ...users];
    });
    serial = action.then(() => undefined, () => undefined);
    return action;
}
export function skillCommand(content: string): string | undefined {
    const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/.exec(content);
    return match?.[1];
}
export async function resolveChatSkill(content: string): Promise<ChatSkillSnapshot | undefined> {
    const name = skillCommand(content);
    if (!name) return undefined;
    const skill = (await listChatSkills()).find(item => item.name === name);
    if (!skill) throw new Error(`Unknown skill /${name}. Open Chat settings to manage Skills.`);
    if (!skill.enabled) throw new Error(`Skill /${name} is disabled. Enable it in Chat settings.`);
    return { id: skill.id, name, body: skill.body, version: skill.version,
        digest: createHash('sha256').update(skill.body).digest('hex') };
}
