'use strict';

const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d', {alpha:false});
const game = document.querySelector('#game');
const stage = document.querySelector('#stage');
const targets = document.querySelector('#targets');
const controls = document.querySelector('#controls');
const directions = document.querySelector('#directions');
const actions = document.querySelector('#actions');
const notice = document.querySelector('#notice');
const confirm = document.querySelector('#confirm');
const media = document.querySelector('#media');
const screenMenu = document.querySelector('#menu');
const debug = document.querySelector('#debug');
const debugScene = document.querySelector('#debug-scene');

const imageCache = new Map();
const frameCache = new Map();
const sounds = new Map();
const videos = new Set();
const overlaySurfaces = [];
const targetButtons = new Map();
const pointers = new Map();
const keyLabels = {13:'Enter',16:'Shift',32:'Пробел',37:'◀',38:'▲',39:'▶',40:'▼'};
const releaseKeys = new Set([9,16,17,18,27,32,37,38,39,40]);
const savePrefix = 'serega-books-5/';
let project, runtime, audioContext;
let loading = false;
let nextLoad = 0;
let lastTime = performance.now();
let accumulator = 0;
let resumeDebugMedia = null;

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ' (' + response.status + ')');
  return response.json();
}

function image(id) {
  if (!imageCache.has(id)) {
    const bitmap = new Image();
    bitmap.decoding = 'async';
    const ready = new Promise((resolve,reject) => {
      bitmap.onload = resolve;
      bitmap.onerror = () => reject(new Error('Не загрузилось изображение ' + id));
    });
    ready.catch(() => imageCache.delete(id));
    imageCache.set(id,{bitmap,ready});
    bitmap.src = 'sprites/' + id + '.webp';
  }
  return imageCache.get(id);
}

function announce(title, detail, label, action) {
  notice.querySelector('h1').textContent = title;
  notice.querySelector('p').textContent = detail;
  confirm.textContent = label;
  confirm.onclick = action;
  confirm.hidden = !action;
  notice.hidden = false;
}

