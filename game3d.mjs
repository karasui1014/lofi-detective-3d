import { Investigation,ANOMALIES } from './engine.mjs';
import { MidnightAudio } from './audio.mjs';
import { characterConfig } from './character-config.mjs';
import { stickVector } from './movement.mjs';

const $=id=>document.getElementById(id), game=new Investigation(), audio=new MidnightAudio();
// Loaded-script revision, so a phone recording can identify the code in use.
const releaseNote=document.createElement('p');releaseNote.className='quiet-note';releaseNote.textContent='更新版：9月26日・探偵の頭を3Dフィギュアから作り直し（アンダーリム眼鏡）、読み込みを軽量化、足音と控えめなBGM';$('helpDialog').append(releaseNote);
const dialogs=[...document.querySelectorAll('dialog')], keys=new Set(), stick={x:0,y:0,id:null};
let world=null,busy=false,inspection=false,context=null,lookDrag=null,sound=false,statusTimer=null,last=0,clock=0,frameId=null;
// Footsteps follow the distance the detective actually covers (so walls and
// stopping are respected): one step per stride, the first soon after setting off.
let stepFrom=null,stepDistance=0;
function footsteps(active,run){
  const p=world.player.position;
  if(!active||!sound){stepFrom=null;return;}
  const moved=stepFrom?Math.hypot(p.x-stepFrom.x,p.z-stepFrom.z):0,stride=run?.95:.72;stepFrom={x:p.x,z:p.z};
  if(moved>.5)return;                      // a reset or transition, not a step
  if(moved<.0005){stepDistance=stride*.55;return;}
  stepDistance+=moved;
  if(stepDistance>=stride){stepDistance-=stride;audio.footstep(run);}
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function status(text){clearTimeout(statusTimer);$('statusLine').textContent=text;statusTimer=setTimeout(()=>$('statusLine').textContent='',4000);}
function resetInput(){keys.clear();stick.x=0;stick.y=0;stick.id=null;lookDrag=null;$('joystickKnob').style.transform='';$('joystick').classList.remove('active');}
function canMove(){return world&&!busy&&!inspection&&!dialogs.some(d=>d.open)&&['briefing','playing'].includes(game.phase);}
function sync(){
  const phase=world?game.phase:'loading';$('game').dataset.phase=phase;
  $('intro').hidden=!['start','loading'].includes(phase);$('ending').hidden=phase!=='escaped';
  $('controls').hidden=!['briefing','playing'].includes(phase)||inspection||busy;
  $('beginButton').hidden=phase!=='briefing'||inspection||busy;
  $('inspection').hidden=!inspection;$('resultOverlay').hidden=phase!=='result'||inspection;
  $('hud').inert=['loading','start','escaped'].includes(phase)||busy;
  $('scene').tabIndex=['briefing','playing'].includes(phase)?0:-1;
  $('progress').replaceChildren(document.createTextNode(String(game.progress)));const denominator=document.createElement('small');denominator.textContent=' / 6';$('progress').append(denominator);
  $('steps').replaceChildren(...Array.from({length:6},(_,i)=>{const e=document.createElement('span');e.className='step'+(i<game.progress?' done':'');return e;}));
  document.querySelector('.progress').setAttribute('aria-label',`出口まで６回中${game.progress}回正解`);
  $('chapterLabel').textContent=phase==='briefing'?'OBSERVE / いつもの廊下':'MIDNIGHT / 00:00';
  $('objective').textContent=phase==='briefing'?'まずは歩いて、いつもの景色を覚えよう。':'異変があれば戻る。なければ奥の扉へ。';
  $('crosshair').hidden=inspection||!['briefing','playing'].includes(phase);
}
async function soundToggle(force){
  const enabled=typeof force==='boolean'?force:!sound;
  try{await audio.setEnabled(enabled);sound=enabled;}catch{sound=false;audio.enabled=false;status('音楽を再生できませんでした。音楽ボタンで再試行できます。');}
  $('soundButton').setAttribute('aria-pressed',String(sound));$('soundButton').setAttribute('aria-label',sound?'音楽をオフにする':'音楽をオンにする');$('soundState').textContent=sound?'ON':'OFF';
}
function openDialog(dialog){resetInput();dialog.showModal();}
dialogs.forEach(d=>{d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));d.addEventListener('close',resetInput);d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});});
$('soundButton').addEventListener('click',()=>soundToggle());$('helpButton').addEventListener('click',()=>openDialog($('helpDialog')));
function journal(){
  $('journalCount').textContent=`${game.discovered.size} / 12`;
  $('journalGrid').replaceChildren(...ANOMALIES.map((a,i)=>{const known=game.discovered.has(a.id),e=document.createElement('article');e.className='journal-entry'+(known?'':' unknown');const n=document.createElement('span');n.textContent=`NO. ${String(i+1).padStart(2,'0')}`;const h=document.createElement('h3');h.textContent=known?a.title:'未発見';const p=document.createElement('p');p.textContent=known?a.description:'この異変は、まだ記録されていない。';e.append(n,h,p);return e;}));openDialog($('journalDialog'));
}
$('journalButton').addEventListener('click',journal);$('endingJournal').addEventListener('click',journal);
function inspect(target,reveal=false){
  if(!world||busy||inspection||!target)return;
  resetInput();if(!world.focus(target.id))return;inspection=true;$('inspectTitle').textContent=target.name;
  $('inspectDescription').textContent=reveal&&game.current?game.current.description:game.phase==='briefing'?'これが、いつもの姿。位置や形を覚えておこう。':'最初に見た姿を、思い出してみよう。';sync();$('closeInspection').focus({preventScroll:true});
}
$('closeInspection').addEventListener('click',()=>{world.unfocus();inspection=false;resetInput();sync();if(game.phase==='result')$('nextButton').focus({preventScroll:true});else $('scene').focus({preventScroll:true});});
async function transition(action){
  if(busy)return;busy=true;resetInput();sync();$('curtain').classList.add('active');
  await wait(reduced?0:360);action();world.unfocus();inspection=false;world.applyAnomaly(game.current?.id||null);world.reset();context=null;
  await wait(reduced?0:150);busy=false;$('curtain').classList.remove('active');sync();$('scene').focus({preventScroll:true});
}
function answer(choice){
  if(busy||inspection||dialogs.some(d=>d.open))return;
  const result=game.answer(choice);if(!result)return;resetInput();context=null;
  if(result.escaped){
    world.applyAnomaly(null);world.reset();world.yaw=2.5;world.scene.background.set(0xacbdc5);world.scene.fog.color.set(0xacbdc5);world.renderer.toneMappingExposure=1.65;world.rain.visible=false;
    const a=document.createElement('span');a.textContent=`発見した異変 ${game.discovered.size} / 12`;const b=document.createElement('span');b.textContent=`引き戻された回数 ${game.mistakes}`;$('endingStats').replaceChildren(a,b);sync();$('replayButton').focus({preventScroll:true});return;
  }
  $('resultEyebrow').textContent=result.correct?'A STEP CLOSER':'BACK TO MIDNIGHT';
  $('resultTitle').textContent=result.correct?'ひとつ、出口に近づいた。':'また、午前０時だ。';
  $('resultText').textContent=result.correct?`あと${6-result.progress}回。次の廊下も、よく観察しよう。`:result.anomaly?'異変を見逃したようだ。進捗が０に戻ってしまった。':'この廊下に異変はなかった。進捗が０に戻ってしまった。';
  $('resultCount').replaceChildren(document.createTextNode(String(result.progress)));const small=document.createElement('small');small.textContent=' / 6';$('resultCount').append(small);
  $('revealButton').hidden=!result.anomaly;$('nextButton').textContent=result.correct?'次の廊下へ →':'もう一度、廊下へ →';sync();$('nextButton').focus({preventScroll:true});
}
function interact(){
  if(!canMove()||!context)return;
  if(context.kind==='exit'){if(game.phase==='playing')answer(context.choice);}
  else inspect(context.target);
}
$('interactButton').addEventListener('click',interact);
$('startButton').addEventListener('click',()=>{if(!world||!game.briefing())return;world.reset();world.applyAnomaly(null);sync();soundToggle(true);status('左スティックで歩く / 画面をスワイプして見回す');$('scene').focus({preventScroll:true});});
$('beginButton').addEventListener('click',()=>{if(game.phase==='briefing')transition(()=>game.start());});
$('nextButton').addEventListener('click',()=>{if(game.phase==='result')transition(()=>game.next());});
$('revealButton').addEventListener('click',()=>{const t=world.targets.find(t=>t.id===game.current?.target);if(t)inspect(t,true);});
$('replayButton').addEventListener('click',()=>{
  if(!game.briefing())return;world.scene.background.set(0x182a38);world.scene.fog.color.set(0x192937);world.renderer.toneMappingExposure=1.12;world.rain.visible=true;world.applyAnomaly(null);world.reset();sync();$('scene').focus({preventScroll:true});
});

