# Read-only SSTable audit. Never opens the database with a writer or touches LOCK.
# Format: https://github.com/google/leveldb/blob/main/doc/table_format.md
import os,struct,json
from pathlib import Path
root=Path(os.environ['LOCALAPPDATA'])/'Google/Chrome/User Data'
out=Path('test-artifacts/manual-entry-door-recovery');out.mkdir(exist_ok=True,parents=True)
def var(b,p):
 n=0;s=0
 while True:
  c=b[p];p+=1;n|=(c&127)<<s
  if c<128:return n,p
  s+=7
  if s>63:raise ValueError('bad varint')
def snappy(b):
 size,p=var(b,0);o=bytearray()
 if size>32*1024*1024:raise ValueError('oversized block skipped')
 while p<len(b):
  tag=b[p];p+=1;t=tag&3
  if t==0:
   n=tag>>2
   if n<60:n+=1
   else:w=n-59;n=int.from_bytes(b[p:p+w],'little')+1;p+=w
   o.extend(b[p:p+n]);p+=n
  else:
   if t==1:n=4+((tag>>2)&7);off=((tag&224)<<3)|b[p];p+=1
   elif t==2:n=1+(tag>>2);off=int.from_bytes(b[p:p+2],'little');p+=2
   else:n=1+(tag>>2);off=int.from_bytes(b[p:p+4],'little');p+=4
   if not off or off>len(o):raise ValueError('bad offset')
   for _ in range(n):o.append(o[-off])
 assert len(o)==size
 return bytes(o)
def entries(b):
 end=len(b)-4-4*int.from_bytes(b[-4:],'little');p=0;last=b''
 while p<end:
  shared,p=var(b,p);length,p=var(b,p);vlen,p=var(b,p);key=last[:shared]+b[p:p+length];p+=length;value=b[p:p+vlen];p+=vlen;last=key;yield key,value
latest={};errors=[];files=0
for profile in root.iterdir():
 for file in (profile/'Local Storage/leveldb').glob('*.ldb'):
  try:
   b=file.read_bytes();files+=1;p=len(b)-48
   _,p=var(b,p);_,p=var(b,p);io,p=var(b,p);ilen,p=var(b,p)
   def block(off,n):return snappy(b[off:off+n]) if b[off+n]==1 else b[off:off+n]
   for _,handle in entries(block(io,ilen)):
    off,pos=var(handle,0);n,pos=var(handle,pos)
    for k,v in entries(block(off,n)):
     if b'localhost:3000' not in k or b'selection' not in k.lower():continue
     seq=int.from_bytes(k[-8:],'little')>>8;typ=k[-8];key=k[:-8].decode('latin1');ident=(profile.name,key)
     if ident not in latest or latest[ident]['sequence']<seq:latest[ident]={'profile':profile.name,'key':key,'sequence':seq,'deleted':typ==0,'value':v,'file':str(file)}
  except Exception as e:errors.append({'file':str(file),'error':str(e)})
result={'sstableFilesRead':files,'errors':errors,'records':[]}
for value in latest.values():
 raw=value.pop('value');entry={**value,'bytes':len(raw)}
 if not value['deleted'] and 'gr8:embedded-selections-book:' in value['key']:
  try:
   payload=json.loads(raw[1:].decode('utf-16-le' if raw[0]==0 else 'latin1'));entry.update(projectId=payload.get('projectId'),savedAt=payload.get('savedAt'))
   doors=[r for room in payload.get('book',{}).get('rooms',[]) for r in room.get('rows',[]) if r.get('guidedRequirementKey')=='entry-door' or r.get('guidedSelection',{}).get('requirementKey')=='entry-door']
   entry['doors']=doors
   if doors:(out/f"local-{value['profile'].replace(' ','-')}-{value['sequence']}.json").write_text(json.dumps(payload,ensure_ascii=True,indent=2),encoding='utf-8')
  except Exception as e:entry['parseError']=str(e)
 result['records'].append(entry)
(out/'local-storage-audit.json').write_text(json.dumps(result,ensure_ascii=True,indent=2),encoding='utf-8')
print(json.dumps({'files':files,'errors':errors,'records':[dict(profile=r['profile'],key=r['key'],deleted=r['deleted'],projectId=r.get('projectId'),savedAt=r.get('savedAt'),doors=[{'selectedProduct':d.get('selectedProduct'),'productCode':d.get('guidedSelection',{}).get('productCode'),'entryDoors':len(d.get('guidedSelection',{}).get('entryDoors',[]))} for d in r.get('doors',[])],parseError=r.get('parseError')) for r in result['records']]},indent=2))