function enterFullScreen(enabled) {
  if (enabled && !document.fullscreenElement) game.requestFullscreen?.().catch(() => {});
  if (!enabled && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

async function loadFrame(id) {
  if (!frameCache.has(id)) {
    const promise = json('frames/' + id + '.json');
    promise.catch(() => frameCache.delete(id));
    frameCache.set(id,promise);
  }
  return frameCache.get(id);
}

function initialSprites(frame) {
  const sprites = new Set();
  for (const object of Object.values(frame.objects)) {
    if (object.type === 2) {
      for (const animation of object.detail) {
        for (const direction of animation.directions) {
          for (const sprite of direction.Frames.slice(0,3)) sprites.add(sprite);
        }
      }
    }
    if (object.type === 7) for (const sprite of object.detail.Images) sprites.add(sprite);
  }
  return [...sprites];
}

async function go(id) {
  const seq = ++nextLoad;
  loading = true;
  const timer = setTimeout(() => {
    if (loading && nextLoad === seq) announce('Загрузка…','','',null);
  },300);
  try {
    const frame = await loadFrame(id);
    await Promise.all(initialSprites(frame).map(sprite => image(sprite).ready));
    if (seq !== nextLoad) return;
    loading = false;
    notice.hidden = true;
    runtime.enter(frame);
    const retained = new Set(frame.sprites);
    for (const sprite of imageCache.keys()) if (!retained.has(sprite)) imageCache.delete(sprite);
  } catch (error) {
    if (seq !== nextLoad) return;
    showError('Не удалось загрузить сцену', error.message, () => go(id));
  } finally {
    clearTimeout(timer);
  }
}

function showError(title, text, retry) {
  loading = true;
  announce(title,text,'Повторить',retry);
}

function readSave(key) {
  try { return Number(localStorage.getItem(savePrefix + key)) || 0; }
  catch { return 0; }
}

function writeSave(key, value) {
  try { localStorage.setItem(savePrefix + key,String(value)); }
  catch {}
}

function audioTrack(name) {
  return sounds.get(String(name).toLowerCase());
}

function stopSound(name) {
  const track = audioTrack(name);
  if (track) {
    track.audio.pause();
    track.node?.disconnect();
    track.pan?.disconnect();
    sounds.delete(String(name).toLowerCase());
  }
}

function playSound(name,count) {
  const key = String(name).toLowerCase();
  const id = project.sounds[key];
  if (id === undefined) return;
  stopSound(name);
  const audio = new Audio('audio/' + id + '.mp3');
  const track = {audio, count};
  sounds.set(key,track);
  audio.loop = count === 0;
  if (audioContext?.createStereoPanner) {
    track.node = audioContext.createMediaElementSource(audio);
    track.pan = audioContext.createStereoPanner();
    track.node.connect(track.pan).connect(audioContext.destination);
  }
  audio.onended = () => {
    if (--track.count <= 0) stopSound(name);
    else {
      audio.currentTime = 0;
      audio.play().catch(() => stopSound(name));
    }
  };
  audio.play().catch(() => stopSound(name));
}

function removeVideo(entity) {
  if (!entity.video) return;
  entity.video.pause();
  entity.video.removeAttribute('src');
  entity.video.load();
  entity.video.remove();
  videos.delete(entity);
  entity.video = null;
  entity.playing = false;
}

function setVideo(entity, path) {
  const filename = path.split(/[\\/]/).at(-1).toLowerCase();
  const id = project.videos[filename];
  removeVideo(entity);
  if (id === undefined) {
    showError('Ролик недоступен', filename, () => go(runtime.frame.id));
    return;
  }
  const video = document.createElement('video');
  video.playsInline = true;
  video.hidden = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.loop = Boolean(entity.videoLoop);
  video.volume = entity.videoGain ?? 1;
  video.muted = video.volume === 0;
  video.src = 'video/' + id + '.mp4';
  video.addEventListener('ended', () => { if (entity.video === video) entity.playing = false; });
  video.addEventListener('error', () => {
    if (entity.video === video) showError('Не удалось загрузить ролик', filename, () => go(runtime.frame.id));
  });
  entity.video = video;
  videos.add(entity);
  media.append(video);
}

function playVideo(entity) {
  const video = entity.video;
  if (!video) return;
  entity.playing = true;
  video.play().catch(error => {
    if (entity.video !== video || !entity.playing || error.name === 'AbortError') return;
    announce('Продолжить игру','', 'Продолжить', () => {
      notice.hidden = true;
      playVideo(entity);
    });
  });
}

function stopVideo(entity) {
  entity.video?.pause();
  entity.playing = false;
}

function stopSounds() {
  for (const name of sounds.keys()) stopSound(name);
}

function goToMenu() {
  stopSounds();
  go(1);
}

function quit() {
  stopSounds();
  loading = true;
  announce('Игра завершена','','В меню',goToMenu);
}

function readyToPlay() {
  return [...videos].every(entity => !entity.playing || entity.video.readyState >= 2);
}

function sprite(ctx,id,x,y) {
  const img = imageCache.get(id)?.bitmap;
  if (img?.naturalWidth) ctx.drawImage(img,Math.round(x),Math.round(y));
}

function textLines(ctx,text,width) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawText(entity,bounds,ctx) {
  const {detail} = entity.def;
  const [face,size,weight,style = 'normal'] = project.fonts[detail.Font] ?? ['Arial',24,400];
  ctx.font = style + ' ' + weight + ' ' + size + 'px "' + face + '", serif';
  ctx.fillStyle = detail.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = (detail.flags & 1) ? 'center' : (detail.flags & 2) ? 'right' : 'left';
  const x = bounds.x + (ctx.textAlign === 'center' ? bounds.w/2 : ctx.textAlign === 'right' ? bounds.w : 0);
  const paragraph = detail.paragraphs[entity.paragraph] ?? '';
  if (detail.singleLine) {
    ctx.textBaseline = 'middle';
    ctx.fillText(paragraph.trim(),x,bounds.y + bounds.h / 2,bounds.w);
    return;
  }
  const lines = textLines(ctx,paragraph,bounds.w);
  const leading = size * 1.08;
  const totalHeight = lines.length * leading;
  const y = bounds.y + (detail.flags & 4 ? (bounds.h-totalHeight)/2 : detail.flags & 8 ? bounds.h-totalHeight : 0);
  for (const [i,line] of lines.entries()) ctx.fillText(line,x,y+i*leading);
}

function drawActive(entity,bounds,ctx) {
  const direction = animationDirection(entity);
  if (!direction?.Frames.length) return;
  const id = activeImage(entity);
  const cache = image(id);
  for (let ahead = 1; ahead <= 3; ahead++) {
    const next = direction.Frames[entity.animIndex + ahead];
    if (next !== undefined) image(next);
  }
  if (cache.bitmap.naturalWidth) entity.renderedSprite = id;
  if (entity.renderedSprite === undefined) return;
  const actual = project.images[entity.renderedSprite];
  const intended = project.images[id];
  sprite(ctx,entity.renderedSprite,bounds.x + intended[2] - actual[2],bounds.y + intended[3] - actual[3]);
}

function drawCounter(entity,bounds,ctx) {
  const {detail} = entity.def;
  if (detail.DisplayType === 1) {
    let x = bounds.x;
    for (const char of String(entity.value).split('').reverse()) {
      const index = '0123456789-+.e'.indexOf(char);
      const id = detail.Images[index];
      const img = project.images[id];
      if (!img) continue;
      x -= img[0];
      sprite(ctx,id,x,bounds.y-img[1]);
    }
  } else if (detail.DisplayType === 3) {
    const ratio = clamp((entity.value-detail.Minimum) / (detail.Maximum-detail.Minimum),0,1);
    ctx.fillStyle = entity.color;
    ctx.fillRect(bounds.x,bounds.y,bounds.w*ratio,bounds.h);
  }
}

function hotspot(target, entity, rect) {
  const button = targetButtons.get(entity);
  const style = button.style;
  const left = Math.max(0,rect.x), top = Math.max(0,rect.y);
  style.left = left / project.width * 100 + '%';
  style.top = top / project.height * 100 + '%';
  style.width = (Math.min(rect.x+rect.w,project.width)-left) / project.width * 100 + '%';
  style.height = (Math.min(rect.y+rect.h,project.height)-top) / project.height * 100 + '%';
  button.hidden = rect.x+rect.w <= 0 || rect.y+rect.h <= 0 || rect.x >= project.width || rect.y >= project.height;
  target.add(entity);
}

function renderTargets() {
  if (!runtime.frame) return;
  const active = new Set();
  for (const [conditions] of runtime.frame.events) for (const [type,num,,,params] of conditions) {
    if (type !== -6 || num !== -7) continue;
    for (const entity of runtime.objects(params[1][1].ObjectInfo)) {
      const rect = runtime.displayBounds(entity);
      if (!(entity.visible || entity.def.inputOnly) || !rect || active.has(entity)) continue;
      if (!targetButtons.has(entity)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'target';
        button.setAttribute('aria-label', tapLabel(entity.def.Name));
        button.addEventListener('click', event => {
          if (event.detail) return;
          const box = runtime.displayBounds(entity);
          runtime.click = runtime.glance = {x:box.x+box.w/2,y:box.y+box.h/2};
        });
        targets.append(button);
        targetButtons.set(entity,button);
      }
      hotspot(active,entity,rect);
    }
  }
  for (const [entity,button] of targetButtons) if (!active.has(entity)) {
    button.remove();
    targetButtons.delete(entity);
  }
}

function tapLabel(name) {
  const label = {
    1:{'Актив 3':'Выбрать эпизод','Актив 4':'Настройки','Актив 5':'Выйти из игры','Актив 6':'Продолжить игру','Актив 7':'Начать новую игру'},
    2:{'Актив':'Эпизод 1','Актив 2':'Эпизод 1.5','Актив 3':'Эпизод 2'},
    9:{'полн':'Полный экран','окн':'Оконный режим','Актив 3':'Выйти в меню'},
  };
  return label[runtime.frame.id]?.[name] ?? name;
}

function videoSurface(depth) {
  if (!overlaySurfaces[depth-1]) {
    const overlay = document.createElement('canvas');
    overlay.width = project.width;
    overlay.height = project.height;
    overlay.style.zIndex = depth*2;
    media.append(overlay);
    overlaySurfaces[depth-1] = {canvas:overlay,ctx:overlay.getContext('2d')};
  }
  const surface = overlaySurfaces[depth-1];
  surface.canvas.hidden = false;
  surface.ctx.clearRect(0,0,project.width,project.height);
  return surface.ctx;
}

function positionVideo(video,bounds,depth,opacity) {
  const coords = [bounds.x/project.width,bounds.y/project.height,bounds.w/project.width,bounds.h/project.height];
  const key = coords.join(',') + '/' + depth + '/' + opacity;
  if (video.layoutKey === key) return;
  const [left,top,width,height] = coords.map(fraction => fraction*100 + '%');
  Object.assign(video.style,{left,top,width,height,zIndex:depth*2-1,opacity});
  video.layoutKey = key;
}

function render() {
  if (!runtime?.frame) return;
  const frame = runtime.frame;
  ctx.fillStyle = frame.background;
  ctx.fillRect(0,0,project.width,project.height);
  const items = runtime.entities.filter(e => e.visible && !e.dead && !frame.layers[e.layer]?.hidden).sort((a,b) => a.layer-b.layer);
  const visibleVideos = new Set();
  let depth = 0;
  let surface = ctx;
  for (const entity of items) {
    const {type,InkEffect,InkEffectParameter,BlendCoeff} = entity.def;
    const b = runtime.displayBounds(entity);
    if (!b || b.x > project.width+100 || b.y > project.height+100 || b.x+b.w < -100 || b.y+b.h < -100) continue;
    if (entity.flash && Math.floor(runtime.time / entity.flash) % 2) continue;
    const opacity = InkEffect === 1 ? 1 - clamp(InkEffectParameter / 128,0,1) : 1 - (BlendCoeff ?? 0)/255;
    if (type === 32 && entity.video?.readyState >= 2) {
      positionVideo(entity.video,b,++depth,opacity);
      visibleVideos.add(entity.video);
      surface = videoSurface(depth);
      continue;
    }
    surface.globalAlpha = opacity;
    if (type === 2) drawActive(entity,b,surface);
    if (type === 3) drawText(entity,b,surface);
    if (type === 7) drawCounter(entity,b,surface);
    surface.globalAlpha = 1;
  }
  for (const entity of videos) entity.video.hidden = !visibleVideos.has(entity.video);
  for (let i = depth; i < overlaySurfaces.length; i++) overlaySurfaces[i].canvas.hidden = true;
  renderTargets();
}

function makeTouchKey(code) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = keyLabels[code] ?? String.fromCharCode(code);
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,code);
    runtime.keyDown(code);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    button.addEventListener(type,event => {
      const key = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (key && ![...pointers.values()].includes(key)) runtime.keyUp(key);
    });
  }
  button.addEventListener('click', event => {
    if (event.detail) return;
    runtime.keyDown(code);
    runtime.keyUp(code);
  });
  return button;
}

