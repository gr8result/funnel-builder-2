import sys,json,types,hashlib
from pathlib import Path
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


from dfindexeddb.leveldb.record import LevelDBRecord
out=Path('recovery/client-selection-integrity-2026-10-09/audit');latest={};errors=[]
for file in (out.parent/'browser/Profile 6/Local Storage/leveldb').glob('*'):
 if file.suffix not in ['.ldb','.log']:continue
 try:
  for r in LevelDBRecord.FromFile(file):
   x=r.record;k=x.key
   if b'localhost:3000' not in k or not any(t in k.lower() for t in [b'selection',b'cabinetry',b'catalogue',b'enablement',b'job-storage',b'alias',b'builder-product',b'builder-custom-products']):continue
   if k not in latest or latest[k].sequence_number<x.sequence_number:latest[k]=x
 except Exception as e:errors.append(str(e))
report=[]
for k,x in latest.items():
 try:
  raw=x.value;value=raw[1:].decode('utf-16-le' if raw[0]==0 else 'latin1') if raw else ''
  try:value=json.loads(value)
  except:pass
  report.append({'key':k.decode('latin1'),'sequence':x.sequence_number,'value':value})
 except Exception as e:errors.append(str(e))
(out/'local-records.json').write_text(json.dumps(report),encoding='utf-8')
print(json.dumps({'errors':errors,'records':[{'key':r['key'],'sequence':r['sequence'],'valueKeys':list(r['value']) if isinstance(r['value'],dict) else str(type(r['value']))} for r in report]},indent=2))
