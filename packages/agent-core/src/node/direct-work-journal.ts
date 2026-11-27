import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { checkEffect, parseExecutionGrant, type ExecutionGrant } from '../authority';
import { projectPath, type AcceptedDirtyBasis } from '../contracts';
import { assertDirtyBasis, captureDirtyBasis, parseAcceptedDirtyBasis } from './dirty-basis';

type FileIdentity = { device: number; inode: number; mtimeNs: string; ctimeNs: string };

type Result = 'prepared' | 'completed' | 'not-applied' | 'uncertain';
export interface DirectChange {
    id: string; taskId: string; runId: string; operation: 'create' | 'modify'; path: string;
    before: string | null; after: string; beforeBytes: string | null; afterBytes: string; at: string;
    result: Result; finishedAt?: string; uncertainTemp?: string;
    afterIdentity?: { device: number; inode: number; mtimeNs: string; ctimeNs: string };
    beforeIdentity?: FileIdentity | null;
    parents?: { path: string; before: 'existing' | 'absent'; afterIdentity?: { device: number; inode: number } }[];
    tempPath?: string;
}
interface Ledger { version: 1; id: string; root: string; head: string; taskId: string; runId: string;
    grantId: string; grantRevision: number; changes: DirectChange[];
    ownerBasis?: { basis: AcceptedDirtyBasis; identities: Record<string, FileIdentity | null> };
    inherited?: { path: string; after: string; afterIdentity: { device: number; inode: number; mtimeNs: string; ctimeNs: string } }[];
    reverts?: { path: string; at: string; result: 'prepared' | 'reverted' | 'conflict' | 'uncertain';
        reason?: string; tempPath?: string; parentCleanup?: string[]; removedParents?: string[] }[] }
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const validText = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.includes('\0')) return false;
    for (const character of value) {
        const code = character.codePointAt(0)!;
        if (code >= 0xd800 && code <= 0xdfff) return false;
    }
    return true;
};
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
root,path,operation,expected,encoded,expected_device,expected_inode,expected_mtime,expected_ctime,parent_wire,fault,temp_name=sys.argv[1:]
class Stop(Exception):
 def __init__(self,status): self.status=status
