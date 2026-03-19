/* Piano Visualizer */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// MIDI PARSER
function parseMidiFile(buffer) {
  const view = new DataView(buffer);
  let pos = 0;
  const read8 = () => view.getUint8(pos++);
  const read16 = () => { const v = view.getUint16(pos); pos += 2; return v; };
  const read32 = () => { const v = view.getUint32(pos); pos += 4; return v; };
  const skip = (n) => { pos += n; };
  const readStr = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(read8()); return s; };

  function readVar() {
    let val = 0, b;
    do { b = read8(); val = (val << 7) | (b & 0x7F); } while (b & 0x80);
    return val;
  }

  readStr(4); read32();
  read16();
  const numTracks = read16();
  const tpb = read16();

  const allNotes = [];
  const tempos = [{ ticks: 0, us: 500000 }];
  const pedalEvents = [];

  for (let t = 0; t < numTracks; t++) {
    readStr(4);
    const trackLen = read32();
    const trackEnd = pos + trackLen;
    let ticks = 0, running = 0;
    const on = {};

    while (pos < trackEnd) {
      ticks += readVar();
      let st = read8();
      if (!(st & 0x80)) { pos--; st = running; } else { running = st; }
      const type = st & 0xF0;

      if (type === 0x90 || type === 0x80) {
        const note = read8(), vel = read8();
        if (type === 0x90 && vel > 0) {
          on[note] = { ticks, vel: vel / 127 };
        } else if (on[note]) {
          allNotes.push({ midi: note, start: on[note].ticks, end: ticks, vel: on[note].vel });
          delete on[note];
        }
      } else if (type === 0xB0) {
        const cc = read8(), val = read8();
        if (cc === 64) pedalEvents.push({ ticks, on: val >= 64 });
      } else if (type === 0xA0 || type === 0xE0) { skip(2); }
      else if (type === 0xC0 || type === 0xD0) { skip(1); }
      else if (st === 0xFF) {
        const mt = read8(), ml = readVar();
        if (mt === 0x51 && ml === 3) {
          tempos.push({ ticks, us: (view.getUint8(pos) << 16) | (view.getUint8(pos + 1) << 8) | view.getUint8(pos + 2) });
        }
        skip(ml);
      } else if (st === 0xF0 || st === 0xF7) { skip(readVar()); }
    }
    pos = trackEnd;
  }

  // extend notes held by sustain pedal
  pedalEvents.sort((a, b) => a.ticks - b.ticks);
  for (const note of allNotes) {
    let pedalHeld = false;
    for (const pe of pedalEvents) {
      if (pe.ticks > note.end) break;
      if (pe.ticks <= note.end) pedalHeld = pe.on;
    }
    if (pedalHeld) {
      for (const pe of pedalEvents) {
        if (pe.ticks > note.end && !pe.on) {
          note.end = pe.ticks;
          break;
        }
      }
    }
  }

  tempos.sort((a, b) => a.ticks - b.ticks);

  function toSec(target) {
    let time = 0, last = 0, us = 500000;
    for (const tc of tempos) {
      if (tc.ticks > target) break;
      time += ((tc.ticks - last) / tpb) * (us / 1e6);
      last = tc.ticks; us = tc.us;
    }
    return time + ((target - last) / tpb) * (us / 1e6);
  }

  const notes = allNotes
    .map(n => ({ midi: n.midi, time: toSec(n.start), duration: toSec(n.end) - toSec(n.start), velocity: n.vel }))
    .sort((a, b) => a.time - b.time);

  const pedals = pedalEvents
    .map(p => ({ time: toSec(p.ticks), on: p.on }))
    .sort((a, b) => a.time - b.time);

  return { notes, pedals };
}

// NOTE COLOR
function noteColor(midi) {
  const hue = (COLOR_HUE_START + ((midi % 12) / 12) * (COLOR_HUE_END - COLOR_HUE_START)) / 360;
  return new THREE.Color().setHSL(hue, COLOR_SATURATION, COLOR_LIGHTNESS);
}

// CONSTANTS
const MAX_PARTICLES = 4000;
const LOOKAHEAD = 4;
const KB_HEIGHT = 50;

