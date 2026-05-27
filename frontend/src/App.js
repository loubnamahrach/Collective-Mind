import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const AGENTS_CONFIG = {
  logique:      { name: "Agent Logique",      emoji: "🔷", color: "#3366e8", role: "Analyste Rationnel" },
  creatif:      { name: "Agent Créatif",      emoji: "✨", color: "#f59e0b", role: "Penseur Innovant" },
  ethique:      { name: "Agent Éthique",      emoji: "⚖️", color: "#10b981", role: "Gardien Moral" },
  critique:     { name: "Agent Critique",     emoji: "🔍", color: "#ef4444", role: "Avocat du Diable" },
  memoire:      { name: "Agent Mémoire",      emoji: "🧩", color: "#8b5cf6", role: "Archiviste Collectif" },
  scientifique: { name: "Agent Scientifique", emoji: "🔬", color: "#0ea5e9", role: "Expert RAG" },
  mediateur:    { name: "Agent Médiateur",    emoji: "🌐", color: "#f97316", role: "Architecte du Consensus" },
};

const FILE_ICONS = { pdf: '📕', txt: '📄', docx: '📝', doc: '📝', csv: '📊', md: '📋', json: '📋', default: '📎' };
const getFileIcon = (filename) => {
  const ext = filename?.toLowerCase().split('.').pop() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
};
const formatBytes = (n) => n < 1024 ? `${n} o` : n < 1048576 ? `${(n/1024).toFixed(1)} Ko` : `${(n/1048576).toFixed(1)} Mo`;

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ── Network Graph ─────────────────────────────────────────────
function NetworkGraph({ alliances, conflicts, activeAgent, agentStatuses }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rW = canvas.offsetWidth, rH = canvas.offsetHeight;
    canvas.width = rW * dpr; canvas.height = rH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = rW/2, cy = rH/2, r = Math.min(rW, rH)*0.36;

    const ids = Object.keys(AGENTS_CONFIG);
    const pos = {};
    ids.forEach((id, i) => {
      const a = (i/ids.length)*2*Math.PI - Math.PI/2;
      pos[id] = { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
    });

    function draw(t) {
      ctx.clearRect(0,0,rW,rH);
      // Grid
      ctx.strokeStyle = 'rgba(67,86,180,0.05)'; ctx.lineWidth = 1;
      for (let x=0;x<rW;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,rH);ctx.stroke();}
      for (let y=0;y<rH;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rW,y);ctx.stroke();}

      // Hub
      const hg = ctx.createRadialGradient(cx,cy,0,cx,cy,22);
      hg.addColorStop(0,'rgba(75,128,245,0.95)'); hg.addColorStop(1,'rgba(139,92,246,0)');
      ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(cx,cy,22,0,2*Math.PI); ctx.fill();
      ctx.fillStyle='white'; ctx.font='bold 8px DM Sans,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CORE',cx,cy);

      // Alliances
      alliances.forEach(({agent1,agent2})=>{
        const p1=pos[agent1],p2=pos[agent2]; if(!p1||!p2) return;
        ctx.strokeStyle=`rgba(16,185,129,${0.15+0.12*Math.sin(t*0.0025)})`;
        ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
        ctx.setLineDash([]);
      });

      // Conflicts
      conflicts.forEach(({agent1,agent2})=>{
        const p1=pos[agent1],p2=pos[agent2]; if(!p1||!p2) return;
        ctx.strokeStyle='rgba(239,68,68,0.18)'; ctx.lineWidth=1; ctx.setLineDash([3,6]);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
        ctx.setLineDash([]);
      });

      // Spokes
      ids.forEach(id=>{
        const p=pos[id]; const active=activeAgent===id;
        ctx.strokeStyle=active?'rgba(75,128,245,0.3)':'rgba(67,86,180,0.07)';
        ctx.lineWidth=active?1.5:0.8;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y); ctx.stroke();
      });

      // Nodes
      ids.forEach(id=>{
        const p=pos[id]; const cfg=AGENTS_CONFIG[id];
        const active=activeAgent===id, done=agentStatuses[id]==='done';
        const nr=active?20:15;

        if(active){
          const pulse=(Math.sin(t*0.005)+1)/2;
          ctx.beginPath(); ctx.arc(p.x,p.y,34+pulse*8,0,2*Math.PI);
          ctx.fillStyle=cfg.color+'15'; ctx.fill();
        }

        ctx.shadowColor=active?cfg.color+'55':'rgba(67,86,180,0.12)';
        ctx.shadowBlur=active?10:4;
        ctx.beginPath(); ctx.arc(p.x,p.y,nr,0,2*Math.PI);
        const g=ctx.createRadialGradient(p.x-nr*.25,p.y-nr*.25,0,p.x,p.y,nr);
        g.addColorStop(0,active?cfg.color:'#ffffff');
        g.addColorStop(1,active?cfg.color+'cc':cfg.color+'20');
        ctx.fillStyle=g; ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle=active?cfg.color:cfg.color+'55'; ctx.lineWidth=active?2:1.5; ctx.stroke();

        if(done&&!active){
          ctx.beginPath(); ctx.arc(p.x+nr*.65,p.y-nr*.65,5,0,2*Math.PI);
          ctx.fillStyle='#10b981'; ctx.fill();
          ctx.fillStyle='white'; ctx.font='bold 6px sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('✓',p.x+nr*.65,p.y-nr*.65);
        }

        ctx.font=`${active?13:10}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle=active?'white':cfg.color;
        ctx.fillText(cfg.emoji,p.x,p.y);

        ctx.font=`${active?'600':'400'} 9px DM Sans,sans-serif`;
        ctx.fillStyle=active?cfg.color:'rgba(67,86,180,0.5)';
        ctx.fillText(cfg.name.replace('Agent ',''),p.x,p.y+nr+11);
      });
    }

    let raf; const loop=(t)=>{draw(t);raf=requestAnimationFrame(loop);};
    raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[alliances,conflicts,activeAgent,agentStatuses]);

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />;
}

// ── File Upload Component ─────────────────────────────────────
function FileUpload({ onDocumentReady, onDocumentRemove, uploadedDoc, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Erreur upload');
      onDocumentReady({ ...data, size: file.size });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [onDocumentReady]);

  const onInputChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  if (uploading) {
    return (
      <div className="file-chip file-chip--loading">
        <div className="spinner" style={{width:18,height:18,borderTopColor:'var(--blue-500)'}} />
        <div className="file-chip__info">
          <div className="file-chip__name">Traitement du fichier…</div>
          <div className="file-chip__meta">Extraction du texte en cours</div>
        </div>
      </div>
    );
  }

  if (uploadedDoc) {
    return (
      <div className="file-chip">
        <span className="file-chip__icon">{getFileIcon(uploadedDoc.filename)}</span>
        <div className="file-chip__info">
          <div className="file-chip__name">{uploadedDoc.filename}</div>
          <div className="file-chip__meta">
            {formatBytes(uploadedDoc.size || 0)} · {uploadedDoc.char_count?.toLocaleString()} caractères extraits
          </div>
          {uploadedDoc.preview && (
            <div className="file-chip__preview">"{uploadedDoc.preview}"</div>
          )}
        </div>
        <span className="file-chip__badge">📎 Référence active</span>
        <button className="file-chip__remove" onClick={onDocumentRemove} title="Retirer le document">✕</button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`upload-zone ${dragOver ? 'upload-zone--dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.docx,.doc,.csv,.md,.json"
          onChange={onInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />
        <span className="upload-zone__icon">📎</span>
        <div className="upload-zone__text">
          <strong>Ajouter un document de référence</strong>
          <span className="upload-zone__formats">PDF · TXT · DOCX · CSV · MD — max 10 Mo</span>
        </div>
      </div>
      {error && (
        <div className="upload-error">
          <span>⚠️</span> {error}
          <button style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'inherit'}} onClick={()=>setError(null)}>✕</button>
        </div>
      )}
    </>
  );
}

