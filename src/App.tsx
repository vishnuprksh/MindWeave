import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Edge, MiniMap, Node, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import { ArrowDownToLine, ChevronDown, FileText, FolderOpen, GitBranch, Lightbulb, Maximize2, MoreHorizontal, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import '@xyflow/react/dist/style.css';

type Item = { id: string; text: string; depth: number; parent?: string };
const starter = `# Product launch strategy\n\n- Define the goal\n  - What outcome are we trying to achieve?\n  - Who is this for?\n- Gather evidence\n  - Interview target customers\n  - Review existing research\n- Make a decision\n  - Compare the strongest options\n  - Choose the next action\n- Ship and learn\n  - Launch a small experiment\n  - Measure the result`;

function parseMarkdown(md: string): Item[] {
  const lines = md.split(/\r?\n/).filter(l => l.trim());
  const items: Item[] = []; const stack: { depth: number; id: string }[] = [];
  lines.forEach((line, index) => {
    const heading = line.match(/^#+\s+(.*)/); const bullet = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (!heading && !bullet) return;
    const depth = heading ? 0 : Math.floor((bullet?.[1].length ?? 0) / 2) + 1;
    const text = heading ? heading[1] : bullet![2]; const id = `n${index}`;
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    items.push({ id, text, depth, parent: stack[stack.length - 1]?.id }); stack.push({ depth, id });
  });
  return items.length ? items : [{ id: 'n0', text: 'Untitled map', depth: 0 }];
}
function toMarkdown(items: Item[]) { return items.map(i => `${i.depth === 0 ? '# ' : `${'  '.repeat(Math.max(0, i.depth - 1))}- `}${i.text}`).join('\n'); }

const palette = ['#ff7b72', '#f7b955', '#78c6a3', '#6ea8fe', '#b58cff'];
function App() {
  const [markdown, setMarkdown] = useState(starter); const [items, setItems] = useState(() => parseMarkdown(starter)); const [selected, setSelected] = useState('n0'); const [query, setQuery] = useState(''); const [zoom, setZoom] = useState(1); const fileRef = useRef<HTMLInputElement>(null);
  const updateItems = useCallback((next: Item[]) => { setItems(next); setMarkdown(toMarkdown(next)); }, []);
  const select = (id: string) => setSelected(id);
  const edit = (id: string, text: string) => updateItems(items.map(i => i.id === id ? { ...i, text: text || 'Untitled node' } : i));
  const addNode = (kind: 'child'|'sibling') => { const current = items.find(i => i.id === selected) ?? items[0]; if (!current) return; const depth = kind === 'child' ? current.depth + 1 : current.depth; const newItem = { id: `n${Date.now()}`, text: kind === 'child' ? 'New child' : 'New idea', depth, parent: kind === 'child' ? current.id : current.parent }; const idx = items.findIndex(i => i.id === current.id); updateItems([...items.slice(0, idx + 1), newItem, ...items.slice(idx + 1)]); setSelected(newItem.id); };
  const remove = () => { if (items.length <= 1) return; const target = items.find(i => i.id === selected); if (!target) return; const ids = new Set([target.id]); items.forEach(i => { if (i.parent && ids.has(i.parent)) ids.add(i.id); }); updateItems(items.filter(i => !ids.has(i.id))); setSelected(items.find(i => !ids.has(i.id))?.id ?? 'n0'); };
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Tab') { e.preventDefault(); addNode('child'); } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); addNode('sibling'); } else if (e.key === 'Delete') remove(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const filtered = items.filter(i => !query || i.text.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><GitBranch size={19}/></div><span>Mindweave</span><button className="icon-btn small"><MoreHorizontal size={17}/></button></div>
      <div className="side-section"><div className="eyebrow">WORKSPACE <span>⌘ K</span></div><button className="nav active"><FileText size={17}/> Untitled map <span className="dot"/></button><button className="nav"><FolderOpen size={17}/> All maps <span className="count">3</span></button></div>
      <div className="side-section prompt"><div className="eyebrow">PROMPT COMPOSER</div><textarea placeholder="Describe what you want to map..." defaultValue="Plan a product launch"/><button className="generate"><Sparkles size={15}/> Generate map <kbd>⌘ ↵</kbd></button><div className="prompt-hint"><Lightbulb size={14}/> Try: “Break down a complex topic”</div></div>
      <div className="side-section source"><div className="eyebrow">SOURCE <span>MARKDOWN</span></div><textarea value={markdown} onChange={e => { setMarkdown(e.target.value); setItems(parseMarkdown(e.target.value)); }}/><div className="source-actions"><button onClick={() => fileRef.current?.click()}><Upload size={14}/> Import .md</button><button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([markdown], {type:'text/markdown'})); a.download = 'mindmap.md'; a.click(); }}><ArrowDownToLine size={14}/> Export</button></div><input ref={fileRef} hidden type="file" accept=".md,.markdown,text/markdown" onChange={e => { const file = e.target.files?.[0]; if (file) file.text().then(t => { setMarkdown(t); setItems(parseMarkdown(t)); }); }}/></div>
      <div className="sidebar-footer"><span className="status"><span className="green"/> Saved just now</span><button className="icon-btn"><RefreshCw size={15}/></button><div className="avatar">AV</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs"><span>My workspace</span><b>/</b><strong>Untitled map</strong></div><div className="top-actions"><button className="share"><Zap size={15}/> Share</button><button className="icon-btn"><MoreHorizontal size={18}/></button></div></header><section className="workspace"><div className="canvas-head"><div><h1>Untitled map</h1><p>Product launch strategy <span>•</span> Edited just now</p></div><div className="canvas-tools"><div className="search"><Search size={15}/><input placeholder="Find in map" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ F</kbd></div><button className="icon-btn"><Maximize2 size={16}/></button></div></div><div className="flow-wrap"><Mindmap items={filtered} selected={selected} select={select} edit={edit} zoom={zoom}/><div className="canvas-hint"><span className="key">TAB</span> child <span className="key">↵</span> sibling <span className="key">F2</span> edit <span className="key">DEL</span> delete</div><div className="zoom"><button onClick={()=>setZoom(z=>Math.min(1.3,z+.1))}>+</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))}>−</button></div></div></section></main>
  </div>
}

