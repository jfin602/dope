import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { checkEffect, parseExecutionGrant, type ExecutionGrant } from '../authority';
import { projectPath } from '../contracts';

type Result = 'prepared' | 'completed' | 'not-applied' | 'uncertain';
export interface DirectChange {
    id: string; taskId: string; runId: string; operation: 'create' | 'modify'; path: string;
    before: string | null; after: string; beforeBytes: string | null; afterBytes: string; at: string;
    result: Result; finishedAt?: string; uncertainTemp?: string;
    afterIdentity?: { device: number; inode: number; mtimeNs: string; ctimeNs: string };
}
interface Ledger { version: 1; id: string; root: string; head: string; taskId: string; runId: string;
    grantId: string; grantRevision: number; changes: DirectChange[];
    inherited?: { path: string; after: string; afterIdentity: { device: number; inode: number; mtimeNs: string; ctimeNs: string } }[];
    reverts?: { path: string; at: string; result: 'prepared' | 'reverted' | 'conflict' | 'uncertain'; reason?: string }[] }
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const protectedPart = (part: string): boolean => {
    const value = part.toLowerCase();
    return ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg', '.kube',
        '.docker', '.azure', 'node_modules', 'secrets', 'secret', 'credentials', 'private',
        '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pypirc', '.gitconfig', '.git-credentials',
        'id_rsa', 'id_ed25519', 'credentials.json'].includes(value) ||
        value === '.env' || value.startsWith('.env.') || value.startsWith('secret.') ||
        value.startsWith('token.') || value.startsWith('credential.') ||
        ['.pem', '.key', '.p12', '.pfx'].some(suffix => value.endsWith(suffix));
};
const WRITE = `import os,sys,stat,hashlib,base64,json,uuid,ctypes
root,path,operation,expected,encoded=sys.argv[1:]
def stop(): print(json.dumps({'status':'denied'})); sys.exit(0)
parts=path.split('/')
if not parts or any(not x or x in ('.','..') for x in parts): stop()
data=base64.b64decode(encoded,validate=True)
fds=[]
try:
 fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); fds.append(fd)
 for part in parts[:-1]:
  fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd); fds.append(fd)
 name=parts[-1]; before=None; identity=None; mode=0o600
 try:
  old=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
  try:
   info=os.fstat(old)
   if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1: stop()
   mode=stat.S_IMODE(info.st_mode)
   before=os.read(old,65537)
   if len(before)>65536 or len(before)!=info.st_size: stop()
   identity=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
  finally: os.close(old)
 except FileNotFoundError: pass
 if (operation=='create' and before is not None) or (operation=='modify' and before is None): stop()
 if (hashlib.sha256(before).hexdigest() if before is not None else '-')!=expected: stop()
 temp='.dope-direct-'+uuid.uuid4().hex
 keep_temp=False
 try:
  out=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=fd)
  try:
   os.fchmod(out,mode)
   view=memoryview(data)
   while view: view=view[os.write(out,view):]
   os.fsync(out)
  finally: os.close(out)
  if operation=='create': os.link(temp,name,src_dir_fd=fd,dst_dir_fd=fd,follow_symlinks=False)
  else:
   current=os.stat(name,dir_fd=fd,follow_symlinks=False)
   if not stat.S_ISREG(current.st_mode) or (current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns)!=identity: stop()
   replacement=os.stat(temp,dir_fd=fd,follow_symlinks=False)
   libc=ctypes.CDLL(None,use_errno=True)
   exchange=getattr(libc,'renameat2',None)
   if exchange is None: stop()
   exchange.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
   if exchange(fd,temp.encode(),fd,name.encode(),2)!=0: stop()
   displaced=os.stat(temp,dir_fd=fd,follow_symlinks=False)
   old=os.open(temp,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
   try: old_bytes=os.read(old,65537)
   finally: os.close(old)
   if (displaced.st_dev,displaced.st_ino,displaced.st_size,displaced.st_mtime_ns)!=identity[:4] or hashlib.sha256(old_bytes).hexdigest()!=expected:
    now=os.stat(name,dir_fd=fd,follow_symlinks=False)
    if (now.st_dev,now.st_ino,now.st_size,now.st_mtime_ns)!=(replacement.st_dev,replacement.st_ino,replacement.st_size,replacement.st_mtime_ns) or exchange(fd,temp.encode(),fd,name.encode(),2)!=0:
     keep_temp=True
     os.fsync(fd)
     print(json.dumps({'status':'uncertain','temp':temp})); sys.exit(0)
    os.fsync(fd)
    stop()
  os.fsync(fd)
 finally:
  if not keep_temp:
   try: os.unlink(temp,dir_fd=fd)
   except FileNotFoundError: pass
 applied=os.stat(name,dir_fd=fd,follow_symlinks=False)
 print(json.dumps({'status':'completed','device':applied.st_dev,'inode':applied.st_ino,'mtimeNs':str(applied.st_mtime_ns),'ctimeNs':str(applied.st_ctime_ns)}))
except (OSError,ValueError): stop()
finally:
 for fd in reversed(fds): os.close(fd)
`;
const RESTORE = `import os,sys,stat,hashlib,base64,json,uuid,ctypes
root,path,expected,device,inode,mtime,ctime,encoded=sys.argv[1:]
def answer(status): print(json.dumps({'status':status})); sys.exit(0)
parts=path.split('/')
if not parts or any(not x or x in ('.','..') for x in parts): answer('conflict')
data=None if encoded=='-' else base64.b64decode(encoded,validate=True)
fds=[]
try:
 fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); fds.append(fd)
 for part in parts[:-1]:
  fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd); fds.append(fd)
 name=parts[-1]
 old=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
 try:
  info=os.fstat(old)
  if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_size>65536 or (info.st_dev,info.st_ino,info.st_mtime_ns,info.st_ctime_ns)!=(int(device),int(inode),int(mtime),int(ctime)): answer('conflict')
  current=os.read(old,65537)
  if len(current)!=info.st_size or hashlib.sha256(current).hexdigest()!=expected: answer('conflict')
 finally: os.close(old)
 temp='.dope-direct-'+uuid.uuid4().hex
 libc=ctypes.CDLL(None,use_errno=True); exchange=getattr(libc,'renameat2',None)
 if exchange is None: answer('conflict')
 exchange.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
 if data is None:
  if exchange(fd,name.encode(),fd,temp.encode(),1)!=0: answer('conflict')
  try:
   moved=os.stat(temp,dir_fd=fd,follow_symlinks=False)
   movedfd=os.open(temp,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
   try: movedbytes=os.read(movedfd,65537)
   finally: os.close(movedfd)
   matched=stat.S_ISREG(moved.st_mode) and (moved.st_dev,moved.st_ino,moved.st_mtime_ns)==(int(device),int(inode),int(mtime)) and hashlib.sha256(movedbytes).hexdigest()==expected
  except OSError: matched=False
  if not matched:
   if exchange(fd,temp.encode(),fd,name.encode(),1)!=0: answer('uncertain')
   os.fsync(fd); answer('conflict')
  os.fsync(fd)
  os.unlink(temp,dir_fd=fd)
  os.fsync(fd)
  answer('reverted')
 out=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,stat.S_IMODE(info.st_mode),dir_fd=fd)
 try:
  view=memoryview(data)
  while view: view=view[os.write(out,view):]
  os.fsync(out)
 finally: os.close(out)
 if exchange(fd,temp.encode(),fd,name.encode(),2)!=0: os.unlink(temp,dir_fd=fd); answer('conflict')
 try:
  displaced=os.stat(temp,dir_fd=fd,follow_symlinks=False)
  movedfd=os.open(temp,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
  try: movedbytes=os.read(movedfd,65537)
  finally: os.close(movedfd)
  matched=stat.S_ISREG(displaced.st_mode) and (displaced.st_dev,displaced.st_ino,displaced.st_mtime_ns)==(int(device),int(inode),int(mtime)) and hashlib.sha256(movedbytes).hexdigest()==expected
 except OSError: matched=False
 if not matched:
  if exchange(fd,temp.encode(),fd,name.encode(),2)!=0: answer('uncertain')
  os.unlink(temp,dir_fd=fd); os.fsync(fd); answer('conflict')
 os.fsync(fd); os.unlink(temp,dir_fd=fd); os.fsync(fd); answer('reverted')
except (OSError,ValueError): answer('conflict')
finally:
 for fd in reversed(fds): os.close(fd)
`;
async function restore(root: string, path: string, after: string,
    identity: { device: number; inode: number; mtimeNs: string; ctimeNs: string },
    beforeBytes: string | null): Promise<'reverted' | 'conflict' | 'uncertain'> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('/usr/bin/python3', ['-c', RESTORE, root, path, after,
            String(identity.device), String(identity.inode), identity.mtimeNs, identity.ctimeNs, beforeBytes ?? '-'],
        { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', chunk => { output += String(chunk).slice(0, 300); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error('Direct restore failed'));
            try { const result = JSON.parse(output);
                resolveResult(['reverted', 'conflict', 'uncertain'].includes(result.status) ? result.status : 'uncertain');
            } catch { reject(new Error('Direct restore result invalid')); }
        });
    });
}
async function python(args: string[]): Promise<{ status: 'completed' | 'denied' | 'uncertain'; temp?: string;
    device?: number; inode?: number; mtimeNs?: string; ctimeNs?: string }> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('/usr/bin/python3', ['-c', WRITE, ...args], { env: { PATH: '/usr/bin:/bin' },
            stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', chunk => { output += String(chunk).slice(0, 300); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error('Direct writer failed'));
            try {
                const result = JSON.parse(output);
                resolveResult(result.status === 'completed' && Number.isSafeInteger(result.device) &&
                    Number.isSafeInteger(result.inode) && /^\d{1,24}$/u.test(result.mtimeNs) &&
                    /^\d{1,24}$/u.test(result.ctimeNs) ?
                    { status: 'completed', device: result.device, inode: result.inode,
                        mtimeNs: result.mtimeNs, ctimeNs: result.ctimeNs } :
                    result.status === 'uncertain' && /^\.dope-direct-[a-f0-9]{32}$/u.test(result.temp) ?
                        { status: 'uncertain', temp: result.temp } : { status: 'denied' });
            }
            catch { reject(new Error('Direct writer result invalid')); }
        });
    });
}
async function syncJson(path: string, value: Ledger): Promise<void> {
    if (await realpath(dirname(path)) !== dirname(path)) throw new Error('Unsafe direct journal parent');
    const temporary = `${path}.${randomUUID()}.tmp`;
    const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path);
    const directory = await open(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY);
    try { await directory.sync(); } finally { await directory.close(); }
}
async function journalDirectory(root: string): Promise<string> {
    let cursor = root;
    for (const part of ['.dope', 'agent', 'direct-journals']) {
        cursor = join(cursor, part);
        await mkdir(cursor, { mode: 0o700 }).catch(error => {
            if (error?.code !== 'EEXIST') throw error;
        });
        const info = await lstat(cursor);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(cursor) !== cursor)
            throw new Error('Unsafe Direct Work journal directory');
    }
    return cursor;
}
async function safePath(root: string, path: string): Promise<string> {
    projectPath(path);
    if (path.split('/').some(protectedPart)) throw new Error('Protected direct path');
    const target = resolve(root, path);
    if (!target.startsWith(root + sep)) throw new Error('Direct path escape');
    let parent = root;
    for (const part of path.split('/').slice(0, -1)) {
        parent = join(parent, part);
        const info = await lstat(parent);
        if (!info.isDirectory() || info.isSymbolicLink() || info.nlink < 2)
            throw new Error('Unsafe direct parent');
    }
    return target;
}
async function bytesAt(path: string): Promise<Buffer | null> {
    const info = await lstat(path).catch(error => error?.code === 'ENOENT' ? undefined : Promise.reject(error));
    if (!info) return null;
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 65_536)
        throw new Error('Unsafe direct target');
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
        const current = await file.stat();
        if (!current.isFile() || current.nlink !== 1 || current.size !== info.size || current.ino !== info.ino)
            throw new Error('Direct target changed');
        const bytes = await file.readFile();
        if (bytes.length !== info.size) throw new Error('Direct target changed');
        return bytes;
    } finally { await file.close(); }
}
async function git(root: string, args: string[]): Promise<string> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd: root, env: { PATH: '/usr/bin:/bin',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' },
            stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', chunk => { output += String(chunk); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolveResult(output) : reject(new Error('Direct Git basis unavailable')));
    });
}
async function gitIgnored(root: string, path: string): Promise<boolean> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false',
            'check-ignore', '-q', '--', path], { cwd: root, env: { PATH: '/usr/bin:/bin',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' },
        stdio: 'ignore' });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolveResult(true) : code === 1 ? resolveResult(false) :
            reject(new Error('Direct Git ignore check unavailable')));
    });
}