// ── Agent Card ────────────────────────────────────────────────
function AgentCard({ message, isNew, hasDoc }) {
  const cfg = AGENTS_CONFIG[message.agent_id];
  if (!cfg) return null;
  return (
    <div className={`agent-card ${isNew ? 'agent-card--new' : ''}`} style={{ '--agent-color': cfg.color }}>
      <div className="agent-card__header">
        <div className="agent-card__avatar" style={{ background: cfg.color+'18', border: `1.5px solid ${cfg.color}33` }}>
          {cfg.emoji}
        </div>
        <div>
          <span className="agent-card__name">{cfg.name}</span>
          <span className="agent-card__role">{cfg.role}</span>
        </div>
        <div className="agent-card__round">R{message.round}</div>
      </div>
      {hasDoc && <div className="doc-badge">📎 Analyse du document</div>}
      <div className="agent-card__content">
        {message.content || message.text || message.response || "(réponse vide)"}
      </div>
    </div>
  );
}

// ── Consensus Panel ───────────────────────────────────────────
function ConsensusPanel({ consensus, votes, consensusScore, onValidate, onReject }) {
  const [comment, setComment] = useState('');
  const approved  = Object.values(votes||{}).filter(v=>v==='approve').length;
  const abstained = Object.values(votes||{}).filter(v=>v==='abstain').length;
  return (
    <div className="consensus-panel">
      <div className="consensus-panel__header">
        <span className="consensus-panel__icon">🌐</span>
        <h3>Consensus collectif</h3>
        <div className="consensus-panel__score">
          <div className="score-bar"><div className="score-bar__fill" style={{width:`${consensusScore*100}%`}} /></div>
          {Math.round(consensusScore*100)}%
        </div>
      </div>
      <div className="consensus-panel__votes">
        {Object.entries(votes||{}).map(([id,vote])=>{
          const cfg=AGENTS_CONFIG[id]; if(!cfg) return null;
          return <div key={id} className={`vote-chip vote-chip--${vote}`}>{cfg.emoji} {vote==='approve'?'✓':vote==='abstain'?'~':'✗'}</div>;
        })}
      </div>
      <div className="consensus-panel__vote-summary">{approved} approuvent · {abstained} s'abstiennent</div>
      <div className="consensus-panel__text">{consensus}</div>
      <div className="human-badge">👤 Validation humaine requise</div>
      <textarea className="human-comment" placeholder="Commentaire optionnel…" value={comment} onChange={e=>setComment(e.target.value)} />
      <div className="human-actions">
        <button className="btn btn--approve" onClick={()=>onValidate(comment)}>✓ Valider</button>
        <button className="btn btn--reject"  onClick={()=>onReject(comment)}>Rejeter</button>
      </div>
    </div>
  );
}

