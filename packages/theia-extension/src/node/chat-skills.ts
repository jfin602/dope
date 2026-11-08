import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ChatSkill, ChatSkillChange, ChatSkillSnapshot } from '@dope/chat/lib/service';

const skillsPath = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'dope', 'chat-skills.json');
const reserved = new Set(['docs-review', 'docs-apply', 'roadmap', 'gen-roadmap',
    'prompt-ass', 'prompt-plan', 'prompt-write', 'skill']);
const builtins: ChatSkill[] = [{ id: 'builtin:explain', name: 'explain',
    title: 'Explain',
    description: 'Explain a topic clearly using the current conversation.',
    body: 'Explain the requested topic clearly. Use the current conversation for context. Do not claim to have changed files.',
    enabled: true, provenance: 'builtin', version: 1 },
{ id: 'builtin:roadmap', name: 'roadmap', title: 'Roadmap',
    description: 'Discuss Roadmap work or propose a reviewed change.',
    body: 'Use authorized native Roadmap tools and current verified project state for changes to an existing Roadmap. For read-only questions, answer without staging. Ask one precise question when required facts are missing. Never claim an unapproved change, invent evidence or Green status, write Markdown, or run Work.',
    enabled: true, provenance: 'builtin', version: 2 },
{ id: 'builtin:gen-roadmap', name: 'gen-roadmap', title: 'Generate Roadmap',
    description: 'Build a new Roadmap from a prompt with the selected local model, then review it on the canvas.',
    body: 'This command starts only from a fresh user Chat message with a nonempty prompt. Use one exact local model. Generated Phases are provisional until the owner reviews and applies them. Do not claim accepted changes, evidence, or Green status.',
    enabled: true, provenance: 'builtin', version: 1 },
{ id: 'builtin:docs-review', name: 'docs-review', title: 'Review documentation',
    description: 'Inspect relevant project documents and prepare a reviewed, source-bound diff.',
    body: 'Use bounded discovery and brokered read_file ranges to inspect relevant current and historical sources, including late sections. Distinguish searched paths from actually read files. Stage each eligible .md/.txt change through proposal_stage_document, inspect receipts, and call proposal_finish only when every requested target is covered. Do not return a changes JSON packet, claim unread text was inspected, publish files or record applied History.',
    enabled: true, provenance: 'builtin', version: 2 },
{ id: 'builtin:prompt-ass', name: 'prompt-ass', title: 'Assess prompt work',
    description: 'Assess the current project and saved Chat discussion before drafting a prompt stack.',
    body: 'Assess the saved discussion and current project. Use brokered read_file, list_files, search_paths and search_text selectively; actually read relevant requirements, source and tests. Distinguish listed or searched paths from files read. Report scope, preservation, dependencies, risks, source omissions, authority and T1/T2/T3 evidence. Return a bounded Markdown assessment draft. Do not write files, run Work or claim approval.',
    enabled: true, provenance: 'builtin', version: 1 },
{ id: 'builtin:prompt-plan', name: 'prompt-plan', title: 'Plan prompt work',
    description: 'Build a dependency-ordered plan from the selected saved assessment.',
    body: 'Use the bound saved assessment and current brokered source reads. Trace producers and consumers, affected tests and package build order. Plan bounded implementation prompts, one integration gate and one manual closeout. Apply Prompt Efficiency, UI Design Compliance and Human Usability where applicable. Return a bounded Markdown plan draft. Do not publish files, grant Work or claim qualification.',
    enabled: true, provenance: 'builtin', version: 1 },
{ id: 'builtin:prompt-write', name: 'prompt-write', title: 'Draft prompt stack',
    description: 'Generate a validated, unpublished stack from the selected saved plan.',
    body: 'Use the bound saved assessment and plan. Stage one ordered plan step or bounded detailed section at a time through proposal_stage_prompt, inspect compact receipts, and call proposal_finish only after one terminal manual closeout. Dope composes and validates the exact prompt bytes. Do not return a whole-stack JSON packet, write files or claim publication, Work grants, Run or Gate status.',
    enabled: true, provenance: 'builtin', version: 3 },
];
let serial = Promise.resolve();

