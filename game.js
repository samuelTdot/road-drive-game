const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const speedEl = document.getElementById('speed');
const scoreEl = document.getElementById('score');
const startPanel = document.getElementById('startPanel');
const gameOver = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const music = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');

let W = 0, H = 0, dpr = 1;
let playing = false, score = 0, speed = 0, playerX = 0.5;
let traffic = [], roadOffset = 0, last = 0, spawnTimer = 0, musicOn = true;
const MAX_SPEED = 140, FAR_DISTANCE = 190;
const keys = { left: false, right: false, gas: false, brake: false };

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
new ResizeObserver(resize).observe(canvas);
resize();

function road() {
  const horizon = H * 0.16, bottom = H + 30;
  ctx.fillStyle = '#427448'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#555b60';
  ctx.beginPath();
  ctx.moveTo(W*.38,horizon); ctx.lineTo(W*.62,horizon);
  ctx.lineTo(W*.96,bottom); ctx.lineTo(W*.04,bottom);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f4f0d6'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W*.38,horizon); ctx.lineTo(W*.04,bottom);
  ctx.moveTo(W*.62,horizon); ctx.lineTo(W*.96,bottom); ctx.stroke();
  ctx.strokeStyle = '#f6e8a6'; ctx.lineWidth = 3;
  for (let lane=1; lane<=2; lane++) {
    const topX=W*(.38+lane*.08), botX=W*(.04+lane*.306);
    for (let i=0;i<12;i++) {
      const y=(i*70+roadOffset)%H, t=(y-horizon)/(bottom-horizon);
      if(t<0||t>1) continue;
      const x=topX+(botX-topX)*t, len=8+18*t;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+len); ctx.stroke();
    }
  }
}

function roadX(lane,y) {
  const t=Math.max(0,Math.min(1,(y-H*.16)/(H*.84)));
  const top=[.42,.50,.58][lane], bottom=[.193,.50,.807][lane];
  return W*(top+(bottom-top)*t);
}
function projectDistance(distance) {
  const d=Math.max(0,Math.min(FAR_DISTANCE,distance));
  return H*.16+H*.84*(1-d/FAR_DISTANCE);
}

function car(x,y,w,h,color,isPlayer=false) {
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='#111820'; ctx.fillRect(-w*.55,-h*.42,w*1.1,h*.84);
  ctx.fillStyle=color; ctx.beginPath();
  ctx.roundRect(-w/2,-h/2,w,h,Math.max(3,w*.12)); ctx.fill();
  ctx.fillStyle='#b9d9e5'; ctx.beginPath();
  ctx.roundRect(-w*.32,-h*.28,w*.64,h*.27,4); ctx.fill();
  ctx.fillStyle='#26333a'; ctx.fillRect(-w*.34,h*.12,w*.68,h*.19);
  ctx.fillStyle='#ffe9a6';
  ctx.fillRect(-w*.38,-h*.48,w*.2,Math.max(2,h*.035));
  ctx.fillRect(w*.18,-h*.48,w*.2,Math.max(2,h*.035));
  if(!isPlayer) {
    ctx.fillStyle='#ff4e42';
    ctx.fillRect(-w*.38,h*.38,w*.2,Math.max(2,h*.035));
    ctx.fillRect(w*.18,h*.38,w*.2,Math.max(2,h*.035));
  }
  ctx.restore();
}

function trafficX(v,y) {
  const lane=Math.max(0,Math.min(2,v.lanePosition));
  return roadX(1,y)+(roadX(2,y)-roadX(1,y))*(lane-1);
}

function draw() {
  if(!W||!H) return;
  ctx.clearRect(0,0,W,H); road();
  const pw=Math.max(34,W*.095), ph=pw*1.55;
  traffic.filter(v=>v.distance>0&&v.distance<FAR_DISTANCE)
    .sort((a,b)=>b.distance-a.distance).forEach(v=>{
      const y=projectDistance(v.distance), depth=1-v.distance/FAR_DISTANCE;
      const scale=.38+.78*depth;
      car(trafficX(v,y),y,pw*scale*v.size,ph*scale*v.size,v.color);
    });
  car(W*playerX,H*.78,pw,ph,'#ff9f24',true);
}

function startMusic() {
  if(!musicOn||!music) return;
  music.volume=.35;
  const p=music.play();
  if(p&&p.catch) p.catch(()=>{musicBtn.textContent='♫ TAP';});
}
function reset() {
  score=0; speed=0; playerX=.5; traffic=[]; roadOffset=0; spawnTimer=0;
  playing=true; last=performance.now();
  startPanel.classList.add('hidden'); gameOver.classList.add('hidden');
  speedEl.textContent='0'; scoreEl.textContent='0'; draw();
  startMusic(); requestAnimationFrame(loop);
}

function laneIsClear(lane,distance,self) {
  return !traffic.some(v=>v!==self&&v.distance>0&&
    Math.abs(v.lanePosition-lane)<.42&&Math.abs(v.distance-distance)<24);
}
function spawnTraffic() {
  const lanes=[0,1,2].sort(()=>Math.random()-.5);
  let lane=lanes.find(l=>traffic.every(v=>
    Math.abs(v.lanePosition-l)>.4||Math.abs(v.distance-FAR_DISTANCE)>28));
  if(lane===undefined) lane=lanes[0];
  const colors=['#e84a4a','#438de0','#f0d34e','#9b70c9','#e7e7e7'];
  const cruise=48+Math.random()*62;
  traffic.push({
    lanePosition:lane,targetLane:lane,distance:145+Math.random()*38,
    speed:cruise,desiredSpeed:cruise,acceleration:5+Math.random()*5,
    color:colors[Math.floor(Math.random()*colors.length)],
    size:.88+Math.random()*.18,changeCooldown:2+Math.random()*4
  });
}

