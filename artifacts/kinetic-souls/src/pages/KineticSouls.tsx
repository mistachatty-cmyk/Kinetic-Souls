import { useEffect, useRef, useCallback, useState } from "react";

const ARENA_W = 900;
const ARENA_H = 560;
const CHAR_RADIUS = 14;
const MAX_HP = 20;
const SPAWN_SPEED = 2.8;
const BOT_MIN_INTERVAL = 2000;
const BOT_MAX_INTERVAL = 4000;
const SCOREBOARD_H = 60;
const GRID_CELL_SIZE = 60;

type GameMode = "timer" | "score" | "horde" | "infection";
type OpponentMode = "pvp" | "bot" | "ffa";
type ThemeMode = "classic" | "neon" | "gameboy" | "abyss" | "runesite" | "gsix";
type LokModifier = "none" | "sudden_death" | "titans";
type CameraMode = "static" | "dynamic" | "action";
type WeaponStyle = "standard" | "roulette";
type Environment = "none" | "ice" | "blackhole" | "lava";
type ScreenState = "menu" | "lok_menu" | "game" | "over";
type WeaponType = "standard" | "dagger" | "spear" | "hammer";

interface GameState {
  mode: GameMode; opponent: OpponentMode; theme: ThemeMode; modifier: LokModifier; camera: CameraMode;
  weaponStyle: WeaponStyle; environment: Environment;
  p1Score: number; p2Score: number; timeLeft: number; scoreLimit: number;
  running: boolean; over: boolean; paused: boolean; p1Auto: boolean; devMode: boolean; winner: string;
  hitPause: number; shakeFrames: number; stats: { maxChars: number; totalDmg: number; };
  juice: boolean; hud: boolean; trails: boolean; ads: boolean; crtFilter: boolean; aiMagnetic: boolean; handOfGod: boolean;
  optCache: boolean; optDelta: boolean; optGravity: boolean; optSmartSpawn: boolean; optGrid: boolean; optPool: boolean;
  actionCamTeam: 1 | 2 | 3 | 4; actionCamIndex: number; draggingId: number | null;
}

interface Part { ox: number; oy: number; r: number; type: "head" | "body" | "arm" | "leg"; }
interface TrailFrame { x: number; y: number; angle: number; }
interface Character {
  id: number; team: 1 | 2 | 3 | 4; x: number; y: number; vx: number; vy: number;
  angle: number; angularV: number; hp: number; maxHp: number; flashFrames: number; dead: boolean;
  parts: Part[]; trail: TrailFrame[]; scale: number; weapon: WeaponType;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; active: boolean; }
interface Ghost { x: number; y: number; team: 1 | 2 | 3 | 4; vy: number; life: number; maxLife: number; scored: boolean; active: boolean; }
interface FloatingText { x: number; y: number; text: string; color: string; life: number; maxLife: number; vy: number; active: boolean; }
interface KillFeedMsg { text: string; life: number; color: string; active: boolean; }

const BASE_PARTS: Part[] = [
  { ox: 0, oy: -20, r: 7, type: "head" }, { ox: 0, oy: -6, r: 9, type: "body" },
  { ox: -12, oy: -8, r: 5, type: "arm" }, { ox: 12, oy: -8, r: 5, type: "arm" },
  { ox: -6, oy: 6, r: 5, type: "leg" }, { ox: 6, oy: 6, r: 5, type: "leg" },
];

function getPartDamage(type: "head" | "body" | "arm" | "leg"): number {
  if (type === "head") return 5; if (type === "body") return 3; if (type === "arm") return 2; return 1;
}

let charIdCounter = 0;

function spawnCharacter(team: 1 | 2 | 3 | 4, modifier: LokModifier, existingChars: Character[], useSmartSpawn: boolean, usePool: boolean, wStyle: WeaponStyle): Character {
  const scale = modifier === "titans" ? 2.5 : 1;
  let x = ARENA_W / 2, y = SCOREBOARD_H + ARENA_H / 2;

  if (team === 1) { x = 40 * scale; y = SCOREBOARD_H + (40 * scale) + Math.random() * (ARENA_H - 80 * scale); }
  else if (team === 2) { x = ARENA_W - 40 * scale; y = SCOREBOARD_H + (40 * scale) + Math.random() * (ARENA_H - 80 * scale); }
  else if (team === 3) { x = 40 * scale + Math.random() * (ARENA_W - 80 * scale); y = SCOREBOARD_H + 40 * scale; }
  else if (team === 4) { x = 40 * scale + Math.random() * (ARENA_W - 80 * scale); y = SCOREBOARD_H + ARENA_H - 40 * scale; }

  if (useSmartSpawn) {
      for (let attempt = 0; attempt < 5; attempt++) {
          let overlap = false;
          for (const other of existingChars) {
              if (other.dead) continue;
              if (Math.hypot(x - other.x, y - other.y) < (CHAR_RADIUS * scale) + (CHAR_RADIUS * other.scale)) { overlap = true; break; }
          }
          if (!overlap) break;
          x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40;
      }
  }

  let weapon: WeaponType = "standard";
  if (wStyle === "roulette") { const r = Math.random(); weapon = r < 0.25 ? "dagger" : r < 0.5 ? "spear" : r < 0.75 ? "hammer" : "standard"; }

  const angle = Math.random() * Math.PI * 2;
  let speed = (SPAWN_SPEED + Math.random() * 1.5) / (modifier === "titans" ? 1.5 : 1);
  if (weapon === "spear") speed *= 0.7;

  let vx = (Math.random() - 0.5) * speed * 2; let vy = (Math.random() - 0.5) * speed * 2;
  if (team === 1) vx = Math.abs(vx); if (team === 2) vx = -Math.abs(vx);
  if (team === 3) vy = Math.abs(vy); if (team === 4) vy = -Math.abs(vy);

  let angularV = (Math.random() - 0.5) * 0.12;
  if (weapon === "dagger") angularV *= 2; 

  const startingHp = modifier === "sudden_death" ? 1 : (modifier === "titans" ? MAX_HP * 3 : MAX_HP);
  const scaledParts = BASE_PARTS.map(p => ({ ...p, ox: p.ox * scale, oy: p.oy * scale, r: p.r * scale }));

  if (usePool) {
      const deadChar = existingChars.find(c => c.dead);
      if (deadChar) {
          deadChar.team = team; deadChar.x = x; deadChar.y = y; deadChar.vx = vx; deadChar.vy = vy; deadChar.angle = angle; deadChar.angularV = angularV;
          deadChar.hp = startingHp; deadChar.maxHp = startingHp; deadChar.flashFrames = 0; deadChar.dead = false; deadChar.parts = scaledParts; deadChar.trail = []; deadChar.scale = scale; deadChar.weapon = weapon;
          return deadChar;
      }
  }
  return { id: charIdCounter++, team, x, y, vx, vy, angle, angularV, hp: startingHp, maxHp: startingHp, flashFrames: 0, dead: false, parts: scaledParts, trail: [], scale, weapon };
}

function getTeamColor(team: number, theme: ThemeMode): string {
    if (theme === "gameboy") return team === 1 ? "#306230" : "#0f380f";
    if (theme === "runesite") return team === 1 ? "#b12a2a" : team === 2 ? "#2a52b1" : team === 3 ? "#2ab144" : "#b1a82a";
    if (theme === "gsix") return team === 1 ? "#ffaa00" : team === 2 ? "#6644aa" : team === 3 ? "#00ffcc" : "#ff0055";
    if (theme === "abyss") return team === 1 ? "#ff0000" : team === 2 ? "#00aaff" : team === 3 ? "#00ff00" : "#ffff00";
    return team === 1 ? "#ff6655" : team === 2 ? "#5599ff" : team === 3 ? "#55ff55" : "#ffff55";
}

function rotatePoint(ox: number, oy: number, angle: number): [number, number] { return [ox * Math.cos(angle) - oy * Math.sin(angle), ox * Math.sin(angle) + oy * Math.cos(angle)]; }

function getWeaponTip(c: Character): [number, number] { 
    let reach = 30; if(c.weapon === "dagger") reach = 18; else if(c.weapon === "spear") reach = 45;
    const [wx, wy] = rotatePoint(0, -reach * c.scale, c.angle); return [c.x + wx, c.y + wy]; 
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy < (ar + br) * (ar + br); }

function spawnExplosion(x: number, y: number, team: 1 | 2 | 3 | 4, theme: ThemeMode, useGravity: boolean, pool: Particle[], usePool: boolean) {
  const color = getTeamColor(team, theme);
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2; const spd = useGravity ? 2 + Math.random() * 4 : 1.5 + Math.random() * 3;
    const vy = useGravity ? Math.sin(a) * spd - 2 : Math.sin(a) * spd;
    const pColor = Math.random() > 0.4 ? color : (theme === "gameboy" ? "#8bac0f" : "#ffff66");
    const pLife = 40 + Math.random() * 30; const pSize = 2 + Math.random() * 4;
    if (usePool) {
        const deadP = pool.find(p => !p.active);
        if (deadP) { deadP.x = x; deadP.y = y; deadP.vx = Math.cos(a) * spd; deadP.vy = vy; deadP.life = pLife; deadP.maxLife = 70; deadP.color = pColor; deadP.size = pSize; deadP.active = true; continue; }
    }
    pool.push({ x, y, vx: Math.cos(a) * spd, vy: vy, life: pLife, maxLife: 70, color: pColor, size: pSize, active: true });
  }
}

