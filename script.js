
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('gameWrap');
const scoreEl = document.getElementById('score');
const hiEl = document.getElementById('hi');
const overlay = document.getElementById('overlay');
const msgText = document.getElementById('msgText');
const restartBtn = document.getElementById('restartBtn');
// Size canvas for devicePixelRatio
function resize() {
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.round(rect.width * devicePixelRatio);
  canvas.height = Math.round(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resize();
window.addEventListener('resize', resize);

// Game variables
let running = false;
let gameSpeed = 6;
let gravity = 0.5;
let score = 0;
let hiScore = parseInt(localStorage.getItem('dino_hi') || '0', 10);
hiEl.textContent = 'High: ' + hiScore;
const bgColors = [
  '#F0B7B3', '#B2E6D4', '#83E8BA', '#EDE5A6', '#F7D6E0', '#F2B5D4', '#B2F7EF',
  '#7BDFF2', '#C9CBA3', '#8DE4FF', '#DAD6D6', '#92BFB1', '#A9E190', '#DBF4AD',
  '#CDC776', '#F4F0BB', '#F8CF8B', '#F5CAC3', '#D2FF96', '#B7F0AD', '#DD99BB', '#BCEDF6'
];
// Make sure the last color repeats the first to loop smoothly
bgColors.push(bgColors[0]);

function lerpColor(a, b, t){
  // linear interpolation between two hex colors a and b by t (0 to 1)
  const ah = parseInt(a.replace(/#/g, ''), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;

  const bh = parseInt(b.replace(/#/g, ''), 16);
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;

  const rr = ar + (br - ar) * t;
  const rg = ag + (bg - ag) * t;
  const rb = ab + (bb - ab) * t;

  return `rgb(${Math.round(rr)}, ${Math.round(rg)}, ${Math.round(rb)})`;
}


// Dino
const dino = {
  x: 50,
  y: null,
  width: 44,
  height: 44,
  vy: 0,
  jumping: false,
  ducking: false,
  runFrame: 0
};
const groundY = 140;
let obstacles = [];
let spawnTimer = 0;
let spawnInterval = 90;

function relY(val){const design=200;return(val/design)*canvas.height/devicePixelRatio;}
function relX(val){const design=800;return(val/design)*canvas.width/devicePixelRatio;}

function init() {
  dino.y = relY(groundY) - dino.height;
  dino.vy = 0;
  obstacles = [];
  score = 0;
  gameSpeed = 6;
  running = true;
  spawnTimer = 0;
  overlay.style.display = 'none';
  loop();
}

// Colors to cycle through gently
let bgIndex = 0;
let bgTransitionProgress = 0;

// Draw helpers
function drawRect(x,y,w,h,fill=true){ctx.beginPath();ctx.rect(x,y,w,h);if(fill)ctx.fill();ctx.closePath();}
function drawDino() {
  ctx.save();
  ctx.translate(dino.x, dino.y);
  // body
  ctx.fillStyle = '#222';
  const h = dino.ducking ? dino.height*0.6 : dino.height;
  drawRect(0, dino.height - h, dino.width, h);
  // eye
  ctx.fillStyle = '#fff';
  drawRect(dino.width - 12, dino.height - h + 8, 6, 6);
  ctx.restore();
}

function updateBackgroundColor() {
  bgTransitionProgress += 0.005; // slower transition speed, adjust if needed
  if (bgTransitionProgress >= 1) {
    bgTransitionProgress = 0;
    bgIndex = (bgIndex + 1) % bgColors.length;
  }
  const nextIndex = (bgIndex + 1) % bgColors.length;
  const currentColor = bgColors[bgIndex];
  const nextColor = bgColors[nextIndex];
  const color = lerpColor(currentColor, nextColor, bgTransitionProgress);
  wrap.style.background = `linear-gradient(120deg, ${color} 0%, ${color} 70%, ${color} 100%)`;
}



function drawGround() {
  ctx.fillStyle = '#5a5a5a';
  const groundH = 6;
  ctx.fillRect(0, relY(groundY), canvas.width/devicePixelRatio, groundH);
}
function drawObstacle(obs) {
  ctx.fillStyle = '#333';
  drawRect(obs.x, obs.y, obs.w, obs.h);
}
let lastTime = 0;
function loop(ts=0){
  if(!running)return;
  update();
  updateBackgroundColor();
  render();
  window.requestAnimationFrame(loop);
}
function update(){
  // Dino physics
  if(dino.jumping){
    dino.vy += gravity;
    dino.y += dino.vy;
    if(dino.y >= relY(groundY) - dino.height){
      dino.y = relY(groundY) - dino.height;
      dino.vy = 0;
      dino.jumping = false;
    }
  }
  // spawn obstacles
  spawnTimer++;
  if(spawnTimer > spawnInterval){
    spawnTimer = 0;
    spawnInterval = Math.max(50, 90 - Math.floor(score/100));
    let h = relY(24 + Math.random()*36);
    let w = relX(12 + Math.random()*24);
    obstacles.push({
      x: canvas.width/devicePixelRatio + 10,
      y: relY(groundY) - h,
      w: w,
      h: h
    });
  }
  // move obstacles
  for(let i = obstacles.length-1; i>=0; i--){
    const o = obstacles[i];
    o.x -= gameSpeed;
    if(rectIntersect(dino.x, dino.y, dino.width, dino.ducking ? dino.height*0.6 : dino.height, o.x, o.y, o.w, o.h)){
      gameOver();
      return;
    }
    if(o.x + o.w < -50) obstacles.splice(i,1);
  }
  // score
  score++;
  if(score % 10 === 0){
    scoreEl.textContent = 'Score: ' + score;
  }
  // speed up gradually
  if(score % 200 === 0) gameSpeed += 0.5;
  // tiny run frame animation
  dino.runFrame = (dino.runFrame + 1) % 60;
}
function render(){
  ctx.clearRect(0,0,canvas.width/devicePixelRatio,canvas.height/devicePixelRatio);
  drawClouds();
  drawGround();
  drawDino();
  obstacles.forEach(drawObstacle);
}
function drawClouds(){
  ctx.fillStyle = '#fff';
  const t = performance.now()/1000;
  const cx1 = Math.sin(t*0.3) * 40;
  ctx.beginPath();
  ctx.ellipse(canvas.width/devicePixelRatio-150+cx1,relY(40),34,18,0,0,Math.PI*2);
  ctx.ellipse(canvas.width/devicePixelRatio-120+cx1,relY(40),22,12,0,0,Math.PI*2);
  ctx.fill();
  ctx.closePath();
}
function rectIntersect(x1,y1,w1,h1,x2,y2,w2,h2){
  return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1);
}
function jump(){
  if(!running)return;
  if(!dino.jumping){
    dino.vy = -12;
    dino.jumping = true;
  }
}
function duck(on){
  dino.ducking = on;
  if(on){
    dino.height = 44;
  }else{
    dino.height = 44;
  }
}
window.addEventListener('keydown',(e)=>{
  if(e.code==='Space'||e.code==='ArrowUp'){
    e.preventDefault();
    jump();
  }else if(e.code==='ArrowDown'){
    e.preventDefault();
    duck(true);
  }else if(e.code==='KeyR'&&!running){
    restart();
  }
});
window.addEventListener('keyup',(e)=>{
  if(e.code==='ArrowDown')duck(false);
});

// touch (tap to jump)
let touchStartY = null;
canvas.addEventListener('touchstart',(e)=>{
  touchStartY = e.touches[0].clientY;
  jump();
});
canvas.addEventListener('touchmove',(e)=>{
  const y = e.touches[0].clientY;
  if(touchStartY && y-touchStartY>20) duck(true);
});
canvas.addEventListener('touchend',(e)=>{
  duck(false);
  touchStartY = null;
});

// Game over & restart
function gameOver(){
  running = false;
  overlay.style.display = '';
  msgText.textContent = 'Game Over — Score: ' + score;
  if(score > hiScore){
    hiScore = score;
    localStorage.setItem('dino_hi',hiScore);
    hiEl.textContent = 'High: ' + hiScore;
    msgText.textContent += ' (New High!)';
  }
}
function restart(){
  init();
}
restartBtn.addEventListener('click',restart);
restartBtn.addEventListener('touchstart',restart);

// start automatically on first click or keypress
let started = false;
function startOnce(){
  if(started) return;
  started = true;
  init();
  window.removeEventListener('click',startOnce);
  window.removeEventListener('keydown',startOnce);
}
window.addEventListener('click',startOnce);
window.addEventListener('keydown',startOnce);

// update score every 500ms to reduce DOM churn
setInterval(()=>{
  scoreEl.textContent = 'Score: ' + score;
},500);

overlay.style.display = '';
msgText.textContent = 'Click anywhere or press any key to start';
hiEl.textContent = 'High: ' + hiScore;
