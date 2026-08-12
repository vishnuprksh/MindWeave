import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Edge, Handle, MiniMap, Node, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { ArrowDownToLine, FileText, FolderOpen, GitBranch, Lightbulb, Maximize2, MoreHorizontal, RefreshCw, Search, Sparkles, Upload, Zap } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const markdownFiles = import.meta.glob('../files/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const mapFiles = Object.entries(markdownFiles).map(([path, content]) => ({ name: path.split('/').pop() ?? 'mindmap.md', content }));
const starter = mapFiles[0]?.content ?? '# Untitled map';

type Item = { id: string; text: string; depth: number; parent?: string };

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
  const [activeFile, setActiveFile] = useState(mapFiles[0]?.name ?? 'mindmap.md'); const [markdown, setMarkdown] = useState(starter); const [items, setItems] = useState(() => parseMarkdown(starter)); const [selected, setSelected] = useState('n0'); const [query, setQuery] = useState(''); const [zoom, setZoom] = useState(1); const [view, setView] = useState<'mindmap'|'markdown'>('mindmap'); const fileRef = useRef<HTMLInputElement>(null);
  const openMap = (name: string) => { const file = mapFiles.find(entry => entry.name === name); if (!file) return; setActiveFile(file.name); setMarkdown(file.content); setItems(parseMarkdown(file.content)); setSelected('n0'); };
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
      <div className="side-section"><div className="eyebrow">WORKSPACE <span>⌘ K</span></div>{mapFiles.map(file => <button key={file.name} className={`nav ${file.name === activeFile ? 'active' : ''}`} onClick={() => openMap(file.name)}><FileText size={17}/> {file.name} {file.name === activeFile && <span className="dot"/>}</button>)}<div className="nav"><FolderOpen size={17}/> All maps <span className="count">{mapFiles.length}</span></div></div>
      <div className="side-section prompt"><div className="eyebrow">PROMPT COMPOSER</div><textarea placeholder="Describe what you want to map..." defaultValue="Plan a product launch"/><button className="generate"><Sparkles size={15}/> Generate map <kbd>⌘ ↵</kbd></button><div className="prompt-hint"><Lightbulb size={14}/> Try: “Break down a complex topic”</div></div>
      <div className="sidebar-footer"><span className="status"><span className="green"/> Saved just now</span><button className="icon-btn"><RefreshCw size={15}/></button><div className="avatar">AV</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs"><span>My workspace</span><b>/</b><strong>Untitled map</strong></div><div className="top-actions"><div className="view-switcher" role="tablist" aria-label="Map view"><button className={view==='mindmap'?'active':''} onClick={()=>setView('mindmap')}>Mindmap</button><button className={view==='markdown'?'active':''} onClick={()=>setView('markdown')}>Markdown</button></div><button className="share"><Zap size={15}/> Share</button><button className="icon-btn"><MoreHorizontal size={18}/></button></div></header><section className="workspace"><div className="canvas-head"><div><h1>{view === 'mindmap' ? 'Untitled map' : 'Source markdown'}</h1><p>{view === 'mindmap' ? <>Product launch strategy <span>•</span> Edited just now</> : <>Edit the outline to update the mindmap <span>•</span> Markdown source</>}</p></div>{view === 'mindmap' && <div className="canvas-tools"><div className="search"><Search size={15}/><input placeholder="Find in map" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ F</kbd></div><button className="icon-btn"><Maximize2 size={16}/></button></div>}</div>{view === 'mindmap' ? <div className="flow-wrap"><Mindmap items={filtered} selected={selected} select={select} edit={edit} zoom={zoom}/><div className="canvas-hint"><span className="key">TAB</span> child <span className="key">↵</span> sibling <span className="key">F2</span> edit <span className="key">DEL</span> delete</div><div className="zoom"><button onClick={()=>setZoom(z=>Math.min(1.3,z+.1))}>+</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))}>−</button></div></div> : <MarkdownEditor markdown={markdown} setMarkdown={(value) => { setMarkdown(value); setItems(parseMarkdown(value)); }} fileRef={fileRef} onExport={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([markdown], {type:'text/markdown'})); a.download = 'mindmap.md'; a.click(); }} onImport={(file) => file.text().then(value => { setMarkdown(value); setItems(parseMarkdown(value)); })} />}</section></main>
  </div>
}

