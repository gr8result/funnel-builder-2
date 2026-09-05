import sys,types,os,json
from pathlib import Path
sys.path.insert(0,'test-artifacts/manual-entry-door-recovery/python-deps')
ns={};source=Path('scripts/audit-local-door-selections-readonly.py').read_text(encoding='utf-8-sig');exec(source[:source.index('latest={}')],ns)
sys.modules['snappy']=types.SimpleNamespace(decompress=ns['snappy'])
import compression.zstd
sys.modules['zstd']=types.SimpleNamespace(decompress=compression.zstd.decompress)
from dfindexeddb.indexeddb.chromium import blink,v8
# V8 format 16 changes ArrayBuffer lengths only. This offline audit accepts
# ordinary objects/strings but rejects buffers rather than misreading them.
# https://github.com/v8/v8/blob/main/src/objects/value-serializer.cc
v8.ValueDeserializer.LATEST_VERSION=16
def unsupported_buffer(*args,**kwargs):
 raise ValueError('Buffer encountered: stop the read-only selection audit')
v8.ValueDeserializer._ReadJSArrayBuffer=unsupported_buffer
v8.ValueDeserializer._ReadJSArrayBufferView=unsupported_buffer
from dfindexeddb.indexeddb import types as js
path=Path(os.environ['LOCALAPPDATA'])/'Google/Chrome/User Data/Profile 6/IndexedDB/http_localhost_3000.indexeddb.blob/1/00/83'
with path.open('rb') as f:data=blink.V8ScriptValueDecoder.FromBytes(f.read())
workbook=data.get('workbook',{})
def plain(v):
 if isinstance(v,js.JSArray):return [plain(x) for x in v.values]
 if isinstance(v,dict):return {str(k):plain(x) for k,x in v.items()}
 if isinstance(v,(str,int,float,bool)) or v is None:return v
 return None
out=Path('test-artifacts/manual-entry-door-recovery');report={'source':str(path),'storageKey':'job:03-09/123','savedAt':data.get('savedAt'),'books':[]}
for name in ['selectionsBook','clientSelectionsBook','builderSelectionsBook','selectionSchedule','selectionSchedules']:
 b=workbook.get(name)
 if not isinstance(b,dict):continue
 b=plain(b);dest=out/('indexeddb-current-'+name+'.json');dest.write_text(json.dumps(b,indent=2),encoding='utf-8')
 rows=[r for room in b.get('rooms',[]) for r in room.get('rows',[]) if r.get('guidedRequirementKey')=='entry-door' or (r.get('guidedSelection') or {}).get('requirementKey')=='entry-door' or r.get('category')=='Entry Door']
 report['books'].append({'name':name,'copy':str(dest),'doors':[{'id':r.get('id'),'selectedProduct':r.get('selectedProduct'),'productModel':r.get('productModel'),'guidedSelection':r.get('guidedSelection')} for r in rows]})
(out/'indexeddb-current-selection-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
