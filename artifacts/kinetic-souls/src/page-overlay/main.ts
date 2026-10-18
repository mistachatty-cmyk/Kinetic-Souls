/** Kinetic Souls page mode: momentum combat over the live site. The site DOM is only measured. */
type Outcome = { ok: true } | { ok: false; reason: string };
type Target = { element: Element; hp: number; gone: boolean; seed: number };
type Orb = { x: number; y: number; vx: number; vy: number; life: number };
type Enemy = { x: number; y: number; vx: number; vy: number; hp: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const SCALE = 4;
const MAX_TARGETS = 240;
const MAX_ENEMIES = 12;
const HOSTILE_HOST = /(^|\.)(bank|chase|paypal|stripe|health|mychart|gov)(\.|$)/i;
const CONTROLS = new Set(["a", "d", "w", "s", "j", "k", " ", "arrowleft", "arrowright", "arrowup", "shift", "escape"]);

function sensitivePage(): boolean {
  if (HOSTILE_HOST.test(location.hostname)) return true;
  if (/\b(login|sign-in|signin|checkout|payment|billing|account\/security)\b/i.test(location.pathname)) return true;
  return !!document.querySelector('input[type="password"],input[autocomplete="cc-number"],input[name*="card" i]');
}

function scanTargets(): Target[] {
  const result: Target[] = [];
  const seen = new Set<Element>();
  for (const element of document.querySelectorAll('h1,h2,h3,p,img,video,canvas,button,a,li,blockquote')) {
    if (result.length >= MAX_TARGETS) break;
    if (seen.has(element) || element.closest('form,[contenteditable="true"],[data-kinetic-page-root]')) continue;
    if (element.matches('input,textarea,select') || element.closest('input,textarea,select')) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.1) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 18 || rect.height < 12 || rect.width > 900 || rect.height > 500) continue;
    if (rect.bottom < -200 || rect.top > innerHeight + 1200) continue;
    seen.add(element);
    result.push({ element, hp: element.matches('img,video,canvas,h1,h2') ? 2 : 1, gone: false, seed: result.length * 71 });
  }
  return result;
}