function drawRawChar(ctx: CanvasRenderingContext2D, c: Character, flash: boolean, theme: ThemeMode, devMode: boolean) {
  const scale = c.scale; const team = c.team;
  if (flash) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(255,255,255,0.85)"; }

  if (devMode) {
    ctx.strokeStyle = getTeamColor(team, theme); ctx.lineWidth = 1;
    for (const p of c.parts) { ctx.beginPath(); ctx.arc(p.ox, p.oy, p.r, 0, Math.PI * 2); ctx.stroke(); }
    let wR = 6; if(c.weapon==="dagger") wR=4; else if(c.weapon==="hammer") wR=10;
    const [tipX, tipY] = rotatePoint(0, -(c.weapon === "spear" ? 45 : c.weapon === "dagger" ? 18 : 30) * scale, 0); 
    ctx.strokeStyle = "#00ff00"; ctx.beginPath(); ctx.arc(tipX, tipY, wR * scale, 0, Math.PI * 2); ctx.stroke(); 
  } else if (theme === "abyss") {
    const glowColor = getTeamColor(team, theme);
    for (const p of c.parts) {
      ctx.fillStyle = flash ? "white" : p.type === "head" ? glowColor : "#111111"; 
      if (p.type === "head") { ctx.shadowBlur = 10; ctx.shadowColor = glowColor; } else { ctx.shadowBlur = 0; }
      ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
    }
    drawWeapon(ctx, c.weapon, scale, flash ? "white" : "#ffff00", flash ? "white" : "#ffff00", theme);
  } else {
    let skin = "#ffcc99", dark = "#aa2211";
    if(theme==="gameboy") { skin = "#8bac0f"; dark = team===1?"#0f380f":"#306230"; }
    else if(theme==="runesite") { skin = "#dca878"; dark = team===1?"#5e1515":"#152c5e"; }
    else if(theme==="gsix") { skin = "#ffffff"; dark = team===1?"#aa6600":"#331166"; }
    else { dark = team === 1 ? "#aa2211" : team === 2 ? "#2244aa" : team===3 ? "#22aa22" : "#aaaa22"; }
    const color = getTeamColor(team, theme);

    if (theme === "neon") {
        ctx.strokeStyle = flash ? "white" : color; ctx.lineWidth = 2 * scale; ctx.shadowBlur = flash ? 15 : 8; ctx.shadowColor = flash ? "white" : color;
        for (const p of c.parts) ctx.strokeRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
    } else {
        for (const p of c.parts) {
          ctx.fillStyle = flash ? "white" : p.type === "head" ? skin : p.type === "body" ? color : p.type === "arm" ? dark : color;
          ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
          if (!flash && p.type === "head") { 
             ctx.fillStyle = theme==="gsix"?"#111":theme==="gameboy"?"#0f380f":"#222"; 
             ctx.fillRect(p.ox - 3 * scale, p.oy - 2 * scale, 2 * scale, 3 * scale); ctx.fillRect(p.ox + 1 * scale, p.oy - 2 * scale, 2 * scale, 3 * scale); 
          }
        }
    }
    let wCol1 = flash ? "white" : "#ffee44"; let wCol2 = flash ? "white" : "#aaaaaa";
    if(theme==="gameboy"){ wCol1=flash?"#9bbc0f":"#9bbc0f"; wCol2=flash?"#9bbc0f":"#306230";}
    if(theme==="runesite"){ wCol1=flash?"white":"#aaaaaa"; wCol2=flash?"white":"#555555";}
    if(theme==="gsix"){ wCol1=flash?"white":"#ffdd00"; wCol2=flash?"white":"#ccaa00";}
    if(theme==="neon"){ wCol1=flash?"white":"#ffff00"; wCol2="transparent"; }
    drawWeapon(ctx, c.weapon, scale, wCol1, wCol2, theme);
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, type: WeaponType, scale: number, c1: string, c2: string, theme: ThemeMode) {
    if (theme === "neon") {
       ctx.strokeStyle = c1; ctx.beginPath();
       if (type==="dagger") { ctx.moveTo(0, -20*scale); ctx.lineTo(0,-28*scale); }
       else if (type==="spear") { ctx.moveTo(0, -26*scale); ctx.lineTo(0,-58*scale); }
       else { ctx.moveTo(0, -26*scale); ctx.lineTo(0,-46*scale); if(type==="hammer") { ctx.moveTo(-6*scale, -42*scale); ctx.lineTo(6*scale, -42*scale); }}
       ctx.stroke(); return;
    }
    ctx.fillStyle = c2; 
    if (type==="dagger") { ctx.fillRect(-2*scale, -26*scale, 4*scale, 6*scale); ctx.fillStyle = c1; ctx.fillRect(-2*scale, -30*scale, 4*scale, 4*scale); }
    else if (type==="spear") { ctx.fillRect(-2*scale, -46*scale, 4*scale, 26*scale); ctx.fillStyle = c1; ctx.fillRect(-3*scale, -58*scale, 6*scale, 12*scale); }
    else if (type==="hammer") { ctx.fillRect(-2*scale, -38*scale, 4*scale, 18*scale); ctx.fillStyle = c1; ctx.fillRect(-8*scale, -44*scale, 16*scale, 10*scale); }
    else { ctx.fillRect(-3*scale, -46*scale, 6*scale, 8*scale); ctx.fillStyle = c1; ctx.fillRect(-2*scale, -38*scale, 4*scale, 12*scale); }
}

const spriteCache: Record<string, HTMLCanvasElement> = {};
function getCharSprite(c: Character, flash: boolean, theme: ThemeMode, devMode: boolean): HTMLCanvasElement {
  const key = `${c.team}-${c.scale}-${c.weapon}-${flash}-${theme}-${devMode}`;
  if (spriteCache[key]) return spriteCache[key];
  const cvs = document.createElement("canvas"); const size = 160 * Math.max(1, c.scale); cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext("2d"); if (!ctx) return cvs;
  ctx.translate(size / 2, size / 2);
  drawRawChar(ctx, c, flash, theme, devMode);
  spriteCache[key] = cvs; return cvs;
}

export default function KineticSouls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const camRef = useRef({ x: ARENA_W / 2, y: SCOREBOARD_H + ARENA_H / 2, zoom: 1 });
  const keysRef = useRef<Set<string>>(new Set());

  const [showLiveMenu, setShowLiveMenu] = useState(false);
  const [showMobileUI, setShowMobileUI] = useState(false);
  const [, setTick] = useState(0);
  const joyRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });

  const stateRef = useRef<GameState>({
    mode: "timer", opponent: "pvp", theme: "classic", modifier: "none", camera: "static", weaponStyle: "standard", environment: "none",
    p1Score: 0, p2Score: 0, timeLeft: 120, scoreLimit: 10, running: false, over: false, paused: false, p1Auto: false, devMode: false, winner: "",
    hitPause: 0, shakeFrames: 0, stats: { maxChars: 0, totalDmg: 0 },
    juice: false, hud: false, trails: false, ads: false, crtFilter: false, aiMagnetic: false, handOfGod: false,
    optCache: true, optDelta: true, optGravity: true, optSmartSpawn: true, optGrid: true, optPool: true,
    actionCamTeam: 1, actionCamIndex: 0, draggingId: null
  });

  const refs = { mode: useRef<GameMode>("timer"), opp: useRef<OpponentMode>("pvp"), theme: useRef<ThemeMode>("classic"), mod: useRef<LokModifier>("none"), cam: useRef<CameraMode>("static"), env: useRef<Environment>("none"), wep: useRef<WeaponStyle>("standard") };
  const screenRef = useRef<ScreenState>("menu");
  const dataRef = { chars: useRef<Character[]>([]), parts: useRef<Particle[]>([]), ghosts: useRef<Ghost[]>([]), texts: useRef<FloatingText[]>([]), feed: useRef<KillFeedMsg[]>([]) };
  const timeRef = { raf: useRef(0), last: useRef(0), timerAcc: useRef(0), botTimer: useRef(0), botNext: useRef(2500), p1Timer: useRef(0) };

  const renderChar = useCallback((ctx: CanvasRenderingContext2D, c: Character, flash: boolean, alpha: number = 1, theme: ThemeMode, devMode: boolean, useCache: boolean) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    if (useCache && !devMode) { const sprite = getCharSprite(c, flash, theme, devMode); ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2); } 
    else { drawRawChar(ctx, c, flash, theme, devMode); }
    ctx.restore();
  }, []);

  const drawHpBar = useCallback((ctx: CanvasRenderingContext2D, c: Character, mod: LokModifier, dev: boolean, theme: ThemeMode) => {
    if (mod === "sudden_death" || dev || theme === "abyss") return; 
    const barW = 28 * c.scale; const barH = 4 * c.scale; const bx = c.x - barW / 2; const by = c.y - (38 * c.scale);
    ctx.fillStyle = theme === "gameboy" ? "#0f380f" : "#333"; ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = theme === "gameboy" ? "#9bbc0f" : (theme === "runesite" ? "#44cc44" : "#22cc22"); ctx.fillRect(bx, by, (barW * Math.max(0, c.hp)) / c.maxHp, barH);
  }, []);

  const drawGhost = useCallback((ctx: CanvasRenderingContext2D, g: Ghost, dev: boolean, theme: ThemeMode) => {
    if (dev) return; 
    ctx.save(); ctx.globalAlpha = g.life / g.maxLife; ctx.fillStyle = getTeamColor(g.team, theme);
    ctx.beginPath(); ctx.arc(g.x, g.y, 10, Math.PI, 0, false); ctx.lineTo(g.x + 10, g.y + 10); ctx.lineTo(g.x + 5, g.y + 5); ctx.lineTo(g.x, g.y + 10); ctx.lineTo(g.x - 5, g.y + 5); ctx.lineTo(g.x - 10, g.y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme === "gameboy" ? "#8bac0f" : "#333"; ctx.beginPath(); ctx.arc(g.x - 3, g.y - 2, 2, 0, Math.PI * 2); ctx.arc(g.x + 3, g.y - 2, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }, []);

  const endGame = useCallback(() => {
    const st = stateRef.current; let winner = "";
    if (st.mode === "horde" || st.mode === "infection") winner = st.p1Score >= 50 ? "You Survived!" : "The Horde Consumed You";
    else { if (st.p1Score > st.p2Score) winner = "Player 1 Wins!"; else if (st.p2Score > st.p1Score) winner = "The Enemy Wins!"; else winner = "It's a Draw!"; }
    stateRef.current = { ...st, running: false, over: true, paused: false, winner, draggingId: null }; screenRef.current = "over";
  }, []);

  const startGame = useCallback(() => {
    charIdCounter = 0; 
    if(!stateRef.current.optPool) { dataRef.chars.current = []; dataRef.parts.current = []; dataRef.ghosts.current = []; dataRef.texts.current = []; dataRef.feed.current = []; }
    else { dataRef.chars.current.forEach(c => c.dead = true); dataRef.parts.current.forEach(p => p.active = false); dataRef.ghosts.current.forEach(g => g.active = false); dataRef.texts.current.forEach(t => t.active = false); dataRef.feed.current.forEach(f => f.active = false); }

    timeRef.timerAcc.current = 0; timeRef.botTimer.current = 0; timeRef.p1Timer.current = 0; camRef.current = { x: ARENA_W / 2, y: SCOREBOARD_H + ARENA_H / 2, zoom: 1 };

    let limit = refs.mode.current === "score" ? 10 : 0; if (refs.mode.current === "horde" || refs.mode.current === "infection") { limit = 50; refs.opp.current = "bot"; }
    timeRef.botNext.current = BOT_MIN_INTERVAL + Math.random() * (BOT_MAX_INTERVAL - BOT_MIN_INTERVAL);

    stateRef.current.mode = refs.mode.current; stateRef.current.opponent = refs.opp.current; stateRef.current.theme = refs.theme.current; stateRef.current.modifier = refs.mod.current; stateRef.current.camera = refs.cam.current;
    stateRef.current.weaponStyle = refs.wep.current; stateRef.current.environment = refs.env.current;

    stateRef.current = {
      ...stateRef.current, p1Score: 0, p2Score: 0, timeLeft: 120, scoreLimit: limit, running: true, over: false, paused: false, p1Auto: false, winner: "",
      hitPause: 0, shakeFrames: 0, stats: { maxChars: 0, totalDmg: 0 }, actionCamTeam: 1, actionCamIndex: 0, draggingId: null
    };

    if (refs.mode.current === "infection") {
       dataRef.chars.current.push(spawnCharacter(1, refs.mod.current, dataRef.chars.current, true, stateRef.current.optPool, refs.wep.current));
       for(let i=0; i<15; i++) dataRef.chars.current.push(spawnCharacter(2, refs.mod.current, dataRef.chars.current, true, stateRef.current.optPool, refs.wep.current));
    }

    screenRef.current = "game";
  }, [refs, dataRef, timeRef]);

  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;

    const dtRaw = Math.min(timestamp - timeRef.last.current, 50); timeRef.last.current = timestamp;
    const screen = screenRef.current; const state = stateRef.current;
    const dtScale = state.optDelta ? dtRaw / 16.666 : 1; 

    ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (screen === "menu") { drawMainMenu(ctx, refs.mode.current, refs.opp.current, mouseRef.current, timestamp); } 
    else if (screen === "lok_menu") { drawLokMenu(ctx, refs.mode.current, refs.theme.current, refs.mod.current, refs.cam.current, refs.wep.current, refs.env.current, mouseRef.current, state, timestamp); } 
    else if (screen === "over") { drawGameOver(ctx, state); } 
    else if (screen === "game") {
      let updatePhysics = state.running && !state.paused;
      if (updatePhysics && state.hitPause > 0 && state.juice) { state.hitPause -= dtRaw; updatePhysics = false; }

      if (updatePhysics) {
        if (state.mode === "timer") { timeRef.timerAcc.current += dtRaw; if (timeRef.timerAcc.current >= 1000) { timeRef.timerAcc.current -= 1000; state.timeLeft -= 1; if (state.timeLeft <= 0) endGame(); } }

        if (state.opponent === "bot" && state.mode !== "infection") {
          timeRef.botTimer.current += dtRaw; let minSpawn = state.mode === "horde" ? 300 : BOT_MIN_INTERVAL; let maxSpawn = state.mode === "horde" ? 800 : BOT_MAX_INTERVAL;
          if (timeRef.botTimer.current >= timeRef.botNext.current) { timeRef.botTimer.current = 0; timeRef.botNext.current = minSpawn + Math.random() * (maxSpawn - minSpawn); 
            const newC = spawnCharacter(2, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle);
            if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
          }
        }
        else if (state.opponent === "ffa") {
          timeRef.botTimer.current += dtRaw;
          if (timeRef.botTimer.current >= timeRef.botNext.current) { timeRef.botTimer.current = 0; timeRef.botNext.current = 800 + Math.random() * 1500; 
            const randomTeam = (Math.floor(Math.random() * 4) + 1) as 1|2|3|4;
            const newC = spawnCharacter(randomTeam, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle);
            if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
          }
        }

        if (state.p1Auto) {
          timeRef.p1Timer.current += dtRaw; if (timeRef.p1Timer.current >= 2000) { timeRef.p1Timer.current = 0; 
            const newC = spawnCharacter(1, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle);
            if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
          }
        }

        const chars = dataRef.chars.current;
        let activeCharCount = 0;

        if (state.handOfGod && state.draggingId !== null && mouseRef.current.isDown) {
            const dc = chars.find(c => c.id === state.draggingId);
            if (dc && !dc.dead) {
                const rect = canvasRef.current!.getBoundingClientRect();
                const rawMx = (mouseRef.current.x - rect.left) * (ARENA_W / rect.width);
                const rawMy = (mouseRef.current.y - rect.top) * ((ARENA_H+SCOREBOARD_H) / rect.height);
                const worldX = (rawMx - ARENA_W/2) / camRef.current.zoom + camRef.current.x;
                const worldY = (rawMy - (SCOREBOARD_H + ARENA_H/2)) / camRef.current.zoom + camRef.current.y;

                dc.vx = (worldX - dc.x) * 0.2 * dtScale; 
                dc.vy = (worldY - dc.y) * 0.2 * dtScale;
                dc.x = worldX; dc.y = worldY;
            } else { state.draggingId = null; }
        }

        for (const c of chars) {
          if (c.dead) continue;
          activeCharCount++;
          c.trail.unshift({ x: c.x, y: c.y, angle: c.angle }); if (c.trail.length > 5) c.trail.pop();

          if (state.draggingId === c.id) continue;

          if (state.environment === "blackhole") {
             const cx = ARENA_W/2; const cy = SCOREBOARD_H + ARENA_H/2;
             c.vx += (cx - c.x) * 0.001 * dtScale; c.vy += (cy - c.y) * 0.001 * dtScale;
          }

          if (state.aiMagnetic) {
              let nearest = Infinity; let target = null;
              for (const e of chars) { if (e.dead || e.team === c.team) continue; const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < nearest) { nearest = d; target = e; } }
              if (target) {
                  const a = Math.atan2(target.y - c.y, target.x - c.x); c.vx += Math.cos(a) * 0.15 * dtScale; c.vy += Math.sin(a) * 0.15 * dtScale;
                  const spd = Math.hypot(c.vx, c.vy); const max = (SPAWN_SPEED + 1.5) * (state.modifier === "titans" ? 0.8 : 1.2);
                  if (spd > max) { c.vx = (c.vx / spd) * max; c.vy = (c.vy / spd) * max; }
              }
          }

          c.x += c.vx * dtScale; c.y += c.vy * dtScale; c.angle += c.angularV * dtScale;
          const bound = (CHAR_RADIUS * c.scale) + 4;

          if (state.environment === "ice") {
             if (c.x < bound) { c.x = bound; c.vx = Math.abs(c.vx); } if (c.x > ARENA_W - bound) { c.x = ARENA_W - bound; c.vx = -Math.abs(c.vx); }
             if (c.y < SCOREBOARD_H + bound) { c.y = SCOREBOARD_H + bound; c.vy = Math.abs(c.vy); } if (c.y > SCOREBOARD_H + ARENA_H - bound) { c.y = SCOREBOARD_H + ARENA_H - bound; c.vy = -Math.abs(c.vy); }
          } else {
             if (c.x < bound) { c.x = bound; c.vx = Math.abs(c.vx) * 0.9; } if (c.x > ARENA_W - bound) { c.x = ARENA_W - bound; c.vx = -Math.abs(c.vx) * 0.9; }
             if (c.y < SCOREBOARD_H + bound) { c.y = SCOREBOARD_H + bound; c.vy = Math.abs(c.vy) * 0.9; } if (c.y > SCOREBOARD_H + ARENA_H - bound) { c.y = SCOREBOARD_H + ARENA_H - bound; c.vy = -Math.abs(c.vy) * 0.9; }
          }

          if (state.environment === "lava" && c.y > SCOREBOARD_H + ARENA_H - (ARENA_H * 0.15)) {
             if (Math.random() < 0.1) { c.hp -= 1; c.flashFrames = 2; }
          }

          if (c.flashFrames > 0) c.flashFrames--;
        }

        if (activeCharCount > state.stats.maxChars) state.stats.maxChars = activeCharCount;

        for (const ft of dataRef.texts.current) { if (!ft.active && state.optPool) continue; ft.y += ft.vy * dtScale; ft.life -= dtScale; if (ft.life <= 0) ft.active = false; }
        if (!state.optPool) dataRef.texts.current = dataRef.texts.current.filter(ft => ft.life > 0);

        for (const msg of dataRef.feed.current) { if (!msg.active && state.optPool) continue; msg.life -= dtScale; if (msg.life <= 0) msg.active = false; }
        if (!state.optPool) dataRef.feed.current = dataRef.feed.current.filter(m => m.life > 0);

        if (state.optGrid) {
            const grid = new Map<string, Character[]>();
            for (const c of chars) { if(c.dead) continue; const cx = Math.floor(c.x / GRID_CELL_SIZE); const cy = Math.floor(c.y / GRID_CELL_SIZE); const key = `${cx},${cy}`; if(!grid.has(key)) grid.set(key, []); grid.get(key)!.push(c); }
            for (const c of chars) {
                if (c.dead) continue; const cx = Math.floor(c.x / GRID_CELL_SIZE); const cy = Math.floor(c.y / GRID_CELL_SIZE);
                for (let ox = -1; ox <= 1; ox++) { for (let oy = -1; oy <= 1; oy++) { const cell = grid.get(`${cx+ox},${cy+oy}`); if (cell) { for (const b of cell) { if (c.id >= b.id || b.dead) continue; processCollision(c, b, state, dtScale); } } } }
            }
        } else {
            for (let i = 0; i < chars.length; i++) { const a = chars[i]; if (a.dead) continue; for (let j = i + 1; j < chars.length; j++) { const b = chars[j]; if (b.dead) continue; processCollision(a, b, state, dtScale); } }
        }

        for (const c of chars) {
          if (!c.dead && c.hp <= 0) {
            c.dead = true; if(state.draggingId === c.id) state.draggingId = null;
            if (state.juice) state.hitPause = 50; 
            if (!state.devMode) spawnExplosion(c.x, c.y, c.team, state.theme, state.optGravity, dataRef.parts.current, state.optPool);

            if (state.mode === "infection" && c.team !== 1) {
                const z = spawnCharacter(1, state.modifier, chars, false, state.optPool, state.weaponStyle);
                z.x = c.x; z.y = c.y; if(!state.optPool || z.id >= charIdCounter-1) chars.push(z);
            }

            if (state.optPool) {
                const deadG = dataRef.ghosts.current.find(g => !g.active);
                if (deadG) { deadG.x = c.x; deadG.y = c.y; deadG.team = c.team; deadG.vy = -1.5; deadG.life = 120; deadG.scored = false; deadG.active = true; }
                else dataRef.ghosts.current.push({ x: c.x, y: c.y, team: c.team, vy: -1.5, life: 120, maxLife: 120, scored: false, active: true });
                const deadF = dataRef.feed.current.find(f => !f.active);
                if (deadF) { deadF.text = `P${c.team} destroyed!`; deadF.color = getTeamColor(c.team, state.theme); deadF.life = 120; deadF.active = true; }
                else dataRef.feed.current.unshift({ text: `P${c.team} destroyed!`, color: getTeamColor(c.team, state.theme), life: 120, active: true });
            } else {
                dataRef.ghosts.current.push({ x: c.x, y: c.y, team: c.team, vy: -1.5, life: 120, maxLife: 120, scored: false, active: true });
                dataRef.feed.current.unshift({ text: `P${c.team} destroyed!`, color: getTeamColor(c.team, state.theme), life: 120, active: true });
            }
          }
        }
        if (!state.optPool) dataRef.chars.current = chars.filter((c) => !c.dead);

        for (const g of dataRef.ghosts.current) {
          if (!g.active && state.optPool) continue;
          if (state.environment === "blackhole") { const cx = ARENA_W/2; const cy = SCOREBOARD_H + ARENA_H/2; g.x += (cx-g.x)*0.02; g.y += (cy-g.y)*0.02; } 
          else { g.y += g.vy * dtScale; }

          g.life -= dtScale;
          if (!g.scored && g.y < SCOREBOARD_H + 20) {
            g.scored = true; 
            if (g.team === 1) state.p2Score++; else state.p1Score++; 
            if (state.mode === "horde" || state.mode === "infection") { if (state.p2Score >= 15 || state.p1Score >= 50) endGame(); }
            else if (state.mode === "score" && (state.p1Score >= state.scoreLimit || state.p2Score >= state.scoreLimit)) endGame();
          }
          if (g.life <= 0) g.active = false;
        }
        if (!state.optPool) dataRef.ghosts.current = dataRef.ghosts.current.filter((g) => g.life > 0);

        for (const p of dataRef.parts.current) { 
          if (!p.active && state.optPool) continue;
          if (state.environment === "blackhole") { const cx = ARENA_W/2; const cy = SCOREBOARD_H + ARENA_H/2; p.vx += (cx-p.x)*0.01; p.vy += (cy-p.y)*0.01; }

          if (state.optGravity && state.environment !== "blackhole") {
             p.vy += 0.2 * dtScale; p.x += p.vx * dtScale; p.y += p.vy * dtScale; p.life -= dtScale; 
             if (p.y > SCOREBOARD_H + ARENA_H - 2) { p.y = SCOREBOARD_H + ARENA_H - 2; p.vy *= -0.5; p.vx *= 0.8; }
          } else { p.x += p.vx * dtScale; p.y += p.vy * dtScale; p.life -= dtScale; }
          if (p.life <= 0) p.active = false;
        }
        if (!state.optPool) dataRef.parts.current = dataRef.parts.current.filter((p) => p.life > 0);
      }

      function processCollision(a: Character, b: Character, st: GameState, dt: number) {
          const dx = b.x - a.x; const dy = b.y - a.y; const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (CHAR_RADIUS * a.scale) + (CHAR_RADIUS * b.scale) + 4;
          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / 2; const nx = dx / dist; const ny = dy / dist;
            a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;

            const fric = st.environment === "ice" ? 1 : 0.85;
            const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (dot > 0) { a.vx -= dot * nx * fric; a.vy -= dot * ny * fric; b.vx += dot * nx * fric; b.vy += dot * ny * fric; }

            if (a.team !== b.team) {
              const processHit = (attacker: Character, victim: Character) => {
                const [wX, wY] = getWeaponTip(attacker);
                let wR = 6; if(attacker.weapon==="dagger") wR=4; else if(attacker.weapon==="hammer") wR=10;
                for (const p of victim.parts) {
                  const [rpX, rpY] = rotatePoint(p.ox, p.oy, victim.angle);
                  if (circlesOverlap(wX, wY, wR * attacker.scale, victim.x + rpX, victim.y + rpY, p.r)) {
                    const dmg = st.modifier === "sudden_death" ? 99 : getPartDamage(p.type);
                    victim.hp -= dmg; victim.flashFrames = 3; st.stats.totalDmg += dmg;
                    if (p.type === "head") st.shakeFrames = 8; 

                    if (attacker.weapon === "hammer") { victim.vx -= nx * 10 * attacker.scale; victim.vy -= ny * 10 * attacker.scale; }

                    if (st.optPool) {
                        const deadT = dataRef.texts.current.find(t => !t.active);
                        if (deadT) { deadT.x = victim.x; deadT.y = victim.y - 20; deadT.text = `-${dmg}`; deadT.color = p.type === "head" ? (st.theme === "gameboy" ? "#0f380f" : "#ff4444") : "#fff"; deadT.life = 30; deadT.vy = -1.5; deadT.active = true; }
                        else dataRef.texts.current.push({ x: victim.x, y: victim.y - 20, text: `-${dmg}`, color: p.type === "head" ? (st.theme === "gameboy" ? "#0f380f" : "#ff4444") : "#fff", life: 30, maxLife: 30, vy: -1.5, active: true });
                    } else { dataRef.texts.current.push({ x: victim.x, y: victim.y - 20, text: `-${dmg}`, color: p.type === "head" ? (st.theme === "gameboy" ? "#0f380f" : "#ff4444") : "#fff", life: 30, maxLife: 30, vy: -1.5, active: true }); }
                    break;
                  }
                }
              };
              processHit(a, b); processHit(b, a);
            }
          }
      }

      let targetX = ARENA_W / 2; let targetY = SCOREBOARD_H + ARENA_H / 2; let targetZoom = 1;
      const aliveChars = dataRef.chars.current.filter(c => !c.dead);
      if (state.camera === "dynamic" && aliveChars.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        aliveChars.forEach(c => { if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x; if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y; });
        minX -= 100; maxX += 100; minY -= 100; maxY += 100; if (minX < 0) minX = 0; if (maxX > ARENA_W) maxX = ARENA_W; if (minY < SCOREBOARD_H) minY = SCOREBOARD_H; if (maxY > SCOREBOARD_H + ARENA_H) maxY = SCOREBOARD_H + ARENA_H;
        const bw = Math.max(maxX - minX, 400); const bh = Math.max(maxY - minY, 250); targetX = minX + bw / 2; targetY = minY + bh / 2; targetZoom = Math.min(ARENA_W / bw, ARENA_H / bh, 2.2);
      } else if (state.camera === "action") {
        const teamChars = aliveChars.filter(c => c.team === state.actionCamTeam);
        if (teamChars.length > 0) {
          if (state.actionCamIndex >= teamChars.length) state.actionCamIndex = 0;
          if (state.actionCamIndex < 0) state.actionCamIndex = teamChars.length - 1;
          const targetChar = teamChars[state.actionCamIndex]; targetX = targetChar.x; targetY = targetChar.y; targetZoom = 2.5;
        } else { targetZoom = 1; }
      }

      camRef.current.x += (targetX - camRef.current.x) * 0.08; camRef.current.y += (targetY - camRef.current.y) * 0.08; camRef.current.zoom += (targetZoom - camRef.current.zoom) * 0.08;

      let bgColor = "#111122";
      if (state.theme === "neon") bgColor = "#050505"; if (state.theme === "gameboy") bgColor = "#9bbc0f"; if (state.theme === "abyss") bgColor = "#000000";
      if (state.theme === "runesite") bgColor = "#2b2620"; if (state.theme === "gsix") bgColor = "#080808";
      ctx.fillStyle = bgColor; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);

      ctx.save();
      if (state.shakeFrames > 0 && !state.paused && state.juice) { ctx.translate(Math.random() * 8 - 4, Math.random() * 8 - 4); state.shakeFrames--; } 
      ctx.beginPath(); ctx.rect(0, SCOREBOARD_H, ARENA_W, ARENA_H); ctx.clip();
      ctx.translate(ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2); ctx.scale(camRef.current.zoom, camRef.current.zoom); ctx.translate(-camRef.current.x, -camRef.current.y);

      if (state.environment === "lava") {
         const lavaGrad = ctx.createLinearGradient(0, SCOREBOARD_H + ARENA_H - (ARENA_H*0.15), 0, SCOREBOARD_H + ARENA_H);
         lavaGrad.addColorStop(0, "rgba(255, 100, 0, 0)"); lavaGrad.addColorStop(1, "rgba(255, 50, 0, 0.8)");
         ctx.fillStyle = lavaGrad; ctx.fillRect(0, SCOREBOARD_H + ARENA_H - (ARENA_H*0.15), ARENA_W, ARENA_H*0.15);
      }
      if (state.environment === "blackhole") {
         ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(ARENA_W/2, SCOREBOARD_H + ARENA_H/2, 40, 0, Math.PI*2); ctx.fill();
         ctx.strokeStyle = "rgba(100,0,255,0.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ARENA_W/2, SCOREBOARD_H + ARENA_H/2, 40 + (timestamp%1000)/10, 0, Math.PI*2); ctx.stroke();
      }

      if (state.theme !== "abyss") {
          let gridColor = "#334"; if (state.theme === "neon") gridColor = "#112244"; if (state.theme === "gameboy") gridColor = "#8bac0f"; if (state.theme === "runesite") gridColor = "#403930"; if (state.theme === "gsix") gridColor = "#221144";
          ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
          for (let gx = 0; gx <= ARENA_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, SCOREBOARD_H); ctx.lineTo(gx, SCOREBOARD_H + ARENA_H); ctx.stroke(); }
          for (let gy = SCOREBOARD_H; gy <= SCOREBOARD_H + ARENA_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(ARENA_W, gy); ctx.stroke(); }
          if (state.environment !== "ice") {
             ctx.strokeStyle = state.theme === "gameboy" ? "#306230" : "#334466"; ctx.lineWidth = 1; ctx.setLineDash([8, 6]);
             ctx.beginPath(); ctx.moveTo(ARENA_W / 2, SCOREBOARD_H); ctx.lineTo(ARENA_W / 2, SCOREBOARD_H + ARENA_H); ctx.stroke(); ctx.setLineDash([]);
          }
      }

      if (state.ads && state.theme !== "abyss") {
          const adTexts = ["★ GSIX PRODUCTIONS ★", "▶ PLAY RUNESITE", "🔒 LOCK APP", "🍔 PARTY BITES CATERING"];
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, 24); ctx.fillRect(0, SCOREBOARD_H + ARENA_H - 24, ARENA_W, 24);
          ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "rgba(255, 255, 255, 0.7)"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
          const offset = (timestamp * 0.05) % 400;
          for(let i=0; i<6; i++) {
             const ax = (i * 400) - offset; ctx.fillText(adTexts[i % adTexts.length], ax, SCOREBOARD_H + 16); ctx.fillText(adTexts[(i+2) % adTexts.length], ax + 200, SCOREBOARD_H + ARENA_H - 8);
          }
      }

      for (const p of dataRef.parts.current) { if (!p.active && state.optPool) continue; ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.globalAlpha = 1; }
      for (const c of dataRef.chars.current) {
        if (c.dead) continue;
        if (!state.devMode && state.trails) { for (let i = 0; i < c.trail.length; i++) renderChar(ctx, { ...c, x: c.trail[i].x, y: c.trail[i].y, angle: c.trail[i].angle }, false, 0.2 * (1 - i / c.trail.length), state.theme, false, state.optCache); }
        renderChar(ctx, c, c.flashFrames > 0, 1, state.theme, state.devMode, state.optCache); drawHpBar(ctx, c, state.modifier, state.devMode, state.theme);
      }
      for (const g of dataRef.ghosts.current) { if (!g.active && state.optPool) continue; drawGhost(ctx, g, state.devMode, state.theme); }

      if (state.hud) { for (const ft of dataRef.texts.current) { if (!ft.active && state.optPool) continue; ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife); ctx.fillStyle = ft.color; ctx.font = "bold 16px monospace"; ctx.fillText(ft.text, ft.x, ft.y); ctx.globalAlpha = 1; } }
      ctx.restore();

      ctx.fillStyle = state.theme === "gameboy" ? "#8bac0f" : (state.theme === "runesite" ? "#1e1a16" : "#0a0a18"); ctx.fillRect(0, 0, ARENA_W, SCOREBOARD_H); 
      ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : "#6644aa"; ctx.lineWidth = 3; ctx.strokeRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);
      ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; 
      ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "#cc4433"; ctx.fillText(`P1: ${state.p1Score}`, 140, 36); 
      ctx.fillStyle = state.theme === "gameboy" ? "#306230" : "#3366cc"; ctx.fillText(`P2: ${state.p2Score}`, ARENA_W - 140, 36);
      ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "#aaaaaa"; ctx.font = "bold 22px monospace"; ctx.fillText("KINETIC SOULS", ARENA_W / 2, 24);
      ctx.font = "12px monospace";
      if (state.mode === "horde" || state.mode === "infection") ctx.fillText(`SURVIVE 50 KILLS | ENEMY KILLS: ${state.p2Score}/15`, ARENA_W / 2, 44); else if (state.mode === "timer") ctx.fillText(`TIME: ${Math.floor(state.timeLeft / 60)}:${(Math.floor(state.timeLeft % 60)).toString().padStart(2, "0")}`, ARENA_W / 2, 44); else ctx.fillText(`FIRST TO ${state.scoreLimit}`, ARENA_W / 2, 44);
      if (state.modifier !== "none" || state.camera !== "static" || state.p1Auto || state.opponent === "ffa") { ctx.fillStyle = state.theme === "gameboy" ? "#306230" : "#ffaa00"; ctx.fillText(`[MOD: ${state.modifier.toUpperCase()} | CAM: ${state.camera.toUpperCase()} | AUTO: ${state.p1Auto ? "ON" : "OFF"}]`, ARENA_W / 2, 55); }

      if (state.hud && state.camera !== "static") {
        const mw = 120, mh = 80, mx = ARENA_W - mw - 10, my = SCOREBOARD_H + ARENA_H - mh - 10;
        ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.8)" : "rgba(0,0,0,0.6)"; ctx.fillRect(mx, my, mw, mh); ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : "#444"; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
        for (const c of dataRef.chars.current) { if(c.dead) continue; ctx.fillStyle = getTeamColor(c.team, state.theme); ctx.beginPath(); ctx.arc(mx + (c.x / ARENA_W) * mw, my + ((c.y - SCOREBOARD_H) / ARENA_H) * mh, 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : "rgba(255,255,255,0.3)"; ctx.strokeRect(mx + ((camRef.current.x - (ARENA_W / camRef.current.zoom) / 2) / ARENA_W) * mw, my + (((camRef.current.y - SCOREBOARD_H) - (ARENA_H / camRef.current.zoom) / 2) / ARENA_H) * mh, (mw / camRef.current.zoom), (mh / camRef.current.zoom));

        ctx.textAlign = "right"; ctx.font = "10px monospace";
        const activeFeed = state.optPool ? dataRef.feed.current.filter(f => f.active) : dataRef.feed.current;
        activeFeed.forEach((msg, idx) => { ctx.globalAlpha = msg.life / 120; ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : msg.color; ctx.fillText(msg.text, ARENA_W - 10, SCOREBOARD_H + 20 + (idx * 15)); }); ctx.globalAlpha = 1;
      }

      if (state.devMode) {
        ctx.textAlign = "left"; ctx.fillStyle = "#00ff00"; ctx.font = "10px monospace";
        ctx.fillText(`DEV MODE ACTIVE`, 10, SCOREBOARD_H + 20); ctx.fillText(`Entities: ${activeChars.length}`, 10, SCOREBOARD_H + 35); ctx.fillText(`Particles: ${state.optPool ? dataRef.parts.current.filter(p=>p.active).length : dataRef.parts.current.length}`, 10, SCOREBOARD_H + 50);
      }

      if (state.crtFilter) {
          ctx.fillStyle = "rgba(18, 16, 16, 0.15)";
          for(let i=0; i<ARENA_H + SCOREBOARD_H; i+=3) ctx.fillRect(0, i, ARENA_W, 1);
          const grad = ctx.createRadialGradient(ARENA_W/2, (ARENA_H+SCOREBOARD_H)/2, ARENA_H*0.5, ARENA_W/2, (ARENA_H+SCOREBOARD_H)/2, ARENA_W);
          grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.6)");
          ctx.fillStyle = grad; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);
      }

      if (state.paused) { 
        ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.8)" : "rgba(0,0,0,0.8)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H); 
        ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "#ccaaff"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center"; 
        ctx.fillText("PAUSED", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 - 50); 
        drawBtn(ctx, ARENA_W/2 - 75, SCOREBOARD_H + ARENA_H/2 - 10, 150, 40, "RESUME", false, true, state.theme);
        drawBtn(ctx, ARENA_W/2 - 75, SCOREBOARD_H + ARENA_H/2 + 40, 150, 40, "LIVE MODIFIERS", false, false, state.theme);
        drawBtn(ctx, ARENA_W/2 - 75, SCOREBOARD_H + ARENA_H/2 + 90, 150, 40, "QUIT TO MENU", false, false, state.theme);
      }
      else if (!state.running && !state.over) { 
        ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.6)" : "rgba(0,0,0,0.5)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H); ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "white"; ctx.textAlign = "center"; ctx.font = "bold 20px monospace"; ctx.fillText("Press A (P1) or L (P2) to spawn!", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2); 
        ctx.font = "12px monospace"; 
        if (state.camera === "action") { ctx.fillStyle = state.theme === "gameboy" ? "#306230" : "#ffaa00"; ctx.fillText("Action Cam: [Up/Down] Swap Team | [Left/Right] Cycle Fighter", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 + 25); } 
        else { ctx.fillText("Press [Q] for Auto-Spawn | Press [P] to Pause | Press [M] for Live Mods", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 + 25); }
      }
    }
    timeRef.raf.current = requestAnimationFrame(gameLoop);
  }, [renderChar, drawHpBar, drawGhost, endGame, refs, dataRef, timeRef]);

  // === UI DRAWING HELPERS ===
  function drawBtn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, active: boolean, highlight: boolean, theme: ThemeMode = "classic") {
    if (theme === "gameboy") {
        ctx.fillStyle = highlight ? "#0f380f" : active ? "#306230" : "#8bac0f"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#0f380f"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = active || highlight ? "#9bbc0f" : "#0f380f"; 
    } else {
        ctx.fillStyle = highlight ? "#aa5500" : active ? "#443388" : "#222244"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = active ? "#9966ff" : "#445566"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = active || highlight ? "white" : "#8899aa"; 
    }
    ctx.font = highlight ? "bold 13px monospace" : "12px monospace"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  function drawAnimatedBackground(ctx: CanvasRenderingContext2D, timestamp: number) {
    ctx.fillStyle = "#080814"; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);
    const drift = (timestamp * 0.02) % (ARENA_H + SCOREBOARD_H);
    for (let i = 0; i < 40; i++) {
      const x = (i * 67 + 13) % ARENA_W; const staticY = (i * 83 + 7);
      let y = (staticY - drift) % (ARENA_H + SCOREBOARD_H); if (y < 0) y += (ARENA_H + SCOREBOARD_H);
      ctx.fillStyle = `rgba(80,60,150,${0.1 + (i % 5) * 0.04})`; ctx.fillRect(x, y, 6, 6);
    }
  }

  function drawMainMenu(ctx: CanvasRenderingContext2D, mode: string, opp: string, mouse: {x:number, y:number}, timestamp: number) {
    drawAnimatedBackground(ctx, timestamp);
    ctx.fillStyle = "#ccaaff"; ctx.font = "bold 52px monospace"; ctx.textAlign = "center"; ctx.fillText("KINETIC", ARENA_W / 2, 120);
    ctx.fillStyle = "#ff9944"; ctx.fillText("SOULS", ARENA_W / 2, 178);
    ctx.fillStyle = "#888"; ctx.font = "14px monospace"; ctx.fillText("1v1 AUTO BATTLE ARENA", ARENA_W / 2, 210);

    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.fillText("GAME MODE", ARENA_W / 2, 270);
    drawBtn(ctx, ARENA_W/2 - 130, 285, 115, 36, "Timer: 2 Mins", mode === "timer", false); drawBtn(ctx, ARENA_W/2 + 15, 285, 115, 36, "Score: 10 Pts", mode === "score", false);

    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.fillText("OPPONENT", ARENA_W / 2, 358);
    drawBtn(ctx, ARENA_W/2 - 130, 373, 115, 36, "Player vs Player", opp === "pvp", false); drawBtn(ctx, ARENA_W/2 + 15, 373, 115, 36, "Player vs Bot", opp === "bot", false);

    drawBtn(ctx, ARENA_W/2 - 75, 440, 150, 44, "START GAME", false, true);
    ctx.fillStyle = "#666"; ctx.font = "12px monospace"; ctx.fillText("P1: Press [A] to spawn  |  P2: Press [L] to spawn", ARENA_W / 2, 530); ctx.fillText("Characters bounce around and fight automatically!", ARENA_W / 2, 550);

    ctx.fillStyle = "#ffd700"; ctx.fillRect(ARENA_W - 160, SCOREBOARD_H + ARENA_H - 40, 150, 30); ctx.strokeStyle = "#aa8800"; ctx.strokeRect(ARENA_W - 160, SCOREBOARD_H + ARENA_H - 40, 150, 30);
    ctx.fillStyle = "#000"; ctx.font = "bold 12px monospace"; ctx.fillText("LoK Game Modifiers", ARENA_W - 85, SCOREBOARD_H + ARENA_H - 20);
  }

  function drawLokMenu(ctx: CanvasRenderingContext2D, mode: string, theme: string, mod: string, cam: string, wep: string, env: string, mouse: {x:number, y:number}, state: GameState, timestamp: number) {
    drawAnimatedBackground(ctx, timestamp);
    ctx.fillStyle = "#ffd700"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center"; ctx.fillText("LOK MODIFIERS", ARENA_W / 2, 60);

    const cx = ARENA_W / 2; ctx.fillStyle = "#aaa"; ctx.font = "bold 13px monospace"; 
    ctx.fillText("SECRET MODES & ENVS", cx, 95); ctx.fillText("THEMES", cx, 155); ctx.fillText("WEAPONS & MODIFIERS", cx, 215); ctx.fillText("CAMERAS & PHYSICS", cx, 275); ctx.fillText("CUT CONTENT (VISUAL TOGGLES)", cx, 335); ctx.fillText("PRO ENGINE OPTIMIZATIONS", cx, 395);

    drawBtn(ctx, cx - 250, 105, 110, 30, "Horde Mode", mode === "horde", false); drawBtn(ctx, cx - 120, 105, 110, 30, "Infection", mode === "infection", false); drawBtn(ctx, cx + 10, 105, 110, 30, "Env: Ice Rink", env === "ice", false); drawBtn(ctx, cx + 140, 105, 110, 30, "Env: Black Hole", env === "blackhole", false);

    drawBtn(ctx, cx - 180, 165, 110, 30, "Classic", theme === "classic", false); drawBtn(ctx, cx - 55, 165, 110, 30, "Neon", theme === "neon", false); drawBtn(ctx, cx + 70, 165, 110, 30, "GameBoy", theme === "gameboy", false);
    drawBtn(ctx, cx - 180, 195, 110, 30, "Abyss", theme === "abyss", false); drawBtn(ctx, cx - 55, 195, 110, 30, "Runesite", theme === "runesite", false); drawBtn(ctx, cx + 70, 195, 110, 30, "GSix", theme === "gsix", false);

    drawBtn(ctx, cx - 250, 225, 110, 30, "None", mod === "none", false); drawBtn(ctx, cx - 120, 225, 110, 30, "Sudden Death", mod === "sudden_death", false); drawBtn(ctx, cx + 10, 225, 110, 30, "Titans", mod === "titans", false); drawBtn(ctx, cx + 140, 225, 110, 30, "Wep: Roulette", wep === "roulette", false);

    drawBtn(ctx, cx - 180, 285, 110, 30, "Static Cam", cam === "static", false); drawBtn(ctx, cx - 55, 285, 110, 30, "Dynamic Cam", cam === "dynamic", false); drawBtn(ctx, cx + 70, 285, 110, 30, "Action Cam", cam === "action", false);

    drawBtn(ctx, cx - 280, 345, 105, 30, state.juice ? "Juice: ON" : "Juice: OFF", state.juice, false); drawBtn(ctx, cx - 165, 345, 105, 30, state.hud ? "HUD: ON" : "HUD: OFF", state.hud, false); drawBtn(ctx, cx - 50, 345, 105, 30, state.trails ? "Trails: ON" : "Trails: OFF", state.trails, false); drawBtn(ctx, cx + 65, 345, 105, 30, state.ads ? "Ads: ON" : "Ads: OFF", state.ads, false); drawBtn(ctx, cx + 180, 345, 105, 30, state.crtFilter ? "CRT Filter: ON" : "CRT Filter: OFF", state.crtFilter, false);

    drawBtn(ctx, cx - 280, 405, 105, 30, state.optCache ? "Cache: ON" : "Cache: OFF", state.optCache, false); drawBtn(ctx, cx - 165, 405, 105, 30, state.optDelta ? "Delta: ON" : "Delta: OFF", state.optDelta, false); drawBtn(ctx, cx - 50, 405, 105, 30, state.optGravity ? "Gravity: ON" : "Gravity: OFF", state.optGravity, false); drawBtn(ctx, cx + 65, 405, 105, 30, state.optSmartSpawn ? "SmSpawn: ON" : "SmSpawn: OFF", state.optSmartSpawn, false); drawBtn(ctx, cx + 180, 405, 105, 30, state.optGrid ? "Swarm Grid: ON" : "Swarm Grid: OFF", state.optGrid, false);
    drawBtn(ctx, cx - 50, 440, 105, 30, state.optPool ? "Mem Pool: ON" : "Mem Pool: OFF", state.optPool, false);

    drawBtn(ctx, cx - 75, 490, 150, 40, "BACK TO MAIN", false, true);
  }

  function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
    ctx.fillStyle = "#080814"; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H); ctx.fillStyle = "#ccaaff"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", ARENA_W / 2, 140);
    ctx.fillStyle = "#ffee88"; ctx.font = "bold 32px monospace"; ctx.fillText(state.winner, ARENA_W / 2, 220);
    ctx.fillStyle = "#ff6655"; ctx.font = "24px monospace"; ctx.fillText(`P1 Kills: ${state.p1Score}`, ARENA_W / 2 - 100, 280); ctx.fillStyle = "#5599ff"; ctx.fillText(`Bot/Enemy Kills: ${state.p2Score}`, ARENA_W / 2 + 100, 280);
    ctx.fillStyle = "#aaa"; ctx.font = "16px monospace"; ctx.fillText(`Max Fighters on Screen: ${state.stats.maxChars}`, ARENA_W / 2, 340); ctx.fillText(`Total Damage Dealt: ${state.stats.totalDmg}`, ARENA_W / 2, 370);
    drawBtn(ctx, ARENA_W/2 - 90, 430, 180, 48, "MAIN MENU", false, true);
  }

  const handleMouseMove = useCallback((e: MouseEvent) => { 
      const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); 
      mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; 
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => { mouseRef.current.isDown = true; }, []);
  const handleMouseUp = useCallback((e: MouseEvent) => { mouseRef.current.isDown = false; stateRef.current.draggingId = null; }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); 
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const screen = screenRef.current; const cx = ARENA_W / 2;

    if (screen === "menu") {
      if (mx >= cx - 130 && mx <= cx - 15 && my >= 285 && my <= 321) refs.mode.current = "timer";
      if (mx >= cx + 15 && mx <= cx + 130 && my >= 285 && my <= 321) refs.mode.current = "score";
      if (mx >= cx - 130 && mx <= cx - 15 && my >= 373 && my <= 409) refs.opp.current = "pvp";
      if (mx >= cx + 15 && mx <= cx + 130 && my >= 373 && my <= 409) refs.opp.current = "bot";
      if (mx >= cx - 75 && mx <= cx + 75 && my >= 440 && my <= 484) startGame();

      if (mx >= ARENA_W - 160 && mx <= ARENA_W - 10 && my >= SCOREBOARD_H + ARENA_H - 40 && my <= SCOREBOARD_H + ARENA_H - 10) screenRef.current = "lok_menu";
    } 
    else if (screen === "lok_menu") {
      if (my >= 95 && my <= 145) { 
         if (mx >= cx - 250 && mx <= cx - 140) refs.mode.current = refs.mode.current === "horde" ? "timer" : "horde"; 
         if (mx >= cx - 120 && mx <= cx - 10) refs.mode.current = refs.mode.current === "infection" ? "timer" : "infection"; 
         if (mx >= cx + 10 && mx <= cx + 120) refs.env.current = refs.env.current === "ice" ? "none" : "ice";
         if (mx >= cx + 140 && mx <= cx + 250) refs.env.current = refs.env.current === "blackhole" ? "none" : "blackhole";
      }

      if (my >= 185 && my <= 215) {
          if (mx >= cx - 180 && mx <= cx - 70) refs.theme.current = "classic"; if (mx >= cx - 55 && mx <= cx + 55) refs.theme.current = "neon"; if (mx >= cx + 70 && mx <= cx + 180) refs.theme.current = "gameboy";
      }
      if (my >= 220 && my <= 250) {
          if (mx >= cx - 180 && mx <= cx - 70) refs.theme.current = "abyss"; if (mx >= cx - 55 && mx <= cx + 55) refs.theme.current = "runesite"; if (mx >= cx + 70 && mx <= cx + 180) refs.theme.current = "gsix";
      }
      if (my >= 255 && my <= 285) {
          if (mx >= cx - 250 && mx <= cx - 140) refs.mod.current = "none"; if (mx >= cx - 120 && mx <= cx - 10) refs.mod.current = "sudden_death"; if (mx >= cx + 10 && mx <= cx + 120) refs.mod.current = "titans"; if (mx >= cx + 140 && mx <= cx + 250) refs.wep.current = refs.wep.current === "roulette" ? "standard" : "roulette";
      }
      if (my >= 285 && my <= 315) {
          if (mx >= cx - 180 && mx <= cx - 70) refs.cam.current = "static"; if (mx >= cx - 55 && mx <= cx + 55) refs.cam.current = "dynamic"; if (mx >= cx + 70 && mx <= cx + 180) refs.cam.current = "action";
      }
      if (my >= 330 && my <= 360) {
          if (mx >= cx - 280 && mx <= cx - 175) stateRef.current.juice = !stateRef.current.juice; if (mx >= cx - 165 && mx <= cx - 60) stateRef.current.hud = !stateRef.current.hud; if (mx >= cx - 50 && mx <= cx + 55) stateRef.current.trails = !stateRef.current.trails; if (mx >= cx + 65 && mx <= cx + 170) stateRef.current.ads = !stateRef.current.ads; if (mx >= cx + 180 && mx <= cx + 285) stateRef.current.crtFilter = !stateRef.current.crtFilter;
      }
      if (my >= 400 && my <= 430) {
          if (mx >= cx - 280 && mx <= cx - 175) stateRef.current.optCache = !stateRef.current.optCache; if (mx >= cx - 165 && mx <= cx - 60) stateRef.current.optDelta = !stateRef.current.optDelta; if (mx >= cx - 50 && mx <= cx + 55) stateRef.current.optGravity = !stateRef.current.optGravity; if (mx >= cx + 65 && mx <= cx + 170) stateRef.current.optSmartSpawn = !stateRef.current.optSmartSpawn; if (mx >= cx + 180 && mx <= cx + 285) stateRef.current.optGrid = !stateRef.current.optGrid;
      }
      if (my >= 435 && my <= 465) { if (mx >= cx - 50 && mx <= cx + 55) stateRef.current.optPool = !stateRef.current.optPool; }

      if (mx >= cx - 75 && mx <= cx + 75 && my >= 490 && my <= 530) screenRef.current = "menu";
    }
    else if (screen === "over") { 
      if (mx >= cx - 90 && mx <= cx + 90 && my >= 430 && my <= 478) { screenRef.current = "menu"; stateRef.current.running = false; stateRef.current.over = false; } 
    }
    else if (screen === "game") {
      if (stateRef.current.paused) {
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H/2 - 10 && my <= SCOREBOARD_H + ARENA_H/2 + 30) stateRef.current.paused = false;
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H/2 + 40 && my <= SCOREBOARD_H + ARENA_H/2 + 80) { setShowLiveMenu(true); stateRef.current.paused = false; }
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H/2 + 90 && my <= SCOREBOARD_H + ARENA_H/2 + 130) { screenRef.current = "menu"; stateRef.current.running = false; stateRef.current.paused = false; }
      } else {
          if (stateRef.current.handOfGod && !stateRef.current.draggingId) {
             const worldX = (mx - ARENA_W/2) / camRef.current.zoom + camRef.current.x; const worldY = (my - (SCOREBOARD_H + ARENA_H/2)) / camRef.current.zoom + camRef.current.y;
             for(let i=dataRef.chars.current.length-1; i>=0; i--) {
                const c = dataRef.chars.current[i]; if(c.dead) continue;
                if (Math.hypot(worldX - c.x, worldY - c.y) < CHAR_RADIUS * c.scale * 1.5) { stateRef.current.draggingId = c.id; break; }
             }
          }
      }
    }
  }, [startGame, refs]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (key === "m") { setShowLiveMenu(prev => !prev); setTick(t => t + 1); }

    if (screenRef.current === "game" && stateRef.current.running) {
      if (key === "p" || key === "escape") stateRef.current.paused = !stateRef.current.paused;

      if (!stateRef.current.paused) {
        if (key === "a") { const c = spawnCharacter(1, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }
        if (key === "l" && stateRef.current.opponent === "pvp") { const c = spawnCharacter(2, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }
        if (key === "q") stateRef.current.p1Auto = !stateRef.current.p1Auto;

        if (stateRef.current.camera === "action") {
           if (key === "arrowup") { stateRef.current.actionCamTeam = (stateRef.current.actionCamTeam % 4) + 1 as 1|2|3|4; stateRef.current.actionCamIndex = 0; }
           if (key === "arrowdown") { stateRef.current.actionCamTeam = stateRef.current.actionCamTeam === 1 ? 4 : stateRef.current.actionCamTeam - 1 as 1|2|3|4; stateRef.current.actionCamIndex = 0; }
           if (key === "arrowleft") stateRef.current.actionCamIndex--; if (key === "arrowright") stateRef.current.actionCamIndex++;
        }
      }
    }
  }, [dataRef]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => { keysRef.current.delete(e.code); }, []);

  const spawnP1 = useCallback(() => {
    if (screenRef.current !== "game" || !stateRef.current.running || stateRef.current.paused) return;
    const c = spawnCharacter(1, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle);
    if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c);
  }, [dataRef]);

  const spawnP2 = useCallback(() => {
    if (screenRef.current !== "game" || !stateRef.current.running || stateRef.current.paused) return;
    if (stateRef.current.opponent !== "pvp") return;
    const c = spawnCharacter(2, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle);
    if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c);
  }, [dataRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
    joyRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 };
    if (tx < ARENA_W / 2) spawnP1(); else spawnP2();
  }, [spawnP1, spawnP2]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joyRef.current.dx = touch.clientX - joyRef.current.startX;
    joyRef.current.dy = touch.clientY - joyRef.current.startY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    joyRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.addEventListener("mousemove", handleMouseMove); window.addEventListener("mousedown", handleMouseDown); window.addEventListener("mouseup", handleMouseUp); canvas.addEventListener("click", handleClick); window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    timeRef.last.current = performance.now(); timeRef.raf.current = requestAnimationFrame(gameLoop);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mousedown", handleMouseDown); window.removeEventListener("mouseup", handleMouseUp); canvas.removeEventListener("click", handleClick); window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart); canvas.removeEventListener("touchmove", handleTouchMove); canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(timeRef.raf.current);
    };
  }, [gameLoop, handleClick, handleKeyDown, handleKeyUp, handleMouseMove, handleMouseDown, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd, timeRef]);

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px", position: "relative" }}>

      {showLiveMenu && (
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(20, 10, 40, 0.95)", border: "2px solid #ffd700", borderRadius: "8px", padding: "16px", color: "#ffd700", fontFamily: "monospace", zIndex: 10, boxShadow: "0 0 20px rgba(255,215,0,0.3)", width: "240px", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ffd700", paddingBottom: "8px", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>⚡ LIVE LOK MODS</h3>
            <button onClick={() => setShowLiveMenu(false)} style={{ background: "transparent", color: "#ff4444", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>X</button>
          </div>

          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Mode: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.mode} onChange={(e) => { stateRef.current.mode = e.target.value as GameMode; }}><option value="timer">Timer</option><option value="score">Score</option><option value="horde">Horde</option><option value="infection">Infection</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Opponent: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.opponent} onChange={(e) => { stateRef.current.opponent = e.target.value as OpponentMode; }}><option value="pvp">PvP</option><option value="bot">Bot</option><option value="ffa">4-Way FFA</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Modifier: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.modifier} onChange={(e) => { stateRef.current.modifier = e.target.value as LokModifier; }}><option value="none">None</option><option value="sudden_death">Sudden Death</option><option value="titans">Titans</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Weapons: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.weaponStyle} onChange={(e) => { stateRef.current.weaponStyle = e.target.value as WeaponStyle; }}><option value="standard">Standard</option><option value="roulette">Roulette</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Camera: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.camera} onChange={(e) => { stateRef.current.camera = e.target.value as CameraMode; }}><option value="static">Static</option><option value="dynamic">Dynamic</option><option value="action">Action Cam</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Theme: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.theme} onChange={(e) => { stateRef.current.theme = e.target.value as ThemeMode; }}><option value="classic">Classic</option><option value="neon">Neon</option><option value="gameboy">GameBoy</option><option value="abyss">Abyss</option><option value="runesite">Runesite</option><option value="gsix">GSix</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{fontSize: "12px"}}>Environment: </label><select style={{ background: "#000", color: "#ccaaff", border: "1px solid #ccaaff", width: "100%", padding: "4px" }} defaultValue={stateRef.current.environment} onChange={(e) => { stateRef.current.environment = e.target.value as Environment; }}><option value="none">None</option><option value="ice">Ice Rink</option><option value="blackhole">Black Hole</option><option value="lava">Lava Floor</option></select></div>

          <hr style={{ borderColor: "#aa8800", margin: "12px 0" }} />

          <h4 style={{ margin: "0 0 8px 0", color: "#ffaa00", fontSize: "13px" }}>✂️ CUT CONTENT & PHYSICS</h4>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.handOfGod} onChange={(e) => stateRef.current.handOfGod = e.target.checked} /> Hand of God (Mouse Grab)</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.aiMagnetic} onChange={(e) => stateRef.current.aiMagnetic = e.target.checked} /> Magnetic AI (Aggro Pull)</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.juice} onChange={(e) => stateRef.current.juice = e.target.checked} /> Game Juice (Shake/Pause)</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.hud} onChange={(e) => stateRef.current.hud = e.target.checked} /> Tactical HUD (Minimap)</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.trails} onChange={(e) => stateRef.current.trails = e.target.checked} /> Motion Trails</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.ads} onChange={(e) => stateRef.current.ads = e.target.checked} /> Arena Ads</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#aaa", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.crtFilter} onChange={(e) => stateRef.current.crtFilter = e.target.checked} /> CRT Arcade Filter</label>

          <hr style={{ borderColor: "#aa8800", margin: "12px 0" }} />

          <h4 style={{ margin: "0 0 8px 0", color: "#ffaa00", fontSize: "13px" }}>⚙️ ENGINE OPTS</h4>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optCache} onChange={(e) => stateRef.current.optCache = e.target.checked} /> Sprite Caching</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optGrid} onChange={(e) => stateRef.current.optGrid = e.target.checked} /> Swarm Grid (Spatial Part)</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optPool} onChange={(e) => stateRef.current.optPool = e.target.checked} /> Memory Pooling</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optDelta} onChange={(e) => stateRef.current.optDelta = e.target.checked} /> Delta-Time Physics</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optGravity} onChange={(e) => stateRef.current.optGravity = e.target.checked} /> Gravity Particles</label>
          <label style={{ display: "block", marginBottom: "4px", cursor: "pointer", color: "#00ff00", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optSmartSpawn} onChange={(e) => stateRef.current.optSmartSpawn = e.target.checked} /> Smart Spawning</label>
          <label style={{ display: "block", marginTop: "12px", cursor: "pointer", color: "#ff0000", fontSize: "12px", borderTop: "1px solid #ff0000", paddingTop: "8px" }}><input type="checkbox" defaultChecked={stateRef.current.devMode} onChange={(e) => stateRef.current.devMode = e.target.checked} /> DEV: Show Hitboxes</label>
        </div>
      )}

      <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H + SCOREBOARD_H} style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain", imageRendering: "pixelated", border: "3px solid #6644aa", cursor: "crosshair" }} />
      <div style={{ color: "#666", fontFamily: "monospace", fontSize: "12px", marginTop: "8px", textAlign: "center", paddingBottom: "10px" }}>
        P1: [A] Spawn | P2: [L] Spawn | [Q] Auto-Spawn | [P] Pause | [M] Live Modifiers Menu
      </div>
    </div>
  );
}