def stop(status='conflict'): raise Stop(status)
parts=path.split('/')
if not parts or any(not x or x in ('.','..') for x in parts): stop('denied')
data=base64.b64decode(encoded,validate=True)
plan=json.loads(base64.b64decode(parent_wire,validate=True))
if len(plan)!=len(parts)-1: stop('denied')
fds=[]; made=[]; temp=None; committed=False; status='denied'; applied=None
try:
 rootfd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); fds.append(rootfd)
 for index,part in enumerate(parts[:-1]):
  parent=fds[-1]; item=plan[index]
  if item['path']!='/'.join(parts[:index+1]): stop('denied')
  if item['before']=='absent':
   try:
    os.mkdir(part,0o700,dir_fd=parent)
   except FileExistsError: stop()
   info=os.stat(part,dir_fd=parent,follow_symlinks=False)
   made.append((parent,part,info.st_dev,info.st_ino,item['path']))
   os.fsync(parent)
  child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
  info=os.fstat(child)
  if item['before']=='existing' and (info.st_dev,info.st_ino)!=(item['device'],item['inode']): stop()
  if item['before']=='absent' and (info.st_dev,info.st_ino)!=(made[-1][2],made[-1][3]): stop()
  fds.append(child)
  if fault=='pause-after-parent' and item['before']=='absent':
   import time
   time.sleep(30)
 fd=fds[-1]; name=parts[-1]; before=None; identity=None; mode=0o600
 try:
  old=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
  try:
   info=os.fstat(old)
   if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1: stop('denied')
   mode=stat.S_IMODE(info.st_mode)
   before=os.read(old,65537)
   if len(before)>65536 or len(before)!=info.st_size: stop()
   identity=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
  finally: os.close(old)
 except FileNotFoundError: pass
 if (operation=='create' and before is not None) or (operation=='modify' and before is None): stop()
 if (hashlib.sha256(before).hexdigest() if before is not None else '-')!=expected: stop()
 if expected_device!='-' and (identity is None or (identity[0],identity[1],identity[3],identity[4])!=(int(expected_device),int(expected_inode),int(expected_mtime),int(expected_ctime))): stop()
 temp=temp_name
 if not temp.startswith('.dope-direct-') or len(temp)!=45: stop('denied')
 out=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=fd)
 try:
  os.fchmod(out,mode)
  view=memoryview(data)
  while view: view=view[os.write(out,view):]
  os.fsync(out)
 finally: os.close(out)
 if fault=='after-temp': stop('uncertain')
 if fault=='pause-after-temp':
  import time
  time.sleep(0.4)
 # The entire descriptor chain must still be rooted at the authorized project.
 for index,part in enumerate(parts[:-1]):
  linked=os.stat(part,dir_fd=fds[index],follow_symlinks=False)
  opened=os.fstat(fds[index+1])
  if (linked.st_dev,linked.st_ino)!=(opened.st_dev,opened.st_ino): stop()
 if operation=='create': os.link(temp,name,src_dir_fd=fd,dst_dir_fd=fd,follow_symlinks=False)
 else:
  current=os.stat(name,dir_fd=fd,follow_symlinks=False)
  if not stat.S_ISREG(current.st_mode) or (current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns)!=identity: stop()
  replacement=os.stat(temp,dir_fd=fd,follow_symlinks=False)
  libc=ctypes.CDLL(None,use_errno=True); exchange=getattr(libc,'renameat2',None)
  if exchange is None: stop('denied')
  exchange.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
  if exchange(fd,temp.encode(),fd,name.encode(),2)!=0: stop()
  displaced=os.stat(temp,dir_fd=fd,follow_symlinks=False)
  old=os.open(temp,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
  try: old_bytes=os.read(old,65537)
  finally: os.close(old)
  if (displaced.st_dev,displaced.st_ino,displaced.st_size,displaced.st_mtime_ns)!=identity[:4] or hashlib.sha256(old_bytes).hexdigest()!=expected:
   now=os.stat(name,dir_fd=fd,follow_symlinks=False)
   if (now.st_dev,now.st_ino,now.st_size,now.st_mtime_ns)!=(replacement.st_dev,replacement.st_ino,replacement.st_size,replacement.st_mtime_ns) or exchange(fd,temp.encode(),fd,name.encode(),2)!=0:
    temp=None; stop('uncertain')
   os.fsync(fd); stop()
 committed=True
 os.fsync(fd)
 if fault=='after-file': stop('uncertain')
 status='completed'
except Stop as error: status=error.status
except (OSError,ValueError,KeyError,TypeError): status='uncertain' if committed else 'conflict'
finally:
 if temp is not None and fds:
  try: os.unlink(temp,dir_fd=fds[-1])
  except FileNotFoundError: pass
  except OSError: status='uncertain'
 if committed and status=='completed':
  try: applied=os.stat(parts[-1],dir_fd=fds[-1],follow_symlinks=False)
  except OSError: status='uncertain'
 if not committed:
  for parent,part,dev,ino,_ in reversed(made):
   try:
    info=os.stat(part,dir_fd=parent,follow_symlinks=False)
    if (info.st_dev,info.st_ino)!=(dev,ino): status='uncertain'; break
    os.rmdir(part,dir_fd=parent); os.fsync(parent)
   except OSError: status='uncertain'; break
 for handle in reversed(fds): os.close(handle)
print(json.dumps({'status':status,'parents':[{'path':p,'device':d,'inode':i} for _,_,d,i,p in made] if committed or status=='uncertain' else [],'device':applied.st_dev if applied else None,'inode':applied.st_ino if applied else None,'mtimeNs':str(applied.st_mtime_ns) if applied else None,'ctimeNs':str(applied.st_ctime_ns) if applied else None}))
`;
const RESTORE = `import os,sys,stat,hashlib,base64,json,uuid,ctypes
root,path,expected,device,inode,mtime,ctime,encoded,temp=sys.argv[1:]
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
 if not temp.startswith('.dope-direct-') or len(temp)!=45: answer('conflict')
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
const REMOVE_EMPTY_PARENTS = `import os,sys,json,stat
root,wire=sys.argv[1:]
parents=json.loads(wire); removed=[]
fds=[]
try:
 base=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); fds.append(base)
 for item in parents:
  parts=item['path'].split('/')
  if not parts or any(not part or part in ('.','..') for part in parts): break
  cursor=base; opened=[]
  try:
   for part in parts[:-1]:
    cursor=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=cursor); opened.append(cursor)
   info=os.stat(parts[-1],dir_fd=cursor,follow_symlinks=False)
   if not stat.S_ISDIR(info.st_mode) or (info.st_dev,info.st_ino)!=(item['device'],item['inode']): break
   os.rmdir(parts[-1],dir_fd=cursor); os.fsync(cursor); removed.append(item['path'])
  except OSError: break
  finally:
   for handle in reversed(opened): os.close(handle)
 print(json.dumps({'status':'completed','removed':removed}))
finally:
 for handle in reversed(fds): os.close(handle)
`;
async function removeEmptyParents(root: string, parents: NonNullable<DirectChange['parents']>): Promise<string[]> {
    const created = parents.filter(parent => parent.before === 'absent' && parent.afterIdentity)
        .reverse().map(parent => ({ path: parent.path, ...parent.afterIdentity! }));
    if (!created.length) return [];
    return new Promise<string[]>((resolveResult, reject) => {
        const child = spawn('/usr/bin/python3', ['-c', REMOVE_EMPTY_PARENTS, root, JSON.stringify(created)],
            { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', chunk => { output += String(chunk).slice(0, 3000); });
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error('Direct parent cleanup uncertain'));
            try { const result = JSON.parse(output);
                if (result.status !== 'completed' || !Array.isArray(result.removed) ||
                    result.removed.some((path: unknown) => typeof path !== 'string' ||
                        !created.some(item => item.path === path)))
                    throw new Error('Invalid Direct parent cleanup result');
                resolveResult(result.removed);
            } catch { reject(new Error('Direct parent cleanup uncertain')); }
        });
    });
}
async function restore(root: string, path: string, after: string,
    identity: { device: number; inode: number; mtimeNs: string; ctimeNs: string },
    beforeBytes: string | null, tempPath: string): Promise<'reverted' | 'conflict' | 'uncertain'> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('/usr/bin/python3', ['-c', RESTORE, root, path, after,
            String(identity.device), String(identity.inode), identity.mtimeNs, identity.ctimeNs,
            beforeBytes ?? '-', tempPath],
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
async function python(args: string[], signal?: AbortSignal): Promise<{ status: 'completed' | 'denied' | 'conflict' | 'uncertain';
    parents?: { path: string; device: number; inode: number }[];
    device?: number; inode?: number; mtimeNs?: string; ctimeNs?: string }> {
    return new Promise((resolveResult, reject) => {
        const child = spawn('/usr/bin/python3', ['-c', WRITE, ...args], { env: { PATH: '/usr/bin:/bin' },
            stdio: ['ignore', 'pipe', 'pipe'], signal });
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
                        mtimeNs: result.mtimeNs, ctimeNs: result.ctimeNs,
                        parents: Array.isArray(result.parents) ? result.parents : [] } :
                    result.status === 'uncertain' ? { status: 'uncertain',
                        parents: Array.isArray(result.parents) ? result.parents : [] } :
                    result.status === 'conflict' ? { status: 'conflict' } : { status: 'denied' });
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
    let absent = false;
    for (const part of path.split('/').slice(0, -1)) {
        parent = join(parent, part);
        if (absent) continue;
        const info = await lstat(parent).catch(error => error?.code === 'ENOENT' ? undefined : Promise.reject(error));
        if (!info) { absent = true; continue; }
        if (!info.isDirectory() || info.isSymbolicLink() || info.nlink < 2)
            throw new Error('Unsafe direct parent');
    }
    return target;
}
async function parentPlan(root: string, path: string): Promise<NonNullable<DirectChange['parents']>> {
    const plan: NonNullable<DirectChange['parents']> = [];
    let cursor = root;
    let absent = false;
    for (const part of path.split('/').slice(0, -1)) {
        cursor = join(cursor, part);
        if (absent) { plan.push({ path: cursor.slice(root.length + 1).split(sep).join('/'), before: 'absent' }); continue; }
        const info = await lstat(cursor).catch(error => error?.code === 'ENOENT' ? undefined : Promise.reject(error));
        if (!info) { absent = true; plan.push({ path: cursor.slice(root.length + 1).split(sep).join('/'), before: 'absent' }); continue; }
        if (!info.isDirectory() || info.isSymbolicLink() || info.nlink < 2)
            throw new Error('Unsafe direct parent');
        plan.push({ path: cursor.slice(root.length + 1).split(sep).join('/'), before: 'existing',
            afterIdentity: { device: info.dev, inode: info.ino } });
    }
    return plan;
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
async function identityAt(path: string): Promise<FileIdentity | null> {
    const info = await lstat(path, { bigint: true }).catch(error =>
        error?.code === 'ENOENT' ? undefined : Promise.reject(error));
    if (!info) return null;
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n ||
        !Number.isSafeInteger(Number(info.dev)) || !Number.isSafeInteger(Number(info.ino)))
        throw new Error('Unsafe Direct Work owner file');
    return { device: Number(info.dev), inode: Number(info.ino),
        mtimeNs: info.mtimeNs.toString(), ctimeNs: info.ctimeNs.toString() };
}
const sameIdentity = (left: FileIdentity | null, right: FileIdentity | null): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
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
    private writing = false;
    private constructor(readonly root: string, readonly path: string, private ledger: Ledger,
        private readonly grant: ExecutionGrant,
        private readonly scope?: { authorizedPaths: readonly string[]; reservedPaths: readonly string[] }) {}
    static async create(root: string, head: string, taskId: string, runId: string,
        offeredGrant: ExecutionGrant,
        scope?: { authorizedPaths: readonly string[]; reservedPaths: readonly string[] },
        inherited?: readonly { path: string; after: string; afterIdentity: {
            device: number; inode: number; mtimeNs: string; ctimeNs: string } }[],
        acceptedDirty?: AcceptedDirtyBasis): Promise<DirectWorkJournal> {
        const grant = parseExecutionGrant(offeredGrant);
        if (!isAbsolute(root) || await realpath(root) !== root || grant.taskId !== taskId ||
            !/^[a-f0-9]{40}$/u.test(head) || !runId || (await git(root, ['rev-parse', 'HEAD'])).trim() !== head)
            throw new Error('Direct Work identity mismatch');
        const directory = await journalDirectory(root);
        if (acceptedDirty) await assertDirtyBasis(root, acceptedDirty);
        const identities: Record<string, FileIdentity | null> = Object.create(null);
        for (const item of acceptedDirty?.paths ?? []) {
            identities[item.path] = await identityAt(await safePath(root, item.path));
            if ((item.code === ' D') !== (identities[item.path] === null))
                throw new Error('Reviewed owner file changed before Direct Work started');
        }
        if (acceptedDirty) await assertDirtyBasis(root, acceptedDirty);
        const ledger: Ledger = { version: 1, id: randomUUID(), root, head, taskId, runId,
            grantId: grant.id, grantRevision: grant.revision, changes: [],
            ...(acceptedDirty ? { ownerBasis: { basis: acceptedDirty, identities } } : {}),
            ...(inherited?.length ? { inherited: [...inherited] } : {}) };
        const path = join(directory, `${ledger.id}.json`);
        await syncJson(path, ledger);
        return new DirectWorkJournal(root, path, ledger, grant, scope);
    }
    get id(): string { return this.ledger.id; }
    get changes(): readonly DirectChange[] { return this.ledger.changes; }
    matches(taskId: string, runId: string, root: string, offeredGrant: ExecutionGrant): boolean {
        const grant = parseExecutionGrant(offeredGrant);
        return this.ledger.taskId === taskId && this.ledger.runId === runId && this.root === root &&
            this.ledger.grantId === grant.id && this.ledger.grantRevision === grant.revision;
    }
    async assertActive(): Promise<void> {
        const journalInfo = await lstat(this.path);
        if (!journalInfo.isFile() || journalInfo.isSymbolicLink() || journalInfo.nlink !== 1 ||
            await readFile(this.path, 'utf8') !== JSON.stringify(this.ledger))
            throw new Error('Direct Work journal changed');
        if (await realpath(this.root) !== this.root || (await git(this.root, ['rev-parse', 'HEAD'])).trim() !== this.ledger.head)
            throw new Error('Direct Work source identity changed');
        if (this.ledger.changes.some(change => change.result === 'prepared' || change.result === 'uncertain'))
            throw new Error('Direct Work journal requires reconciliation');
        const completed = new Set(this.ledger.changes.filter(change => change.result === 'completed').map(change => change.path));
        const inherited = new Set(this.ledger.inherited?.map(item => item.path) ?? []);
        const owner = this.ledger.ownerBasis;
        const own = new Set([...(owner?.basis.paths.map(item => item.path) ?? []), ...inherited, ...completed]);
        const dirty = await captureDirtyBasis(this.root);
        for (const item of dirty.paths) if (!own.has(item.path))
            throw new Error('Concurrent or dirty owner source changes');
        for (const item of owner?.basis.paths ?? []) {
            if (completed.has(item.path) || inherited.has(item.path)) continue;
            const current = dirty.paths.find(entry => entry.path === item.path);
            if (JSON.stringify(current) !== JSON.stringify(item) ||
                !sameIdentity(await identityAt(await safePath(this.root, item.path)),
                    owner!.identities[item.path] ?? null))
                throw new Error('Reviewed owner source changed during Direct Work');
        }
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
    async write(path: string, content: string, unsaved: (path: string) => Promise<boolean>,
        signal?: AbortSignal): Promise<DirectChange> {
        const target = await safePath(this.root, path);
        const before = await bytesAt(target);
        return this.edit(before === null ? 'create' : 'modify', path, content, unsaved, signal,
            before === null ? undefined : hash(before), undefined, { identity: await identityAt(target) },
            this.grant.toolSelection?.tools.some(tool => tool.id === 'write') ? 'write' : 'edit_file');
    }
    async exactEdit(path: string, edits: readonly { oldText: string; newText: string }[],
        unsaved: (path: string) => Promise<boolean>, signal?: AbortSignal): Promise<DirectChange> {
        if (!Array.isArray(edits) || edits.length < 1 || edits.length > 32 || edits.some(edit =>
            !edit || !validText(edit.oldText) || !edit.oldText || !validText(edit.newText)))
            throw new Error('Invalid Direct Work exact edit');
        const before = await bytesAt(await safePath(this.root, path));
        if (!before) throw new Error('Direct Work exact edit target conflict');
        const originalIdentity = await identityAt(await safePath(this.root, path));
        const raw = before.toString('utf8');
        if (!Buffer.from(raw, 'utf8').equals(before)) throw new Error('Direct Work exact edit requires UTF-8');
        const bom = raw.startsWith('\ufeff') ? '\ufeff' : '';
        const body = raw.slice(bom.length);
        const crlf = body.includes('\r\n') && body.indexOf('\r\n') === body.indexOf('\n') - 1;
        let updated = body.replace(/\r\n?/gu, '\n');
        const matches = edits.map(edit => {
            const oldText = edit.oldText.replace(/\r\n?/gu, '\n');
            const first = updated.indexOf(oldText);
            if (first < 0 || updated.indexOf(oldText, first + 1) >= 0)
                throw new Error('Direct Work exact edit match conflict');
            return { at: first, length: oldText.length, text: edit.newText.replace(/\r\n?/gu, '\n') };
        }).sort((a, b) => a.at - b.at);
        if (matches.some((match, index) => index > 0 && matches[index - 1].at + matches[index - 1].length > match.at))
            throw new Error('Direct Work exact edit overlap conflict');
        for (const match of matches.reverse()) updated = updated.slice(0, match.at) + match.text + updated.slice(match.at + match.length);
        const content = bom + (crlf ? updated.replace(/\n/gu, '\r\n') : updated);
        if (content === raw) throw new Error('Direct Work exact edit made no change');
        return this.edit('modify', path, content, unsaved, signal, hash(before), undefined,
            { identity: originalIdentity },
            this.grant.toolSelection?.tools.some(tool => tool.id === 'edit') ? 'edit' : 'edit_file');
    }
    async edit(operation: 'create' | 'modify', path: string, content: string,
        unsaved: (path: string) => Promise<boolean>, signal?: AbortSignal,
        expectedBefore?: string, fault?: 'pause-after-parent' | 'pause-after-temp' | 'after-temp' | 'after-file',
        expectedState?: { identity: FileIdentity | null }, toolIdentity?: 'write' | 'edit' | 'edit_file'): Promise<DirectChange> {
        if (this.writing) throw new Error('Concurrent Direct Work operation conflict');
        this.writing = true;
        const selectedIdentity = toolIdentity ?? (this.grant.toolSelection?.catalogRevision === 4 &&
            this.grant.toolSelection.tools.some(tool => tool.id === 'write') ? 'write' : 'edit_file');
        try { return await this.performEdit(operation, path, content, unsaved, signal, expectedBefore, fault, expectedState, selectedIdentity); }
        finally { this.writing = false; }
    }
    private async performEdit(operation: 'create' | 'modify', path: string, content: string,
        unsaved: (path: string) => Promise<boolean>, signal?: AbortSignal,
        expectedBefore?: string, fault?: 'pause-after-parent' | 'pause-after-temp' | 'after-temp' | 'after-file',
        expectedState?: { identity: FileIdentity | null }, toolIdentity: 'write' | 'edit' | 'edit_file' = 'edit_file'): Promise<DirectChange> {
        if (operation !== 'create' && operation !== 'modify' || this.ledger.changes.length >= 500)
            throw new Error('Direct Work operation denied');
        if (!validText(content)) throw new Error('Invalid Direct Work content');
        if (signal?.aborted) throw new Error('Direct Work cancelled');
        await this.assertActive();
        const within = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}/`);
        if (!this.grant.toolSelection?.tools.some(tool => tool.id === toolIdentity) ||
            this.scope && (!this.scope.authorizedPaths.some(allowed => within(allowed, path)) ||
                this.scope.reservedPaths.some(reserved => within(reserved, path) || within(path, reserved))))
            throw new Error('Direct Work tool or delegated scope denied');
        if (!checkEffect(this.grant, { kind: `project-${operation}`, scope: 'project', path }).allowed ||
            !checkEffect(this.grant, { kind: 'workspace-write', scope: 'workspace', path }).allowed)
            throw new Error('Direct Work effect denied');
        const target = await safePath(this.root, path);
        const parents = await parentPlan(this.root, path);
        for (const parent of parents) if (parent.before === 'absent' &&
            !checkEffect(this.grant, { kind: 'workspace-write', scope: 'workspace', path: parent.path }).allowed)
            throw new Error('Direct Work parent effect denied');
        if (await gitIgnored(this.root, path)) throw new Error('Ignored project path cannot be edited by Direct Work');
        if (await unsaved(path)) throw new Error('Unsaved editor conflicts with Direct Work');
        const before = await bytesAt(target);
        if (expectedState && !sameIdentity(await identityAt(target), expectedState.identity))
            throw new Error('Direct Work source identity conflict');
        if (expectedBefore && (!before || hash(before) !== expectedBefore))
            throw new Error('Direct Work exact edit source conflict');
        if (operation === 'create' ? before !== null : before === null)
            throw new Error('Direct Work create/modify conflict');
        const prior = [...this.ledger.changes].reverse().find(change => change.path === path && change.result === 'completed');
        const inherited = this.ledger.inherited?.find(item => item.path === path);
        const owner = this.ledger.ownerBasis?.basis.paths.find(item => item.path === path);
        const ownerIdentity = this.ledger.ownerBasis?.identities[path];
        if (prior ? hash(before!) !== prior.after : inherited ? hash(before!) !== inherited.after :
            owner ? owner.code === ' D' || !before || hash(before) !== owner.hash ||
                !sameIdentity(await identityAt(target), ownerIdentity ?? null) : (await git(this.root,
                    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', path])).length > 0)
            throw new Error('Direct Work source conflict: changed or dirty');
        const expectedIdentity = prior?.afterIdentity ?? inherited?.afterIdentity ?? ownerIdentity ??
            (before ? await identityAt(target) : null);
        const afterBytes = Buffer.from(content, 'utf8');
        if (afterBytes.length > 65_536) throw new Error('Direct Work edit exceeds limit');
        const change: DirectChange = { id: randomUUID(), taskId: this.ledger.taskId, runId: this.ledger.runId,
            operation, path, before: before === null ? null : hash(before), after: hash(afterBytes),
            beforeIdentity: await identityAt(target),
            beforeBytes: before === null ? null : before.toString('base64'),
            afterBytes: afterBytes.toString('base64'), at: new Date().toISOString(), result: 'prepared', parents,
            tempPath: `.dope-direct-${randomUUID().replace(/-/gu, '')}` };
        this.ledger.changes.push(change);
        await syncJson(this.path, this.ledger);
        if (signal?.aborted) {
            change.result = 'not-applied'; change.finishedAt = new Date().toISOString();
            await syncJson(this.path, this.ledger);
            throw new Error('Direct Work cancelled');
        }
        const writer = await python([this.root, path, operation, change.before ?? '-', afterBytes.toString('base64'),
            String(expectedIdentity?.device ?? '-'), String(expectedIdentity?.inode ?? '-'),
            expectedIdentity?.mtimeNs ?? '-', expectedIdentity?.ctimeNs ?? '-',
            Buffer.from(JSON.stringify(parents.map(parent => ({ path: parent.path, before: parent.before,
                device: parent.afterIdentity?.device, inode: parent.afterIdentity?.inode }))), 'utf8').toString('base64'),
            fault ?? '-', change.tempPath!], signal);
        let current: Buffer | null = null;
        let currentIdentity: FileIdentity | null = null;
        let currentUnsafe = false;
        try { current = await bytesAt(target); currentIdentity = await identityAt(target); }
        catch { currentUnsafe = true; }
        const tempExists = await lstat(join(dirname(target), change.tempPath!)).then(() => true,
            error => error?.code === 'ENOENT' ? false : true);
        const parentEffects = writer.parents ?? [];
        for (const effect of parentEffects) {
            const planned = parents.find(parent => parent.path === effect.path && parent.before === 'absent');
            if (planned && Number.isSafeInteger(effect.device) && Number.isSafeInteger(effect.inode))
                planned.afterIdentity = { device: effect.device, inode: effect.inode };
        }
        let parentStateMatches = true;
        let parentsBeforeStillMatch = true;
        for (const parent of parents) {
            const info = await lstat(join(this.root, parent.path)).catch(() => undefined);
            if (parent.before === 'absent' ? !parent.afterIdentity || !info ||
                info.dev !== parent.afterIdentity.device || info.ino !== parent.afterIdentity.inode :
                !info || info.dev !== parent.afterIdentity?.device || info.ino !== parent.afterIdentity?.inode)
                parentStateMatches = false;
            if (parent.before === 'absent' && info) parentsBeforeStillMatch = false;
            if (parent.before === 'existing' && (!info || info.dev !== parent.afterIdentity?.device ||
                info.ino !== parent.afterIdentity?.inode)) parentsBeforeStillMatch = false;
        }
        change.result = writer.status === 'completed' && !currentUnsafe && !tempExists && current && hash(current) === change.after &&
                parentStateMatches &&
                sameIdentity(currentIdentity, { device: writer.device!, inode: writer.inode!,
                    mtimeNs: writer.mtimeNs!, ctimeNs: writer.ctimeNs! }) ? 'completed' :
                writer.status === 'conflict' && !currentUnsafe && !tempExists && parentsBeforeStillMatch ?
                    'not-applied' :
                writer.status !== 'completed' && !currentUnsafe && !tempExists &&
                    sameIdentity(currentIdentity, change.beforeIdentity ?? null) &&
                    (current === null && before === null || current && before && hash(current) === change.before) &&
                    parentsBeforeStillMatch ? 'not-applied' : 'uncertain';
        if (writer.status === 'completed' && writer.device !== undefined && writer.inode !== undefined &&
            writer.mtimeNs !== undefined && writer.ctimeNs !== undefined)
            change.afterIdentity = { device: writer.device, inode: writer.inode,
                mtimeNs: writer.mtimeNs, ctimeNs: writer.ctimeNs };
        change.finishedAt = new Date().toISOString();
        await syncJson(this.path, this.ledger);
        if (change.result !== 'completed') throw new Error(change.result === 'uncertain' ?
            'Direct Work write uncertain; reconcile before retry' : writer.status === 'conflict' ?
            'Direct Work source conflict' : 'Direct Work write denied');
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
        if (ledger.ownerBasis) {
            const basis = parseAcceptedDirtyBasis(ledger.ownerBasis.basis);
            if (!ledger.ownerBasis.identities || typeof ledger.ownerBasis.identities !== 'object' ||
                Object.keys(ledger.ownerBasis.identities).length !== basis.paths.length)
                throw new Error('Invalid Direct Work owner basis');
            for (const item of basis.paths) {
                await safePath(root, item.path);
                if (!Object.prototype.hasOwnProperty.call(ledger.ownerBasis.identities, item.path)) {
                    throw new Error('Direct Work owner basis identity is missing.');
                }
                const identity = ledger.ownerBasis.identities[item.path];
                if (item.code === ' D' ? identity !== null :
                    !Number.isSafeInteger(identity?.device) || !Number.isSafeInteger(identity?.inode) ||
                    !/^\d{1,24}$/u.test(identity?.mtimeNs ?? '') ||
                    !/^\d{1,24}$/u.test(identity?.ctimeNs ?? ''))
                    throw new Error('Invalid Direct Work owner identity');
            }
        }
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
            if (revert.tempPath && !/^\.dope-direct-[a-f0-9]{32}$/u.test(revert.tempPath))
                throw new Error('Invalid Direct Work revert temporary plan');
            if (revert.parentCleanup && (!Array.isArray(revert.parentCleanup) ||
                revert.parentCleanup.some(parent => typeof parent !== 'string' || !revert.path.startsWith(`${parent}/`))))
                throw new Error('Invalid Direct Work revert parent plan');
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
            if (change.parents) {
                if (!Array.isArray(change.parents) || change.parents.length !== change.path.split('/').length - 1)
                    throw new Error('Invalid Direct Work parent plan');
                for (const [index, parent] of change.parents.entries()) {
                    if (parent.path !== change.path.split('/').slice(0, index + 1).join('/') ||
                        !['existing', 'absent'].includes(parent.before) ||
                        parent.afterIdentity && (!Number.isSafeInteger(parent.afterIdentity.device) ||
                            !Number.isSafeInteger(parent.afterIdentity.inode)))
                        throw new Error('Invalid Direct Work parent plan');
                }
            }
            if (change.tempPath && !/^\.dope-direct-[a-f0-9]{32}$/u.test(change.tempPath))
                throw new Error('Invalid Direct Work temporary file plan');
            if (change.result !== 'prepared') continue;
            let current: Buffer | null = null;
            let identity: FileIdentity | null = null;
            let unsafe = false;
            try { current = await bytesAt(await safePath(root, change.path));
                identity = await identityAt(join(root, change.path)); }
            catch { unsafe = true; }
            const tempExists = change.tempPath ? await lstat(join(dirname(join(root, change.path)), change.tempPath))
                .then(() => true, error => error?.code === 'ENOENT' ? false : true) : false;
            let parentsUnchanged = true;
            for (const parent of change.parents ?? []) {
                const info = await lstat(join(root, parent.path)).catch(error =>
                    error?.code === 'ENOENT' ? undefined : Promise.reject(error));
                if (parent.before === 'absent' ? Boolean(info) :
                    !info || !info.isDirectory() || info.isSymbolicLink() ||
                    info.dev !== parent.afterIdentity?.device || info.ino !== parent.afterIdentity?.inode)
                    parentsUnchanged = false;
            }
            change.result = !unsafe && !tempExists && parentsUnchanged &&
                sameIdentity(identity, change.beforeIdentity ?? null) &&
                (current === null && change.before === null ||
                current && change.before && hash(current) === change.before) ?
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
                const pending = { path: file, at: new Date().toISOString(), result: 'prepared' as const,
                    tempPath: `.dope-direct-${randomUUID().replace(/-/gu, '')}`,
                    parentCleanup: edits.flatMap(edit => edit.parents ?? []).filter(parent =>
                        parent.before === 'absent' && parent.afterIdentity).map(parent => parent.path) };
                ledger.reverts ??= [];
                ledger.reverts.push(pending);
                await syncJson(path, ledger);
                const restored = await restore(root, file, last.after, last.afterIdentity,
                    edits[0].beforeBytes, pending.tempPath)
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
            const entry: NonNullable<Ledger['reverts']>[number] = { path: file,
                at: new Date().toISOString(), result, ...(reason ? { reason } : {}),
                parentCleanup: edits.flatMap(edit => edit.parents ?? []).filter(parent =>
                    parent.before === 'absent' && parent.afterIdentity).map(parent => parent.path) };
            ledger.reverts ??= [];
            ledger.reverts.push(entry);
            await syncJson(path, ledger);
            if (result === 'reverted') {
                try {
                    const removedParents = await removeEmptyParents(root, edits.flatMap(edit => edit.parents ?? []));
                    entry.removedParents = removedParents;
                    await syncJson(path, ledger);
                }
                catch { /* File restoration is recorded; an empty attributed directory may remain. */ }
            }
            results.push({ path: file, result, ...(reason ? { reason } : {}) });
        }
        return results;
        } finally { this.reverting.delete(path); }
    }
}
