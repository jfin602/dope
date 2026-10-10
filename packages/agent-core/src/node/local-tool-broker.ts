import { parseExecutionGrant, checkEffect } from '../authority';
import type { AgentExecutionRequest } from '../execution';
import { LOCAL_TOOL_LIMITS, parseLocalToolRequests, parseLocalToolResult } from './local-tool-contracts';
import type { LocalToolRequest, LocalToolResult } from './local-tool-contracts';
import { launchLocalSandboxedTool } from './local-tool-sandbox';
import { ExecutionWorkspace } from './execution-workspace';

const privatePart = (part: string): boolean => {
    const p = part.toLowerCase();
    return ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg', '.kube',
        '.docker', '.azure', '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.pypirc', '.gitconfig', '.git-credentials',
        'id_rsa', 'id_ed25519', 'credentials.json', 'secrets', 'secret', 'credentials', 'private', 'node_modules'].includes(p) ||
        p === '.env' || p.startsWith('.env.') || ['.pem', '.key', '.p12', '.pfx'].some(s => p.endsWith(s)) ||
        ['secret.', 'token.', 'credential.'].some(s => p.startsWith(s));
};

/** A fixed program inside the writable candidate mount. All directory traversal uses no-follow
 * descriptors; create is exclusive and modify replaces only a verified regular file. */
const EDIT_SCRIPT = `import os,sys,json,base64,stat,uuid
operation,path,encoded,limit=sys.argv[1:]
def denied():
 print(json.dumps({'status':'denied'})); sys.exit(0)
parts=path.split('/')
if not parts or any(not p or p in ('.','..') or p.lower() in ('.git','.dope','.codex','.agents','.ssh','.aws','.config','.gnupg','.kube','.docker','.azure','.npmrc','.yarnrc','.yarnrc.yml','.netrc','.pypirc','.gitconfig','.git-credentials','id_rsa','id_ed25519','credentials.json','secrets','secret','credentials','private','node_modules') or p.lower()=='.env' or p.lower().startswith('.env.') or p.lower().endswith(('.pem','.key','.p12','.pfx')) or p.lower().startswith(('secret.','token.','credential.')) for p in parts): denied()
try:
 data=base64.b64decode(encoded,validate=True)
 if len(data)>int(limit): denied()
 root=os.open('/work',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 parent=root
 for part in parts[:-1]:
  nextfd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
  if parent!=root: os.close(parent)
  parent=nextfd
 leaf=parts[-1]
 before=None; mode=0o600
 try:
  original=os.open(leaf,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
  try:
   info=os.fstat(original)
   if not stat.S_ISREG(info.st_mode): denied()
   before=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns)
   mode=stat.S_IMODE(info.st_mode)
  finally: os.close(original)
 except FileNotFoundError:
  if operation!='create': denied()
 if operation=='create' and before is not None: denied()
 if operation=='modify' and before is None: denied()
 temp='.dope-edit-'+uuid.uuid4().hex
 try:
  fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=parent)
  try:
   os.fchmod(fd,mode)
   with os.fdopen(fd,'wb',closefd=False) as out: out.write(data); out.flush()
   os.fsync(fd)
  finally: os.close(fd)
  if operation=='create':
   os.link(temp,leaf,src_dir_fd=parent,dst_dir_fd=parent,follow_symlinks=False)
  else:
   now=os.stat(leaf,dir_fd=parent,follow_symlinks=False)
   if not stat.S_ISREG(now.st_mode) or (now.st_dev,now.st_ino,now.st_size,now.st_mtime_ns)!=before: denied()
   os.replace(temp,leaf,src_dir_fd=parent,dst_dir_fd=parent)
  print(json.dumps({'status':'completed'}))
 finally:
  try: os.unlink(temp,dir_fd=parent)
  except FileNotFoundError: pass
except (OSError,ValueError,OverflowError): denied()
finally:
 if 'parent' in locals() and parent!=root: os.close(parent)
 if 'root' in locals(): os.close(root)
`;

/** Fixed code runs in P2's isolated /work mount. Path components are opened relative to
 * directory descriptors with O_NOFOLLOW, so a rename or symlink cannot redirect a read. */
