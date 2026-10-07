import pymupdf,pathlib
d=pymupdf.open('test-artifacts/lockwood-locksets.pdf')
root=pathlib.Path('data/product-library/source-evidence/lockwood-internal')
for p in d:
 if 'Symmetry' not in p.get_text():continue
 print(p.number+1,p.get_text()[:100])
 (root/f'symmetry-page-{p.number+1}.txt').write_text(p.get_text(),encoding='utf-8')
 for im in p.get_images():
  info=d.extract_image(im[0])
  if info['width']>200 and info['height']>200:
   filename=f'symmetry-{p.number+1}-{im[0]}.{info["ext"]}'
   (root/filename).write_bytes(info['image']);print(filename,info['width'],info['height'])
