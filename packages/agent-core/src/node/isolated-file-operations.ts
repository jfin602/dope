import { Buffer } from 'node:buffer';
import { parseExecutionGrant, checkEffect } from '../authority';
import { projectPath } from '../contracts';
import type { AgentExecutionRequest } from '../execution';
import { ExecutionWorkspace } from './execution-workspace';
import { privateLocalPathPart, LOCAL_TOOL_LIMITS } from './local-tool-contracts';
import { brokerLocalRead } from './local-tool-broker';
import { launchLocalSandboxedTool } from './local-tool-sandbox';

export type IsolatedFileOperation =
    | { kind: 'read'; path: string; offset?: number; maxBytes?: number; expectedSourceHash?: string }
    | { kind: 'write'; path: string; content: string; expectedSourceHash?: string | null }
    | { kind: 'edit'; path: string; edits: readonly { oldText: string; newText: string }[] };

export interface IsolatedFileResult {
    status: 'completed' | 'denied' | 'failed' | 'cancelled' | 'recovery-required';
    output: string;
    createdDirectories?: readonly string[];
    bytesWritten?: number;
}

/** One sandboxed operation owns parent creation, target verification, replacement, and rollback.
 * A killed sandbox may have committed or left empty parents; the caller must stop and reconcile. */
export const ISOLATED_FILE_SCRIPT = `import os,sys,json,base64,stat,uuid,hashlib
kind,path,encoded,limit=sys.argv[1:]
def private(part):
 p=part.lower()
 return p in ('.git','.dope','.codex','.agents','.ssh','.aws','.config','.gnupg','.kube','.docker','.azure','.npmrc','.yarnrc','.yarnrc.yml','.netrc','.pypirc','.gitconfig','.git-credentials','id_rsa','id_ed25519','credentials.json','secrets','secret','credentials','private','node_modules') or p=='.env' or p.startswith('.env.') or p.endswith(('.pem','.key','.p12','.pfx')) or p.startswith(('secret.','token.','credential.'))
def emit(status): print(json.dumps({'status':status}))
parts=path.split('/')
if not parts or any(not p or p in ('.','..') or private(p) for p in parts):
 emit('denied'); sys.exit(0)
root=None; dirs=[]; made=[]; made_names=[]; temp=None; committed=False; status='denied'; data=b''
try:
 payload=json.loads(base64.b64decode(encoded,validate=True))
 if kind=='write':
  if isinstance(payload,dict) and set(payload)==set(('content','expectedSourceHash')):
   expected=payload['expectedSourceHash']; payload=payload['content']
   if expected is not None and (not isinstance(expected,str) or len(expected)!=64): raise ValueError()
  else: expected='unbound'
  if not isinstance(payload,str): raise ValueError()
  data=payload.encode('utf-8')
  if len(data)>int(limit): raise ValueError()
 elif kind=='edit':
  if not isinstance(payload,list) or not 1<=len(payload)<=32: raise ValueError()
  for edit in payload:
   if not isinstance(edit,dict) or set(edit)!=set(('oldText','newText')) or not all(isinstance(edit[k],str) for k in ('oldText','newText')): raise ValueError()
  if len(encoded)>262144: raise ValueError()
 else: raise ValueError()
 root=os.open('/work',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); dirs.append(root)
 parent=root
 for index,part in enumerate(parts[:-1]):
  try: child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
  except FileNotFoundError:
   os.mkdir(part,0o700,dir_fd=parent)
   info=os.stat(part,dir_fd=parent,follow_symlinks=False)
   made.append((parent,part,info.st_dev,info.st_ino))
   made_names.append('/'.join(parts[:index+1]))
   child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
  dirs.append(child); parent=child
 leaf=parts[-1]; before=None; original=None; mode=0o600
 try:
  fd=os.open(leaf,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
  try:
   info=os.fstat(fd)
   if not stat.S_ISREG(info.st_mode) or info.st_size>33554432: raise ValueError()
   before=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
   mode=stat.S_IMODE(info.st_mode)
   if kind=='edit' or kind=='write' and expected!='unbound':
    original=os.read(fd,info.st_size+1)
    if len(original)!=info.st_size: raise ValueError()
  finally: os.close(fd)
 except FileNotFoundError:
  if kind=='edit': raise ValueError()
 if kind=='write' and expected!='unbound':
  if expected is None and before is not None or expected is not None and (before is None or hashlib.sha256(original).hexdigest()!=expected): raise ValueError()
 if kind=='edit':
  raw=original.decode('utf-8')
  bom='\\ufeff' if raw.startswith('\\ufeff') else ''
  content=raw[len(bom):]
  ending='\\r\\n' if content.find('\\r\\n')!=-1 and content.find('\\r\\n')==content.find('\\n')-1 else '\\n'
  base=content.replace('\\r\\n','\\n').replace('\\r','\\n')
  matches=[]
  for edit in payload:
   old=edit['oldText'].replace('\\r\\n','\\n').replace('\\r','\\n')
   new=edit['newText'].replace('\\r\\n','\\n').replace('\\r','\\n')
   if not old or base.count(old)!=1: raise ValueError()
   matches.append((base.index(old),len(old),new))
  matches.sort()
  if any(matches[i-1][0]+matches[i-1][1]>matches[i][0] for i in range(1,len(matches))): raise ValueError()
  updated=base
  for pos,length,new in reversed(matches): updated=updated[:pos]+new+updated[pos+length:]
  if updated==base: raise ValueError()
  data=(bom+(updated.replace('\\n','\\r\\n') if ending=='\\r\\n' else updated)).encode('utf-8')
  if len(data)>int(limit): raise ValueError()
 temp='.dope-edit-'+uuid.uuid4().hex
 fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=parent)
 try:
  os.fchmod(fd,mode)
  with os.fdopen(fd,'wb',closefd=False) as out: out.write(data); out.flush()
  os.fsync(fd)
 finally: os.close(fd)
 if before is None:
  os.link(temp,leaf,src_dir_fd=parent,dst_dir_fd=parent,follow_symlinks=False)
 else:
  fd=os.open(leaf,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
  try:
   info=os.fstat(fd)
   now=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
   if not stat.S_ISREG(info.st_mode) or now!=before: raise ValueError()
   if kind=='edit':
    current=os.read(fd,info.st_size+1)
    if hashlib.sha256(current).digest()!=hashlib.sha256(original).digest(): raise ValueError()
  finally: os.close(fd)
  os.replace(temp,leaf,src_dir_fd=parent,dst_dir_fd=parent)
 committed=True; status='completed'
except (OSError,ValueError,UnicodeError,TypeError,OverflowError): status='denied'
finally:
 if temp is not None and dirs:
  try: os.unlink(temp,dir_fd=dirs[-1])
  except FileNotFoundError: pass
  except OSError: status='recovery-required'
 if not committed:
  for parent,part,dev,ino in reversed(made):
   try:
    info=os.stat(part,dir_fd=parent,follow_symlinks=False)
    if (info.st_dev,info.st_ino)!=(dev,ino): status='recovery-required'; break
    os.rmdir(part,dir_fd=parent)
   except OSError: status='recovery-required'; break
 for fd in reversed(dirs): os.close(fd)
print(json.dumps({'status':status,'createdDirectories':made_names if status=='completed' else [],'bytesWritten':len(data) if status=='completed' else 0}))
`;