function Mindmap({ items, selected, select, edit, zoom }: {items: Item[]; selected: string; select:(id:string)=>void; edit:(id:string,text:string)=>void; zoom:number}) {
  const { fitView } = useReactFlow(); const nodes: Node[] = []; const edges: Edge[] = []; const levels = new Map<number, number>(); const pos = new Map<string, {x:number,y:number}>();
  items.forEach((item, index) => { const same = levels.get(item.depth) ?? 0; levels.set(item.depth, same + 1); const x = item.depth * 285; const y = same * 112 + (item.depth % 2 ? 28 : 0); pos.set(item.id,{x,y}); nodes.push({ id:item.id, type:'mindNode', position:{x,y}, data:{ label:item.text, depth:item.depth, selected:item.id===selected, onSelect:()=>select(item.id), onEdit:(v:string)=>edit(item.id,v) }, sourcePosition:Position.Right, targetPosition:Position.Left }); if(item.parent) edges.push({id:`e-${item.parent}-${item.id}`,source:item.parent,target:item.id,type:'smoothstep',style:{stroke:'#174b60',strokeWidth:1.5}}); });
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ mindNode: MindNode }} fitView onInit={()=>fitView({padding:.2})} minZoom={.5} maxZoom={1.5} zoomOnScroll={false} panOnScroll nodesDraggable={false} proOptions={{hideAttribution:true}}><Background color="#d9ddd8" gap={32} size={1}/><MiniMap pannable zoomable nodeColor="#174b60" maskColor="rgba(221,225,220,.72)"/><Controls showInteractive={false}/></ReactFlow>
}
function MindNode({ data }: {data:any}) { const [editing,setEditing]=useState(false); const [value,setValue]=useState(data.label); return <div className={`mind-node depth-${data.depth} ${data.selected?'selected':''}`} onClick={data.onSelect} onDoubleClick={()=>setEditing(true)}><span className="node-status" />{editing ? <input autoFocus value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>{data.onEdit(value);setEditing(false)}} onKeyDown={e=>{if(e.key==='Enter'){data.onEdit(value);setEditing(false)}}}/> : <span>{data.label}</span>}</div> }
export default function Wrapped(){ return <ReactFlowProvider><App/></ReactFlowProvider> }