function MarkdownEditor({ markdown, setMarkdown, fileRef, onExport, onImport }: { markdown: string; setMarkdown: (value: string) => void; fileRef: React.RefObject<HTMLInputElement>; onExport: () => void; onImport: (file: File) => void }) {
  return <div className="markdown-view"><div className="markdown-toolbar"><span className="markdown-file"><FileText size={16}/> mindmap.md</span><span className="markdown-meta">Markdown outline</span><button onClick={() => fileRef.current?.click()}><Upload size={14}/> Import</button><button onClick={onExport}><ArrowDownToLine size={14}/> Export</button><input ref={fileRef} hidden type="file" accept=".md,.markdown,text/markdown" onChange={e => { const file = e.target.files?.[0]; if (file) onImport(file); }} /></div><textarea aria-label="Markdown source editor" spellCheck={false} value={markdown} onChange={e=>setMarkdown(e.target.value)} /></div>;
}

function Mindmap({ items, selected, select, edit, zoom }: {items: Item[]; selected: string; select:(id:string)=>void; edit:(id:string,text:string)=>void; zoom:number}) {
  const { fitView } = useReactFlow(); const nodes: Node[] = []; const edges: Edge[] = [];
  const children = new Map<string, Item[]>(); const visible = new Set(items.map(item => item.id));
  items.forEach(item => { if (item.parent && visible.has(item.parent)) { const group = children.get(item.parent) ?? []; group.push(item); children.set(item.parent, group); } });
  const roots = items.filter(item => !item.parent || !visible.has(item.parent));
  const positions = new Map<string, { x: number; y: number }>(); let nextY = 0;
  const place = (item: Item) => {
    const descendants = children.get(item.id) ?? [];
    if (!descendants.length) { positions.set(item.id, { x: item.depth * 320, y: nextY }); nextY += 76; return; }
    descendants.forEach(place);
    const first = positions.get(descendants[0].id)!; const last = positions.get(descendants[descendants.length - 1].id)!;
    positions.set(item.id, { x: item.depth * 320, y: (first.y + last.y) / 2 });
  };
  roots.forEach(place);
  items.forEach(item => { const position = positions.get(item.id) ?? { x: item.depth * 320, y: nextY }; nodes.push({ id:item.id, type:'mindNode', position, data:{ label:item.text, depth:item.depth, selected:item.id===selected, onSelect:()=>select(item.id), onEdit:(v:string)=>edit(item.id,v) }, sourcePosition:Position.Right, targetPosition:Position.Left }); if(item.parent && visible.has(item.parent)) edges.push({id:`e-${item.parent}-${item.id}`,source:item.parent,target:item.id,type:'smoothstep',style:{stroke:'#174b60',strokeWidth:2}}); });
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ mindNode: MindNode }} fitView onInit={()=>fitView({padding:.2})} minZoom={.5} maxZoom={1.5} zoomOnScroll={false} panOnScroll nodesDraggable={false} proOptions={{hideAttribution:true}}><Background color="#d9ddd8" gap={32} size={1}/><MiniMap pannable zoomable nodeColor="#174b60" maskColor="rgba(221,225,220,.72)"/><Controls showInteractive={false}/></ReactFlow>
}
function MindNode({ data }: {data:any}) { const [editing,setEditing]=useState(false); const [value,setValue]=useState(data.label); return <div className={`mind-node depth-${data.depth} ${data.selected?'selected':''}`} onClick={data.onSelect} onDoubleClick={()=>setEditing(true)}><Handle type="target" position={Position.Left} className="mind-handle" /><span className="node-status" />{editing ? <input autoFocus value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>{data.onEdit(value);setEditing(false)}} onKeyDown={e=>{if(e.key==='Enter'){data.onEdit(value);setEditing(false)}}}/> : <span>{data.label}</span>}<Handle type="source" position={Position.Right} className="mind-handle" /></div> }
export default function Wrapped(){ return <ReactFlowProvider><App/></ReactFlowProvider> }