function selectFrame(frame) {
  directions.replaceChildren();
  actions.replaceChildren();
  const keys = new Set();
  const moves = Object.values(frame.objects).map(obj => obj.movement.Type);
  if (moves.includes(9) || moves.includes(3)) {
    keys.add(37);
    keys.add(39);
    if (moves.includes(3)) { keys.add(38); keys.add(40); }
  }
  for (const [conditions] of frame.events) for (const [type,num,,,params] of conditions) {
    if (type === -6 && (num === -1 || num === -2)) {
      const code = params[0][1].Value;
      if (code < 112) keys.add(code);
    }
  }
  for (const code of keys) (code >= 37 && code <= 40 ? directions : actions).append(makeTouchKey(code));
  controls.hidden = frame.id === 1;
  screenMenu.hidden = frame.id === 1;
  for (const code of pointers.values()) runtime.keyUp(code);
  pointers.clear();
}

function updatePoint(event, pressed) {
  if (!runtime?.frame) return;
  const bounds = stage.getBoundingClientRect();
  const point = {x:(event.clientX-bounds.left)*project.width/bounds.width,y:(event.clientY-bounds.top)*project.height/bounds.height};
  runtime.glance = point;
  if (pressed) runtime.click = point;
}

for (const area of [stage,controls]) {
  area.addEventListener('selectstart', event => event.preventDefault());
  area.addEventListener('contextmenu', event => event.preventDefault());
}
stage.addEventListener('pointermove', event => updatePoint(event,false));
stage.addEventListener('pointerleave', () => { if (runtime) runtime.glance = null; });
targets.addEventListener('pointerdown', event => updatePoint(event,true));
screenMenu.onclick = goToMenu;