// ── Status Bar ────────────────────────────────────────────────
function StatusBar({ status, round, maxRounds, activeAgent, ragReady, docName }) {
  const cfg = activeAgent ? AGENTS_CONFIG[activeAgent] : null;
  return (
    <div className="status-bar">
      <div className="status-bar__indicator" data-status={status} />
      <span>
        {status==='idle'      && 'En attente d\'une question'}
        {status==='rag'       && '📚 Récupération documentaire…'}
        {status==='debating'  && cfg && `${cfg.emoji} ${cfg.name} délibère — Round ${round}/${maxRounds}`}
        {status==='consensus' && '🌐 Génération du consensus…'}
        {status==='complete'  && '✓ Débat terminé · Validation humaine requise'}
        {status==='validated' && '✅ Consensus validé'}
        {status==='rejected'  && '❌ Consensus rejeté'}
      </span>
      {docName && <span className="file-chip__badge" style={{marginLeft:8}}>📎 {docName}</span>}
      {ragReady && <span className="status-bar__rag">RAG ✓</span>}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [question, setQuestion]         = useState('');
  const [maxRounds, setMaxRounds]       = useState(2);
  const [useRag, setUseRag]             = useState(true);
  const [status, setStatus]             = useState('idle');
  const [messages, setMessages]         = useState([]);
  const [activeAgent, setActiveAgent]   = useState(null);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [alliances, setAlliances]       = useState([]);
  const [conflicts, setConflicts]       = useState([]);
  const [consensus, setConsensus]       = useState(null);
  const [consensusScore, setConsensusScore] = useState(0);
  const [votes, setVotes]               = useState({});
  const [debateId, setDebateId]         = useState(null);
  const [ragReady, setRagReady]         = useState(false);
  const [round, setRound]               = useState(0);
  const [systemLog, setSystemLog]       = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [newMessageId, setNewMessageId] = useState(null);
  const [uploadedDoc, setUploadedDoc]   = useState(null);  // { document_id, filename, ... }
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addLog = useCallback((msg) => {
    setSystemLog(prev => [...prev.slice(-40), { msg, ts: Date.now() }]);
  }, []);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'document_loaded': addLog(`📎 Document chargé: ${event.filename}`); break;
      case 'rag_ready':       setRagReady(true); setStatus('rag'); addLog('📚 RAG prêt'); break;
      case 'debate_start':    setDebateId(event.debate_id); setStatus('debating'); addLog('🚀 Débat lancé'); break;
      case 'round_start':     setRound(event.round); addLog(`🔄 Round ${event.round}/${event.max_rounds}`); break;
      case 'agent_thinking':
        setActiveAgent(event.agent_id);
        setAgentStatuses(p=>({...p,[event.agent_id]:'thinking'}));
        addLog(`${AGENTS_CONFIG[event.agent_id]?.emoji} ${event.agent_name} réfléchit…`);
        break;
      case 'agent_response': {
        setActiveAgent(null);
        setAgentStatuses(p=>({...p,[event.agent_id]:'done'}));
        const id=`${event.agent_id}-${event.round}-${Date.now()}`;
        console.log('Agent response:', event.agent_id, 'content:', event.content?.slice(0,100));
        setNewMessageId(id);
        setMessages(p=>[...p,{...event,_id:id}]);
        if(event.alliances) setAlliances(event.alliances);
        if(event.conflicts)  setConflicts(event.conflicts);
        addLog(`✅ ${event.agent_name} a répondu`);
        break;
      }
      case 'round_end':       setConsensusScore(event.consensus_score||0); break;
      case 'consensus_start': setStatus('consensus'); setActiveAgent('mediateur'); addLog('🌐 Consensus…'); break;
      case 'consensus_ready':
        setActiveAgent(null);
        setConsensus(event.consensus);
        setConsensusScore(event.consensus_score||0.82);
        setVotes(event.votes||{});
        if(event.alliances) setAlliances(event.alliances);
        if(event.conflicts)  setConflicts(event.conflicts);
        addLog('✨ Consensus généré');
        break;
      case 'debate_complete': setStatus('complete'); addLog('✓ Débat complet'); break;
      default: break;
    }
  }, [addLog]);

  const startDebate = useCallback(async () => {
    if (!question.trim() || status==='debating'||status==='consensus') return;
    setMessages([]); setAlliances([]); setConflicts([]); setConsensus(null);
    setConsensusScore(0); setVotes({}); setDebateId(null); setRagReady(false);
    setRound(0); setSystemLog([]); setValidationResult(null);
    setActiveAgent(null); setAgentStatuses({}); setStatus('debating');
    addLog('Initialisation du débat…');
    if (uploadedDoc) addLog(`📎 Document inclus: ${uploadedDoc.filename}`);

    try {
      const body = {
        question, max_rounds: maxRounds, use_rag: useRag,
        document_id: uploadedDoc?.document_id || null
      };
      const resp = await fetch(`${API_BASE}/debate/stream`,{
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
      });
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const reader=resp.body.getReader(); const dec=new TextDecoder(); let buf='';
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split('\n'); buf=lines.pop()||'';
        for(const line of lines){
          if(!line.startsWith('data: ')) continue;
          try{handleEvent(JSON.parse(line.slice(6)));}catch{}
        }
      }
    } catch(err) { addLog(`Erreur: ${err.message}`); setStatus('idle'); }
  },[question,maxRounds,useRag,uploadedDoc,status,addLog,handleEvent]);

  const handleValidate = useCallback(async(comment)=>{
    if(!debateId) return;
    try{
      const r=await fetch(`${API_BASE}/debate/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({debate_id:debateId,decision:'approve',comment})});
      setValidationResult(await r.json()); setStatus('validated'); addLog('✅ Validé');
    }catch(e){addLog(`Erreur: ${e.message}`);}
  },[debateId,addLog]);

  const handleReject = useCallback(async(comment)=>{
    if(!debateId) return;
    try{
      const r=await fetch(`${API_BASE}/debate/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({debate_id:debateId,decision:'reject',comment})});
      setValidationResult(await r.json()); setStatus('rejected'); addLog('❌ Rejeté');
    }catch(e){addLog(`Erreur: ${e.message}`);}
  },[debateId,addLog]);

  const handleDocumentReady = useCallback((doc)=>{
    setUploadedDoc(doc);
    addLog(`📎 Document prêt: ${doc.filename} (${doc.char_count?.toLocaleString()} car.)`);
  },[addLog]);

  const handleDocumentRemove = useCallback(async()=>{
    if(uploadedDoc?.document_id){
      try{ await fetch(`${API_BASE}/upload/${uploadedDoc.document_id}`,{method:'DELETE'}); }catch{}
    }
    setUploadedDoc(null); addLog('🗑 Document retiré');
  },[uploadedDoc,addLog]);

  const isRunning = status==='debating'||status==='consensus'||status==='rag';

  const EXAMPLES=[
    "Faut-il remplacer certains emplois par l'IA ?",
    "Comment réduire le chômage grâce à l'IA ?",
    "L'IA générative menace-t-elle la créativité humaine ?",
    "Analysez ce document et donnez vos conclusions.",
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__logo">
          <div className="logo-mark">🧠</div>
          <div>
            <div className="logo-title"><span>Collective</span> Mind</div>
            <div className="logo-sub">Intelligence Émergente Multi-Agent</div>
          </div>
        </div>
        <div className="app-header__stats">
          <div className="stat"><span className="stat__val">{Object.keys(AGENTS_CONFIG).length}</span><span className="stat__label">agents</span></div>
          <div className="stat"><span className="stat__val">{messages.length}</span><span className="stat__label">messages</span></div>
          <div className="stat"><span className="stat__val">{alliances.length}</span><span className="stat__label">alliances</span></div>
          <div className="stat"><span className="stat__val">{Math.round(consensusScore*100)}%</span><span className="stat__label">consensus</span></div>
        </div>
      </header>

      <StatusBar status={status} round={round} maxRounds={maxRounds} activeAgent={activeAgent} ragReady={ragReady} docName={uploadedDoc?.filename} />

      <div className="app-body">
        {/* Left */}
        <aside className="left-panel">
          <div className="network-container">
            <div className="panel-label">Réseau d'agents</div>
            <NetworkGraph alliances={alliances} conflicts={conflicts} activeAgent={activeAgent} agentStatuses={agentStatuses} />
          </div>
          <div className="relationships">
            {alliances.length>0&&(
              <div className="rel-section">
                <div className="rel-title rel-title--alliance">🤝 Alliances</div>
                {alliances.map((a,i)=>(
                  <div key={i} className="rel-item rel-item--alliance">
                    {AGENTS_CONFIG[a.agent1]?.emoji} ↔ {AGENTS_CONFIG[a.agent2]?.emoji}
                    <span>{a.topic}</span>
                  </div>
                ))}
              </div>
            )}
            {conflicts.length>0&&(
              <div className="rel-section">
                <div className="rel-title rel-title--conflict">⚡ Tensions</div>
                {conflicts.map((c,i)=>(
                  <div key={i} className="rel-item rel-item--conflict">
                    {AGENTS_CONFIG[c.agent1]?.emoji} ↕ {AGENTS_CONFIG[c.agent2]?.emoji}
                    <span>{c.topic}</span>
                  </div>
                ))}
              </div>
            )}
            {alliances.length===0&&conflicts.length===0&&(
              <div style={{color:'var(--text-300)',fontSize:11,padding:'4px',fontStyle:'italic'}}>
                Les relations émergent pendant le débat…
              </div>
            )}
          </div>
          {/* agent grid removed */}
        </aside>

        {/* Center */}
        <main className="debate-feed">
          <div className="debate-feed__messages">
            {messages.length===0&&status==='idle'&&(
              <div className="empty-state">
                <div className="empty-state__icon">🧠</div>
                <div className="empty-state__title">Posez une question au collectif</div>
                <p className="empty-state__sub">7 agents spécialisés débattent, se contredisent et construisent un consensus. Importez un document pour l'analyser collectivement.</p>
                <div className="example-questions">
                  {EXAMPLES.map((q,i)=>(
                    <button key={i} className="example-btn" onClick={()=>setQuestion(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg,i)=>(
              <AgentCard key={msg._id||i} message={msg} isNew={msg._id===newMessageId} hasDoc={!!uploadedDoc&&msg.round===1} />
            ))}
            {isRunning&&(
              <div className="typing-indicator">
                <div className="typing-dots"><span/><span/><span/></div>
                {activeAgent&&AGENTS_CONFIG[activeAgent]&&(
                  <span className="typing-label">{AGENTS_CONFIG[activeAgent].emoji} {AGENTS_CONFIG[activeAgent].name} réfléchit…</span>
                )}
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Input zone */}
          <div className="debate-input">
            <FileUpload
              uploadedDoc={uploadedDoc}
              onDocumentReady={handleDocumentReady}
              onDocumentRemove={handleDocumentRemove}
              disabled={isRunning}
            />
            <div className="debate-input__controls">
              <label className="control-label">
                Rounds :
                <select className="control-select" value={maxRounds} onChange={e=>setMaxRounds(Number(e.target.value))} disabled={isRunning}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </label>
              <label className="control-toggle">
                <input type="checkbox" checked={useRag} onChange={e=>setUseRag(e.target.checked)} disabled={isRunning}/>
                Enrichissement RAG
              </label>
            </div>
            <div className="debate-input__row">
              <textarea
                className="debate-input__textarea"
                value={question}
                onChange={e=>setQuestion(e.target.value)}
                placeholder={uploadedDoc ? `Posez une question sur "${uploadedDoc.filename}"…` : "Posez une question complexe au collectif…"}
                disabled={isRunning}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!isRunning){e.preventDefault();startDebate();}}}
              />
              <button className={`debate-input__submit ${isRunning?'debate-input__submit--loading':''}`} onClick={startDebate} disabled={isRunning||!question.trim()}>
                {isRunning?<span className="spinner"/>:'▶'}
              </button>
            </div>
          </div>
        </main>

        {/* Right */}
        <aside className="right-panel">
          {consensus&&!validationResult&&(status==='complete'||status==='consensus')&&(
            <ConsensusPanel consensus={consensus} votes={votes} consensusScore={consensusScore} onValidate={handleValidate} onReject={handleReject}/>
          )}
          {validationResult&&(
            <div className="validation-result">
              <div className={`validation-result__badge ${validationResult.status==='validated'?'badge--approved':'badge--rejected'}`}>
                {validationResult.status==='validated'?'✅ Validé':'❌ Rejeté'}
              </div>
              <p className="validation-result__text">{validationResult.final_consensus?.slice(0,300)}…</p>
              {validationResult.comment&&<p className="validation-result__comment">💬 {validationResult.comment}</p>}
            </div>
          )}
          <div className="system-log">
            <div className="panel-label">Journal système</div>
            <div className="system-log__entries">
              {systemLog.length===0&&<div className="log-entry log-entry--empty">En attente…</div>}
              {systemLog.map((e,i)=>(
                <div key={i} className="log-entry">
                  <span className="log-entry__ts">{new Date(e.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                  <span className="log-entry__msg">{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