const BLOOM_STRENGTH = 0.6;
const BLOOM_RADIUS = 0.5;
const BLOOM_THRESHOLD = 0.15;
const BLOOM_STRENGTH_MOBILE = 0.8;

const PARTICLE_SIZE_MIN = 3;
const PARTICLE_SIZE_MAX = 7;
const PARTICLE_LIFE_MIN = 0.3;
const PARTICLE_LIFE_MAX = 0.7;
const SPAWN_RATE_IDLE = 1;
const SPAWN_RATE_ACTIVE = 3;
const SPLASH_COUNT = 15;
const SPLASH_SPEED_MIN = 30;
const SPLASH_SPEED_MAX = 90;

const COLOR_HUE_START = 210;
const COLOR_HUE_END = 270;
const COLOR_SATURATION = 0.7;
const COLOR_LIGHTNESS = 0.55;

const KB_WHITE_COLOR = 0x444444;
const KB_WHITE_OPACITY = 0;
const KB_BLACK_COLOR = 0x2a2a2a;
const KB_BLACK_OPACITY = 0;
const KB_WHITE_INACTIVE_COLOR = KB_WHITE_COLOR;
const KB_WHITE_INACTIVE_OPACITY = KB_WHITE_OPACITY;
const KB_BLACK_INACTIVE_COLOR = KB_BLACK_COLOR;
const KB_BLACK_INACTIVE_OPACITY = KB_BLACK_OPACITY;
const KB_ACTIVE_OPACITY_WHITE = 0.7;
const KB_ACTIVE_OPACITY_BLACK = 0.85;
const KB_LINE_COLOR = 0xffffff;
const KB_LINE_OPACITY = 0.2;
const KB_LINE_THICKNESS = 1;
const KB_LINE_GLOW_COLOR = 0xffffff;
const KB_LINE_GLOW_OPACITY = 0;
const KB_LINE_GLOW_THICKNESS = 0;

const MOUSE_HOVER_RADIUS = 150;
const MOUSE_HOVER_COLOR = { r: 1, g: 0.95, b: 0.8 };

// PIANO VISUALIZER
class PianoVisualizer {
  constructor(containerId, midiUrl) {
    this.container = document.getElementById(containerId);
    this.midiUrl = midiUrl;
    this.notes = [];
    this.isPlaying = false;
    this.manualPause = false;
    this.playStartTime = 0;
    this.pauseOffset = 0;
    this.totalDuration = 0;
    this._lastFrame = 0;

    this.minNote = 127;
    this.maxNote = 0;
    this.keyMap = {};
    this.keyMeshes = {};

    this.pool = [];
    this.freeList = [];

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.particleGeometry = null;
    this.kbGroup = null;

    this.toneLoaded = false;
    this.synth = null;
    this.audioStarted = false;

    this._isDragging = false;
    this._lastPlayedNote = -1;
    this._interactiveNotes = {};
    this._mouseX = -9999;
    this._mouseY = -9999;
    this._mouseOnCanvas = false;

    this.W = 0;
    this.H = window.innerWidth <= 768 ? 300 : 500;

    if (this.container) this.init();
  }

  // INIT & RESIZE
  async init() {
    await this.loadMidi();
    if (!this.notes.length) return;
    this.W = this.container.getBoundingClientRect().width;
    this.calcKeys();
    this.initThree();
    if (!this.renderer) return;
    this.initParticles();
    this.createKeyboard();
    this.createVolumeSlider();
    this.createPlayHint();
    this.setupMouseInteraction();
    this.setupAutoPlay();
    this.setupAudioOnGesture();
    this.animate();
  }

  resize() {
    this.W = this.container.getBoundingClientRect().width;
    this.H = window.innerWidth <= 768 ? 300 : 500;
    if (!this.renderer) return;

    this.renderer.setSize(this.W, this.H);
    this.composer.setSize(this.W, this.H);
    this.camera.right = this.W;
    this.camera.top = this.H;
    this.camera.updateProjectionMatrix();

    if (this.notes.length) {
      this.calcKeys();
      if (this.kbGroup) this.scene.remove(this.kbGroup);
      this.keyMeshes = {};
      this.createKeyboard();
    }
  }