function openDebug() {
  debugScene.value = String(runtime.frame.id);
  runtime.down.clear();
  runtime.tapped.clear();
  runtime.click = null;
  pointers.clear();

  const pausedAudio = [...sounds.values()].map(track => track.audio).filter(audio => !audio.paused);
  const pausedVideos = [...videos].filter(entity => entity.playing);
  for (const audio of pausedAudio) audio.pause();
  for (const entity of pausedVideos) entity.video.pause();
  resumeDebugMedia = () => {
    for (const audio of pausedAudio) audio.play().catch(() => {});
    for (const entity of pausedVideos) if (entity.video && entity.playing) playVideo(entity);
  };
  debug.showModal();
}

debug.addEventListener('close', () => {
  resumeDebugMedia?.();
  resumeDebugMedia = null;
});
document.querySelector('#debug-close').onclick = () => debug.close();
document.querySelector('#debug-form').onsubmit = event => {
  event.preventDefault();
  const id = Number(debugScene.value);
  if (!project.frames.some(frame => frame.id === id)) return;
  resumeDebugMedia = null;
  debug.close();
  stopSounds();
  go(id);
};
window.addEventListener('keydown', event => {
  if (event.code === 'KeyP' && runtime?.frame) {
    event.preventDefault();
    if (event.repeat) return;
    if (debug.open) debug.close();
    else openDebug();
    return;
  }
  if (debug.open || !runtime?.frame || !notice.hidden) return;
  if (event.key === 'Escape' && !document.fullscreenElement) { goToMenu(); return; }
  if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return;
  if (releaseKeys.has(event.keyCode) && ![9,27].includes(event.keyCode)) event.preventDefault();
  if (!event.repeat) runtime.keyDown(event.keyCode);
});
window.addEventListener('keyup', event => runtime?.keyUp(event.keyCode));
window.addEventListener('blur', () => {
  runtime?.down.clear();
  runtime?.tapped.clear();
  pointers.clear();
});

