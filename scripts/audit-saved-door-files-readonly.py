import json,zipfile,os
from pathlib import Path
out=Path('test-artifacts/manual-entry-door-recovery');report=[]
for filename in ['Johnson 123.gr8job','New Job 03 09.gr8job']:
 p=Path(os.environ['USERPROFILE'])/'Downloads'/filename
 if not p.exists():continue
 with zipfile.ZipFile(p) as archive:
  details=json.loads(archive.read('job-details.json'))
  raw=archive.read('client-selections.json');payload=json.loads(raw)
  (out/(p.stem.replace(' ','-')+'-client-selections.json')).write_bytes(raw)
  books=[]
  for key,book in payload.items():
   if not isinstance(book,dict) or not isinstance(book.get('rooms'),list):continue
   doors=[]
   for room in book['rooms']:
    for row in room.get('rows',[]):
     guided=row.get('guidedSelection') or {}
     if row.get('category')=='Entry Door' or row.get('guidedRequirementKey')=='entry-door' or guided.get('requirementKey')=='entry-door':
      doors.append({'rowId':row.get('id'),'selectedProduct':row.get('selectedProduct'),'model':row.get('productModel'),'productCode':guided.get('productCode'),'entryDoors':guided.get('entryDoors'),'drafts':guided.get('entryDoorDrafts')})
   books.append({'path':'client-selections.json.'+key,'revision':book.get('metadata',{}).get('selectionRevision'),'doors':doors})
  report.append({'file':str(p),'projectId':details.get('projectId'),'books':books,'sourceModified':False,'takeoffOpened':False})
(out/'saved-files-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