const READ_SCRIPT = `import os,sys,json,base64,stat
name,path,limit=sys.argv[1:]
limit=int(limit)
def private(part):
 p=part.lower()
 return p in ('.git','.dope','.codex','.agents','.ssh','.aws','.config','.gnupg','.kube','.docker','.azure','.npmrc','.yarnrc','.yarnrc.yml','.netrc','.pypirc','.gitconfig','.git-credentials','id_rsa','id_ed25519','credentials.json','secrets','secret','credentials','private','node_modules') or p=='.env' or p.startswith('.env.') or p.endswith(('.pem','.key','.p12','.pfx')) or p.startswith(('secret.','token.','credential.'))
def denied():
 print(json.dumps({'status':'denied'}))
 sys.exit(0)
parts=[] if path=='.' else path.split('/')
if (not parts and name!='list') or any(not p or p in ('.','..') or private(p) for p in parts): denied()
fds=[]
try:
 root=os.open('/work',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW); fds.append(root)
 current=root
 for part in parts[:-1]:
  current=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=current); fds.append(current)
 if name=='read':
  fd=os.open(parts[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=current); fds.append(fd)
  if not stat.S_ISREG(os.fstat(fd).st_mode): denied()
  data=os.read(fd,limit+1)
  print(json.dumps({'status':'completed','data':base64.b64encode(data[:limit]).decode('ascii'),'truncated':len(data)>limit}))
 else:
  if parts:
   current=os.open(parts[-1],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=current); fds.append(current)
  entries=[]; truncated=False
  with os.scandir(current) as scan:
   for entry in scan:
    if private(entry.name) or entry.is_symlink(): continue
    if len(entries)==limit:
     truncated=True; break
    if entry.is_file(follow_symlinks=False): kind='file'
    elif entry.is_dir(follow_symlinks=False): kind='directory'
    else: continue
    entries.append({'name':entry.name,'kind':kind})
  entries.sort(key=lambda item:item['name'])
  print(json.dumps({'status':'completed','entries':entries,'truncated':truncated}))
except (OSError,ValueError): denied()
finally:
 for fd in reversed(fds): os.close(fd)
`;

function result(call: LocalToolRequest, status: LocalToolResult['status'], output = '',
    truncated = false): LocalToolResult {
    return parseLocalToolResult({ id: call.id, name: call.name, status, output, truncated });
}

/** Trusted developer/adapter configuration. A model supplies only commandId; it cannot supply
 * executable, arguments, cwd, environment, limits, or an effect classification. */
export interface LocalProcessCommand {
    id: string;
    kind: 'test' | 'build';
    executable: 'node';
    argv: readonly string[];
    timeoutMs?: number;
}

