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
const touchScreen = window.matchMedia('(any-pointer: coarse)');
const debug = document.querySelector('#debug');
const debugScene = document.querySelector('#debug-scene');

const imageCache = new Map();
const frameCache = new Map();
const sounds = new Map();
const soundBuffers = new Map();
const videos = new Set();
const overlaySurfaces = [];
const targetButtons = new Map();
const pointers = new Map();
const keyLabels = {13:'Enter',16:'Shift',32:'Пробел',37:'‹',38:'⌃',39:'›',40:'⌄'};
const directionLabels = {37:'Влево',38:'Вверх',39:'Вправо',40:'Вниз'};
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
  const key = String(name).toLowerCase();
  const track = sounds.get(key);
  if (!track) return;
  sounds.delete(key);
  if (track.audio) {
    track.audio.onended = null;
    track.audio.pause();
  }
  if (track.source) {
    track.source.onended = null;
    track.source.stop();
    track.source.disconnect();
  }
  track.node?.disconnect();
  track.pan?.disconnect();
}

function playAudioElement(key,track) {
  if (sounds.get(key) !== track) return;
  track.retry = false;
  track.audio.play().catch(error => {
    if (sounds.get(key) !== track) return;
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') track.retry = true;
    else stopSound(key);
  });
}

function startAudioElement(key,track) {
  const audio = new Audio(track.url);
  track.audio = audio;
  audio.loop = track.count === 0;
  audio.volume = track.volume;
  if (!touchScreen.matches && audioContext?.createStereoPanner) {
    track.node = audioContext.createMediaElementSource(audio);
    track.pan = audioContext.createStereoPanner();
    track.pan.pan.value = track.balance;
    track.node.connect(track.pan).connect(audioContext.destination);
  }
  audio.onended = () => {
    if (--track.count <= 0) stopSound(key);
    else {
      audio.currentTime = 0;
      playAudioElement(key,track);
    }
  };
  playAudioElement(key,track);
}

function loadSoundBuffer(url) {
  if (soundBuffers.has(url)) return soundBuffers.get(url);
  const buffer = fetch(url).then(response => {
    if (!response.ok) throw new Error('Audio request failed');
    return response.arrayBuffer();
  }).then(bytes => audioContext.decodeAudioData(bytes));
  if (soundBuffers.size >= 8) soundBuffers.delete(soundBuffers.keys().next().value);
  soundBuffers.set(url,buffer);
  buffer.then(decoded => {
    if (decoded.duration > 15 && soundBuffers.get(url) === buffer) soundBuffers.delete(url);
  },() => {
    if (soundBuffers.get(url) === buffer) soundBuffers.delete(url);
  });
  return buffer;
}

function playSound(name,count) {
  const key = String(name).toLowerCase();
  const id = project.sounds[key];
  if (id === undefined) return;
  stopSound(name);
  const track = {url:'audio/' + id + '.mp3',count,volume:1,balance:0};
  sounds.set(key,track);
  if (!touchScreen.matches || !audioContext) {
    startAudioElement(key,track);
    return;
  }

  loadSoundBuffer(track.url).then(buffer => {
    if (sounds.get(key) !== track) return;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.loop = count !== 1;
    gain.gain.value = track.volume;
    source.connect(gain);
    if (audioContext.createStereoPanner) {
      track.pan = audioContext.createStereoPanner();
      track.pan.pan.value = track.balance;
      gain.connect(track.pan).connect(audioContext.destination);
    } else gain.connect(audioContext.destination);
    track.node = gain;
    track.source = source;
    source.onended = () => { if (sounds.get(key) === track) stopSound(key); };
    source.start();
    if (count > 1) source.stop(audioContext.currentTime + buffer.duration * count);
  },() => {
    if (sounds.get(key) === track) startAudioElement(key,track);
  });
}

function recoverAudio() {
  if (debug.open || document.hidden) return;
  if (audioContext && audioContext.state !== 'running') audioContext.resume().catch(() => {});
  for (const [key,track] of sounds) if (track.retry) playAudioElement(key,track);
}

for (const event of ['pointerup','touchend','keydown']) {
  window.addEventListener(event,recoverAudio,{capture:true});
}
document.addEventListener('visibilitychange',recoverAudio);

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
  button.dataset.key = code;
  if (directionLabels[code]) button.setAttribute('aria-label',directionLabels[code]);
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
  controls.hidden = frame.cinematic || keys.size === 0;
  directions.hidden = directions.childElementCount === 0;
  actions.hidden = actions.childElementCount === 0;
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

function openDebug() {
  debugScene.value = String(runtime.frame.id);
  runtime.down.clear();
  runtime.tapped.clear();
  runtime.click = null;
  pointers.clear();

  const pausedAudio = [...sounds.values()].filter(track => track.audio && !track.audio.paused);
  if (touchScreen.matches) audioContext?.suspend().catch(() => {});
  const pausedVideos = [...videos].filter(entity => entity.playing);
  for (const track of pausedAudio) track.audio.pause();
  for (const entity of pausedVideos) entity.video.pause();
  resumeDebugMedia = () => {
    for (const [key,track] of sounds) if (pausedAudio.includes(track)) playAudioElement(key,track);
    for (const entity of pausedVideos) if (entity.video && entity.playing) playVideo(entity);
  };
  debug.showModal();
}

debug.addEventListener('close', () => {
  recoverAudio();
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
  if (debug.open || !runtime?.frame || runtime.frame.cinematic || !notice.hidden) return;
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
      soundVolume: (name,value) => {
        const track = audioTrack(name);
        if (!track) return;
        track.volume = clamp(value,0,1);
        if (track.audio) track.audio.volume = track.volume;
        else if (track.node) track.node.gain.value = track.volume;
      },
      soundPan: (name,value) => {
        const track = audioTrack(name);
        if (!track) return;
        track.balance = clamp(value,-1,1);
        if (track.pan) track.pan.pan.value = track.balance;
      },
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
  if (touchScreen.matches) enterFullScreen(true);
  confirm.disabled = true;
  boot().finally(() => { confirm.disabled = false; });
};
requestAnimationFrame(drawLoop);