class PageArena {
  private root: HTMLDivElement | null = null;
  private fx: HTMLCanvasElement | null = null;
  private actors: HTMLCanvasElement | null = null;
  private hud: HTMLElement | null = null;
  private result: HTMLElement | null = null;
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private spawnClock = 0;
  private fireClock = 0;
  private hurtClock = 0;
  private dashClock = 0;
  private paused = false;
  private complete = false;
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0 };
  private targets: Target[] = [];
  private orbs: Orb[] = [];
  private enemies: Enemy[] = [];
  private sparks: Spark[] = [];
  private player = { x: 100, y: 100, vx: 0, vy: 0, hp: 100, facing: 1 };
  private goal = 5;
  private broken = 0;
  private kills = 0;
  private score = 0;
  private scrollStart = { x: 0, y: 0 };
  private runId = '';

  get isRunning(): boolean { return this.root !== null; }

  start(): Outcome {
    if (this.root) return { ok: true };
    if (sensitivePage()) return { ok: false, reason: 'This page has a sign-in, payment, or sensitive form.' };
    if (!matchMedia('(any-pointer: fine)').matches) return { ok: false, reason: 'This page mode needs a keyboard and pointer.' };
    this.targets = scanTargets();
    if (!this.targets.length) return { ok: false, reason: 'There are no suitable page elements to break here.' };
    this.goal = Math.min(8, Math.max(3, Math.ceil(this.targets.length * 0.15)));
    this.scrollStart = { x: scrollX, y: scrollY };
    this.runId = crypto.randomUUID();
    this.elapsed = this.spawnClock = this.fireClock = this.hurtClock = this.dashClock = 0;
    this.paused = this.complete = false;
    this.broken = this.kills = this.score = 0;
    this.orbs = []; this.enemies = []; this.sparks = []; this.keys.clear();
    this.player = { x: innerWidth * 0.3, y: innerHeight * 0.55, vx: 0, vy: 0, hp: 100, facing: 1 };
    this.pointer = { x: innerWidth * 0.65, y: innerHeight * 0.5 };

    const root = document.createElement('div');
    root.dataset.kineticPageRoot = '';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;isolation:isolate';
    const shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial}.layer{position:fixed;inset:0;overflow:hidden;font:12px/1.35 ui-monospace,Consolas,monospace;color:#f4f8ff}
      canvas{position:fixed;inset:0;width:100vw;height:100vh}.actors{image-rendering:pixelated;image-rendering:crisp-edges;cursor:crosshair}
      .hud{position:fixed;top:12px;left:12px;right:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none}
      .pill{padding:8px 10px;border:1px solid #72e9ff88;background:#081320e8;box-shadow:0 2px 0 #001;color:#dffaff}
      .brand{font-weight:900;letter-spacing:.12em;color:#83f5ff}.bar{width:110px;height:8px;border:1px solid #9ef;background:#243049;display:inline-block;vertical-align:middle}
      .bar i{display:block;height:100%;background:#5fe7a2}.hud button,.end button{pointer-events:auto;border:1px solid #b2f9ff;background:#172b3b;color:#f4ffff;padding:8px 12px;font:700 12px ui-monospace,Consolas,monospace;cursor:pointer}
      .hint{position:fixed;bottom:12px;right:12px;width:max-content;max-width:calc(100vw - 24px);pointer-events:none}
      .end{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);min-width:min(360px,85vw);padding:24px;background:#06101df2;border:2px solid #76eaff;box-shadow:0 0 0 100vmax #0008;text-align:center}
      .end h2{font:900 28px Impact,system-ui,sans-serif;letter-spacing:.04em;margin:0 0 12px;color:#fff}.end p{line-height:1.5}
      .end-actions{display:flex;justify-content:center;gap:8px;margin-top:16px}
      @media(prefers-reduced-motion:reduce){.pill,.end{transition:none!important}}
    </style><div class="layer"><canvas class="damage"></canvas><canvas class="actors"></canvas>
      <div class="hud"><span class="pill brand">KINETIC SOULS / PAGE ARENA</span><span class="pill stats"></span>
      <span class="pill">SOUL <span class="bar"><i></i></span></span><button class="pause" type="button">PAUSE</button><button class="leave" type="button">RESTORE PAGE</button></div>
      <span class="pill hint">A/D move · W/Space jump · Shift dash · click or J/K fire · wheel scrolls page · Esc pause</span>
      <div class="end" hidden><h2></h2><p></p><div class="end-actions"><button class="again" type="button">KEEP BREAKING</button><button class="leave" type="button">RESTORE PAGE</button></div></div>
    </div>`;
    this.root = root;
    this.fx = shadow.querySelector<HTMLCanvasElement>('.damage');
    this.actors = shadow.querySelector<HTMLCanvasElement>('.actors');
    this.hud = shadow.querySelector<HTMLElement>('.stats');
    this.result = shadow.querySelector<HTMLElement>('.end');
    this.actors?.addEventListener('pointermove', this.onPointer);
    this.actors?.addEventListener('pointerdown', this.onFire);
    shadow.querySelector('.pause')?.addEventListener('click', this.togglePause);
    shadow.querySelectorAll('.leave').forEach((button) => button.addEventListener('click', () => this.stop()));
    shadow.querySelector('.again')?.addEventListener('click', () => {
      this.goal += 5; this.complete = false; this.paused = false;
      this.player.hp = 100; this.enemies = []; this.orbs = [];
      this.runId = crypto.randomUUID();
      if (this.result) this.result.hidden = true;
    });
    addEventListener('keydown', this.onKeyDown, true);
    addEventListener('keyup', this.onKeyUp, true);
    addEventListener('resize', this.resize);
    addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    document.body.appendChild(root);
    this.resize();
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
    return { ok: true };
  }

  stop(): void {
    if (!this.root) return;
    cancelAnimationFrame(this.frame);
    removeEventListener('keydown', this.onKeyDown, true);
    removeEventListener('keyup', this.onKeyUp, true);
    removeEventListener('resize', this.resize);
    removeEventListener('wheel', this.onWheel, true);
    this.actors?.removeEventListener('pointermove', this.onPointer);
    this.actors?.removeEventListener('pointerdown', this.onFire);
    this.root.remove();
    this.root = null; this.fx = null; this.actors = null; this.hud = null; this.result = null;
    this.keys.clear();
    scrollTo(this.scrollStart.x, this.scrollStart.y);
  }

  private resize = () => {
    if (!this.fx || !this.actors) return;
    this.fx.width = innerWidth; this.fx.height = innerHeight;
    this.actors.width = Math.ceil(innerWidth / SCALE); this.actors.height = Math.ceil(innerHeight / SCALE);
    this.player.x = Math.min(innerWidth - 20, this.player.x);
    this.player.y = Math.min(innerHeight - 42, this.player.y);
  };
  private onPointer = (event: PointerEvent) => { this.pointer = { x: event.clientX, y: event.clientY }; };
  private onFire = (event: PointerEvent) => { event.preventDefault(); this.pointer = { x: event.clientX, y: event.clientY }; this.fire(); };
  private onWheel = (event: WheelEvent) => { if (!this.root) return; event.preventDefault(); scrollBy(0, Math.sign(event.deltaY) * Math.min(300, Math.abs(event.deltaY))); };
  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.root) return;
    const key = event.key.toLowerCase();
    if (CONTROLS.has(key)) event.preventDefault();
    if (key === 'escape' && !event.repeat) { this.togglePause(); return; }
    if (key === 'j' || key === 'k') { if (!event.repeat) this.fire(); return; }
    if (key === 'shift' && !event.repeat && this.dashClock <= 0 && !this.paused) {
      this.player.vx = this.player.facing * 17;
      this.dashClock = 1.2;
      this.burst(this.player.x, this.player.y, '#81faff', 12);
    }
    this.keys.add(key);
  };
  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private togglePause = () => {
    if (this.complete || !this.root) return;
    this.paused = !this.paused;
    const button = this.root.shadowRoot?.querySelector<HTMLButtonElement>('.pause');
    if (button) button.textContent = this.paused ? 'RESUME' : 'PAUSE';
  };

  private fire(): void {
    if (!this.root || this.paused || this.complete || this.fireClock > 0) return;
    let dx = this.pointer.x - this.player.x, dy = this.pointer.y - this.player.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    this.orbs.push({ x: this.player.x + dx * 18, y: this.player.y + dy * 18, vx: dx * 820, vy: dy * 820, life: 1 });
    this.fireClock = 0.14;
    this.burst(this.player.x + dx * 16, this.player.y + dy * 16, '#83f5ff', 5);
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count && this.sparks.length < 160; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 200;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + Math.random() * 0.35, color });
    }
  }

  private hitTarget(x: number, y: number): boolean {
    for (const target of this.targets) {
      if (target.gone) continue;
      const rect = target.element.getBoundingClientRect();
      if (x < rect.left - 5 || x > rect.right + 5 || y < rect.top - 5 || y > rect.bottom + 5) continue;
      target.hp--;
      this.burst(x, y, '#78efff', 8);
      if (target.hp <= 0) { target.gone = true; this.broken++; this.score += 100; }
      return true;
    }
    return false;
  }

  private finish(success: boolean): void {
    this.complete = true;
    const title = this.result?.querySelector('h2');
    const copy = this.result?.querySelector('p');
    if (title) title.textContent = success ? 'PAGE SHATTERED' : 'SOUL DOWN';
    if (copy) copy.textContent = `${this.broken} page elements broken · ${this.kills} enemies defeated · ${this.score} points. The site restores when you leave.`;
    if (this.result) this.result.hidden = false;
    dispatchEvent(new CustomEvent('lok:demoday:page-run', { detail: {
      version: 1, gameKey: 'kinetic-souls', runId: this.runId, score: this.score,
      xp: Math.min(500, this.broken * 10 + this.kills * 5), completedAt: new Date().toISOString(),
    } }));
  }

  private tick = (now: number) => {
    if (!this.root) return;
    const dt = Math.min(0.04, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused && !this.complete) this.update(dt);
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    this.elapsed += dt;
    this.fireClock = Math.max(0, this.fireClock - dt);
    this.hurtClock = Math.max(0, this.hurtClock - dt);
    this.dashClock = Math.max(0, this.dashClock - dt);
    const player = this.player;
    const direction = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    player.vx += direction * 1250 * dt;
    player.vx *= Math.pow(0.86, dt * 60);
    player.vx = Math.max(-540, Math.min(540, player.vx));
    if (direction) player.facing = direction;
    const floor = innerHeight - 42;
    if ((this.keys.has('w') || this.keys.has(' ') || this.keys.has('arrowup')) && player.y >= floor - 2) player.vy = -540;
    player.vy += 1180 * dt;
    player.x = Math.min(innerWidth - 18, Math.max(18, player.x + player.vx * dt));
    player.y = Math.min(floor, Math.max(24, player.y + player.vy * dt));
    if (player.y === floor) player.vy = 0;

    this.spawnClock += dt;
    if (this.spawnClock >= 2.1 && this.enemies.length < MAX_ENEMIES) {
      this.spawnClock = 0;
      const fromLeft = Math.random() < 0.5;
      this.enemies.push({ x: fromLeft ? -20 : innerWidth + 20, y: floor - Math.random() * 130,
        vx: fromLeft ? 70 : -70, vy: 0, hp: 2 });
    }
    for (const enemy of this.enemies) {
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.vx = (enemy.vx + dx / distance * 320 * dt) * Math.pow(0.985, dt * 60);
      enemy.vy = (enemy.vy + dy / distance * 320 * dt) * Math.pow(0.985, dt * 60);
      enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt;
      if (distance < 28) {
        if (this.dashClock > 0.9) { enemy.hp = 0; this.burst(enemy.x, enemy.y, '#ff6a98', 12); }
        else if (this.hurtClock <= 0) { player.hp = Math.max(0, player.hp - 12); this.hurtClock = 0.7; this.burst(player.x, player.y, '#ff6a98', 10); }
      }
    }
    for (const orb of this.orbs) {
      orb.x += orb.vx * dt; orb.y += orb.vy * dt; orb.life -= dt;
      for (const enemy of this.enemies) {
        if (enemy.hp > 0 && Math.hypot(enemy.x - orb.x, enemy.y - orb.y) < 20) {
          enemy.hp--; orb.life = 0; this.burst(orb.x, orb.y, '#ffbd73', 8); break;
        }
      }
      if (orb.life > 0 && this.hitTarget(orb.x, orb.y)) orb.life = 0;
    }
    this.orbs = this.orbs.filter((orb) => orb.life > 0 && orb.x > -20 && orb.x < innerWidth + 20 && orb.y > -20 && orb.y < innerHeight + 20);
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    this.kills += before - this.enemies.length;
    this.score += (before - this.enemies.length) * 25;
    for (const spark of this.sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += 220 * dt; spark.life -= dt; }
    this.sparks = this.sparks.filter((spark) => spark.life > 0);
    if (this.broken >= this.goal) this.finish(true);
    else if (player.hp <= 0) this.finish(false);
  }

  private draw(): void {
    if (!this.fx || !this.actors) return;
    const damage = this.fx.getContext('2d'), actors = this.actors.getContext('2d');
    if (!damage || !actors) return;
    damage.clearRect(0, 0, this.fx.width, this.fx.height);
    for (const target of this.targets) {
      if (!target.gone) continue;
      const rect = target.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      damage.fillStyle = '#07101ced';
      damage.fillRect(rect.left, rect.top, rect.width, rect.height);
      damage.strokeStyle = '#79f1ff'; damage.lineWidth = 2;
      damage.strokeRect(rect.left, rect.top, rect.width, rect.height);
      for (let i = 0; i < 12; i++) {
        const x = rect.left + (target.seed * (i + 3) % Math.max(1, rect.width));
        const y = rect.top + (target.seed * (i + 11) % Math.max(1, rect.height));
        damage.fillStyle = i % 2 ? '#67e9ff' : '#2e7998';
        damage.fillRect(x, y, 4 + i % 4, 4 + i % 3);
      }
    }
    actors.clearRect(0, 0, this.actors.width, this.actors.height);
    actors.save(); actors.scale(1 / SCALE, 1 / SCALE);
    for (const spark of this.sparks) { actors.fillStyle = spark.color; actors.fillRect(spark.x, spark.y, 5, 5); }
    for (const orb of this.orbs) { actors.fillStyle = '#d5faff'; actors.fillRect(orb.x - 6, orb.y - 6, 12, 12); actors.fillStyle = '#39b8e4'; actors.fillRect(orb.x - 3, orb.y - 3, 6, 6); }
    for (const enemy of this.enemies) {
      actors.fillStyle = '#ef5d8f'; actors.fillRect(enemy.x - 12, enemy.y - 12, 24, 24);
      actors.fillStyle = '#25122e'; actors.fillRect(enemy.x - 5, enemy.y - 3, 4, 4); actors.fillRect(enemy.x + 3, enemy.y - 3, 4, 4);
    }
    const p = this.player;
    actors.fillStyle = this.hurtClock > 0 ? '#fff' : '#70f3d3';
    actors.fillRect(p.x - 14, p.y - 14, 28, 28);
    actors.fillStyle = '#113149'; actors.fillRect(p.x + p.facing * 3 - 3, p.y - 4, 6, 6);
    actors.fillStyle = '#bafaff'; actors.fillRect(p.x + p.facing * 13 - 2, p.y + 2, 14 * p.facing, 5);
    actors.restore();
    if (this.hud) this.hud.textContent = `${this.broken}/${this.goal} PAGE TARGETS · ${this.kills} K.O. · ${this.score} PTS`;
    const hp = this.root?.shadowRoot?.querySelector<HTMLElement>('.bar i');
    if (hp) hp.style.width = `${p.hp}%`;
  }
}

interface PageApi { start(): Outcome; stop(): void; isRunning(): boolean }
const pageWindow = window as Window & { KineticSoulsPage?: PageApi };
if (!pageWindow.KineticSoulsPage) {
  const arena = new PageArena();
  pageWindow.KineticSoulsPage = { start: () => arena.start(), stop: () => arena.stop(), isRunning: () => arena.isRunning };
}
const current = document.currentScript;
if (current instanceof HTMLScriptElement && current.dataset.autostart !== undefined) pageWindow.KineticSoulsPage?.start();
