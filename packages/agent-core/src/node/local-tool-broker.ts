import { parseExecutionGrant, checkEffect } from '../authority';
import type { AgentExecutionRequest } from '../execution';
import { LOCAL_TOOL_LIMITS, parseLocalToolRequests, parseLocalToolResult } from './local-tool-contracts';
import type { LocalToolRequest, LocalToolResult } from './local-tool-contracts';
import { launchLocalSandboxedTool } from './local-tool-sandbox';

/** Fixed code runs in P2's isolated /work mount. Path components are opened relative to
 * directory descriptors with O_NOFOLLOW, so a rename or symlink cannot redirect a read. */
const READ_SCRIPT = `import os,sys,json,base64,stat
name,path,limit=sys.argv[1:]
limit=int(limit)
def private(part):
 p=part.lower()
 return p in ('.git','.dope','.codex','.agents','.ssh','.aws','.config','.gnupg','.kube','.docker','.azure','.npmrc','.netrc','.pypirc','.gitconfig','.git-credentials','id_rsa','id_ed25519','credentials.json','secrets','private') or p=='.env' or p.startswith('.env.') or p.endswith(('.pem','.key','.p12','.pfx')) or p.startswith(('secret.','token.','credential.'))
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

/** Only P3 read/list calls are executable. The adapter passes the runtime's execution request,
 * never a model-selected root; no process or edit handler is registered here. */
export async function brokerLocalRead(request: AgentExecutionRequest, untrusted: LocalToolRequest,
    signal?: AbortSignal): Promise<LocalToolResult> {
    let call: LocalToolRequest;
    try { [call] = parseLocalToolRequests(JSON.stringify([untrusted])); }
    catch { return result({ id: 'invalid', name: 'read', arguments: { path: 'invalid', maxBytes: 1 } }, 'denied'); }
    if (call.name !== 'read' && call.name !== 'list') return result(call, 'denied');
    if (signal?.aborted) return result(call, 'cancelled');
    const parts = call.arguments.path === '.' ? [] : call.arguments.path.toLowerCase().split('/');
    if (parts.some(part => ['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config', '.gnupg',
        '.kube', '.docker', '.azure', '.npmrc', '.netrc', '.pypirc', '.gitconfig', '.git-credentials',
        'id_rsa', 'id_ed25519', 'credentials.json', 'secrets', 'private'].includes(part) ||
        part === '.env' || part.startsWith('.env.') ||
        ['.pem', '.key', '.p12', '.pfx'].some(suffix => part.endsWith(suffix)) ||
        ['secret.', 'token.', 'credential.'].some(prefix => part.startsWith(prefix))))
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
