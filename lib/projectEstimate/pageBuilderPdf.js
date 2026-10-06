import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export async function exportPageBuilderPdf(document) {
  const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  for(const sheet of document.pages) {
    let page=pdf.addPage([595.28,841.89]), y=790;
    const space=height=>{if(y-height<45){page=pdf.addPage([595.28,841.89]);y=790;}};
    const text=(value,size=12,strong=false)=>{
      const font=strong?bold:regular;
      for(const paragraph of String(value||'').split('\n')) {
        let line='';for(const word of paragraph.split(' ')){
          const candidate=line?line+' '+word:word;
          if(font.widthOfTextAtSize(candidate,size)>485 && line){space(size+6);page.drawText(line,{x:50,y,size,font});y-=size+6;line=word;}else line=candidate;
        }
        space(size+6);page.drawText(line,{x:50,y,size,font});y-=size+6;
      }
    };
    for(const block of sheet.blocks) {
      if(block.type==='image' && block.src){const image=block.src.startsWith('data:image/png')?await pdf.embedPng(block.src):await pdf.embedJpg(block.src);const scale=Math.min(485/image.width,260/image.height);const height=image.height*scale;space(height);page.drawImage(image,{x:50,y:y-height,width:image.width*scale,height});y-=height+12;}
      else if(block.type==='shape'){space(65);page.drawRectangle({x:50,y:y-50,width:240,height:50,color:rgb(.87,.92,.97),borderColor:rgb(.2,.35,.5),borderWidth:1});y-=65;}
      else if(block.type==='table'){
        for(const row of block.rows){space(28);const width=485/row.length;row.forEach((cell,i)=>{page.drawRectangle({x:50+i*width,y:y-24,width,height:24,borderColor:rgb(.6,.6,.6),borderWidth:.5});page.drawText(String(cell).slice(0,35),{x:54+i*width,y:y-16,font:regular,size:10});});y-=24;}y-=12;
      } else {if(block.type==='block')text(block.heading,16,true);text(block.text,block.fontSize||12,block.bold);y-=10;}
    }
  }
  return pdf.save();
}
