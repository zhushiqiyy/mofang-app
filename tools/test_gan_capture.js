/* 用老板的真机封包字节，离线复算 GAN Gen2 解析，定位"乱转/电量误判"根因。
   字节来自 iPad 上「实时封包」面板的两张截图：
     A) 手腕整转（应只出 GYRO / type 0x1，不应有任何 MOVE）
     B) 拧一个面（应出 1 个 MOVE U'）
*/
function ganBits(msg){let b='';for(let i=0;i<msg.length;i++)b+=(msg[i]+0x100).toString(2).slice(1);return b;}
function bw(bits,s,len){if(len<=8)return parseInt(bits.substr(s,len),2);const n=len/8;const u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=parseInt(bits.substr(8*i+s,8),2);const dv=new DataView(u.buffer);return len===16?dv.getUint16(0,true):dv.getUint32(0,true);}

/* 当前线上逻辑（复刻 60-gan.js） */
function parseOld(bits,st,out){
  const et=bw(bits,0,4);
  if(et===0x02){
    if(st.lastSerial!==-1){
      const serial=bw(bits,4,8);
      const diff=Math.min((serial-st.lastSerial)&0xFF,7);
      st.lastSerial=serial;
      for(let i=diff-1;i>=0;i--){
        const face=bw(bits,12+5*i,4);
        const dir=bw(bits,16+5*i,1);
        out.push({type:'MOVE',face,dir});
      }
    }
  } else if(et===0x04){ st.lastSerial=bw(bits,4,8); }
  else if(et===0x09){ out.push({type:'BATTERY',level:Math.min(bw(bits,8,8),100)}); }
  else if(et===0x0D){ out.push({type:'DISCONNECT'}); }
  return et;
}

/* 候选新逻辑（与 60-gan.js 最终实现一致）：
   MOVE 首包建基线(首步即生效)、每包最多 2 步并逐项校验；
   0x4 读电量(dec[13])且不碰 lastSerial，避免序号错位导致乱转。 */
function parseNew(bits,st,out){
  const et=bw(bits,0,4);
  if(et===0x02){
    const serial=bw(bits,4,8);
    if(st.lastSerial===-1) st.lastSerial=(serial-1)&0xFF;
    const diff=(serial-st.lastSerial)&0xFF;
    st.lastSerial=serial;
    if(diff>=1&&diff<=2){
      for(let i=diff-1;i>=0;i--){
        const face=bw(bits,12+5*i,4);
        const dir=bw(bits,16+5*i,1);
        if(face>5||dir>2) continue;
        out.push({type:'MOVE',face,dir});
      }
    }
  } else if(et===0x04){
    const lvl=parseInt(bits.substr(13*8,8),2);
    if(lvl>=0&&lvl<=100) out.push({type:'BATTERY',level:lvl,from:'0x4[13]'});
  } else if(et===0x09){ out.push({type:'BATTERY',level:Math.min(bw(bits,8,8),100),from:'0x9'}); }
  else if(et===0x0D){ out.push({type:'DISCONNECT'}); }
  return et;
}

const H=s=>s.split(' ').map(x=>parseInt(x,16));
const P={
  rot:[
    '1d 8b 5d 2a 91 d3 11 cc 88 80 d8 b1 d2 ad 1d 34 1c c5 88 8a',
    '1d 8a dd 2b 11 d3 81 cc 18 80 d8 a9 d2 b5 1d 3c 1c be 88 8a',
    '1d 8a 6d 2b 91 d4 01 cb a8 88 d8 a2 d2 bd 1d 43 1c b7 00 0a',
    '1d 89 ed 2c 11 d4 71 cb 48 80 d8 9a d2 c5 1d 4b 1c b0 00 8a',
    '1d 89 6d 2c 91 d4 f1 ca c0 00 d8 96 d2 c9 1d 4f 1c ac 00 0a'
  ],
  turn:[
    '1b 9b 9b 0a 14 b0 14 71 80 08 b9 79 b0 cb 4b 10 47 2c 08 8a', // 0x1
    '1b 95 2b 0d 34 b1 f4 73 30 88 b9 4e b0 cd 4b 3e 47 19 08 0a', // 0x1
    '4b 46 0a 97 00 00 60 24 8a cf 13 40 00 64 00 00 00 00 00 00', // 0x4
    '1b 94 eb 0c d4 b3 e4 71 90 80 b3 64 b6 2c 4a 88 48 77 08 8a', // 0x1
    '1b 2b 5b 6a b4 a6 24 8b a0 88 b1 eb b7 50 4a 2d 49 00 08 8a', // 0x1
    '2b 50 80 e6 39 8e 04 3e 05 c0 0a ba 03 92 04 f6 03 a0 04 84'  // 0x2 MOVE U'
  ]
};

function run(label,packets,fn){
  const st={lastSerial:-1};const log=[];
  for(const p of packets){
    const out=[];const et=fn(ganBits(H(p)),st,out);
    log.push('type=0x'+et.toString(16)+' -> '+JSON.stringify(out));
  }
  console.log('=== '+label+' ===');
  log.forEach(l=>console.log('  '+l));
}
console.log('>>> 整转（应 0 个 MOVE，否则就是乱转根因）');
run('当前线上逻辑', P.rot, parseOld);
run('候选新逻辑', P.rot, parseNew);
console.log('>>> 拧一个面（应只出 1 个 MOVE U\'，电量来自 0x4）');
run('当前线上逻辑', P.turn, parseOld);
run('候选新逻辑', P.turn, parseNew);

/* 盒子里乱转场景：周期性 0x4 状态包（序号与 MOVE 计数列错位）+ 偶尔 1 个真实 0x2。
   旧逻辑会把 0x4 的序号写进 lastSerial，导致下一包 0x2 的 diff 爆炸 → 7 步垃圾动作。
   新逻辑 0x4 不碰序号，0x2 自己建基线 → 只出 1 步真实动作。 */
const box=[
  '4b 46 0a 97 00 00 60 24 8a cf 13 40 00 64 00 00 00 00 00 00', // 0x4 状态包 A，序号≈180
  '4b 00 0a 97 00 00 60 24 8a cf 13 40 00 64 00 00 00 00 00 00', // 0x4 状态包 B，序号≈176（列错位）
  '21 00 80 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00'  // 0x2 真实一步 U'，序号=1
];
console.log('>>> 盒子里（旧逻辑应爆出多步垃圾=乱转；新逻辑只出 1 步真实动作）');
run('当前线上逻辑', box, parseOld);
run('候选新逻辑', box, parseNew);