export function validateSkill(name: string, description: string, body: string, title = name): void {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64 || reserved.has(name))
        throw new Error('Use a unique lowercase skill name (letters, digits, hyphens; 1–64 characters)');
    if (!title.trim() || title.length > 80 || !description.trim() || description.length > 240 ||
        !body.trim() || body.length > 1500 || /[\x00-\x08\x0b-\x1f\x7f]/u.test(title + description + body))
        throw new Error('Skill needs a title, summary, and plain-text instructions (up to 1,500 characters)');
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
        const title = typeof skill.title === 'string' ? skill.title : skill.name;
        validateSkill(skill.name, skill.description, skill.body, title);
        if (names.has(skill.name)) throw new Error('Saved skill names collide');
        names.add(skill.name);
        return { ...skill, title };
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
            validateSkill(change.name, change.description, change.body, change.title ?? change.name);
            if (users.some(item => item.name === change.name) || builtins.some(item => item.name === change.name))
                throw new Error('Skill name already exists');
            users.push({ id: randomUUID(), name: change.name, title: (change.title ?? change.name).trim(),
                description: change.description.trim(),
                body: change.body.trim(), enabled: true, provenance: 'user', version: 1 });
        } else {
            const index = users.findIndex(item => item.id === change.id);
            if (index < 0) throw new Error('Only user-created skills can be changed');
            if (change.type === 'delete') users.splice(index, 1);
            else if (change.type === 'enable') users[index] = { ...users[index], enabled: change.enabled,
                version: users[index].version + 1 };
            else {
                validateSkill(change.name, change.description, change.body, change.title ?? users[index].title);
                if (builtins.some(item => item.name === change.name) ||
                    users.some((item, at) => at !== index && item.name === change.name))
                    throw new Error('Skill name already exists');
                users[index] = { ...users[index], name: change.name, title: (change.title ?? users[index].title).trim(),
                    description: change.description.trim(),
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
/** Only a fresh, leading command can request deterministic Markdown publication. */
export function roadmapPublicationIntent(content: string): { mode: 'publish' | 'link'; path: string } | undefined {
    const match = /^\/roadmap (publish|link) the accepted roadmap to ([^\r\n]+?)\s*$/i.exec(content);
    if (!match) return undefined;
    const path = match[2].trim();
    return path && path.length <= 512 ? { mode: match[1].toLowerCase() as 'publish' | 'link', path } : undefined;
}
export async function resolveChatSkill(content: string): Promise<ChatSkillSnapshot | undefined> {
    const name = skillCommand(content);
    if (!name) return undefined;
    const skill = (await listChatSkills()).find(item => item.name === name);
    if (!skill) throw new Error(`Unknown skill /${name}. Open Skills from Select Chat to manage commands.`);
    if (!skill.enabled) throw new Error(`Skill /${name} is disabled. Enable it from Select Chat > Skills.`);
    return { id: skill.id, name, title: skill.title, description: skill.description,
        body: skill.body, version: skill.version,
        digest: createHash('sha256').update(skill.body).digest('hex') };
}

/** Display metadata only. The trusted Chat command parser owns generation authority. */
export function generationChatSkillSnapshot(): ChatSkillSnapshot {
    const skill = builtins.find(item => item.id === 'builtin:gen-roadmap')!;
    return { id: skill.id, name: skill.name, title: skill.title,
        description: skill.description, body: skill.body, version: skill.version,
        digest: createHash('sha256').update(skill.body).digest('hex') };
}

/** Saved retry metadata is data, never proof that a protected skill was invoked. */
export function isBoundRoadmapSkill(skill: ChatSkillSnapshot | undefined): boolean {
    const builtIn = builtins.find(item => item.id === 'builtin:roadmap');
    return !!builtIn && !!skill && skill.id === builtIn.id && skill.name === builtIn.name &&
        skill.version === builtIn.version && skill.body === builtIn.body &&
        skill.digest === createHash('sha256').update(builtIn.body).digest('hex');
}

/** Protected Docs operations require the exact built-in send-time snapshot. */
export function isBoundDocumentationSkill(skill: ChatSkillSnapshot | undefined,
    name: 'docs-review'): boolean {
    const builtIn = builtins.find(item => item.id === `builtin:${name}`);
    return !!builtIn && !!skill && skill.id === builtIn.id && skill.name === name &&
        skill.version === builtIn.version && skill.body === builtIn.body &&
        skill.digest === createHash('sha256').update(builtIn.body).digest('hex');
}

/** A saved name or model-written slash string cannot grant native prompt authoring. */
export function boundPromptStage(skill: ChatSkillSnapshot | undefined):
    'prompt-ass' | 'prompt-plan' | 'prompt-write' | undefined {
    if (!skill) return undefined;
    const builtIn = builtins.find(item => item.id === `builtin:${skill.name}`);
    if (!builtIn || !['prompt-ass', 'prompt-plan', 'prompt-write'].includes(builtIn.name) ||
        skill.id !== builtIn.id || skill.name !== builtIn.name || skill.version !== builtIn.version ||
        skill.body !== builtIn.body ||
        skill.digest !== createHash('sha256').update(builtIn.body).digest('hex')) return undefined;
    return builtIn.name as 'prompt-ass' | 'prompt-plan' | 'prompt-write';
}
