// Run once per fresh disposable Dope Roadmap import: node fixture-recipe.cjs <project-root> [...]
const path=require('node:path');
const {RoadmapStore}=require('@dope/project-intelligence/lib/node/roadmap-store');
const {ProjectPlanningActions}=require('@dope/project-intelligence/lib/node/project-planning-actions');
const {projectRoadmap}=require('@dope/project-intelligence/lib/roadmap-projection');
const {roadmapCanvasConnectors}=require(path.join(process.cwd(),'packages/theia-extension/lib/browser/roadmap-canvas-model'));
(async()=>{
 const output=[];
 const roots=process.argv.slice(2);
 if(!roots.length) throw Error('Pass at least one fresh disposable Dope project root');
 for(const root of roots){
  const service=new ProjectPlanningActions(new RoadmapStore());
  const {projectHandle,snapshot}=await service.attach(root);
  const phase=n=>snapshot.checkpoints.find(c=>c.id.endsWith('#phase-'+n));
  const create=[
   ['roadmap:fixture#phase-100','phase','Product Phase 100 — Distant future isolation check',100],
   ['roadmap:fixture#phase-88-a','phase','Product Phase 88 — First ambiguous candidate',88],
   ['roadmap:fixture#phase-88-b','phase','Product Phase 88 — Second ambiguous candidate',89],
   ['roadmap:fixture#c100-other','correction','Correction c100-other — isolated from c10',101],
   ['roadmap:fixture#c99-orphan','correction','Correction c99-orphan — missing Phase 99',102],
   ['roadmap:fixture#c88-ambiguous','correction','Correction c88-ambiguous — two Phase 88 candidates',103],
   ['roadmap:fixture#c10-recovery-a','correction','Correction c10-recovery-a — relationship qualification',104],
   ['roadmap:fixture#c10-recovery-b','correction','Correction c10-recovery-b — dense branch from Phase 10 with a deliberately long readable label covering planning review, local authority, and source reconciliation',105],
   ['roadmap:fixture#c10-recovery-c','correction','Correction c10-recovery-c — parallel support branch',106],
  ].map(([id,kind,title,order])=>({type:'create',id,kind,title,objective:'Disposable R3 Group 3 presentation fixture; no gate claim.',order}));
  let req={projectHandle,ownerId:snapshot.projectId,expectedRevision:snapshot.revision,actions:create};
  let preview=await service.preview(req);
  let next=await service.apply(req,preview.token,true);
  req={projectHandle,ownerId:next.projectId,expectedRevision:next.revision,
   sourceHashes:{[phase(10).id]:phase(10).source.sha256,[phase(11).id]:phase(11).source.sha256},
   actions:[
    {type:'depend',id:phase(10).id,dependencyId:phase(9).id},
    {type:'depend',id:phase(11).id,dependencyId:phase(10).id},
    {type:'depend',id:'roadmap:fixture#c10-recovery-a',dependencyId:phase(10).id},
    {type:'depend',id:'roadmap:fixture#c100-other',dependencyId:'roadmap:fixture#phase-100'},
   ]};
  preview=await service.preview(req); next=await service.apply(req,preview.token,true);
  const projection=projectRoadmap(next);
  const connectors=roadmapCanvasConnectors(projection);
  output.push({root,projectId:next.projectId,revision:next.revision,linkedSourceHash:next.linkedDocument.sourceHash,
   checkpoints:next.checkpoints.filter(c=>c.dependencies.length).map(c=>({id:c.id,dependencies:c.dependencies,status:c.status})),
   diagnostics:projection.diagnostics.filter(x=>x.includes('correction phase')||x.includes('dependency')),
   associations:projection.nodes.filter(n=>n.kind==='correction'&&(n.id.includes('fixture')||n.id.includes('c10-'))).map(n=>({id:n.id,phaseAssociation:n.phaseAssociation})),
   projectionEdges:projection.edges.filter(e=>e.id.startsWith('dependency:')).map(e=>({id:e.id,from:e.from,to:e.to,kind:e.kind})),
   canvasEdges:connectors.filter(e=>e.from.includes('phase-9')||e.to.includes('phase-10')||e.to.includes('c10-')||e.to.includes('c100-')||e.to.includes('c99-')||e.to.includes('c88-')).map(e=>({id:e.id,from:e.from,to:e.to,kind:e.kind,label:e.label}))});
 }
 console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