// Separate pointer capture lets a thumb move the player while another turns the camera.
const joystick=$('joystick');
function stickMove(e){if(e.pointerId!==stick.id)return;const r=joystick.getBoundingClientRect(),radius=r.width*.34;let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const len=Math.hypot(x,y);if(len>radius){x*=radius/len;y*=radius/len;}const input=stickVector(x/radius,y/radius);stick.x=input.x;stick.y=input.y;$('joystickKnob').style.transform=`translate(${x}px,${y}px)`;}
joystick.addEventListener('pointerdown',e=>{if(!canMove()||stick.id!==null)return;e.preventDefault();e.stopPropagation();stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);joystick.classList.add('active');stickMove(e);});
joystick.addEventListener('pointermove',e=>{if(stick.id===e.pointerId){e.preventDefault();stickMove(e);}});
function releaseStick(e){if(e.pointerId!==stick.id)return;stick.id=null;stick.x=stick.y=0;$('joystickKnob').style.transform='';joystick.classList.remove('active');if(joystick.hasPointerCapture(e.pointerId))joystick.releasePointerCapture(e.pointerId);}
joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);joystick.addEventListener('lostpointercapture',releaseStick);
const canvas=$('scene');
canvas.addEventListener('pointerdown',e=>{if(!canMove()||lookDrag||e.button!==0)return;lookDrag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!lookDrag||lookDrag.id!==e.pointerId)return;const dx=e.clientX-lookDrag.x,dy=e.clientY-lookDrag.y;if(Math.hypot(e.clientX-lookDrag.startX,e.clientY-lookDrag.startY)>5)lookDrag.moved=true;world.orbit(dx,dy);lookDrag.x=e.clientX;lookDrag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!lookDrag||lookDrag.id!==e.pointerId)return;const clicked=!lookDrag.moved;lookDrag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(clicked&&canMove()){const t=world.pick(e.clientX,e.clientY);if(t)inspect(t);}});
canvas.addEventListener('pointercancel',()=>lookDrag=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(canMove()){e.preventDefault();world.zoom(e.deltaY);}},{passive:false});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||dialogs.some(d=>d.open))return;
  if(e.key==='Escape'&&inspection){$('closeInspection').click();return;}
  if(!canMove())return;const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){keys.add(key);e.preventDefault();}
  if(key==='e'&&!e.repeat){e.preventDefault();interact();}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{resetInput();if(document.hidden)audio.pause().catch(()=>{});else{last=0;audio.resume().catch(()=>{});}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();resetInput();$('failure').hidden=false;$('failureText').textContent='3D表示が一時停止しました。ページを開き直してください。';});