const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
// In the PID namespace this Node build classifies inherited pipes as unknown and creates
// no-op stdio streams. A fixed prelude writes to the inherited descriptors synchronously.
const NODE_STDIO = 'data:text/javascript,' + encodeURIComponent(
    "import { writeSync } from 'node:fs'; for (const [stream, fd] of [[process.stdout, 1], [process.stderr, 2]]) stream._write = (chunk, encoding, callback) => { try { writeSync(fd, chunk); callback(); } catch (error) { callback(error); } };"
);
// Node's test harness creates its reporter stream before the prelude above. Redirect its TAP
// report into sandbox-private tmpfs and relay bounded bytes through a fixed, shell-free wrapper.
const TEST_REPORT = `import json,os,subprocess,sys
command=json.loads(sys.argv[1])
status=subprocess.run(command).returncode
try:
 with open('/tmp/dope-test-report','rb') as report:
  os.write(1,report.read(65536))
except OSError: pass
sys.exit(status)
`;
const SCRIPT_PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:c|m)?js$/u;
const PROJECT_PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.json$/u;
function supportedCommand(value: LocalProcessCommand): boolean {
    if (!value || Object.keys(value).some(key => !['argv', 'executable', 'id', 'kind', 'timeoutMs'].includes(key)) ||
        (value.timeoutMs !== undefined && (!Number.isSafeInteger(value.timeoutMs) ||
            value.timeoutMs < 100 || value.timeoutMs > 30_000)) ||
        !COMMAND_ID.test(value.id) || value.executable !== 'node' ||
        !Array.isArray(value.argv) || value.argv.length < 1 || value.argv.length > 3 ||
        value.argv.some(arg => typeof arg !== 'string' || Buffer.byteLength(arg, 'utf8') > 512 ||
            /[;&|`$<>*?{}()[\]\\\s\u0000-\u001f]/u.test(arg))) return false;
    const safePath = (path: string, pattern: RegExp) => pattern.test(path) &&
        path.split('/').every(part => part !== '.' && part !== '..' && !privatePart(part));
    if (value.kind === 'test')
        return value.argv.length === 2 && value.argv[0] === '--test' &&
            safePath(value.argv[1], SCRIPT_PATH) && /\.test\.(?:c|m)?js$/u.test(value.argv[1]);
    if (value.kind === 'build')
        return (value.argv.length === 1 && safePath(value.argv[0], SCRIPT_PATH)) ||
            (value.argv.length === 3 && value.argv[0] === 'node_modules/typescript/bin/tsc' &&
                value.argv[1] === '-p' && safePath(value.argv[2], PROJECT_PATH));
    return false;
}

/** The adapter passes the runtime's execution request, never a model-selected root. */
export async function brokerLocalRead(request: AgentExecutionRequest, untrusted: LocalToolRequest,
    signal?: AbortSignal): Promise<LocalToolResult> {
    let call: LocalToolRequest;
    try { [call] = parseLocalToolRequests(JSON.stringify([untrusted])); }
    catch { return result({ id: 'invalid', name: 'read', arguments: { path: 'invalid', maxBytes: 1 } }, 'denied'); }
    if (call.name !== 'read' && call.name !== 'list') return result(call, 'denied');
    if (signal?.aborted) return result(call, 'cancelled');
    const parts = call.arguments.path === '.' ? [] : call.arguments.path.toLowerCase().split('/');
    if (parts.some(privatePart))
        return result(call, 'denied');
    try {
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId ||
            !checkEffect(grant, { kind: 'workspace-read', scope: 'workspace',
                path: call.arguments.path }).allowed)
            return result(call, 'denied');
    } catch { return result(call, 'denied'); }
    const limit = call.name === 'read' ? call.arguments.maxBytes : call.arguments.maxEntries;
    try {
        const sandbox = await launchLocalSandboxedTool({ workspaceRoot: request.executionRoot },
            ['/usr/bin/python3', '-c', READ_SCRIPT, call.name, call.arguments.path, String(limit)], 5000, signal);
        if (signal?.aborted) return result(call, 'cancelled');
        if (sandbox.exitCode !== 0) return result(call, 'failed');
        const response: unknown = JSON.parse(sandbox.stdout);
        if (!response || typeof response !== 'object') return result(call, 'failed');
        const wire = response as Record<string, unknown>;
        if (wire.status === 'denied') return result(call, 'denied');
        if (wire.status !== 'completed' || typeof wire.truncated !== 'boolean') return result(call, 'failed');
        let output: string;
        if (call.name === 'read') {
            if (typeof wire.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(wire.data))
                return result(call, 'failed');
            const bytes = Buffer.from(wire.data, 'base64');
            if (bytes.length > call.arguments.maxBytes) return result(call, 'failed');
            output = bytes.toString('utf8');
        } else {
            if (!Array.isArray(wire.entries) || wire.entries.length > call.arguments.maxEntries ||
                wire.entries.some(entry => !entry || typeof entry.name !== 'string' ||
                    !['file', 'directory'].includes(entry.kind))) return result(call, 'failed');
            output = JSON.stringify(wire.entries);
        }
        const bytes = Buffer.from(output, 'utf8');
        const capped = bytes.length > LOCAL_TOOL_LIMITS.resultBytes;
        if (capped && call.name === 'list') {
            const entries = JSON.parse(output) as unknown[];
            while (entries.length && Buffer.byteLength(JSON.stringify(entries), 'utf8') > LOCAL_TOOL_LIMITS.resultBytes)
                entries.pop();
            output = JSON.stringify(entries);
        } else if (capped) output = bytes.subarray(0, LOCAL_TOOL_LIMITS.resultBytes - 4).toString('utf8');
        return result(call, 'completed', output, wire.truncated || capped);
    } catch { return result(call, signal?.aborted ? 'cancelled' : 'denied'); }
}

/** Mutates only an explicitly supplied active ExecutionWorkspace. The request's root is
 * checked against that object rather than accepted as a model-selected destination. */
export async function brokerLocalEdit(request: AgentExecutionRequest,
    workspace: ExecutionWorkspace,
    untrusted: LocalToolRequest, signal?: AbortSignal): Promise<LocalToolResult> {
    let call: LocalToolRequest;
    try { [call] = parseLocalToolRequests(JSON.stringify([untrusted])); }
    catch { return result({ id: 'invalid', name: 'edit', arguments:
        { operation: 'create', path: 'invalid', content: '' } }, 'denied'); }
    if (call.name !== 'edit' || !(workspace instanceof ExecutionWorkspace) ||
        call.arguments.path.split('/').some(privatePart))
        return result(call, 'denied');
    if (signal?.aborted) return result(call, 'cancelled');
    try {
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId || request.projectRoot !== workspace.projectRoot ||
            request.executionRoot !== workspace.root || !checkEffect(grant,
                { kind: 'workspace-write', scope: 'workspace', path: call.arguments.path }).allowed)
            return result(call, 'denied');
        await workspace.assertActiveBasis(request.projectRoot, request.executionRoot);
        if (signal?.aborted) return result(call, 'cancelled');
        const sandbox = await launchLocalSandboxedTool({ workspaceRoot: workspace.root },
            ['/usr/bin/python3', '-c', EDIT_SCRIPT, call.arguments.operation,
                call.arguments.path, Buffer.from(call.arguments.content, 'utf8').toString('base64'),
                String(LOCAL_TOOL_LIMITS.editBytes)], 5000, signal);
        if (signal?.aborted) return result(call, 'cancelled');
        if (sandbox.exitCode !== 0) return result(call, 'failed');
        const response: unknown = JSON.parse(sandbox.stdout);
        if (!response || typeof response !== 'object') return result(call, 'failed');
        const status = (response as Record<string, unknown>).status;
        if (status !== 'completed' && status !== 'denied') return result(call, 'failed');
        return result(call, status);
    } catch { return result(call, signal?.aborted ? 'cancelled' : 'denied'); }
}

/** Runs one explicitly allowed test/build command inside P2 containment. Its output is provider
 * evidence only; Dope-owned candidate validation remains a separate authoritative path. */
export async function brokerLocalProcess(request: AgentExecutionRequest,
    workspace: ExecutionWorkspace, untrusted: LocalToolRequest,
    commands: readonly LocalProcessCommand[], signal?: AbortSignal): Promise<LocalToolResult> {
    let call: LocalToolRequest;
    try { [call] = parseLocalToolRequests(JSON.stringify([untrusted])); }
    catch { return result({ id: 'invalid', name: 'process', arguments:
        { kind: 'test', commandId: 'invalid' } }, 'denied'); }
    if (call.name !== 'process' || !(workspace instanceof ExecutionWorkspace) ||
        !Array.isArray(commands)) return result(call, 'denied');
    if (signal?.aborted) return result(call, 'cancelled');
    const selected = commands.filter(command => command?.id === call.arguments.commandId);
    if (selected.length !== 1 || !Array.isArray(selected[0].argv)) return result(call, 'denied');
    const approved = { ...selected[0], argv: [...selected[0].argv] };
    if (approved.kind !== call.arguments.kind || !supportedCommand(approved))
        return result(call, 'denied');
    try {
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId || request.projectRoot !== workspace.projectRoot ||
            request.executionRoot !== workspace.root ||
            !checkEffect(grant, { kind: 'workspace-process', scope: 'workspace', path: '.' }).allowed ||
            !checkEffect(grant, { kind: call.arguments.kind === 'test' ? 'workspace-test' : 'workspace-build',
                scope: 'workspace', path: '.' }).allowed) return result(call, 'denied');
        await workspace.assertActiveBasis(request.projectRoot, request.executionRoot);
        if (signal?.aborted) return result(call, 'cancelled');
        // RLIMIT_AS and CPU/fd/process limits are inherited by descendants. P2 owns the sterile
        // environment, fixed /work cwd, network namespace, private mounts and process group kill.
        const nodeCommand = ['/dope-node', '--max-old-space-size=256',
            '--import=' + NODE_STDIO, ...approved.argv];
        if (approved.kind === 'test')
            nodeCommand.splice(4, 0, '--test-reporter=tap',
                '--test-reporter-destination=/tmp/dope-test-report');
        const command = approved.kind === 'test' ?
            ['/usr/bin/python3', '-c', TEST_REPORT, JSON.stringify(nodeCommand)] : nodeCommand;
        const sandbox = await launchLocalSandboxedTool({ workspaceRoot: workspace.root },
            ['/usr/bin/prlimit', '--as=4294967296', '--cpu=30', '--nofile=128', '--nproc=64',
                '--fsize=67108864', '--', ...command],
            approved.timeoutMs ?? 30_000, signal);
        const combined = [sandbox.stdout, sandbox.stderr].filter(Boolean).join('\n');
        const bytes = Buffer.from(combined, 'utf8');
        const truncated = bytes.length > LOCAL_TOOL_LIMITS.resultBytes;
        const output = (truncated ? bytes.subarray(0, LOCAL_TOOL_LIMITS.resultBytes - 4) : bytes).toString('utf8');
        return result(call, signal?.aborted || sandbox.cancelled ? 'cancelled' :
            sandbox.timedOut || sandbox.exitCode !== 0 ? 'failed' : 'completed', output,
        truncated || sandbox.timedOut);
    } catch { return result(call, signal?.aborted ? 'cancelled' : 'denied'); }
}