  // MIDI LOADING
  async loadMidi() {
    try {
      const res = await fetch(this.midiUrl);
      const buf = await res.arrayBuffer();
      const midi = parseMidiFile(buf);
      this.notes = midi.notes;
      this.pedals = midi.pedals;
      this.notes.forEach(n => {
        if (n.midi < this.minNote) this.minNote = n.midi;
        if (n.midi > this.maxNote) this.maxNote = n.midi;
      });
      this.minNote -= this.minNote % 12;
      this.maxNote += 11 - (this.maxNote % 12);
      this.totalDuration = Math.max(...this.notes.map(n => n.time + n.duration));
    } catch (e) {
      console.error('MIDI load failed:', e);
    }
  }

  // KEYBOARD LAYOUT
  isBlack(n) { return [1, 3, 6, 8, 10].includes(n % 12); }

  calcKeys() {
    this.keyMap = {};
    let wc = 0;
    for (let n = this.minNote; n <= this.maxNote; n++) if (!this.isBlack(n)) wc++;
    const ww = this.W / wc, bw = ww * 0.62;
    let wi = 0;
    for (let n = this.minNote; n <= this.maxNote; n++) {
      if (!this.isBlack(n)) { this.keyMap[n] = { x: wi * ww, w: ww, black: false }; wi++; }
    }
    for (let n = this.minNote; n <= this.maxNote; n++) {
      if (this.isBlack(n)) {
        const prev = this.keyMap[n - 1];
        if (prev) this.keyMap[n] = { x: prev.x + prev.w - bw / 2, w: bw, black: true };
      }
    }
  }