const denied = (status: IsolatedFileResult['status'] = 'denied'): IsolatedFileResult =>
    ({ status, output: status === 'recovery-required' ? 'RECONCILE_CANDIDATE' : '' });

function validText(value: unknown): value is string {
    if (typeof value !== 'string' || value.includes('\0')) return false;
    for (const character of value) {
        const code = character.codePointAt(0)!;
        if (code >= 0xd800 && code <= 0xdfff) return false;
    }
    return true;
}

/** P2's operation entry point. P4/P5 will bind Pi registrations to it; no model tool is added here. */
export async function brokerIsolatedFileOperation(request: AgentExecutionRequest,
    workspace: ExecutionWorkspace, input: IsolatedFileOperation, signal?: AbortSignal,
    directMirror = false): Promise<IsolatedFileResult> {
    if (signal?.aborted) return denied('cancelled');
    if (!(workspace instanceof ExecutionWorkspace) || request.executionMode === 'direct' ||
        !input || typeof input !== 'object') return denied();
    try {
        const path = input.path;
        if (typeof path !== 'string' || Buffer.byteLength(path, 'utf8') > LOCAL_TOOL_LIMITS.pathBytes ||
            /[\u0000-\u001f\u007f]/u.test(path) ||
            path.split('/').some(privateLocalPathPart)) return denied();
        projectPath(path);
        if (request.authorizedPaths && !request.authorizedPaths.some(allowed =>
            path === allowed || path.startsWith(`${allowed}/`)) ||
            request.reservedPaths?.some(reserved => path === reserved || path.startsWith(`${reserved}/`) ||
                reserved.startsWith(`${path}/`))) return denied();
        const grant = parseExecutionGrant(request.grant);
        const nativeSelection = grant.toolSelection?.tools.some(tool =>
            ['read', 'ls', 'write', 'edit'].includes(tool.id));
        const selected = nativeSelection ?
            input.kind === 'read' ? 'read' : input.kind === 'write' ? 'write' : 'edit' :
            input.kind === 'read' ? 'read_file' : 'edit_file';
        if (grant.taskId !== request.taskId ||
            !(directMirror && input.kind === 'write' && grant.toolSelection?.tools.some(tool =>
                tool.id === 'edit' || tool.id === 'write' || tool.id === 'edit_file')) &&
            !grant.toolSelection?.tools.some(tool => tool.id === selected) ||
            request.projectRoot !== workspace.projectRoot || request.executionRoot !== workspace.root ||
            !checkEffect(grant, { kind: input.kind === 'read' ? 'workspace-read' : 'workspace-write',
                scope: 'workspace', path }).allowed || input.kind === 'edit' &&
            !checkEffect(grant, { kind: 'workspace-read', scope: 'workspace', path }).allowed) return denied();
        if (input.kind !== 'read') {
            const parts = path.split('/');
            for (let index = 1; index < parts.length; index++) {
                if (!checkEffect(grant, { kind: 'workspace-write', scope: 'workspace',
                    path: parts.slice(0, index).join('/') }).allowed) return denied();
            }
        }
        await workspace.assertActiveBasis(request.projectRoot, request.executionRoot);
        if (signal?.aborted) return denied('cancelled');
        if (input.kind === 'read') {
            const call = { id: 'isolated-read', name: 'read' as const, arguments: { path,
                maxBytes: input.maxBytes ?? 4096, offset: input.offset ?? 0,
                ...(input.expectedSourceHash ? { expectedSourceHash: input.expectedSourceHash } : {}) } };
            const read = await brokerLocalRead(request, call, signal, workspace);
            return { status: read.status, output: read.output };
        }
        if (input.kind !== 'write' && input.kind !== 'edit') return denied();
        const payload = input.kind === 'write' ? input.content : input.edits;
        if (input.kind === 'write' && (!validText(payload) ||
            Buffer.byteLength(payload, 'utf8') > LOCAL_TOOL_LIMITS.editBytes) ||
            input.kind === 'edit' && (!Array.isArray(payload) || payload.length < 1 || payload.length > 32 ||
                payload.some(edit => !edit || !validText(edit.oldText) || !validText(edit.newText) ||
                    !edit.oldText) ||
                Buffer.byteLength(JSON.stringify(payload), 'utf8') > LOCAL_TOOL_LIMITS.jsonBytes)) return denied();
        if (input.kind === 'write' && input.expectedSourceHash !== undefined &&
            input.expectedSourceHash !== null && !/^[a-f0-9]{64}$/u.test(input.expectedSourceHash)) return denied();
        const wirePayload = input.kind === 'write' && input.expectedSourceHash !== undefined ?
            { content: input.content, expectedSourceHash: input.expectedSourceHash } : payload;
        const sandbox = await launchLocalSandboxedTool({ workspaceRoot: workspace.root },
            ['/usr/bin/python3', '-c', ISOLATED_FILE_SCRIPT, input.kind, path,
                Buffer.from(JSON.stringify(wirePayload), 'utf8').toString('base64'), String(LOCAL_TOOL_LIMITS.editBytes)],
            5000, signal);
        if (sandbox.cancelled || signal?.aborted || sandbox.timedOut || sandbox.exitCode !== 0)
            return denied('recovery-required');
        const wire: unknown = JSON.parse(sandbox.stdout);
        if (!wire || typeof wire !== 'object') return denied('recovery-required');
        const response = wire as { status?: unknown; createdDirectories?: unknown; bytesWritten?: unknown };
        if (response.status === 'completed' && Array.isArray(response.createdDirectories) &&
            response.createdDirectories.every(dir => typeof dir === 'string' &&
                path.startsWith(`${dir}/`)) && Number.isSafeInteger(response.bytesWritten) &&
            (response.bytesWritten as number) >= 0 && (response.bytesWritten as number) <= LOCAL_TOOL_LIMITS.editBytes)
            return { status: 'completed', output: '', createdDirectories: response.createdDirectories,
                bytesWritten: response.bytesWritten as number };
        return response.status === 'denied' ? denied() : denied('recovery-required');
    } catch { return denied(signal?.aborted ? 'recovery-required' : 'denied'); }
}