$('reloadButton').addEventListener('click',()=>location.reload());

function render(now){
  const dt=last?Math.min((now-last)/1000,.05):.016;last=now;clock+=dt;
  const active=canMove(),input={x:stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),forward:-stick.y+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),run:keys.has('shift')};
  if(game.phase==='start'||game.phase==='escaped')world.yaw=2.5+Math.sin(clock*.18)*.17;
  const state=world.update(dt,clock,input,active);
  footsteps(active,input.run);
  if(active){
    if(state.exit&&game.phase==='playing'){context={kind:'exit',choice:state.exit};$('contextName').textContent=state.exit==='forward'?'奥の扉':'来た道の扉';$('interactText').textContent=state.exit==='forward'?'先へ進む':'引き返す';}
    else if(state.nearest){context={kind:'object',target:state.nearest};$('contextName').textContent=state.nearest.name;$('interactText').textContent='調べる';}
    else{context=null;$('contextName').textContent='';}
    $('interactButton').hidden=!context;
    if(game.phase==='playing'&&state.exit&&Math.abs(world.player.position.z)>13.28&&Math.abs(world.player.position.x)<1.1)answer(state.exit);
  }
  frameId=requestAnimationFrame(render);
}
async function boot(){
  let loadingCharacter=false;
  try{
    const {MidnightWorld}=await import('./world3d.mjs');world=new MidnightWorld(canvas);world.yaw=2.5;
    if(characterConfig){loadingCharacter=true;$('startButton').textContent='探偵を準備中…';await world.loadCharacter(characterConfig.url,characterConfig);loadingCharacter=false;}
    new ResizeObserver(()=>world.resize()).observe(canvas);sync();$('startButton').disabled=false;$('startButton').textContent='廊下に出る →';frameId=requestAnimationFrame(render);
  }catch(error){
    console.error('3D game initialization failed',error);$('failure').hidden=false;$('failureText').textContent=loadingCharacter?'キャラクターを読み込めませんでした。通信を確認して、もう一度開いてください。':'3D表示を開始できませんでした。SafariまたはChromeで開き直してください。';
  }
}
sync();boot();