/** Dope-owned canonical writer. The model and its commands retain only the isolated /work mount. */
export class DirectWorkJournal {
    private static readonly reverting = new Set<string>();
    private constructor(readonly root: string, readonly path: string, private ledger: Ledger,
        private readonly grant: ExecutionGrant,
        private readonly scope?: { authorizedPaths: readonly string[]; reservedPaths: readonly string[] }) {}
    static async create(root: string, head: string, taskId: string, runId: string,
        offeredGrant: ExecutionGrant,
        scope?: { authorizedPaths: readonly string[]; reservedPaths: readonly string[] },
        inherited?: readonly { path: string; after: string; afterIdentity: {
            device: number; inode: number; mtimeNs: string; ctimeNs: string } }[]): Promise<DirectWorkJournal> {
        const grant = parseExecutionGrant(offeredGrant);
        if (!isAbsolute(root) || await realpath(root) !== root || grant.taskId !== taskId ||
            !/^[a-f0-9]{40}$/u.test(head) || !runId || (await git(root, ['rev-parse', 'HEAD'])).trim() !== head)
            throw new Error('Direct Work identity mismatch');
        const directory = await journalDirectory(root);
        const ledger: Ledger = { version: 1, id: randomUUID(), root, head, taskId, runId,
            grantId: grant.id, grantRevision: grant.revision, changes: [],
            ...(inherited?.length ? { inherited: [...inherited] } : {}) };
        const path = join(directory, `${ledger.id}.json`);
        await syncJson(path, ledger);
        return new DirectWorkJournal(root, path, ledger, grant, scope);
    }
    get id(): string { return this.ledger.id; }
    get changes(): readonly DirectChange[] { return this.ledger.changes; }
    async assertActive(): Promise<void> {
        const journalInfo = await lstat(this.path);
        if (!journalInfo.isFile() || journalInfo.isSymbolicLink() || journalInfo.nlink !== 1 ||
            await readFile(this.path, 'utf8') !== JSON.stringify(this.ledger))
            throw new Error('Direct Work journal changed');
        if (await realpath(this.root) !== this.root || (await git(this.root, ['rev-parse', 'HEAD'])).trim() !== this.ledger.head)
            throw new Error('Direct Work source identity changed');
        if (this.ledger.changes.some(change => change.result === 'prepared' || change.result === 'uncertain'))
            throw new Error('Direct Work journal requires reconciliation');
        const own = new Set([...(this.ledger.inherited?.map(item => item.path) ?? []),
            ...this.ledger.changes.filter(change => change.result === 'completed').map(change => change.path)]);
        const status = await git(this.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
        for (const entry of status.split('\0')) if (entry && !entry.slice(3).startsWith('.dope/') &&
            !own.has(entry.slice(3)))
            throw new Error('Concurrent or dirty owner source changes');
        for (const change of this.ledger.changes.filter(item => item.result === 'completed')) {
            const latest = [...this.ledger.changes].reverse().find(item => item.path === change.path && item.result === 'completed');
            if (latest !== change) continue;
            const current = await bytesAt(await safePath(this.root, change.path));
            const info = await lstat(join(this.root, change.path), { bigint: true });
            if (!current || hash(current) !== change.after || !change.afterIdentity ||
                info.dev !== BigInt(change.afterIdentity.device) || info.ino !== BigInt(change.afterIdentity.inode) ||
                info.mtimeNs.toString() !== change.afterIdentity.mtimeNs ||
                info.ctimeNs.toString() !== change.afterIdentity.ctimeNs)
                throw new Error('Concurrent owner edit conflicts with Direct Work');
        }
        for (const inherited of this.ledger.inherited ?? []) {
            if (this.ledger.changes.some(item => item.path === inherited.path && item.result === 'completed')) continue;
            const current = await bytesAt(await safePath(this.root, inherited.path));
            const info = await lstat(join(this.root, inherited.path), { bigint: true });
            if (!current || hash(current) !== inherited.after || info.dev !== BigInt(inherited.afterIdentity.device) ||
                info.ino !== BigInt(inherited.afterIdentity.inode) ||
                info.mtimeNs.toString() !== inherited.afterIdentity.mtimeNs ||
                info.ctimeNs.toString() !== inherited.afterIdentity.ctimeNs)
                throw new Error('Inherited Direct Work source changed');
        }
    }
    async edit(operation: 'create' | 'modify', path: string, content: string,
        unsaved: (path: string) => Promise<boolean>): Promise<DirectChange> {
        if (operation !== 'create' && operation !== 'modify' || this.ledger.changes.length >= 500)
            throw new Error('Direct Work operation denied');
        await this.assertActive();
        const within = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}/`);
        if (!this.grant.toolSelection?.tools.some(tool => tool.id === 'edit_file') ||
            this.scope && (!this.scope.authorizedPaths.some(allowed => within(allowed, path)) ||
                this.scope.reservedPaths.some(reserved => within(reserved, path) || within(path, reserved))))
            throw new Error('Direct Work tool or delegated scope denied');
        if (!checkEffect(this.grant, { kind: `project-${operation}`, scope: 'project', path }).allowed ||
            !checkEffect(this.grant, { kind: 'workspace-write', scope: 'workspace', path }).allowed)
            throw new Error('Direct Work effect denied');
        const target = await safePath(this.root, path);
        if (await gitIgnored(this.root, path)) throw new Error('Ignored project path cannot be edited by Direct Work');
        if (await unsaved(path)) throw new Error('Unsaved editor conflicts with Direct Work');
        const before = await bytesAt(target);
        if (operation === 'create' ? before !== null : before === null)
            throw new Error('Direct Work create/modify conflict');
        const prior = [...this.ledger.changes].reverse().find(change => change.path === path && change.result === 'completed');
        const inherited = this.ledger.inherited?.find(item => item.path === path);
        if (prior ? hash(before!) !== prior.after : inherited ? hash(before!) !== inherited.after : (await git(this.root,
            ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', path])).length > 0)
            throw new Error('Direct Work source changed or was dirty');
        const afterBytes = Buffer.from(content, 'utf8');
        if (afterBytes.length > 65_536) throw new Error('Direct Work edit exceeds limit');
        const change: DirectChange = { id: randomUUID(), taskId: this.ledger.taskId, runId: this.ledger.runId,
            operation, path, before: before === null ? null : hash(before), after: hash(afterBytes),
            beforeBytes: before === null ? null : before.toString('base64'),
            afterBytes: afterBytes.toString('base64'), at: new Date().toISOString(), result: 'prepared' };
        this.ledger.changes.push(change);
        await syncJson(this.path, this.ledger);
        const writer = await python([this.root, path, operation, change.before ?? '-', afterBytes.toString('base64')]);
        const current = await bytesAt(target).catch(() => null);
        change.result = writer.status === 'uncertain' ? 'uncertain' :
            writer.status === 'completed' && current && hash(current) === change.after ? 'completed' :
                writer.status === 'denied' && (current === null && before === null ||
                    current && before && hash(current) === change.before) ? 'not-applied' : 'uncertain';
        if (writer.temp) change.uncertainTemp = writer.temp;
        if (writer.status === 'completed' && writer.device !== undefined && writer.inode !== undefined &&
            writer.mtimeNs !== undefined && writer.ctimeNs !== undefined)
            change.afterIdentity = { device: writer.device, inode: writer.inode,
                mtimeNs: writer.mtimeNs, ctimeNs: writer.ctimeNs };
        change.finishedAt = new Date().toISOString();
        await syncJson(this.path, this.ledger);
        if (change.result !== 'completed') throw new Error('Direct Work write denied or uncertain');
        return change;
    }
    static async reconcile(root: string, path: string): Promise<readonly DirectChange[]> {
        if (!isAbsolute(root) || await realpath(root) !== root ||
            dirname(path) !== join(root, '.dope', 'agent', 'direct-journals') ||
            await realpath(dirname(path)) !== dirname(path))
            throw new Error('Unsafe Direct Work journal location');
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Unsafe Direct Work journal file');
        const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
        if (ledger.version !== 1 || ledger.root !== root ||
            basename(path) !== `${ledger.id}.json` || !/^[a-f0-9-]{36}$/u.test(ledger.id) ||
            !Array.isArray(ledger.changes) || ledger.changes.length > 500)
            throw new Error('Invalid Direct Work journal');
        for (const inherited of ledger.inherited ?? []) {
            if (typeof inherited.path !== 'string' || typeof inherited.after !== 'string' ||
                !/^[a-f0-9]{64}$/u.test(inherited.after) ||
                !Number.isSafeInteger(inherited.afterIdentity?.device) ||
                !Number.isSafeInteger(inherited.afterIdentity?.inode) ||
                !/^\d{1,24}$/u.test(inherited.afterIdentity?.mtimeNs ?? '') ||
                !/^\d{1,24}$/u.test(inherited.afterIdentity?.ctimeNs ?? ''))
                throw new Error('Invalid inherited Direct Work source');
            await safePath(root, inherited.path);
        }
        for (const revert of ledger.reverts ?? []) {
            if (typeof revert.path !== 'string' || typeof revert.at !== 'string' ||
                !['prepared', 'reverted', 'conflict', 'uncertain'].includes(revert.result))
                throw new Error('Invalid Direct Work revert receipt');
            await safePath(root, revert.path);
            if (revert.result === 'prepared') { revert.result = 'uncertain';
                revert.reason = 'Revert interrupted before its outcome was recorded'; }
        }
        for (const change of ledger.changes) {
            if (change.taskId !== ledger.taskId || change.runId !== ledger.runId ||
                !['create', 'modify'].includes(change.operation) || !['prepared', 'completed', 'not-applied', 'uncertain'].includes(change.result) ||
                typeof change.afterBytes !== 'string' || typeof change.after !== 'string' ||
                hash(Buffer.from(change.afterBytes, 'base64')) !== change.after ||
                change.beforeBytes !== null && (typeof change.beforeBytes !== 'string' ||
                    hash(Buffer.from(change.beforeBytes, 'base64')) !== change.before))
                throw new Error('Direct Work journal image hash mismatch');
            await safePath(root, change.path);
            if (change.result !== 'prepared') continue;
            const current = await bytesAt(await safePath(root, change.path)).catch(() => null);
            change.result = current === null && change.before === null ||
                current && change.before && hash(current) === change.before ?
                    'not-applied' : 'uncertain';
            change.finishedAt = new Date().toISOString();
        }
        await syncJson(path, ledger);
        return ledger.changes;
    }
    static async review(root: string, path: string): Promise<{ changes: readonly DirectChange[];
        inherited: readonly NonNullable<Ledger['inherited']>[number][];
        reverts: readonly { path: string; at: string; result: 'prepared' | 'reverted' | 'conflict' | 'uncertain'; reason?: string }[];
        conflicts: string[] }> {
        const changes = await this.reconcile(root, path);
        const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
        const conflicts: string[] = [];
        for (const [file, latest] of new Map(changes.filter(change => change.result === 'completed')
            .map(change => [change.path, change])).entries()) {
            if (ledger.reverts?.some(item => item.path === file && item.result === 'reverted')) continue;
            if (ledger.reverts?.some(item => item.path === file && item.result === 'uncertain')) {
                conflicts.push(file); continue;
            }
            const current = await bytesAt(await safePath(root, file)).catch(() => null);
            const info = await lstat(join(root, file), { bigint: true }).catch(() => undefined);
            if (!latest.afterIdentity || !current || hash(current) !== latest.after ||
                info?.dev !== BigInt(latest.afterIdentity.device) || info?.ino !== BigInt(latest.afterIdentity.inode) ||
                info?.mtimeNs.toString() !== latest.afterIdentity.mtimeNs ||
                info?.ctimeNs.toString() !== latest.afterIdentity.ctimeNs)
                conflicts.push(file);
        }
        for (const inherited of ledger.inherited ?? []) {
            if (changes.some(change => change.path === inherited.path && change.result === 'completed')) continue;
            const current = await bytesAt(await safePath(root, inherited.path)).catch(() => null);
            const info = await lstat(join(root, inherited.path), { bigint: true }).catch(() => undefined);
            if (!current || hash(current) !== inherited.after ||
                info?.dev !== BigInt(inherited.afterIdentity.device) ||
                info?.ino !== BigInt(inherited.afterIdentity.inode) ||
                info?.mtimeNs.toString() !== inherited.afterIdentity.mtimeNs ||
                info?.ctimeNs.toString() !== inherited.afterIdentity.ctimeNs)
                conflicts.push(inherited.path);
        }
        return { changes, inherited: ledger.inherited ?? [], reverts: ledger.reverts ?? [], conflicts };
    }
    static async revert(root: string, path: string, files: readonly string[],
        unsaved: (path: string) => Promise<boolean>): Promise<{ path: string; result: 'reverted' | 'conflict'; reason?: string }[]> {
        if (this.reverting.has(path)) throw new Error('Direct Work revert already in progress');
        this.reverting.add(path);
        try {
        const review = await this.review(root, path);
        const ledger = JSON.parse(await readFile(path, 'utf8')) as Ledger;
        if ((await git(root, ['rev-parse', 'HEAD'])).trim() !== ledger.head)
            throw new Error('Direct Work source HEAD changed; review source before reverting');
        const results: { path: string; result: 'reverted' | 'conflict'; reason?: string }[] = [];
        for (const file of [...new Set(files)]) {
            if (review.changes.some(change => change.path === file &&
                (change.result === 'prepared' || change.result === 'uncertain')))
                throw new Error(`Direct Work effect is uncertain for ${file}; inspect source before reverting`);
            const edits = review.changes.filter(change => change.path === file && change.result === 'completed');
            if (!edits.length) throw new Error('Requested path is not an applied Direct Work effect');
            if (ledger.reverts?.some(item => item.path === file && item.result === 'uncertain'))
                throw new Error(`Earlier Direct revert is uncertain for ${file}; inspect source before another action`);
            if (ledger.reverts?.some(item => item.path === file && item.result === 'reverted')) {
                results.push({ path: file, result: 'conflict', reason: 'Already reverted' }); continue;
            }
            const last = edits.at(-1)!;
            let result: 'reverted' | 'conflict' = 'conflict';
            let reason: string | undefined;
            if (review.conflicts.includes(file)) reason = 'Current file identity or hash differs from the agent after-state';
            else if (await unsaved(file)) reason = 'Unsaved editor changes';
            else if (!last.afterIdentity) reason = 'Historical write has no verified after-state identity';
            else {
                const pending = { path: file, at: new Date().toISOString(), result: 'prepared' as const };
                ledger.reverts ??= [];
                ledger.reverts.push(pending);
                await syncJson(path, ledger);
                const restored = await restore(root, file, last.after, last.afterIdentity, edits[0].beforeBytes)
                    .catch(() => 'uncertain' as const);
                if (restored === 'uncertain') {
                    ledger.reverts[ledger.reverts.length - 1] = { ...pending, result: 'uncertain',
                        reason: 'Revert outcome uncertain; inspect source' };
                    await syncJson(path, ledger);
                    throw new Error(`Direct restore uncertain for ${file}; inspect source before another action`);
                }
                ledger.reverts.pop();
                result = restored;
                if (restored === 'conflict') reason = 'Current file changed during revert';
            }
            const entry = { path: file, at: new Date().toISOString(), result, ...(reason ? { reason } : {}) };
            ledger.reverts ??= [];
            ledger.reverts.push(entry);
            await syncJson(path, ledger);
            results.push({ path: file, result, ...(reason ? { reason } : {}) });
        }
        return results;
        } finally { this.reverting.delete(path); }
    }
}
