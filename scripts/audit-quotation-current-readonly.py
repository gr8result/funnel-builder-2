"""Copy and inspect recoverable quotation data without opening a browser database for writing."""
import os, sys, json, types, zipfile, hashlib, shutil
from pathlib import Path
out=Path('recovery/quotation-changes-2026-10-03');out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,'artifacts/test-artifacts/manual-entry-door-recovery/python-deps')
ns={};source=Path('scripts/audit-local-door-selections-readonly.py').read_text(encoding='utf-8-sig');source=source.replace('32*1024*1024','1024*1024*1024').replace('for _ in range(n):o.append(o[-off])','o.extend((o[-off:] * ((n+off-1)//off))[:n])');exec(source[:source.index('latest={}')],ns)
sys.modules['snappy']=types.SimpleNamespace(decompress=ns['snappy'])
import compression.zstd
sys.modules['zstd']=types.SimpleNamespace(decompress=compression.zstd.decompress)
from dfindexeddb.indexeddb.chromium import blink,v8
from dfindexeddb.indexeddb import types as js
v8.ValueDeserializer.LATEST_VERSION=16
def plain(v):
 if isinstance(v,js.JSArray):return [plain(v.properties.get(i,v.properties.get(str(i),x))) for i,x in enumerate(v.values)]
 if isinstance(v,dict):return {str(k):plain(x) for k,x in v.items()}
 if isinstance(v,(str,int,float,bool)) or v is None:return v
 return None
def summary(wb,source):
 q=wb.get('quotation') or {};order={k:[r.get('id') for r in s.get('rows',[])] for k,s in q.items() if isinstance(s,dict)}
 return {'source':str(source),'jobId':wb.get('jobId'),'savedAt':wb.get('savedAt'),'updatedAt':wb.get('updatedAt'),'templateType':wb.get('templateType'),'sections':len(q),'rows':sum(map(len,order.values())),'orderHash':hashlib.sha256(json.dumps(order,sort_keys=True).encode()).hexdigest(),'stampedRows':sum(1 for s in q.values() for r in s.get('rows',[]) if 'sortOrder' in r),'history':wb.get('quoteHistory',[])[-8:]}
report=[]
for root in [Path(os.environ['USERPROFILE'])/'Downloads',Path(os.environ['USERPROFILE'])/'Documents/GR8 Jobs']:
 for p in root.rglob('*.gr8job'):
  if not p.is_file():continue
  try:
   with zipfile.ZipFile(p) as z:
    if 'estimate.json' not in z.namelist():continue
    estimate=json.loads(z.read('estimate.json'));wb=estimate.get('workbook') or {}
    r=summary(wb,p);r['fileModified']=p.stat().st_mtime;report.append(r)
    if p.name=='New Job 03 09.gr8job' and p.parent.name=='Downloads':
     dest=out/'download-original.gr8job'
     if not dest.exists():shutil.copy2(p,dest)
     (out/'download-workbook.json').write_text(json.dumps(wb),encoding='utf8')
  except Exception as e:report.append({'source':str(p),'error':str(e)})
profile=Path(os.environ['LOCALAPPDATA'])/'Google/Chrome/User Data/Profile 6'
blobroot=profile/'IndexedDB/http_localhost_3000.indexeddb.blob'
blobs=sorted(blobroot.rglob('*'),key=lambda p:p.stat().st_mtime,reverse=True)
selected=[p for p in blobs if p.is_file()][:12]
for p in selected:
 rel=p.relative_to(blobroot);dest=out/'raw-blobs'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():shutil.copy2(p,dest)
 try:
  data=blink.V8ScriptValueDecoder.FromBytes(dest.read_bytes());wb=plain(data.get('workbook') or data.get('payload') or data.get('data') or {}) if isinstance(data,dict) else {}
  if not wb:print('Record shape',str(rel),type(data).__name__,[(str(k),type(v).__name__) for k,v in data.items()] if isinstance(data,dict) else '',flush=True)
  if isinstance(wb,dict) and wb.get('workbook'):wb=wb['workbook']
  r=summary(wb,p);r['recordSavedAt']=data.get('savedAt') if isinstance(data,dict) else None;r['recordKey']=data.get('key') if isinstance(data,dict) else None
  if wb.get('quotation'):
   target=out/('browser-'+str(rel).replace('\\','-').replace('/','-')+'.json');target.write_text(json.dumps(wb),encoding='utf8');r['workbookCopy']=str(target)
  report.append(r)
 except Exception as e:report.append({'source':str(p),'error':str(e)})
for directory in ['IndexedDB/http_localhost_3000.indexeddb.leveldb','Local Storage/leveldb','Session Storage']:
 src=profile/directory;dest=out/'storage-metadata'/directory;dest.mkdir(parents=True,exist_ok=True)
 for p in src.glob('*'):
  if not p.is_file() or p.name=='LOCK':continue
  try:shutil.copy2(p,dest/p.name)
  except Exception as e:report.append({'source':str(p),'copyError':str(e)})
(out/'audit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps([{k:v for k,v in r.items() if k!='history'} for r in report],indent=2))
