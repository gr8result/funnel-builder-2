import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { blankDocument, blankPage, copyDocument, uid, loadDocument, saveDocument, listDocuments } from '../../../lib/projectEstimate/pageBuilderStore.js';
import { exportPageBuilderPdf } from '../../../lib/projectEstimate/pageBuilderPdf.js';

function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function ProjectEstimatePageBuilder(){
  const [doc,setDoc]=useState(null),[status,setStatus]=useState('Loading'),[error,setError]=useState(''),[library,setLibrary]=useState([]),[active,setActive]=useState(0),[selected,setSelected]=useState('');
  const current=useRef(null),savedRevision=useRef(0),queue=useRef(Promise.resolve()),timer=useRef(null),generation=useRef(0),context=useRef(null),tab=useRef('');
  const imageInput=useRef(null);
  const draftKey=id=>`page-builder-draft:${tab.current}:${id}`;
  const refreshLibrary=()=>listDocuments(context.current.workspace).then(setLibrary).catch(e=>setError(e.message));
  const install=next=>{clearTimeout(timer.current);generation.current++;current.current=next;savedRevision.current=next.revision;setDoc(next);setActive(0);setError('');setStatus(next.revision?'Saved':'Unsaved changes');
    const params=new URLSearchParams({workspace:next.workspace,job:next.job,document:next.id});history.replaceState(null,'',location.pathname+'?'+params);};
  const stash=next=>localStorage.setItem(draftKey(next.id),JSON.stringify(next));
  const save=(snapshot=current.current)=>{
    if(!snapshot)return Promise.resolve(null);
    clearTimeout(timer.current);const epoch=generation.current;const captured=structuredClone(snapshot);
    const work=queue.current.catch(()=>{}).then(async()=>{
      if(epoch!==generation.current)return null;
      setStatus('Saving');
      try{const result=await saveDocument(captured,savedRevision.current);
        if(epoch!==generation.current)return result;
        savedRevision.current=result.revision;
        current.current={...current.current,revision:result.revision};setDoc(current.current);
        if(JSON.stringify(current.current.pages)===JSON.stringify(captured.pages)&&current.current.name===captured.name){localStorage.removeItem(draftKey(captured.id));setStatus('Saved');}else{stash(current.current);setStatus('Unsaved changes');}
        setError('');await refreshLibrary();return result;
      }catch(e){if(epoch===generation.current){setError(e.message);setStatus('Save failed');}return null;}
    });queue.current=work;return work;
  };
  const change=next=>{current.current=next;setDoc(next);setStatus('Unsaved changes');setError('');try{stash(next);}catch(e){setError('Local recovery storage is full. Save now or download a recovery copy.');}clearTimeout(timer.current);timer.current=setTimeout(()=>save(next),900);};
  const newBlank=()=>{if(current.current)try{stash(current.current);}catch{};install(blankDocument(context.current.workspace,context.current.job));};
  const load=async id=>{
    setStatus('Loading');setError('');
    try{const next=await loadDocument(id,context.current.workspace,context.current.job);install(next);}
    catch(e){setError(e.message);setStatus('Save failed');}
  };
  useEffect(()=>{
    let alive=true;
    const params=new URLSearchParams(location.search);context.current={workspace:params.get('workspace')||'local',job:params.get('job')||'unassigned'};
    tab.current=sessionStorage.getItem('page-builder-tab')||uid();sessionStorage.setItem('page-builder-tab',tab.current);
    const start=async()=>{
      const id=params.get('document');
      try{
        const draft=id&&localStorage.getItem(draftKey(id));
        if(draft){const parsed=JSON.parse(draft);if(parsed.workspace!==context.current.workspace||parsed.job!==context.current.job)throw Error('Recovery draft belongs to another job.');
          // Recover into a new identity: never overwrite a revision another tab may have saved.
          const recovered=copyDocument(parsed,{...context.current,name:parsed.name+' (recovered)'});if(alive){install(recovered);stash(recovered);setStatus('Recovered');}
        }else if(id){const next=await loadDocument(id,context.current.workspace,context.current.job);if(alive)install(next);}
        else if(alive)install(blankDocument(context.current.workspace,context.current.job));
      }catch(e){if(alive){setError(e.message);setStatus('Save failed');}}
      if(alive)refreshLibrary();
    };start();
    const before=e=>{if(current.current&&localStorage.getItem(draftKey(current.current.id))){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',before);
    return()=>{alive=false;clearTimeout(timer.current);window.removeEventListener('beforeunload',before);};
  },[]);
  const patchBlock=(id,patch)=>change({...current.current,pages:current.current.pages.map(p=>({...p,blocks:p.blocks.map(b=>b.id===id?{...b,...patch}:b)}))});
  const add=(type,extra={})=>{
    const block={id:uid(),type,...(type==='text'?{text:'',fontSize:14}:type==='table'?{rows:[['Item','Quantity','Amount'],['','','']]}:type==='block'?{heading:'Content block',text:''}:{}),...extra};
    change({...current.current,pages:current.current.pages.map((p,i)=>i===active?{...p,blocks:[...p.blocks,block]}:p)});setSelected(block.id);
  };
  const copy=async(kind)=>{if(!doc)return;const name=window.prompt(kind==='template'?'Master template name':'Separate estimate name',doc.name);if(!name)return;
    try{const result=await saveDocument(copyDocument(current.current,{...context.current,kind,name}));await refreshLibrary();if(kind==='estimate')install(result);else{setStatus('Saved');setError('Master template saved separately. Editing this estimate does not change it.');}}
    catch(e){setStatus('Save failed');setError(e.message);}
  };
  const fromTemplate=async id=>{const template=library.find(d=>d.id===id);if(!template)return;install(copyDocument(template,{...context.current,name:template.name+' estimate'}));};
  const exportPdf=async()=>{try{const bytes=await exportPageBuilderPdf(current.current);download(bytes,`${doc.name}.pdf`,'application/pdf');}catch(e){setError('PDF export failed: '+e.message);}};
  const selectedBlock=doc?.pages.flatMap(p=>p.blocks).find(b=>b.id===selected);
  return <><Head><title>Project Estimate Page Builder</title></Head><main className="builder">
    <header><a href="/modules/estimate-builder">Back to Estimate Builder</a><h1>Project Estimate Page Builder</h1><p>A separate document editor · Saved in this browser · Export a copy for safekeeping</p>
      <strong role="status">{status}</strong><p>Workspace: {doc?.workspace||context.current?.workspace} · Job: {doc?.job||context.current?.job}</p>
      <div className="tools"><button onClick={newBlank}>New Blank Estimate</button><button disabled={!doc} onClick={()=>save()}>Save</button><button disabled={!doc} onClick={()=>copy('estimate')}>Save separate copy</button><button disabled={!doc} onClick={()=>copy('template')}>Create master template</button><button disabled={!doc} onClick={exportPdf}>Export PDF</button><button disabled={!doc} onClick={()=>download(JSON.stringify(current.current,null,2),`${doc.name}.json`,'application/json')}>Download recovery copy</button></div>
      {error&&<div role="alert"><p>{error}</p><button onClick={()=>load(new URLSearchParams(location.search).get('document'))}>Retry saved document</button><button onClick={newBlank}>Start blank safely</button></div>}
      <div className="tools"><label>Open estimate <select aria-label="Open estimate" value="" onChange={e=>load(e.target.value)}><option value="">Choose saved estimate</option>{library.filter(d=>d.kind==='estimate'&&d.job===context.current?.job).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Create from template <select aria-label="Create from template" value="" onChange={e=>fromTemplate(e.target.value)}><option value="">Choose master template</option>{library.filter(d=>d.kind==='template').map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    </header>
    {doc&&<><div className="tools ribbon"><input aria-label="Document name" value={doc.name} onChange={e=>change({...doc,name:e.target.value})}/><button onClick={()=>{change({...doc,pages:[...doc.pages,blankPage()]});setActive(doc.pages.length);}}>Add Page</button>{['text','table','shape','block'].map(type=><button key={type} onClick={()=>add(type)}>Add {type[0].toUpperCase()+type.slice(1)}</button>)}<button onClick={()=>imageInput.current.click()}>Add Image</button><input hidden ref={imageInput} type="file" accept="image/png,image/jpeg" onChange={async e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>add('image',{src:reader.result,alt:file.name});reader.readAsDataURL(file);e.target.value='';}}/>
      <button disabled={!selectedBlock} onClick={()=>patchBlock(selected,{bold:!selectedBlock.bold})}>Bold</button><button disabled={!selectedBlock} onClick={()=>patchBlock(selected,{italic:!selectedBlock.italic})}>Italic</button><label>Text size <select aria-label="Text size" value={selectedBlock?.fontSize||14} onChange={e=>patchBlock(selected,{fontSize:Number(e.target.value)})}>{[12,14,18,24,32].map(n=><option key={n}>{n}</option>)}</select></label></div>
      <div className="workspace"><nav aria-label="Pages">{doc.pages.map((p,i)=><button key={p.id} onClick={()=>{setActive(i);document.getElementById(p.id)?.scrollIntoView({block:'center'});}}>Page {i+1}</button>)}</nav><div className="sheets">{doc.pages.map((p,i)=><section id={p.id} key={p.id} className={'paper '+(active===i?'active':'')} data-page={i+1} onClick={()=>setActive(i)}><span className="pageNumber">Page {i+1}</span>{p.blocks.map(b=><div key={b.id} data-block={b.type} className={'content '+(selected===b.id?'selected':'')} onClick={()=>setSelected(b.id)} style={{fontSize:b.fontSize||14,fontWeight:b.bold?'bold':'normal',fontStyle:b.italic?'italic':'normal'}}>
        {b.type==='text'&&<textarea aria-label="Text" placeholder="Start writing…" value={b.text} onChange={e=>patchBlock(b.id,{text:e.target.value})}/>}
        {b.type==='block'&&<><input aria-label="Block heading" value={b.heading} onChange={e=>patchBlock(b.id,{heading:e.target.value})}/><textarea aria-label="Block content" placeholder="Write your content…" value={b.text} onChange={e=>patchBlock(b.id,{text:e.target.value})}/></>}
        {b.type==='image'&&<img src={b.src} alt={b.alt}/>}
        {b.type==='shape'&&<div className="shape" aria-label="Rectangle shape"/>}
        {b.type==='table'&&<><table><tbody>{b.rows.map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c}><input aria-label={`Row ${r+1} column ${c+1}`} value={cell} onChange={e=>patchBlock(b.id,{rows:b.rows.map((row,ri)=>row.map((v,ci)=>ri===r&&ci===c?e.target.value:v))})}/></td>)}</tr>)}</tbody></table><button onClick={()=>patchBlock(b.id,{rows:[...b.rows,b.rows[0].map(()=>'')]})}>Add row</button></>}
        <button className="remove" aria-label="Remove block" onClick={()=>change({...doc,pages:doc.pages.map(page=>({...page,blocks:page.blocks.filter(item=>item.id!==b.id)}))})}>Remove</button>
      </div>)}</section>)}</div></div></>}
    <style jsx>{`*{box-sizing:border-box}.builder{background:#eef0f3;min-height:100vh;color:#182c40;font-family:Arial,sans-serif;padding:24px}header{background:white;padding:20px;border-radius:8px}h1{margin:12px 0}header p{font-size:13px}button,select,input{font:inherit}button,select{padding:8px 12px;border:1px solid #bcc8d4;border-radius:4px;background:white;color:#182c40;cursor:pointer}button:disabled{opacity:.5}.tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center}.ribbon{position:sticky;top:0;background:#fff;padding:12px;z-index:2;box-shadow:0 2px 6px #0002}.workspace{display:flex;gap:24px}nav{width:130px;display:flex;flex-direction:column;gap:8px}.sheets{flex:1}.paper{background:white;width:794px;min-height:1123px;padding:65px 60px;margin:24px auto;box-shadow:0 2px 8px #0002;position:relative}.paper.active{outline:2px solid #6b8fab}.pageNumber{position:absolute;bottom:20px;right:30px;font-size:12px;color:#697987}.content{margin:14px 0;padding:6px;position:relative}.selected{outline:1px dashed #8faecb}textarea{width:100%;min-height:110px;resize:vertical;border:0;font:inherit;background:transparent;line-height:1.6}input{max-width:100%;padding:6px;border:1px solid #ccd3dc}.content>input{font-size:20px;font-weight:bold;width:100%}img{display:block;max-width:100%;max-height:350px}.shape{width:280px;height:70px;border:1px solid #335980;background:#dfebf7}table{border-collapse:collapse;width:100%}td{border:1px solid #aab6c2;padding:3px}td input{width:100%;border:0}.remove{font-size:11px;opacity:.4}.remove:hover{opacity:1}[role=alert]{background:#fff1ed;padding:12px;border-left:4px solid #b94325}@media(max-width:1000px){nav{display:none}.paper{width:100%;min-height:900px;padding:32px}.builder{padding:8px}}`}</style>
  </main></>;
}