  // THREE.JS SETUP
  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, this.W, this.H, 0, -100, 100);
    this.camera.position.z = 10;

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      console.warn('WebGL not available');
      return;
    }
    this.renderer.setSize(this.W, this.H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.container.appendChild(canvas);

    const rt = new THREE.WebGLRenderTarget(this.W, this.H, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const isMobile = window.innerWidth <= 768;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.W, this.H),
      isMobile ? BLOOM_STRENGTH_MOBILE : BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    this.composer.addPass(bloomPass);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
  }

  // PARTICLES
  initParticles() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        alive: false, x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0, gravity: 0,
        r: 1, g: 1, b: 1,
        size: 1, alpha: 1, life: 0, maxLife: 1
      });
    }
    for (let i = MAX_PARTICLES - 1; i >= 0; i--) this.freeList.push(i);

    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    const alphas = new Float32Array(MAX_PARTICLES);

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.particleGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.particleGeometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float glow = exp(-d * d * 3.0);
          gl_FragColor = vec4(vColor * (0.5 + glow * 1.5), glow * vAlpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });

    this.points = new THREE.Points(this.particleGeometry, material);
    this.scene.add(this.points);
  }

  // KEYBOARD RENDERING
  createKeyboard() {
    this.kbGroup = new THREE.Group();

    // white keys
    for (let n = this.minNote; n <= this.maxNote; n++) {
      const k = this.keyMap[n];
      if (!k || k.black) continue;
      const geo = new THREE.PlaneGeometry(k.w - 1, KB_HEIGHT);
      const mat = new THREE.MeshBasicMaterial({ color: KB_WHITE_COLOR, transparent: true, opacity: KB_WHITE_OPACITY });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(k.x + k.w / 2, KB_HEIGHT / 2, 0);
      this.kbGroup.add(mesh);
      this.keyMeshes[n] = { mesh, mat, isBlack: false };
    }

    // black keys
    for (let n = this.minNote; n <= this.maxNote; n++) {
      const k = this.keyMap[n];
      if (!k || !k.black) continue;
      const bh = KB_HEIGHT * 0.6;
      const geo = new THREE.PlaneGeometry(k.w - 0.5, bh);
      const mat = new THREE.MeshBasicMaterial({ color: KB_BLACK_COLOR, transparent: true, opacity: KB_BLACK_OPACITY });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(k.x + k.w / 2, KB_HEIGHT - bh / 2, 1);
      this.kbGroup.add(mesh);
      this.keyMeshes[n] = { mesh, mat, isBlack: true };
    }

    // hit line glow
    const glowGeo = new THREE.PlaneGeometry(this.W, KB_LINE_GLOW_THICKNESS);
    const glowMat = new THREE.MeshBasicMaterial({ color: KB_LINE_GLOW_COLOR, transparent: true, opacity: KB_LINE_GLOW_OPACITY });
    const glowLine = new THREE.Mesh(glowGeo, glowMat);
    glowLine.position.set(this.W / 2, KB_HEIGHT, 0);
    this.kbGroup.add(glowLine);

    // hit line
    const lineGeo = new THREE.PlaneGeometry(this.W, KB_LINE_THICKNESS);
    const lineMat = new THREE.MeshBasicMaterial({ color: KB_LINE_COLOR, transparent: true, opacity: KB_LINE_OPACITY });
    const hitLine = new THREE.Mesh(lineGeo, lineMat);
    hitLine.position.set(this.W / 2, KB_HEIGHT, 1);
    this.kbGroup.add(hitLine);

    this.scene.add(this.kbGroup);
  }

  // MOUSE INTERACTION
  xToNote(clientX) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = clientX - rect.left;

    // check black keys first (they overlap white keys)
    for (let n = this.maxNote; n >= this.minNote; n--) {
      const k = this.keyMap[n];
      if (!k || !k.black) continue;
      if (x >= k.x && x < k.x + k.w) return n;
    }
    for (let n = this.minNote; n <= this.maxNote; n++) {
      const k = this.keyMap[n];
      if (!k || k.black) continue;
      if (x >= k.x && x < k.x + k.w) return n;
    }
    return -1;
  }

  playInteractiveNote(midi) {
    if (midi < 0 || midi === this._lastPlayedNote) return;
    this._lastPlayedNote = midi;

    // trigger sound
    if (this.synth && this.audioStarted) {
      const noteName = Tone.Frequency(midi, 'midi').toNote();
      this.synth.triggerAttackRelease(noteName, 0.4, undefined, 0.6);
    }

    // spawn splash particles
    const k = this.keyMap[midi];
    if (!k) return;
    const color = noteColor(midi);
    const dpr = this.renderer.getPixelRatio();

    for (let i = 0; i < SPLASH_COUNT; i++) {
      const p = this.getParticle();
      if (!p) return;

      const angle = Math.random() * Math.PI;
      const speed = SPLASH_SPEED_MIN + Math.random() * (SPLASH_SPEED_MAX - SPLASH_SPEED_MIN);

      p.x = k.x + k.w / 2 + (Math.random() - 0.5) * k.w;
      p.y = KB_HEIGHT;
      p.z = (Math.random() - 0.5) * 5;
      p.vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
      p.vy = Math.sin(angle) * speed;
      p.vz = (Math.random() - 0.5) * 20;
      p.gravity = -80;
      p.r = Math.min(1, color.r * 2);
      p.g = Math.min(1, color.g * 2);
      p.b = Math.min(1, color.b * 2);
      p.size = (4 + Math.random() * 6) * dpr;
      p.life = 0.4 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.alpha = 1;
    }

    // track for keyboard highlight
    this._interactiveNotes[midi] = performance.now() + 300;
  }

  createPlayHint() {
    const hint = document.createElement('img');
    hint.src = 'assets/img/play_here.png';
    hint.className = 'piano-play-hint';
    this.container.style.position = 'relative';
    this.container.appendChild(hint);
    this._playHint = hint;
  }

  hidePlayHint() {
    if (this._playHint) {
      this._playHint.style.opacity = '0';
      setTimeout(() => this._playHint?.remove(), 500);
      this._playHint = null;
    }
  }

  setupMouseInteraction() {
    const canvas = this.renderer.domElement;
    canvas.style.cursor = 'pointer';

    canvas.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._lastPlayedNote = -1;
      this.hidePlayHint();
      const note = this.xToNote(e.clientX);
      this.playInteractiveNote(note);
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this._mouseX = e.clientX - rect.left;
      this._mouseY = this.H - (e.clientY - rect.top);
      this._mouseOnCanvas = true;

      if (!this._isDragging) return;
      const note = this.xToNote(e.clientX);
      this.playInteractiveNote(note);
    });

    canvas.addEventListener('mouseup', () => {
      this._isDragging = false;
      this._lastPlayedNote = -1;
    });

    canvas.addEventListener('mouseleave', () => {
      this._isDragging = false;
      this._lastPlayedNote = -1;
      this._mouseOnCanvas = false;
    });

    // touch support
    canvas.addEventListener('touchstart', (e) => {
      this._isDragging = true;
      this._lastPlayedNote = -1;
      const touch = e.touches[0];
      this.playInteractiveNote(this.xToNote(touch.clientX));
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (!this._isDragging) return;
      const touch = e.touches[0];
      this.playInteractiveNote(this.xToNote(touch.clientX));
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      this._isDragging = false;
      this._lastPlayedNote = -1;
    });
  }

  // VOLUME SLIDER
  sliderToDb(val) {
    if (val <= 0) return -Infinity;
    return -12 + (Math.pow(val, 0.5) - Math.pow(0.5, 0.5)) * (24 / (1 - Math.pow(0.5, 0.5)));
  }

  createVolumeSlider() {
    const svgOn = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    const svgOff = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

    const wrap = document.createElement('div');
    wrap.className = 'piano-volume';

    const icon = document.createElement('span');
    icon.className = 'piano-volume__icon';
    icon.innerHTML = svgOn;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'piano-volume__slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '80';

    const credit = document.createElement('span');
    credit.className = 'piano-volume__credit';
    credit.textContent = 'If I Am With You — Yoshimasa Terui';

    wrap.appendChild(icon);
    wrap.appendChild(slider);
    wrap.appendChild(credit);
    this.container.insertAdjacentElement('afterend', wrap);
    this._volumeSlider = slider;
    this._muted = false;
    this._premuteValue = slider.value;

    // mute toggle
    icon.addEventListener('click', () => {
      this._muted = !this._muted;
      if (this._muted) {
        this._premuteValue = slider.value;
        icon.innerHTML = svgOff;
        if (this.synth) this.synth.volume.value = -Infinity;
      } else {
        icon.innerHTML = svgOn;
        slider.value = this._premuteValue;
        if (this.synth) this.synth.volume.value = this.sliderToDb(this._premuteValue / 100);
      }
    });

    // volume change
    slider.addEventListener('input', () => {
      if (this._muted) {
        this._muted = false;
        icon.innerHTML = svgOn;
      }
      const db = this.sliderToDb(slider.value / 100);
      if (this.synth) {
        this.synth.volume.value = db;
      }
    });
  }

  // AUTO-PLAY ON SCROLL
  setupAutoPlay() {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isPlaying && !this.manualPause) {
          this.play();
        } else if (!entries[0].isIntersecting && this.isPlaying) {
          this.pause();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(this.container);
  }

  // AUDIO (TONE.JS + SALAMANDER GRAND PIANO)
  setupAudioOnGesture() {
    const handler = () => {
      this.startAudio();
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
  }

  async loadTone() {
    if (this.toneLoaded) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.min.js';
      script.onload = () => { this.toneLoaded = true; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async startAudio() {
    if (this.audioStarted) return;
    try {
      await this.loadTone();
      await Tone.start();

      const initDb = this._volumeSlider ? this.sliderToDb(this._volumeSlider.value / 100) : -12;
      const baseUrl = 'https://tonejs.github.io/audio/salamander/';
      this.synth = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
          A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
          A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
          A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
          A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
          A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
          A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
          A7: 'A7.mp3', C8: 'C8.mp3',
        },
        release: 1.5,
        baseUrl,
        volume: initDb,
        onload: () => {
          this.audioStarted = true;
          this.scheduleNotes();
          if (this.isPlaying) {
            Tone.Transport.position = this.getCurrentTime();
            Tone.Transport.start();
          }
        }
      }).toDestination();

      this.audioStarted = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  scheduleNotes() {
    Tone.Transport.cancel();
    Tone.Transport.position = this.getCurrentTime();

    for (const note of this.notes) {
      const noteName = Tone.Frequency(note.midi, 'midi').toNote();
      Tone.Transport.schedule((t) => {
        if (this.synth) {
          this.synth.triggerAttackRelease(noteName, note.duration, t, note.velocity * 0.7);
        }
      }, note.time);
    }
  }

  // PLAYBACK CONTROLS
  getCurrentTime() {
    if (!this.isPlaying) return this.pauseOffset;
    return (performance.now() - this.playStartTime) / 1000 + this.pauseOffset;
  }

  play() {
    if (!this.notes.length) return;
    this.playStartTime = performance.now();
    this.isPlaying = true;

    if (this.audioStarted) {
      Tone.Transport.position = this.getCurrentTime();
      Tone.Transport.start();
    }
  }

  pause() {
    this.pauseOffset = this.getCurrentTime();
    this.isPlaying = false;

    if (this.audioStarted) {
      Tone.Transport.pause();
    }
  }

  loop() {
    this.pauseOffset = 0;
    this.playStartTime = performance.now();
    this.notes.forEach(n => delete n._splashed);

    if (this.audioStarted) {
      this.scheduleNotes();
      Tone.Transport.position = 0;
      Tone.Transport.start();
    }
  }

  // ANIMATION LOOP
  getParticle() {
    if (this.freeList.length === 0) return null;
    const idx = this.freeList.pop();
    this.pool[idx].alive = true;
    return this.pool[idx];
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.renderer) return;

    const now = performance.now();
    const dt = Math.min((now - (this._lastFrame || now)) / 1000, 0.05);
    this._lastFrame = now;

    const time = this.getCurrentTime();

    if (this.isPlaying && time > this.totalDuration + 1) {
      this.loop();
    }

    // update particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.freeList.push(i);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += p.gravity * dt;
      p.alpha = p.life / p.maxLife;
    }

    if (this.isPlaying || this.pauseOffset > 0) {
      this.spawnNoteParticles(time);
    }

    // highlight active keys (midi playback + interactive)
    const active = new Set();
    for (const n of this.notes) {
      if (time >= n.time && time < n.time + n.duration) active.add(n.midi);
    }
    for (const [midi, expiry] of Object.entries(this._interactiveNotes)) {
      if (now < expiry) active.add(Number(midi));
      else delete this._interactiveNotes[midi];
    }
    this.updateKeyboard(active);

    this.syncParticleBuffer();
    this.composer.render();
  }

  // PARTICLE SPAWNING
  spawnNoteParticles(time) {
    const fallH = this.H - KB_HEIGHT;
    const pps = fallH / LOOKAHEAD;
    const dpr = this.renderer.getPixelRatio();

    for (const note of this.notes) {
      const dt0 = note.time - time;
      const dt1 = (note.time + note.duration) - time;
      if (dt1 < -0.1 || dt0 > LOOKAHEAD) continue;

      const k = this.keyMap[note.midi];
      if (!k) continue;

      const color = noteColor(note.midi);
      const isActive = time >= note.time && time < note.time + note.duration;

      const bottomY = KB_HEIGHT + Math.max(dt0, 0) * pps;
      const topY = KB_HEIGHT + Math.min(dt1, LOOKAHEAD) * pps;
      if (topY <= bottomY) continue;

      // stream particles
      const rate = isActive ? SPAWN_RATE_ACTIVE : SPAWN_RATE_IDLE;
      for (let i = 0; i < rate; i++) {
        const p = this.getParticle();
        if (!p) return;

        p.x = k.x + Math.random() * k.w;
        p.y = bottomY + Math.random() * (topY - bottomY);
        p.z = (Math.random() - 0.5) * 2;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = -pps * 0.02;
        p.vz = 0;
        p.gravity = 0;
        p.size = (PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN)) * dpr;
        p.life = PARTICLE_LIFE_MIN + Math.random() * (PARTICLE_LIFE_MAX - PARTICLE_LIFE_MIN);
        p.maxLife = p.life;
        p.alpha = 1;

        if (isActive) {
          p.r = Math.min(1, color.r * 1.5);
          p.g = Math.min(1, color.g * 1.5);
          p.b = Math.min(1, color.b * 1.5);
          p.size *= 1.3;
        } else {
          p.r = color.r;
          p.g = color.g;
          p.b = color.b;
        }
      }

      // splash burst on note hit
      if (isActive && !note._splashed) {
        note._splashed = true;
        for (let i = 0; i < SPLASH_COUNT; i++) {
          const p = this.getParticle();
          if (!p) return;

          const angle = Math.random() * Math.PI;
          const speed = SPLASH_SPEED_MIN + Math.random() * (SPLASH_SPEED_MAX - SPLASH_SPEED_MIN);

          p.x = k.x + k.w / 2 + (Math.random() - 0.5) * k.w;
          p.y = KB_HEIGHT;
          p.z = (Math.random() - 0.5) * 5;
          p.vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
          p.vy = Math.sin(angle) * speed;
          p.vz = (Math.random() - 0.5) * 20;
          p.gravity = -80;
          p.r = Math.min(1, color.r * 2);
          p.g = Math.min(1, color.g * 2);
          p.b = Math.min(1, color.b * 2);
          p.size = (4 + Math.random() * 6) * dpr;
          p.life = 0.4 + Math.random() * 0.5;
          p.maxLife = p.life;
          p.alpha = 1;
        }
      }
    }
  }

  // BUFFER SYNC & KEYBOARD UPDATE
  syncParticleBuffer() {
    const pos = this.particleGeometry.attributes.position.array;
    const col = this.particleGeometry.attributes.aColor.array;
    const sizes = this.particleGeometry.attributes.aSize.array;
    const alphas = this.particleGeometry.attributes.aAlpha.array;

    let idx = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;

      pos[idx * 3] = p.x;
      pos[idx * 3 + 1] = p.y;
      pos[idx * 3 + 2] = p.z;

      let cr = p.r, cg = p.g, cb = p.b;
      let sz = p.size, al = p.alpha;
      if (this._mouseOnCanvas) {
        const dx = p.x - this._mouseX;
        const dy = p.y - this._mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_HOVER_RADIUS) {
          const t = 1 - dist / MOUSE_HOVER_RADIUS;
          const blend = t * t * (3 - 2 * t);
          cr += (MOUSE_HOVER_COLOR.r - cr) * blend;
          cg += (MOUSE_HOVER_COLOR.g - cg) * blend;
          cb += (MOUSE_HOVER_COLOR.b - cb) * blend;
          sz *= 1 + blend * 0.5;
          al = Math.min(1, al + blend * 0.3);
        }
      }
      col[idx * 3] = cr;
      col[idx * 3 + 1] = cg;
      col[idx * 3 + 2] = cb;
      sizes[idx] = sz;
      alphas[idx] = al;
      idx++;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.aColor.needsUpdate = true;
    this.particleGeometry.attributes.aSize.needsUpdate = true;
    this.particleGeometry.attributes.aAlpha.needsUpdate = true;
    this.particleGeometry.setDrawRange(0, idx);
  }

  updateKeyboard(activeNotes) {
    for (let n = this.minNote; n <= this.maxNote; n++) {
      const km = this.keyMeshes[n];
      if (!km) continue;

      if (activeNotes.has(n)) {
        const color = noteColor(n);
        km.mat.color.copy(color);
        km.mat.opacity = km.isBlack ? KB_ACTIVE_OPACITY_BLACK : KB_ACTIVE_OPACITY_WHITE;
      } else {
        km.mat.color.setHex(km.isBlack ? KB_BLACK_INACTIVE_COLOR : KB_WHITE_INACTIVE_COLOR);
        km.mat.opacity = km.isBlack ? KB_BLACK_INACTIVE_OPACITY : KB_WHITE_INACTIVE_OPACITY;
      }
    }
  }
}

// INITIALIZE
function initVisualizer() {
  if (document.getElementById('piano-visualizer')) {
    new PianoVisualizer('piano-visualizer', 'assets/midi.mid');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVisualizer);
} else {
  initVisualizer();
}