function drawLoop(now) {
  const dt = 1 / (project?.fps ?? 60);
  accumulator += Math.min((now-lastTime)/1000,dt*4);
  lastTime = now;
  if (runtime) {
    while (accumulator >= dt) {
      runtime.step(dt);
      accumulator -= dt;
    }
    render();
  } else accumulator = 0;
  requestAnimationFrame(drawLoop);
}

async function boot() {
  try {
    project = await json('project.json');
    debugScene.replaceChildren(...project.frames.map(({id,name}, index) =>
      new Option(`${index + 1}. ${name}`, String(id))
    ));
    runtime = new GameRuntime(project,{
      go, quit, cursor: visible => { targets.style.cursor = visible ? '' : 'none'; },
      selectFrame, waiting: () => debug.open || loading || !notice.hidden || !readyToPlay(),
      playSound, stopSound, stopSounds, isPlaying: name => Boolean(audioTrack(name)),
      soundVolume: (name,value) => { const track = audioTrack(name); if (track) track.audio.volume = clamp(value,0,1); },
      soundPan: (name,value) => { const track = audioTrack(name); if (track?.pan) track.pan.pan.value = clamp(value,-1,1); },
      setVideo, playVideo, stopVideo, removeVideo, videoPlaying: entity => Boolean(entity.playing),
      loopVideo: (entity,loop) => { entity.videoLoop = loop; if (entity.video) entity.video.loop = loop; },
      videoVolume: (entity,value) => {
        entity.videoGain = clamp(value,0,1);
        if (entity.video) { entity.video.volume = entity.videoGain; entity.video.muted = value === 0; }
      },
      fullScreen: enabled => { if (runtime.frame.id === 9) enterFullScreen(enabled); },
      readSave, writeSave,
    });
    go(0);
  } catch (error) {
    announce('Не удалось открыть игру',error.message,'Повторить',boot);
  }
}

let unlocked = false;
confirm.onclick = () => {
  if (unlocked) return;
  unlocked = true;
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (Context) {
    audioContext = new Context();
    audioContext.resume().catch(() => {});
  }
  confirm.disabled = true;
  boot().finally(() => { confirm.disabled = false; });
};
requestAnimationFrame(drawLoop);
