import {useState} from 'react';
export default function VerifiedProductImage({src,name='',style={},className=''}) {
  const [failed,setFailed]=useState('');
  return src&&failed!==src ? <img className={className} src={src} alt={name} loading="lazy" decoding="async" onError={()=>setFailed(src)} style={{objectFit:'contain',...style}}/> : <span className={className} role="img" aria-label={`${name}: Image awaiting verification`} style={{display:'grid',placeItems:'center',minHeight:160,background:'#f1f5f9',color:'#475569',textAlign:'center',...style}}>Image awaiting verification</span>;
}
