import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Edge, Handle, MiniMap, Node, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { ArrowDownToLine, FileText, GitBranch, Lightbulb, Maximize2, MoreHorizontal, RefreshCw, Search, Sparkles, Upload, Zap, GripVertical, LoaderCircle, Undo2, Redo2 } from 'lucide-react';
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
const promptTiming = (requestId: string, startedAt: number, stage: string, details: Record<string, unknown> = {}) => {
  console.debug('[prompt-timing]', { requestId, stage, elapsedMs: Math.round(performance.now() - startedAt), ...details });
};
function App() {
  const [activeFile, setActiveFile] = useState(mapFiles[0]?.name ?? 'mindmap.md'); const [markdown, setMarkdown] = useState(starter); const [items, setItems] = useState(() => parseMarkdown(starter)); const [history, setHistory] = useState<{ markdown: string; items: Item[] }[]>([]); const [future, setFuture] = useState<{ markdown: string; items: Item[] }[]>([]); const [selected, setSelected] = useState('n0'); const [query, setQuery] = useState(''); const [zoom, setZoom] = useState(1); const [view, setView] = useState<'mindmap'|'markdown'>('mindmap'); const [sidebarWidth, setSidebarWidth] = useState(286); const [prompt, setPrompt] = useState('Plan a product launch'); const [generating, setGenerating] = useState(false); const [promptError, setPromptError] = useState(''); const [editRequest, setEditRequest] = useState<{ id: string; initial?: string; request: number } | null>(null); const fileRef = useRef<HTMLInputElement>(null);
  const openMap = (name: string) => { const file = mapFiles.find(entry => entry.name === name); if (!file) return; setActiveFile(file.name); setMarkdown(file.content); setItems(parseMarkdown(file.content)); setSelected('n0'); };
  const updateItems = useCallback((next: Item[]) => { setHistory(previous => [...previous, { markdown, items }]); setFuture([]); setItems(next); setMarkdown(toMarkdown(next)); }, [items, markdown]);
  const updateMarkdown = useCallback((value: string) => { setHistory(previous => [...previous, { markdown, items }]); setFuture([]); setMarkdown(value); setItems(parseMarkdown(value)); }, [items, markdown]);
  const undo = () => { const previous = history[history.length - 1]; if (!previous) return; setFuture(next => [...next, { markdown, items }]); setHistory(next => next.slice(0, -1)); setMarkdown(previous.markdown); setItems(previous.items); setSelected(previous.items[0]?.id ?? 'n0'); };
  const redo = () => { const next = future[future.length - 1]; if (!next) return; setHistory(previous => [...previous, { markdown, items }]); setFuture(previous => previous.slice(0, -1)); setMarkdown(next.markdown); setItems(next.items); setSelected(next.items[0]?.id ?? 'n0'); };
  const select = (id: string) => setSelected(id);
  const edit = (id: string, text: string) => updateItems(items.map(i => i.id === id ? { ...i, text: text || 'Untitled node' } : i));
  const addNode = (kind: 'child'|'sibling') => { const current = items.find(i => i.id === selected) ?? items[0]; if (!current) return; const depth = kind === 'child' ? current.depth + 1 : current.depth; const newItem = { id: `n${Date.now()}`, text: kind === 'child' ? 'New child' : 'New idea', depth, parent: kind === 'child' ? current.id : current.parent }; const idx = items.findIndex(i => i.id === current.id); updateItems([...items.slice(0, idx + 1), newItem, ...items.slice(idx + 1)]); setSelected(newItem.id); };
  const remove = () => { if (items.length <= 1) return; const target = items.find(i => i.id === selected); if (!target) return; const ids = new Set([target.id]); items.forEach(i => { if (i.parent && ids.has(i.parent)) ids.add(i.id); }); updateItems(items.filter(i => !ids.has(i.id))); setSelected(items.find(i => !ids.has(i.id))?.id ?? 'n0'); };
  const generate = async () => {
    if (!prompt.trim() || generating) return;
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    promptTiming(requestId, startedAt, 'start', { promptChars: prompt.length, markdownChars: markdown.length, fileName: activeFile });
    setGenerating(true); setPromptError('');
    try {
      const requestStartedAt = performance.now();
      const response = await fetch('/api/generate-map', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId }, body: JSON.stringify({ prompt, markdown, fileName: activeFile }) });
      promptTiming(requestId, startedAt, 'response-received', { requestMs: Math.round(performance.now() - requestStartedAt), status: response.status });
      const raw = await response.text();
      promptTiming(requestId, startedAt, 'body-read', { responseChars: raw.length });
      let data: { error?: string; markdown?: string } = {};
      if (raw.trim()) { try { data = JSON.parse(raw) as typeof data; } catch { throw new Error('The server returned an invalid response. Please try again.'); } }
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`);
      const nextMarkdown = data.markdown?.trim();
      if (!nextMarkdown) throw new Error('The model returned an empty map.');
      const parseStartedAt = performance.now();
      const nextItems = parseMarkdown(nextMarkdown);
      promptTiming(requestId, startedAt, 'markdown-parsed', { parseMs: Math.round(performance.now() - parseStartedAt), itemCount: nextItems.length });
      setHistory(previous => [...previous, { markdown, items }]); setFuture([]); setMarkdown(nextMarkdown); setItems(nextItems); setSelected('n0');
      promptTiming(requestId, startedAt, 'state-queued', { totalMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      promptTiming(requestId, startedAt, 'error', { message: error instanceof Error ? error.message : 'unknown error', totalMs: Math.round(performance.now() - startedAt) });
      setPromptError(error instanceof Error ? error.message : 'Unable to update the map.');
    } finally { setGenerating(false); }
  };
  useEffect(() => { const handler = (e: KeyboardEvent) => { const target = e.target as HTMLElement; const editingField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable; if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void generate(); } else if (editingField) return; else if (e.key === 'Tab') { e.preventDefault(); addNode('child'); } else if (e.key === 'Enter') { e.preventDefault(); addNode('sibling'); } else if (e.key === 'Delete') remove(); else if (selected && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setEditRequest({ id: selected, initial: e.key, request: Date.now() }); } else if (selected && e.key === 'F2') { e.preventDefault(); setEditRequest({ id: selected, request: Date.now() }); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  const filtered = items.filter(i => !query || i.text.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell">
    <aside className="sidebar" style={{ width: sidebarWidth }}>
      <div className="brand"><div className="brand-mark"><GitBranch size={19}/></div><span>Mindweave</span><button className="icon-btn small"><MoreHorizontal size={17}/></button></div>
      <div className="side-section"><div className="eyebrow">WORKSPACE <span>⌘ K</span></div>{mapFiles.map(file => <button key={file.name} className={`nav ${file.name === activeFile ? 'active' : ''}`} onClick={() => openMap(file.name)}><FileText size={17}/> {file.name} {file.name === activeFile && <span className="dot"/>}</button>)}<button className="nav import-nav" onClick={() => fileRef.current?.click()}><Upload size={17}/> Import markdown</button><input ref={fileRef} hidden type="file" accept=".md,.markdown,text/markdown" onChange={e => { const file = e.target.files?.[0]; if (file) file.text().then(value => { setMarkdown(value); setItems(parseMarkdown(value)); }); e.currentTarget.value = ''; }} /></div>
      <div className="side-section prompt"><div className="eyebrow">PROMPT COMPOSER</div><textarea placeholder="Describe how to update this map..." value={prompt} onChange={e => setPrompt(e.target.value)} disabled={generating}/><button className="generate" onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle className="spin" size={15}/> : <Sparkles size={15}/>} {generating ? 'Updating…' : 'Update active map'} <kbd>⌘ ↵</kbd></button>{promptError && <div className="prompt-error">{promptError}</div>}<div className="prompt-hint"><Lightbulb size={14}/> Updates the current map; use Export to download</div></div>
      <div className="sidebar-resizer" role="separator" aria-label="Resize sidebar" title="Drag to resize sidebar" onMouseDown={e => { e.preventDefault(); const move = (event: MouseEvent) => setSidebarWidth(Math.min(440, Math.max(230, event.clientX))); const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); }}><GripVertical size={14}/></div>
      <div className="sidebar-footer"><span className="status"><span className="green"/> Saved just now</span><button className="icon-btn"><RefreshCw size={15}/></button><div className="avatar">AV</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs"><span>My workspace</span><b>/</b><strong>Untitled map</strong></div><div className="top-actions"><div className="history-actions" aria-label="History"><button className="icon-btn" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={16}/></button><button className="icon-btn" onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={16}/></button></div><div className="view-switcher" role="tablist" aria-label="Map view"><button className={view==='mindmap'?'active':''} onClick={()=>setView('mindmap')}>Mindmap</button><button className={view==='markdown'?'active':''} onClick={()=>setView('markdown')}>Markdown</button></div><button className="share"><Zap size={15}/> Share</button><button className="icon-btn"><MoreHorizontal size={18}/></button></div></header><section className="workspace"><div className="canvas-head"><div><h1>{view === 'mindmap' ? 'Untitled map' : 'Source markdown'}</h1><p>{view === 'mindmap' ? <>Product launch strategy <span>•</span> Edited just now</> : <>Edit the outline to update the mindmap <span>•</span> Markdown source</>}</p></div>{view === 'mindmap' && <div className="canvas-tools"><div className="search"><Search size={15}/><input placeholder="Find in map" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ F</kbd></div><button className="icon-btn"><Maximize2 size={16}/></button></div>}</div>{view === 'mindmap' ? <div className="flow-wrap"><Mindmap items={filtered} selected={selected} select={select} edit={edit} zoom={zoom}/><div className="canvas-hint"><span className="key">TAB</span> child <span className="key">↵</span> sibling <span className="key">F2</span> edit <span className="key">DEL</span> delete</div><div className="zoom"><button onClick={()=>setZoom(z=>Math.min(1.3,z+.1))}>+</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))}>−</button></div></div> : <MarkdownEditor markdown={markdown} setMarkdown={updateMarkdown} onExport={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([markdown], {type:'text/markdown'})); a.download = 'mindmap.md'; a.click(); }} />}</section></main>
  </div>
}

function MarkdownEditor({ markdown, setMarkdown, onSave = () => undefined, onExport }: { markdown: string; setMarkdown: (value: string) => void; onSave?: () => void; onExport: () => void }) {
  return <div className="markdown-view"><div className="markdown-toolbar"><span className="markdown-file"><FileText size={16}/> mindmap.md</span><span className="markdown-meta">Markdown outline · saved on blur</span><button onClick={onExport}><ArrowDownToLine size={14}/> Export</button></div><textarea aria-label="Markdown source editor" spellCheck={false} value={markdown} onChange={e=>setMarkdown(e.target.value)} onBlur={onSave} /></div>;
}

function Mindmap({ items, selected, select, edit, zoom }: {items: Item[]; selected: string; select:(id:string)=>void; edit:(id:string,text:string)=>void; zoom:number}) {
  const [editRequest, setEditRequest] = useState<{ id: string; initial?: string; request: number } | null>(null);
  useEffect(() => { const handler = (e: KeyboardEvent) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return; if (selected && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setEditRequest({ id: selected, initial: e.key, request: Date.now() }); } else if (selected && e.key === 'F2') { e.preventDefault(); setEditRequest({ id: selected, request: Date.now() }); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [selected]);
  const { fitView } = useReactFlow(); const nodes: Node[] = []; const edges: Edge[] = [];
  const children = new Map<string, Item[]>(); const visible = new Set(items.map(item => item.id));
  items.forEach(item => { if (item.parent && visible.has(item.parent)) { const group = children.get(item.parent) ?? []; group.push(item); children.set(item.parent, group); } });
  const roots = items.filter(item => !item.parent || !visible.has(item.parent));
  // Keep the estimate conservative because the node's status marker, handles,
  // padding, and proportional font width reduce the space available for text.
  const estimateHeight = (text: string) => { const charsPerLine = 24; const lineHeight = 14; const verticalPadding = 16; const lines = Math.max(1, Math.ceil(text.length / charsPerLine)); return Math.max(30, lines * lineHeight + verticalPadding); };
  const positions = new Map<string, { x: number; y: number; height: number }>(); let nextY = 0;
  const place = (item: Item) => {
    const descendants = children.get(item.id) ?? [];
    const nodeHeight = estimateHeight(item.text);
    if (!descendants.length) { positions.set(item.id, { x: item.depth * 320, y: nextY, height: nodeHeight }); nextY += nodeHeight + 18; return; }
    descendants.forEach(place);
    const first = positions.get(descendants[0].id)!; const last = positions.get(descendants[descendants.length - 1].id)!;
    const centerY = (first.y + last.y) / 2;
    positions.set(item.id, { x: item.depth * 320, y: centerY, height: nodeHeight });
  };
  roots.forEach(place);
  items.forEach(item => { const position = positions.get(item.id) ?? { x: item.depth * 320, y: nextY, height: 30 }; nodes.push({ id:item.id, type:'mindNode', position, data:{ label:item.text, depth:item.depth, selected:item.id===selected, onSelect:()=>select(item.id), onEdit:(v:string)=>edit(item.id,v), editRequest: editRequest?.id === item.id ? editRequest : null, nodeHeight: position.height }, sourcePosition:Position.Right, targetPosition:Position.Left }); if(item.parent && visible.has(item.parent)) edges.push({id:`e-${item.parent}-${item.id}`,source:item.parent,target:item.id,type:'smoothstep',style:{stroke:'#174b60',strokeWidth:2}}); });
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={mindNodeTypes} fitView onInit={()=>fitView({padding:.2})} minZoom={.5} maxZoom={1.5} zoomOnScroll={false} panOnScroll nodesDraggable={false} proOptions={{hideAttribution:true}}><Background color="#d9ddd8" gap={32} size={1}/><MiniMap pannable zoomable nodeColor="#174b60" maskColor="rgba(221,225,220,.72)"/><Controls showInteractive={false}/></ReactFlow>
}
const mindNodeTypes = { mindNode: MindNode };
function MindNode({ data }: {data:any}) {
  const [editing, setEditing] = useState(false); const [value, setValue] = useState(data.label); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setValue(data.label); }, [data.label]);
  useEffect(() => { if (!data.editRequest) return; setEditing(true); setValue(data.editRequest.initial ?? data.label); requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); }); }, [data.editRequest]);
  const finish = (commit: boolean) => { if (commit) data.onEdit(value); else setValue(data.label); setEditing(false); };
  const nodeHeight = data.nodeHeight ?? 30;
  return <div className={`mind-node depth-${data.depth} ${data.selected?'selected':''}`} style={{minHeight:nodeHeight}} onClick={data.onSelect} onDoubleClick={()=>{setEditing(true); requestAnimationFrame(()=>inputRef.current?.focus());}}><Handle type="target" position={Position.Left} className="mind-handle" /><span className="node-status" />{editing ? <input ref={inputRef} autoFocus value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>finish(true)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();finish(true);} if(e.key==='Escape'){e.preventDefault();finish(false);}}}/> : <span>{data.label}</span>}<Handle type="source" position={Position.Right} className="mind-handle" /></div>
}
export default function Wrapped(){ return <ReactFlowProvider><App/></ReactFlowProvider> }
