const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d');
const speedEl=document.getElementById('speed'),scoreEl=document.getElementById('score');
const startPanel=document.getElementById('startPanel'),gameOver=document.getElementById('gameOver');
const finalScore=document.getElementById('finalScore'),music=document.getElementById('bgMusic');
const musicBtn=document.getElementById('musicBtn');
let W,H,dpr,playing=false,score=0,speed=0,playerX=.5,traffic=[],roadOffset=0,last=0,spawn=0,musicOn=true;
const keys={left:false,right:false,gas:false,brake:false};
function resize(){dpr=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
new ResizeObserver(resize).observe(canvas);resize();

function road(){
 const horizon=H*.16,bottom=H+30;
 ctx.fillStyle='#427448';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#555b60';ctx.beginPath();ctx.moveTo(W*.38,horizon);ctx.lineTo(W*.62,horizon);ctx.lineTo(W*.96,bottom);ctx.lineTo(W*.04,bottom);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#f4f0d6';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(W*.38,horizon);ctx.lineTo(W*.04,bottom);ctx.moveTo(W*.62,horizon);ctx.lineTo(W*.96,bottom);ctx.stroke();
 ctx.strokeStyle='#f6e8a6';ctx.lineWidth=3;
 for(let lane=1;lane<=2;lane++){
   const topX=W*(.38+lane*.08),botX=W*(.04+lane*.306);
   for(let i=0;i<12;i++){let y=((i*70+roadOffset)%H),t=(y-horizon)/(bottom-horizon);if(t<0||t>1)continue;let x=topX+(botX-topX)*t;let len=8+18*t;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+len);ctx.stroke()}
 }
}
// The three lane centers follow the road's perspective, not its painted edge lines.
function roadX(lane,y){
 const t=Math.max(0,Math.min(1,(y-H*.16)/(H*.84)));
 const top=[.42,.50,.58][lane],bottom=[.193,.50,.807][lane];
 return W*(top+(bottom-top)*t);
}
function car(x,y,w,h,color,isPlayer=false){
 ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#111820';ctx.fillRect(-w*.55,-h*.42,w*1.1,h*.84);
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,7);ctx.fill();
 ctx.fillStyle='#b9d9e5';ctx.beginPath();ctx.roundRect(-w*.32,-h*.28,w*.64,h*.27,4);ctx.fill();
 ctx.fillStyle='#26333a';ctx.fillRect(-w*.34,h*.12,w*.68,h*.19);
 ctx.fillStyle='#ffe9a6';ctx.fillRect(-w*.38,-h*.48,w*.2,4);ctx.fillRect(w*.18,-h*.48,w*.2,4);
 if(!isPlayer){ctx.fillStyle='#ff4e42';ctx.fillRect(-w*.38,h*.38,w*.2,4);ctx.fillRect(w*.18,h*.38,w*.2,4)}
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,W,H);road();
 const py=H*.78,pw=Math.max(34,W*.095),ph=pw*1.55;
 traffic.forEach(t=>{
   const x=roadX(t.lane,t.y),scale=.42+.7*Math.max(0,Math.min(1,(t.y-H*.16)/(H*.84)));
   car(x,t.y,pw*scale,ph*scale,t.color);
 });
 car(W*playerX,py,pw,ph,'#ff9f24',true);
}
function startMusic(){
 if(!musicOn)return;
 music.volume=.35;
 const p=music.play();if(p&&p.catch)p.catch(()=>{musicBtn.textContent='♫ TAP';});
}
function reset(){
 score=0;speed=0;playerX=.5;traffic=[];roadOffset=0;spawn=0;playing=true;last=performance.now();
 startPanel.classList.add('hidden');gameOver.classList.add('hidden');startMusic();requestAnimationFrame(loop);
}
function loop(now){
 if(!playing)return;
 const dt=Math.min((now-last)/16.67,2);last=now;
 if(keys.gas)speed=Math.min(120,speed+0.95*dt);
 else speed=Math.max(0,speed-0.12*dt);
 if(keys.brake)speed=Math.max(0,speed-1.5*dt);
 if(keys.left)playerX-=.009*dt*(.55+speed/65);
 if(keys.right)playerX+=.009*dt*(.55+speed/65);
 playerX=Math.max(.14,Math.min(.86,playerX));
 roadOffset=(roadOffset+speed*dt*.12)%70;
 score+=speed/120*dt*.45;
 spawn+=dt;
 if(speed>8&&spawn>Math.max(24,64-speed*.25)){
   spawn=0;const lane=Math.floor(Math.random()*3);
   traffic.push({lane,y:H*.17,color:['#e84a4a','#438de0','#f0d34e','#9b70c9'][Math.floor(Math.random()*4)],factor:.72+Math.random()*.48});
 }
 traffic.forEach(t=>t.y+=(speed*t.factor+7)*dt*.075);
 traffic=traffic.filter(t=>t.y<H+100);
 const px=W*playerX,py=H*.78,pw=Math.max(34,W*.095),ph=pw*1.55;
 for(const t of traffic){
   const tx=roadX(t.lane,t.y),scale=.42+.7*Math.max(0,Math.min(1,(t.y-H*.16)/(H*.84)));
   if(Math.abs(tx-px)<(pw*scale+pw)*.37&&Math.abs(t.y-py)<(ph*scale+ph)*.34){end();return}
 }
 speedEl.textContent=Math.round(speed);scoreEl.textContent=Math.floor(score);draw();requestAnimationFrame(loop);
}
function end(){playing=false;finalScore.textContent=Math.floor(score);gameOver.classList.remove('hidden');}
document.getElementById('startBtn').onclick=reset;
document.getElementById('retryBtn').onclick=reset;
function bind(id,key){
 const el=document.getElementById(id);
 el.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;el.setPointerCapture(e.pointerId)});
 ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>el.addEventListener(ev,()=>keys[key]=false));
}
bind('leftBtn','left');bind('rightBtn','right');bind('gasBtn','gas');bind('brakeBtn','brake');
addEventListener('keydown',e=>{
 if(e.key==='ArrowLeft'||e.key==='a')keys.left=true;
 if(e.key==='ArrowRight'||e.key==='d')keys.right=true;
 if(e.key==='ArrowUp'||e.key==='w')keys.gas=true;
 if(e.key==='ArrowDown'||e.key==='s'||e.key===' ')keys.brake=true;
});
addEventListener('keyup',e=>{
 if(e.key==='ArrowLeft'||e.key==='a')keys.left=false;
 if(e.key==='ArrowRight'||e.key==='d')keys.right=false;
 if(e.key==='ArrowUp'||e.key==='w')keys.gas=false;
 if(e.key==='ArrowDown'||e.key==='s'||e.key===' ')keys.brake=false;
});
musicBtn.onclick=()=>{
 musicOn=!musicOn;
 if(musicOn){musicBtn.textContent='♫ ON';if(playing)startMusic();}
 else{music.pause();musicBtn.textContent='♫ OFF';}
};
draw();