function updateTraffic(dt) {
  for(const v of traffic) {
    v.changeCooldown-=dt;
    let leader=null;
    for(const other of traffic) {
      if(other===v||other.distance<=v.distance) continue;
      if(Math.abs(other.lanePosition-v.lanePosition)>.38) continue;
      if(!leader||other.distance<leader.distance) leader=other;
    }
    v.desiredSpeed=Math.min(112,Math.max(42,v.desiredSpeed));
    if(leader) {
      const gap=leader.distance-v.distance, safeGap=13+v.speed*.12;
      if(gap<safeGap+12) {
        v.desiredSpeed=Math.min(v.desiredSpeed,
          Math.max(25,leader.speed-Math.max(0,safeGap-gap)*2.2));
        if(gap<safeGap+5&&v.changeCooldown<=0) {
          const choices=[v.targetLane-1,v.targetLane+1]
            .filter(l=>l>=0&&l<=2&&laneIsClear(l,v.distance,v));
          if(choices.length) {
            v.targetLane=choices[Math.floor(Math.random()*choices.length)];
            v.changeCooldown=4+Math.random()*4;
          }
        }
      }
    }
    const diff=v.desiredSpeed-v.speed;
    const rate=diff>=0?v.acceleration:v.acceleration*1.8;
    v.speed+=Math.sign(diff)*Math.min(Math.abs(diff),rate*dt);
    const laneStep=.48*dt;
    if(Math.abs(v.targetLane-v.lanePosition)<=laneStep) v.lanePosition=v.targetLane;
    else v.lanePosition+=Math.sign(v.targetLane-v.lanePosition)*laneStep;
    v.distance-=((speed-v.speed)/3.6)*dt;
  }
  traffic=traffic.filter(v=>v.distance>-8&&v.distance<FAR_DISTANCE+35);
}

function loop(now) {
  if(!playing) return;
  const dt=Math.min((now-last)/1000,.05); last=now;
  if(keys.gas) speed=Math.min(MAX_SPEED,speed+34*dt);
  else speed=Math.max(0,speed-4.5*dt);
  if(keys.brake) speed=Math.max(0,speed-72*dt);
  const steering=.62+speed/95;
  if(keys.left) playerX-=.52*dt*steering;
  if(keys.right) playerX+=.52*dt*steering;
  playerX=Math.max(.14,Math.min(.86,playerX));
  roadOffset=(roadOffset+speed*dt*.55)%70;
  score+=(speed/MAX_SPEED)*dt*10;

  updateTraffic(dt);
  spawnTimer+=dt;
  if(speed>12&&spawnTimer>=Math.max(1.25,3.2-speed/85)) {
    spawnTimer=0; spawnTraffic();
  }

  const py=H*.78, pw=Math.max(34,W*.095), ph=pw*1.55;
  for(const v of traffic) {
    if(v.distance<0||v.distance>16) continue;
    const y=projectDistance(v.distance), x=trafficX(v,y);
    const depth=1-v.distance/FAR_DISTANCE;
    const otherW=pw*(.38+.78*depth)*v.size;
    if(Math.abs(x-W*playerX)<(otherW+pw)*.34&&Math.abs(y-py)<ph*.72) {
      end(); return;
    }
  }
  speedEl.textContent=Math.round(speed);
  scoreEl.textContent=Math.floor(score);
  draw(); requestAnimationFrame(loop);
}

function end() {
  playing=false; finalScore.textContent=Math.floor(score);
  gameOver.classList.remove('hidden');
}
document.getElementById('startBtn').onclick=reset;
document.getElementById('retryBtn').onclick=reset;

function bind(id,key) {
  const el=document.getElementById(id);
  el.addEventListener('pointerdown',e=>{
    e.preventDefault(); keys[key]=true; el.setPointerCapture(e.pointerId);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>
    el.addEventListener(ev,()=>keys[key]=false));
}
bind('leftBtn','left'); bind('rightBtn','right');
bind('gasBtn','gas'); bind('brakeBtn','brake');

addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='a') keys.left=true;
  if(e.key==='ArrowRight'||e.key==='d') keys.right=true;
  if(e.key==='ArrowUp'||e.key==='w') keys.gas=true;
  if(e.key==='ArrowDown'||e.key==='s'||e.key===' ') keys.brake=true;
});
addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a') keys.left=false;
  if(e.key==='ArrowRight'||e.key==='d') keys.right=false;
  if(e.key==='ArrowUp'||e.key==='w') keys.gas=false;
  if(e.key==='ArrowDown'||e.key==='s'||e.key===' ') keys.brake=false;
});

musicBtn.onclick=()=>{
  musicOn=!musicOn;
  if(musicOn) {
    musicBtn.textContent='♫ ON';
    if(playing) startMusic();
  } else {
    music.pause(); musicBtn.textContent='♫ OFF';
  }
};
draw();
