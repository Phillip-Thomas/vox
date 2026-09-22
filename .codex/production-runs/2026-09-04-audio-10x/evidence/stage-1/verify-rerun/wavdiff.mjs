import fs from 'node:fs';
function readWav(p){const b=fs.readFileSync(p);let off=12,fmt=null,data=null;
 while(off+8<=b.length){const id=b.toString('ascii',off,off+4);const sz=b.readUInt32LE(off+4);
  if(id==='fmt ')fmt={ch:b.readUInt16LE(off+10),sr:b.readUInt32LE(off+12),bits:b.readUInt16LE(off+22)};
  if(id==='data')data=b.subarray(off+8,off+8+sz);off+=8+sz+(sz%2);}
 return {fmt,data};}
const [a,b]=process.argv.slice(2);
const A=readWav(a),B=readWav(b);
if(A.data.length!==B.data.length){console.log(`${a} LEN MISMATCH ${A.data.length} vs ${B.data.length}`);process.exit(0);}
let max=0,n=0,first=null;const N=A.data.length/2;
for(let i=0;i<N;i++){const d=Math.abs(A.data.readInt16LE(i*2)-B.data.readInt16LE(i*2));if(d){n++;if(d>max)max=d;if(first===null)first=i/A.fmt.ch/A.fmt.sr;}}
console.log(`${a.split('/').slice(-2).join('/')} bits=${A.fmt.bits} ch=${A.fmt.ch} sr=${A.fmt.sr} samples=${N} diff=${n} maxLSB=${max} firstAtS=${first===null?'-':first.toFixed(3)} dbfs=${max?(20*Math.log10(max/32768)).toFixed(2):'-inf'}`);
