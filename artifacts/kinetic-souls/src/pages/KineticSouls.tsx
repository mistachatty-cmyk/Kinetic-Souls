import { useEffect, useRef, useCallback, useState } from "react";

const ARENA_W = 900; const ARENA_H = 560; const CHAR_RADIUS = 14; const MAX_HP = 20;
const SPAWN_SPEED = 2.8; const BOT_MIN_INTERVAL = 2000; const BOT_MAX_INTERVAL = 4000;
const SCOREBOARD_H = 60; const GRID_CELL_SIZE = 60;

const SPLASH_ARCHIVE = [
  "THEEEee ULtimatee everything-everywhere-all-at-once auto-battler?", "Why choose a variant when you can build the ULTIMATE?",
  "🦉 Lok: Focus on what matters.", "💰 COIN MODE: Greed is a weapon.", "GSix: Gilded Protocol - Authorized.",
  "Br/kn State: THE SOUL OF THE MACHINE.", "4-Tone Puke: Pure Retro DMG.", "Everything-Everywhere-All-At-Once.",
  "Liquidate the System.", "Welcome back, Eric.", "Welcome back, Cante.", "Welcome back, Miss N.", "Welcome back, Sire.",
  "Must build additional pylons.", "The only way to win is to not lose.", "The only way to lose is to not win.",
  "The only way to tie is to not win or lose.", "Howa bout a pickle you nasty", "W.O.W Service Initiated",
  "W.O.W Service Terminated", "Have you seen Moka?", "I love you Tan-Moka", "MCallie Named her BumbleBee...",
  "It's okay to be sad and happy, it grows you ^^", "I like saying hungry hungry hippo but I don't mean to offend",
  "Hey Hey Hey... Don't be so rough <3", "Hello World!", "Ima Cookie MOnster", "Youa Cookie?",
  "You're a good person, I like you", "I'm a good person, I like you", "Arena Smash Bro's",
  "Ultimate Arena Smash Bro's", "Yum Yum Get in my tum"
];

type GameMode = "timer" | "score" | "horde" | "infection" | "unlimited";
type OpponentMode = "pvp" | "bot" | "ffa";
type ThemeMode = "classic" | "neon" | "gameboy" | "abyss" | "runesite" | "runesite_ultimate" | "gsix" | "gilded" | "lokmod" | "hacker" | "synthwave" | "vampire" | "oceanic" | "infernal" | "glitch" | "monochrome" | "celestial" | "overdrive" | "comic" | "neon_abyss" | "rgb_cycle";
type LokModifier = "none" | "sudden_death" | "titans" | "shrinking_arena" | "vampire_kiss" | "necromancy" | "magnet" | "repel" | "heavy";
type CameraMode = "static" | "dynamic" | "action" | "enhanced";
type ViewMode = "standard" | "theater" | "cinematic";
type WeaponStyle = "standard" | "roulette" | "melee_mash" | "ranged_test";
type Environment = "none" | "ice" | "blackhole" | "lava" | "storm" | "bouncy" | "wrap" | "blackout";
type ScreenState = "menu" | "lok_menu" | "settings_menu" | "game" | "over";
type WeaponType = "standard" | "dagger" | "spear" | "hammer" | "scythe" | "axe" | "katana" | "mace" | "whip" | "rapier" | "blaster" | "fireball";
type JuiceLevel = "off" | "normal" | "super";
type KineticType = "standard" | "tank" | "assassin" | "sniper" | "giant" | "zombie" | "shield" | "null" | "necromancer" | "ninja" | "mage" | "ghost" | "juggernaut";

interface GameState {
  mode: GameMode; opponent: OpponentMode; theme: ThemeMode; modifier: LokModifier; camera: CameraMode; viewMode: ViewMode; weaponStyle: WeaponStyle; environment: Environment;
  p1Score: number; p2Score: number; directorScore: number; timeLeft: number; scoreLimit: number; fighterSpeed: number;
  running: boolean; over: boolean; paused: boolean; p1Auto: boolean; devMode: boolean; winner: string;
  hitPause: number; shakeFrames: number; timeScale: number; stats: { maxChars: number; totalDmg: number };
  juice: JuiceLevel; hud: boolean; trails: boolean; ads: boolean; crtFilter: boolean; vhsFilter: boolean; invertFilter: boolean; aiMagnetic: boolean; handOfGod: boolean;
  optCache: boolean; optDelta: boolean; optGravity: boolean; optSmartSpawn: boolean; optGrid: boolean; optPool: boolean;
  actionCamTeam: number; actionCamIndex: number; draggingId: number | null; shrinkingZone: number; fpsTarget: number;
  menuParticles: boolean; menuDrift: boolean; menuGrid: boolean; menuPulse: boolean; menuCRT: boolean;
  moonGravity: boolean; explodingCorpses: boolean; sloMoKills: boolean; rainbowBlood: boolean; parallaxGrid: boolean; reactiveGrid: boolean;
}

interface Part { ox: number; oy: number; r: number; type: "head" | "body" | "arm" | "leg"; }
interface TrailFrame { x: number; y: number; angle: number; }
interface Character { 
    id: number; team: number; x: number; y: number; vx: number; vy: number; angle: number; angularV: number; 
    hp: number; maxHp: number; flashFrames: number; dead: boolean; parts: Part[]; trail: TrailFrame[]; 
    scale: number; weapon: WeaponType; kineticType: KineticType; stunTime: number; cooldown: number; 
    shieldHp: number; contacts: number; mass: number;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; active: boolean; }
interface Projectile { x: number; y: number; vx: number; vy: number; life: number; color: string; team: number; active: boolean; type: "laser"|"fireball"; }
interface Ghost { x: number; y: number; team: number; vy: number; life: number; maxLife: number; scored: boolean; active: boolean; }
interface FloatingText { x: number; y: number; text: string; color: string; life: number; maxLife: number; vy: number; active: boolean; isSplat?: boolean; }
interface KillFeedMsg { text: string; life: number; color: string; active: boolean; }
interface Drop { type: "bomb" | "blackhole" | "medkit" | "freeze" | "nuke"; x: number; y: number; timer: number; maxTimer: number; active: boolean; radius: number; }

const BASE_PARTS: Part[] = [ { ox: 0, oy: -20, r: 7, type: "head" }, { ox: 0, oy: -6, r: 9, type: "body" }, { ox: -12, oy: -8, r: 5, type: "arm" }, { ox: 12, oy: -8, r: 5, type: "arm" }, { ox: -6, oy: 6, r: 5, type: "leg" }, { ox: 6, oy: 6, r: 5, type: "leg" } ];
function getPartDamage(type: "head" | "body" | "arm" | "leg"): number { if (type === "head") return 5; if (type === "body") return 3; if (type === "arm") return 2; return 1; }

let charIdCounter = 0;

function getRandomWeapon(): WeaponType {
    const types: WeaponType[] = ["standard", "dagger", "spear", "hammer", "scythe", "axe", "katana", "mace", "whip", "rapier"];
    return types[Math.floor(Math.random() * types.length)];
}

function spawnCharacter(team: number, modifier: LokModifier, existingChars: Character[], useSmartSpawn: boolean, usePool: boolean, wStyle: WeaponStyle, speedMult: number, overrideX?: number, overrideY?: number, kType: KineticType = "standard"): Character {
  let scale = modifier === "titans" ? 2.5 : 1;
  let baseHp = modifier === "sudden_death" || modifier === "shrinking_arena" || kType === "zombie" ? 1 : modifier === "titans" ? MAX_HP * 3 : MAX_HP;
  let speed = (SPAWN_SPEED + Math.random() * 1.5) * speedMult;
  let weapon: WeaponType = "standard";
  let shieldHp = 0; let mass = modifier === "heavy" ? 3 : 1;

  if (wStyle === "roulette" || wStyle === "melee_mash") weapon = getRandomWeapon();
  else if (wStyle === "ranged_test") weapon = "blaster";

  // KINETIC TYPE MODIFIERS
  if (kType === "giant") { scale *= 2.5; baseHp *= 4; speed *= 0.5; weapon = "hammer"; mass *= 3; }
  else if (kType === "juggernaut") { scale *= 1.5; baseHp *= 3; speed *= 0.4; weapon = "axe"; mass *= 4; }
  else if (kType === "assassin") { scale *= 0.8; baseHp = Math.max(1, Math.floor(baseHp/2)); speed *= 1.8; weapon = "katana"; mass *= 0.5; }
  else if (kType === "ninja") { scale *= 0.9; speed *= 1.5; weapon = "dagger"; mass *= 0.7; }
  else if (kType === "tank") { scale *= 1.3; baseHp *= 2; speed *= 0.7; weapon = "mace"; mass *= 2; }
  else if (kType === "sniper") { weapon = "blaster"; speed *= 0.9; }
  else if (kType === "mage") { weapon = "fireball"; speed *= 0.8; }
  else if (kType === "zombie") { speed *= 0.6; weapon = "standard"; }
  else if (kType === "ghost") { speed *= 1.4; mass *= 0.2; weapon = "scythe"; }
  else if (kType === "shield") { shieldHp = 15; weapon = "standard"; speed *= 0.8; mass *= 1.5; }
  else if (kType === "necromancer") { shieldHp = 10; weapon = "scythe"; speed *= 1.2; }
  else if (kType === "null") { weapon = "standard"; speed *= 0.1; mass *= 5; }

  let x = overrideX ?? ARENA_W / 2; let y = overrideY ?? SCOREBOARD_H + ARENA_H / 2;

  if (overrideX === undefined) {
      if (team === 1) { x = 40 * scale; y = SCOREBOARD_H + 40 * scale + Math.random() * (ARENA_H - 80 * scale); } 
      else if (team === 2) { x = ARENA_W - 40 * scale; y = SCOREBOARD_H + 40 * scale + Math.random() * (ARENA_H - 80 * scale); } 
      else if (team === 3) { x = 40 * scale + Math.random() * (ARENA_W - 80 * scale); y = SCOREBOARD_H + 40 * scale; } 
      else if (team === 4) { x = 40 * scale + Math.random() * (ARENA_W - 80 * scale); y = SCOREBOARD_H + ARENA_H - 40 * scale; }
      else { x = ARENA_W / 2 + (Math.random() - 0.5) * 100; y = SCOREBOARD_H + ARENA_H / 2 + (Math.random() - 0.5) * 100; }

      if (useSmartSpawn) {
        for (let attempt = 0; attempt < 5; attempt++) {
          let overlap = false;
          for (const other of existingChars) {
            if (other.dead) continue;
            if (Math.hypot(x - other.x, y - other.y) < CHAR_RADIUS * scale + CHAR_RADIUS * other.scale) { overlap = true; break; }
          }
          if (!overlap) break; x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40;
        }
      }
  }

  const angle = Math.random() * Math.PI * 2;
  if (weapon === "spear" || weapon === "axe" || weapon === "mace") speed *= 0.7;
  if (weapon === "katana" || weapon === "dagger" || weapon === "rapier") speed *= 1.3;

  let vx = (Math.random() - 0.5) * speed * 2; let vy = (Math.random() - 0.5) * speed * 2;
  if (overrideX === undefined) {
      if (team === 1) vx = Math.abs(vx); if (team === 2) vx = -Math.abs(vx); if (team === 3) vy = Math.abs(vy); if (team === 4) vy = -Math.abs(vy);
  }

  let angularV = (Math.random() - 0.5) * 0.12 * speedMult; 
  if (weapon === "dagger") angularV *= 2; if (weapon === "katana") angularV *= 2.5; if (weapon === "scythe" || weapon === "whip") angularV *= 1.5;

  const scaledParts = BASE_PARTS.map((p) => ({ ...p, ox: p.ox * scale, oy: p.oy * scale, r: p.r * scale }));

  if (usePool) {
    const deadChar = existingChars.find((c) => c.dead);
    if (deadChar) {
      deadChar.team = team; deadChar.x = x; deadChar.y = y; deadChar.vx = vx; deadChar.vy = vy; deadChar.angle = angle; deadChar.angularV = angularV;
      deadChar.hp = baseHp; deadChar.maxHp = baseHp; deadChar.flashFrames = 0; deadChar.dead = false; deadChar.parts = scaledParts; deadChar.trail = []; deadChar.scale = scale; deadChar.weapon = weapon; 
      deadChar.kineticType = kType; deadChar.stunTime = 0; deadChar.cooldown = 0; deadChar.shieldHp = shieldHp; deadChar.contacts = 0; deadChar.mass = mass;
      return deadChar;
    }
  }
  return { id: charIdCounter++, team, x, y, vx, vy, angle, angularV, hp: baseHp, maxHp: baseHp, flashFrames: 0, dead: false, parts: scaledParts, trail: [], scale, weapon, kineticType: kType, stunTime: 0, cooldown: 0, shieldHp, contacts: 0, mass };
}

function getTeamColor(team: number, theme: ThemeMode, kType: KineticType = "standard", ts: number = 0): string {
  if (kType === "null") return "#555555";
  if (kType === "zombie" || team === 5) return "#33ff33"; 
  if (kType === "necromancer") return "#aa00ff";
  if (theme === "rgb_cycle") return `hsl(${(ts * 0.1 + team * 90) % 360}, 100%, 50%)`;
  if (theme === "gameboy") return team === 1 ? "#306230" : "#0f380f";
  if (theme === "runesite" || theme === "runesite_ultimate") return team === 1 ? "#b12a2a" : team === 2 ? "#2a52b1" : team === 3 ? "#2ab144" : "#b1a82a";
  if (theme === "gsix") return team === 1 ? "#00f0ff" : team === 2 ? "#cccccc" : team === 3 ? "#ffffff" : "#444444"; 
  if (theme === "gilded") return team === 1 ? "#ffd700" : team === 2 ? "#b8860b" : team === 3 ? "#e5e4e2" : "#8b0000"; 
  if (theme === "lokmod") return team === 1 ? "#ffd700" : team === 2 ? "#ccaaff" : team === 3 ? "#ffffff" : "#444444"; 
  if (theme === "glitch") return team === 1 ? "#00ffff" : team === 2 ? "#ff00ff" : team === 3 ? "#ffff00" : "#ffffff"; 
  if (theme === "monochrome" || theme === "comic") return team === 1 ? "#ffffff" : team === 2 ? "#888888" : team === 3 ? "#dddddd" : "#444444"; 
  if (theme === "celestial") return team === 1 ? "#ffffff" : team === 2 ? "#ffd700" : team === 3 ? "#aaccff" : "#eeeeee"; 
  if (theme === "overdrive") return team === 1 ? "#ff2200" : team === 2 ? "#ffaa00" : team === 3 ? "#ff0000" : "#880000"; 
  if (theme === "hacker") return team === 1 ? "#00ff00" : team === 2 ? "#008800" : team === 3 ? "#ccffcc" : "#004400";
  if (theme === "synthwave" || theme === "neon_abyss") return team === 1 ? "#ff00ff" : team === 2 ? "#00ffff" : team === 3 ? "#ffff00" : "#ff8800";
  if (theme === "vampire") return team === 1 ? "#dd0000" : team === 2 ? "#550000" : team === 3 ? "#ffffff" : "#880000";
  if (theme === "oceanic") return team === 1 ? "#00aaff" : team === 2 ? "#0055ff" : team === 3 ? "#00ffcc" : "#002288";
  if (theme === "infernal") return team === 1 ? "#ff4400" : team === 2 ? "#ff8800" : team === 3 ? "#ffaa00" : "#882200";
  if (theme === "abyss" || theme === "void") return team === 1 ? "#ffffff" : team === 2 ? "#aaaaaa" : team === 3 ? "#dddddd" : "#555555";
  return team === 1 ? "#ff6655" : team === 2 ? "#5599ff" : team === 3 ? "#55ff55" : "#ffff55";
}

function rotatePoint(ox: number, oy: number, angle: number): [number, number] { return [ ox * Math.cos(angle) - oy * Math.sin(angle), ox * Math.sin(angle) + oy * Math.cos(angle) ]; }

function getWeaponTip(c: Character): [number, number] {
  let reach = 30; 
  if (c.weapon === "dagger") reach = 18; else if (c.weapon === "spear") reach = 45;
  else if (c.weapon === "scythe") reach = 40; else if (c.weapon === "axe") reach = 25;
  else if (c.weapon === "katana") reach = 35; else if (c.weapon === "mace") reach = 28;
  else if (c.weapon === "rapier") reach = 42; else if (c.weapon === "whip") reach = 38;
  else if (c.weapon === "blaster" || c.weapon === "fireball") reach = 20;
  const [wx, wy] = rotatePoint(0, -reach * c.scale, c.angle); return [c.x + wx, c.y + wy];
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean { return (ax - bx)*(ax - bx) + (ay - by)*(ay - by) < (ar + br)*(ar + br); }

function pushParticle(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number, pool: Particle[], usePool: boolean) {
    if (usePool) {
        const deadP = pool.find((p) => !p.active);
        if (deadP) { deadP.x=x; deadP.y=y; deadP.vx=vx; deadP.vy=vy; deadP.life=life; deadP.maxLife=life; deadP.color=color; deadP.size=size; deadP.active=true; return; }
    }
    pool.push({ x, y, vx, vy, life, maxLife: life, color, size, active: true });
}

function drawRawChar(ctx: CanvasRenderingContext2D, c: Character, flash: boolean, theme: ThemeMode, devMode: boolean, timestamp: number) {
  const scale = c.scale; const team = c.team;
  if (flash) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(255,255,255,0.85)"; }

  if (devMode) {
    ctx.strokeStyle = getTeamColor(team, theme, c.kineticType, timestamp); ctx.lineWidth = 1;
    for (const p of c.parts) { ctx.beginPath(); ctx.arc(p.ox, p.oy, p.r, 0, Math.PI * 2); ctx.stroke(); }
    let wR = 6; if (c.weapon === "dagger" || c.weapon==="katana" || c.weapon==="rapier") wR = 4; else if (c.weapon === "hammer" || c.weapon==="axe" || c.weapon==="mace") wR = 10;
    const reach = (c.weapon === "spear" ? 45 : c.weapon === "dagger" ? 18 : c.weapon === "scythe" ? 40 : c.weapon === "katana" ? 35 : c.weapon === "axe" ? 25 : c.weapon==="mace" ? 28 : c.weapon==="rapier" ? 42 : c.weapon==="whip" ? 38 : c.weapon==="blaster"||c.weapon==="fireball"? 20 : 30);
    ctx.strokeStyle = "#00ff00"; ctx.beginPath(); ctx.arc(0, -reach * scale, wR * scale, 0, Math.PI * 2); ctx.stroke();
  } else if (theme === "abyss" || theme === "hacker" || theme === "void" || theme === "glitch" || theme === "neon_abyss" || theme === "rgb_cycle") {
    let glowColor = getTeamColor(team, theme, c.kineticType, timestamp);
    if (theme === "neon_abyss") glowColor = team===1?"#ff00ff":team===2?"#00ffff":"#00ff00";
    if (c.kineticType === "ghost") ctx.globalAlpha = 0.4;
    for (const p of c.parts) {
      if (theme === "void" || theme === "neon_abyss") {
          ctx.strokeStyle = flash ? "white" : glowColor; ctx.lineWidth = 2 * scale;
          ctx.strokeRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
      } else {
          ctx.fillStyle = "#050505"; ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
          ctx.fillStyle = flash ? "white" : p.type === "head" ? glowColor : "#111111";
          if (p.type === "head") { ctx.shadowBlur = 10; ctx.shadowColor = glowColor; } else { ctx.shadowBlur = 0; }
          ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
      }
    }
    drawWeapon(ctx, c.weapon, scale, flash ? "white" : (theme==="hacker"?"#00ff00":theme==="void"||theme==="glitch"?"#fff":"#ffff00"), flash ? "white" : (theme==="hacker"?"#005500":theme==="void"?"#000":"#ffff00"), theme, timestamp);
    ctx.globalAlpha = 1;
  } else {
    let skin = "#ffcc99", dark = "#aa2211";
    if (c.kineticType === "zombie" || team === 5) { skin = "#ccffcc"; dark = "#004400"; }
    else if (c.kineticType === "null") { skin = "#aaaaaa"; dark = "#555555"; }
    else if (theme === "gameboy") { skin = "#8bac0f"; dark = team === 1 ? "#0f380f" : "#306230"; } 
    else if (theme === "runesite" || theme === "runesite_ultimate") { skin = "#dca878"; dark = team === 1 ? "#5e1515" : "#152c5e"; } 
    else if (theme === "gsix") { skin = "#080808"; dark = "#cccccc"; } 
    else if (theme === "gilded" || theme === "lokmod") { skin = "#fff"; dark = "#1a0f00"; }
    else if (theme === "synthwave" || theme === "cyberpunk") { skin = "#ffccff"; dark = "#220044"; } 
    else if (theme === "vampire") { skin = "#ffffff"; dark = "#222222"; } 
    else if (theme === "oceanic") { skin = "#ccffff"; dark = "#002244"; } 
    else if (theme === "infernal" || theme === "overdrive") { skin = "#ffaaaa"; dark = "#440000"; } 
    else if (theme === "monochrome" || theme === "comic") { skin = "#ffffff"; dark = "#000000"; }
    else if (theme === "celestial") { skin = "#ffffff"; dark = "#aa8800"; }
    else { dark = team === 1 ? "#aa2211" : team === 2 ? "#2244aa" : team === 3 ? "#22aa22" : "#aaaa22"; }
    const color = getTeamColor(team, theme, c.kineticType, timestamp);

    if (c.kineticType === "ghost") ctx.globalAlpha = 0.4;

    if (theme === "neon") {
      ctx.fillStyle = "#050505";
      ctx.strokeStyle = flash ? "white" : color; ctx.lineWidth = 2 * scale; ctx.shadowBlur = flash ? 15 : 8; ctx.shadowColor = flash ? "white" : color;
      for (const p of c.parts) { ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2); ctx.strokeRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2); }
    } else {
      for (const p of c.parts) {
        ctx.fillStyle = flash ? "white" : p.type === "head" ? skin : p.type === "body" ? color : p.type === "arm" ? dark : color;
        ctx.fillRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2);
        if (theme === "comic") { ctx.strokeStyle="#000"; ctx.lineWidth=1.5; ctx.strokeRect(p.ox - p.r, p.oy - p.r, p.r * 2, p.r * 2); }
        if (!flash && p.type === "head") {
          ctx.fillStyle = (theme === "gsix" || theme === "gilded" || theme === "vampire" || theme === "lokmod" || theme === "monochrome" || theme === "comic") ? "#fff" : theme === "gameboy" ? "#0f380f" : "#222";
          ctx.fillRect(p.ox - 3 * scale, p.oy - 2 * scale, 2 * scale, 3 * scale); ctx.fillRect(p.ox + 1 * scale, p.oy - 2 * scale, 2 * scale, 3 * scale);
        }
      }
    }

    if (c.shieldHp > 0) {
        ctx.strokeStyle = "rgba(0, 150, 255, 0.8)"; ctx.lineWidth = 3; ctx.shadowBlur = 10; ctx.shadowColor = "#00aaff";
        ctx.beginPath(); ctx.arc(0, 0, CHAR_RADIUS * scale * 1.8, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    }

    let wCol1 = flash ? "white" : "#ffee44"; let wCol2 = flash ? "white" : "#aaaaaa";
    if (theme === "gameboy") { wCol1 = flash ? "#9bbc0f" : "#9bbc0f"; wCol2 = flash ? "#9bbc0f" : "#306230"; }
    if (theme === "runesite" || theme === "runesite_ultimate") { wCol1 = flash ? "white" : "#aaaaaa"; wCol2 = flash ? "white" : "#555555"; }
    if (theme === "gsix") { wCol1 = flash ? "white" : "#00f0ff"; wCol2 = flash ? "white" : "#444"; } 
    if (theme === "gilded" || theme === "lokmod" || theme === "celestial") { wCol1 = flash ? "white" : "#ffd700"; wCol2 = flash ? "white" : "#cc9900"; } 
    if (theme === "vampire" || theme === "monochrome" || theme === "overdrive" || theme === "comic") { wCol1 = flash ? "white" : "#ff0000"; wCol2 = flash ? "white" : "#555555"; }
    if (theme === "neon" || theme === "synthwave" || theme === "glitch") { wCol1 = flash ? "white" : "#ffff00"; wCol2 = "transparent"; }
    if (theme === "rgb_cycle") { wCol1 = color; wCol2 = "#fff"; }
    drawWeapon(ctx, c.weapon, scale, wCol1, wCol2, theme, timestamp);
    ctx.globalAlpha = 1;
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, type: WeaponType, scale: number, c1: string, c2: string, theme: ThemeMode, ts: number) {
  if (theme === "neon" || theme === "synthwave" || theme === "cyberpunk" || theme === "void" || theme === "glitch" || theme === "neon_abyss") {
    ctx.strokeStyle = c1; ctx.lineWidth = 2 * scale; ctx.beginPath();
    if (type === "dagger") { ctx.moveTo(0, -20 * scale); ctx.lineTo(0, -28 * scale); } 
    else if (type === "spear") { ctx.moveTo(0, -26 * scale); ctx.lineTo(0, -58 * scale); } 
    else if (type === "scythe") { ctx.moveTo(0, -26 * scale); ctx.lineTo(0, -40 * scale); ctx.quadraticCurveTo(-20*scale, -35*scale, -25*scale, -20*scale); }
    else if (type === "axe") { ctx.moveTo(0, -20 * scale); ctx.lineTo(0, -35 * scale); ctx.moveTo(-10*scale, -30*scale); ctx.lineTo(10*scale, -30*scale); ctx.lineTo(10*scale, -40*scale); ctx.lineTo(-10*scale, -40*scale); ctx.closePath(); }
    else if (type === "katana") { ctx.moveTo(0, -20 * scale); ctx.quadraticCurveTo(5*scale, -30*scale, 0, -45*scale); }
    else if (type === "mace") { ctx.moveTo(0, -20 * scale); ctx.lineTo(0, -35 * scale); ctx.moveTo(0,-35*scale); ctx.arc(0, -35*scale, 6*scale, 0, Math.PI*2); }
    else if (type === "rapier") { ctx.moveTo(0, -20 * scale); ctx.lineTo(0, -45 * scale); ctx.moveTo(-3*scale, -25*scale); ctx.lineTo(3*scale, -25*scale); }
    else if (type === "whip") { ctx.moveTo(0, -20*scale); ctx.bezierCurveTo(-20*scale, -30*scale, 20*scale, -40*scale, 0, -50*scale); }
    else if (type === "blaster" || type === "fireball") { ctx.moveTo(-4*scale, -20*scale); ctx.lineTo(4*scale, -20*scale); ctx.lineTo(4*scale, -26*scale); ctx.lineTo(1*scale, -26*scale); ctx.lineTo(1*scale, -30*scale); ctx.lineTo(-1*scale, -30*scale); ctx.lineTo(-1*scale, -26*scale); ctx.lineTo(-4*scale, -26*scale); ctx.closePath(); }
    else { ctx.moveTo(0, -26 * scale); ctx.lineTo(0, -46 * scale); if (type === "hammer") { ctx.moveTo(-6 * scale, -42 * scale); ctx.lineTo(6 * scale, -42 * scale); } }
    ctx.stroke(); return;
  }
  ctx.fillStyle = c2;
  if (theme === "comic") { ctx.strokeStyle="#000"; ctx.lineWidth=1; }
  const drawPoly = (pts: number[]) => { ctx.beginPath(); ctx.moveTo(pts[0],pts[1]); for(let i=2; i<pts.length; i+=2) ctx.lineTo(pts[i], pts[i+1]); ctx.closePath(); ctx.fill(); if(theme==="comic") ctx.stroke(); };

  if (type === "dagger") { ctx.fillRect(-2 * scale, -26 * scale, 4 * scale, 6 * scale); ctx.fillStyle = c1; ctx.fillRect(-2 * scale, -30 * scale, 4 * scale, 4 * scale); } 
  else if (type === "spear") { ctx.fillRect(-2 * scale, -46 * scale, 4 * scale, 26 * scale); ctx.fillStyle = c1; ctx.fillRect(-3 * scale, -58 * scale, 6 * scale, 12 * scale); } 
  else if (type === "hammer") { ctx.fillRect(-2 * scale, -38 * scale, 4 * scale, 18 * scale); ctx.fillStyle = c1; ctx.fillRect(-8 * scale, -44 * scale, 16 * scale, 10 * scale); } 
  else if (type === "scythe") { ctx.fillRect(-2 * scale, -40 * scale, 4 * scale, 20 * scale); ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(-2*scale, -40*scale); ctx.quadraticCurveTo(-20*scale, -30*scale, -25*scale, -15*scale); ctx.lineTo(-20*scale, -15*scale); ctx.quadraticCurveTo(-15*scale, -25*scale, -2*scale, -35*scale); ctx.fill(); if(theme==="comic") ctx.stroke(); }
  else if (type === "axe") { ctx.fillRect(-2 * scale, -35 * scale, 4 * scale, 15 * scale); ctx.fillStyle = c1; ctx.fillRect(-10 * scale, -40 * scale, 20 * scale, 10 * scale); }
  else if (type === "katana") { ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(-2*scale, -20*scale); ctx.quadraticCurveTo(3*scale, -35*scale, -2*scale, -45*scale); ctx.lineTo(2*scale, -45*scale); ctx.quadraticCurveTo(7*scale, -35*scale, 2*scale, -20*scale); ctx.fill(); if(theme==="comic") ctx.stroke(); }
  else if (type === "mace") { ctx.fillRect(-2 * scale, -35 * scale, 4 * scale, 15 * scale); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, -35*scale, 8*scale, 0, Math.PI*2); ctx.fill(); if(theme==="comic") ctx.stroke(); }
  else if (type === "rapier") { ctx.fillRect(-1*scale, -45*scale, 2*scale, 25*scale); ctx.fillStyle=c1; ctx.fillRect(-3*scale, -25*scale, 6*scale, 3*scale); }
  else if (type === "whip") { ctx.strokeStyle=c1; ctx.lineWidth=2*scale; ctx.beginPath(); ctx.moveTo(0, -20*scale); ctx.bezierCurveTo(-20*scale, -30*scale, 20*scale, -40*scale, 0, -50*scale); ctx.stroke(); }
  else if (type === "blaster" || type === "fireball") { drawPoly([-4*scale,-20*scale, 4*scale,-20*scale, 4*scale,-26*scale, 1*scale,-26*scale, 1*scale,-30*scale, -1*scale,-30*scale, -1*scale,-26*scale, -4*scale,-26*scale]); ctx.fillStyle=c1; ctx.fillRect(-1*scale,-30*scale, 2*scale, 2*scale); }
  else { ctx.fillRect(-3 * scale, -46 * scale, 6 * scale, 8 * scale); ctx.fillStyle = c1; ctx.fillRect(-2 * scale, -38 * scale, 4 * scale, 12 * scale); }

  if(theme==="comic"){
      ctx.strokeStyle="#000"; ctx.lineWidth=1.5;
      if (type==="dagger") ctx.strokeRect(-2 * scale, -30 * scale, 4 * scale, 10 * scale);
      if (type==="spear") ctx.strokeRect(-3 * scale, -58 * scale, 6 * scale, 38 * scale);
      if (type==="hammer") { ctx.strokeRect(-2 * scale, -38 * scale, 4 * scale, 18 * scale); ctx.strokeRect(-8 * scale, -44 * scale, 16 * scale, 10 * scale); }
      if (type==="axe") { ctx.strokeRect(-2 * scale, -35 * scale, 4 * scale, 15 * scale); ctx.strokeRect(-10 * scale, -40 * scale, 20 * scale, 10 * scale); }
      if (type==="rapier") { ctx.strokeRect(-1*scale, -45*scale, 2*scale, 25*scale); ctx.strokeRect(-3*scale, -25*scale, 6*scale, 3*scale); }
  }
}

const spriteCache: Record<string, HTMLCanvasElement> = {};
function getCharSprite(c: Character, flash: boolean, theme: ThemeMode, devMode: boolean): HTMLCanvasElement {
  const key = `${c.team}-${c.scale}-${c.weapon}-${flash}-${theme}-${devMode}-${c.kineticType}`;
  if (spriteCache[key]) return spriteCache[key];
  const cvs = document.createElement("canvas"); const size = 160 * Math.max(1, c.scale); cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext("2d"); if (!ctx) return cvs; ctx.translate(size / 2, size / 2); drawRawChar(ctx, c, flash, theme, devMode, 0);
  spriteCache[key] = cvs; return cvs;
}
function renderChar(ctx: CanvasRenderingContext2D, c: Character, flash: boolean, alpha: number, theme: ThemeMode, devMode: boolean, useCache: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = alpha;

  // Use the cached sprite if we aren't flashing, devMode is off, and it's fully opaque
  if (useCache && !flash && !devMode && alpha === 1) {
    const sprite = getCharSprite(c, flash, theme, devMode);
    ctx.rotate(c.angle);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  } else {
    ctx.rotate(c.angle);
    drawRawChar(ctx, c, flash, theme, devMode, 0);
  }
  ctx.restore();
}

function drawHpBar(ctx: CanvasRenderingContext2D, c: Character, modifier: LokModifier, devMode: boolean, _theme: ThemeMode) {
  if ((modifier === "sudden_death" || modifier === "shrinking_arena") && !devMode) return;
  const barW = 30 * c.scale;
  const barH = 4 * c.scale;
  const py = c.y - CHAR_RADIUS * c.scale - 15 * c.scale;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(c.x - barW / 2, py, barW, barH);

  const hpPct = Math.max(0, c.hp / c.maxHp);
  ctx.fillStyle = hpPct > 0.5 ? "#00ff00" : hpPct > 0.2 ? "#ffff00" : "#ff0000";
  ctx.fillRect(c.x - barW / 2, py, barW * hpPct, barH);
}

function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, _devMode: boolean, theme: ThemeMode) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.globalAlpha = Math.max(0, g.life / g.maxLife) * 0.6;
  ctx.fillStyle = getTeamColor(g.team, theme);

  ctx.beginPath();
  ctx.arc(0, -5, 10, Math.PI, 0);
  ctx.lineTo(10, 10); ctx.lineTo(5, 5); ctx.lineTo(0, 10); ctx.lineTo(-5, 5); ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(-4, -7, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(4, -7, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function spawnExplosion(x: number, y: number, team: number, theme: ThemeMode, state: GameState, pool: Particle[], kType: KineticType = "standard") {
  const color = getTeamColor(team, theme, kType, 0);
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 4 + 1;
    pushParticle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, 20 + Math.random() * 20, color, 3 + Math.random() * 4, pool, state.optPool);
  }
}

export default function KineticSouls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const camRef = useRef({ x: ARENA_W / 2, y: SCOREBOARD_H + ARENA_H / 2, zoom: 1 });
  const keysRef = useRef<Set<string>>(new Set());

  const [showLiveMenu, setShowLiveMenu] = useState(false);
  const [godAction, setGodAction] = useState<"smite"|"heal"|"revive"|"freeze"|"enrage"|"mutate"|"infect"|"ascend">("smite");
  const [godTarget, setGodTarget] = useState<number>(2);
  const [birthType, setBirthType] = useState<KineticType>("standard");

  const [currentSplash] = useState(SPLASH_ARCHIVE[Math.floor(Math.random() * SPLASH_ARCHIVE.length)]);
  const [showMobileUI, setShowMobileUI] = useState(false);
  const [hoverBox, setHoverBox] = useState<{text: string, x: number, y: number} | null>(null);
  const [, setTick] = useState(0);
  const joyRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });

  const stateRef = useRef<GameState>({
    mode: "timer", opponent: "pvp", theme: "classic", modifier: "none", camera: "static", viewMode: "standard", weaponStyle: "standard", environment: "none",
    p1Score: 0, p2Score: 0, directorScore: 0, timeLeft: 120, scoreLimit: 10, fighterSpeed: 1.0, running: false, over: false, paused: false, p1Auto: false, devMode: false, winner: "",
    hitPause: 0, shakeFrames: 0, timeScale: 1, stats: { maxChars: 0, totalDmg: 0 }, 
    juice: "normal", hud: true, trails: false, ads: false, crtFilter: false, vhsFilter: false, invertFilter: false, aiMagnetic: false, handOfGod: false,
    optCache: true, optDelta: true, optGravity: true, optSmartSpawn: true, optGrid: true, optPool: true, actionCamTeam: 1, actionCamIndex: 0, draggingId: null, shrinkingZone: 0,
    fpsTarget: 60, menuParticles: true, menuDrift: true, menuGrid: true, menuPulse: true, menuCRT: false,
    moonGravity: false, explodingCorpses: false, sloMoKills: false, rainbowBlood: false, parallaxGrid: true, reactiveGrid: true
  });

  const refs = {
    mode: useRef<GameMode>("timer"), opp: useRef<OpponentMode>("pvp"), theme: useRef<ThemeMode>("classic"),
    mod: useRef<LokModifier>("none"), cam: useRef<CameraMode>("static"), view: useRef<ViewMode>("standard"), env: useRef<Environment>("none"), wep: useRef<WeaponStyle>("standard"),
    tLimit: useRef<number>(120), sLimit: useRef<number>(10), fSpeed: useRef<number>(1.0)
  };
  const screenRef = useRef<ScreenState>("menu");
  const dataRef = { 
      chars: useRef<Character[]>([]), parts: useRef<Particle[]>([]), ghosts: useRef<Ghost[]>([]), 
      texts: useRef<FloatingText[]>([]), feed: useRef<KillFeedMsg[]>([]), bombs: useRef<Drop[]>([]), projs: useRef<Projectile[]>([]) 
  };
  const timeRef = { raf: useRef(0), last: useRef(0), timerAcc: useRef(0), botTimer: useRef(0), botNext: useRef(2500), p1Timer: useRef(0) };

  const spawnText = useCallback((x: number, y: number, text: string, color: string, isSplat: boolean = false) => {
      const st = stateRef.current;
      if (st.optPool) {
          const deadT = dataRef.texts.current.find(t => !t.active);
          if (deadT) { deadT.x = x; deadT.y = y; deadT.text = text; deadT.color = color; deadT.life = 40; deadT.vy = -1.5; deadT.active = true; deadT.isSplat = isSplat; }
          else dataRef.texts.current.push({ x, y, text, color, life: 40, maxLife: 40, vy: -1.5, active: true, isSplat });
      } else {
          dataRef.texts.current.push({ x, y, text, color, life: 40, maxLife: 40, vy: -1.5, active: true, isSplat });
      }
  }, []);

  const drawOSRSplat = useCallback((ctx: CanvasRenderingContext2D, t: FloatingText) => {
      ctx.fillStyle = t.color;
      ctx.beginPath();
      for(let i=0; i<12; i++) {
          const angle = (i * Math.PI * 2) / 12;
          const r = i % 2 === 0 ? 16 : 8; 
          ctx.lineTo(t.x + Math.cos(angle)*r, t.y + Math.sin(angle)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "white"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.shadowBlur = 2; ctx.shadowColor = "black";
      ctx.fillText(t.text, t.x, t.y + 5);
      ctx.shadowBlur = 0;
  }, []);

  const triggerExplosion = useCallback((ex: number, ey: number, radius: number, state: GameState, isBomb: boolean = false) => {
      state.shakeFrames += state.juice === "super" ? 30 : 15;
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2; const spd = 4 + Math.random() * 8;
        const pColor = state.rainbowBlood ? `hsl(${Math.random()*360}, 100%, 50%)` : "#ff4400";
        pushParticle(ex, ey, Math.cos(a) * spd, Math.sin(a) * spd, 30 + Math.random() * 20, pColor, 3 + Math.random() * 5, dataRef.parts.current, state.optPool);
      }

      dataRef.chars.current.forEach(c => {
          if (c.dead) return;
          const dx = c.x - ex; const dy = c.y - ey; const dist = Math.hypot(dx, dy);
          if (dist < radius) {
              if (isBomb) {
                  if (Math.random() < 0.3) {
                      c.hp = 0; c.flashFrames = 5; 
                  } else {
                      const force = 20 * ((radius - dist) / radius) / c.mass;
                      c.vx += (dx / dist) * force; c.vy += (dy / dist) * force;
                      if (Math.random() < 0.5) c.stunTime = 60; else { c.vx *= 3; c.vy *= 3; }
                  }
              } else {
                 const force = 15 * ((radius - dist) / radius) / c.mass;
                 c.vx += (dx / dist) * force; c.vy += (dy / dist) * force;
                 c.hp -= 5; c.flashFrames = 5;
              }
          }
      });
  }, [dataRef]);

  const endGame = useCallback(() => {
    const st = stateRef.current; let winner = "";
    if (st.mode === "horde" || st.mode === "infection") winner = st.p1Score >= 50 ? "You Survived!" : "The Horde Consumed You";
    else if (st.mode === "unlimited") winner = "Match Concluded";
    else { if (st.p1Score > st.p2Score) winner = "Player 1 Wins!"; else if (st.p2Score > st.p1Score) winner = "The Enemy Wins!"; else winner = "It's a Draw!"; }
    stateRef.current = { ...st, running: false, over: true, paused: false, winner, draggingId: null }; screenRef.current = "over";
  }, []);

  const startGame = useCallback(() => {
    charIdCounter = 0;
    if (!stateRef.current.optPool) { dataRef.chars.current = []; dataRef.parts.current = []; dataRef.ghosts.current = []; dataRef.texts.current = []; dataRef.feed.current = []; dataRef.bombs.current = []; dataRef.projs.current = []; } 
    else { dataRef.chars.current.forEach((c) => (c.dead = true)); dataRef.parts.current.forEach((p) => (p.active = false)); dataRef.ghosts.current.forEach((g) => (g.active = false)); dataRef.texts.current.forEach((t) => (t.active = false)); dataRef.feed.current.forEach((f) => (f.active = false)); dataRef.bombs.current.forEach(b => b.active = false); dataRef.projs.current.forEach(p => p.active = false); }

    timeRef.timerAcc.current = 0; timeRef.botTimer.current = 0; timeRef.p1Timer.current = 0; camRef.current = { x: ARENA_W / 2, y: SCOREBOARD_H + ARENA_H / 2, zoom: 1 };
    let limit = refs.mode.current === "score" ? refs.sLimit.current : 0;
    if (refs.mode.current === "horde" || refs.mode.current === "infection") { limit = 50; refs.opp.current = "bot"; }
    timeRef.botNext.current = BOT_MIN_INTERVAL + Math.random() * (BOT_MAX_INTERVAL - BOT_MIN_INTERVAL);

    stateRef.current.mode = refs.mode.current; stateRef.current.opponent = refs.opp.current; stateRef.current.theme = refs.theme.current; stateRef.current.modifier = refs.mod.current; stateRef.current.camera = refs.cam.current; stateRef.current.viewMode = refs.view.current; stateRef.current.weaponStyle = refs.wep.current; stateRef.current.environment = refs.env.current;

    if (refs.view.current === "cinematic") { stateRef.current.camera = "enhanced"; stateRef.current.hud = false; }
    else if (refs.view.current === "theater") { stateRef.current.hud = false; }

    stateRef.current = { ...stateRef.current, p1Score: 0, p2Score: 0, directorScore: 0, fighterSpeed: refs.fSpeed.current, timeLeft: refs.mode.current === "unlimited" ? Infinity : refs.tLimit.current, scoreLimit: refs.mode.current === "unlimited" ? Infinity : limit, running: true, over: false, paused: false, p1Auto: false, winner: "", hitPause: 0, shakeFrames: 0, timeScale: 1, stats: { maxChars: 0, totalDmg: 0 }, actionCamTeam: 1, actionCamIndex: 0, draggingId: null, shrinkingZone: 0 };

    if (refs.mode.current === "infection") {
      dataRef.chars.current.push(spawnCharacter(1, refs.mod.current, dataRef.chars.current, true, stateRef.current.optPool, refs.wep.current, stateRef.current.fighterSpeed));
      for (let i = 0; i < 15; i++) dataRef.chars.current.push(spawnCharacter(2, refs.mod.current, dataRef.chars.current, true, stateRef.current.optPool, refs.wep.current, stateRef.current.fighterSpeed));
    }
    screenRef.current = "game";
  }, [refs, dataRef, timeRef]);

  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
      const dtRaw = Math.min(timestamp - timeRef.last.current, 50); timeRef.last.current = timestamp;
      const screen = screenRef.current; const state = stateRef.current; 

      const fpsMulti = state.fpsTarget / 60; 
      const subDtRaw = dtRaw / fpsMulti;

      ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (screen === "menu") { drawMainMenu(ctx, refs.mode.current, refs.opp.current, mouseRef.current, timestamp, state); } 
      else if (screen === "lok_menu") { drawLokMenu(ctx, refs.mode.current, refs.theme.current, refs.mod.current, refs.cam.current, refs.wep.current, refs.env.current, refs.view.current, mouseRef.current, state, timestamp); } 
      else if (screen === "settings_menu") { drawSettingsMenu(ctx, state, timestamp); }
      else if (screen === "over") { drawGameOver(ctx, state); } 
      else if (screen === "game") {

        let updatePhysics = state.running && !state.paused;
        if (updatePhysics && state.hitPause > 0 && state.juice !== "off") { state.hitPause -= dtRaw; updatePhysics = false; }
        if (state.timeScale < 1) { state.timeScale += 0.005; if (state.timeScale > 1) state.timeScale = 1; }

        if (updatePhysics) {
          if (state.mode === "timer" && state.timeLeft !== Infinity) {
            timeRef.timerAcc.current += dtRaw;
            if (timeRef.timerAcc.current >= 1000) { timeRef.timerAcc.current -= 1000; state.timeLeft -= 1; if (state.timeLeft <= 0) endGame(); }
          }
          if (state.modifier === "shrinking_arena") { state.shrinkingZone += 0.2 * (dtRaw/16.666) * state.timeScale; }

          if (state.opponent === "bot" && state.mode !== "infection") {
            timeRef.botTimer.current += dtRaw * state.timeScale; let minSpawn = state.mode === "horde" ? 300 : BOT_MIN_INTERVAL; let maxSpawn = state.mode === "horde" ? 800 : BOT_MAX_INTERVAL;
            if (timeRef.botTimer.current >= timeRef.botNext.current) {
              timeRef.botTimer.current = 0; timeRef.botNext.current = minSpawn + Math.random() * (maxSpawn - minSpawn);
              const newC = spawnCharacter(2, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle, state.fighterSpeed);
              if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
            }
          } else if (state.opponent === "ffa") {
            timeRef.botTimer.current += dtRaw * state.timeScale;
            if (timeRef.botTimer.current >= timeRef.botNext.current) {
              timeRef.botTimer.current = 0; timeRef.botNext.current = 800 + Math.random() * 1500;
              const randomTeam = (Math.floor(Math.random() * 4) + 1) as 1 | 2 | 3 | 4;
              const newC = spawnCharacter(randomTeam, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle, state.fighterSpeed);
              if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
            }
          }

          if (state.p1Auto) {
            timeRef.p1Timer.current += dtRaw * state.timeScale;
            if (timeRef.p1Timer.current >= 2000) {
              timeRef.p1Timer.current = 0;
              const newC = spawnCharacter(1, state.modifier, dataRef.chars.current, state.optSmartSpawn, state.optPool, state.weaponStyle, state.fighterSpeed);
              if (!state.optPool || newC.id >= charIdCounter - 1) dataRef.chars.current.push(newC);
            }
          }

          const chars = dataRef.chars.current; let activeCharCount = 0;

          if (state.handOfGod && state.draggingId !== null && mouseRef.current.isDown) {
            const dc = chars.find((c) => c.id === state.draggingId);
            if (dc && !dc.dead) {
              const rect = canvasRef.current!.getBoundingClientRect();
              const rawMx = (mouseRef.current.x - rect.left) * (ARENA_W / rect.width); const rawMy = (mouseRef.current.y - rect.top) * ((ARENA_H + SCOREBOARD_H) / rect.height);
              const worldX = (rawMx - ARENA_W / 2) / camRef.current.zoom + camRef.current.x; const worldY = (rawMy - (SCOREBOARD_H + ARENA_H / 2)) / camRef.current.zoom + camRef.current.y;
              dc.vx = (worldX - dc.x) * 0.2; dc.vy = (worldY - dc.y) * 0.2; dc.x = worldX; dc.y = worldY;
            } else { state.draggingId = null; }
          }

          for (let step = 0; step < fpsMulti; step++) {
              const dtScale = (state.optDelta ? subDtRaw / 16.666 : 1 / fpsMulti) * state.timeScale;

              for (let i = 0; i < chars.length; i++) {
                  const c = chars[i];
                  if (c.dead) continue; 
                  if (step === 0) {
                      activeCharCount++;
                      c.trail.unshift({ x: c.x, y: c.y, angle: c.angle }); if (c.trail.length > 5) c.trail.pop();
                      if (c.flashFrames > 0) c.flashFrames--;
                      if (c.cooldown > 0) c.cooldown -= dtRaw * state.timeScale;
                      if (c.kineticType === "ninja" && Math.random() < 0.005 * state.timeScale) {
                          c.x += (Math.random()-0.5)*100; c.y += (Math.random()-0.5)*100;
                          pushParticle(c.x, c.y, 0, -2, 20, "#fff", 4, dataRef.parts.current, state.optPool);
                      }
                  }

                  if (state.draggingId === c.id) continue;

                  if (c.stunTime && c.stunTime > 0) {
                      if(step===0) c.stunTime -= (dtRaw/16.666) * state.timeScale;
                      c.vx *= Math.pow(0.9, 1/fpsMulti); c.vy *= Math.pow(0.9, 1/fpsMulti); 
                  } else {
                      if (state.environment === "blackhole") { const cx = ARENA_W / 2; const cy = SCOREBOARD_H + ARENA_H / 2; c.vx += (cx - c.x) * 0.001 * dtScale; c.vy += (cy - c.y) * 0.001 * dtScale; }
                      if (state.environment === "storm") { c.vx += 0.15 * dtScale; }

                      if (state.modifier === "magnet" || state.modifier === "repel") {
                          for (let j = 0; j < chars.length; j++) {
                              if (i===j) continue; const o = chars[j]; if(o.dead || o.kineticType==="ghost" || c.kineticType==="ghost") continue;
                              const dx = o.x - c.x; const dy = o.y - c.y; const d = Math.hypot(dx,dy);
                              if (d > 10 && d < 300) {
                                  const force = (state.modifier === "magnet" ? 0.05 : -0.05) * dtScale;
                                  c.vx += (dx/d) * force; c.vy += (dy/d) * force;
                              }
                          }
                      }

                      if (state.aiMagnetic && c.kineticType !== "null") {
                        let nearest = Infinity; let target = null;
                        for (const e of chars) {
                          if (e.dead || e.team === c.team || (c.team===5 && e.team===5) || e.kineticType==="null") continue;
                          const d = Math.hypot(e.x - c.x, e.y - c.y);
                          if (d < nearest) { nearest = d; target = e; }
                        }
                        if (target) {
                          const a = Math.atan2(target.y - c.y, target.x - c.x); c.vx += Math.cos(a) * 0.15 * dtScale; c.vy += Math.sin(a) * 0.15 * dtScale;
                          const spd = Math.hypot(c.vx, c.vy); const max = (SPAWN_SPEED + 1.5) * (state.modifier === "titans" ? 0.8 : 1.2) * state.fighterSpeed;
                          if (spd > max) { c.vx = (c.vx / spd) * max; c.vy = (c.vy / spd) * max; }
                        }
                      }

                      if ((c.weapon === "blaster" || c.weapon === "fireball") && c.cooldown <= 0) {
                          let nearest = Infinity; let target = null;
                          for (const e of chars) {
                              if (e.dead || e.team === c.team || (c.team===5 && e.team===5) || e.kineticType==="null") continue;
                              const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < nearest) { nearest = d; target = e; }
                          }
                          if (target && nearest < 400) {
                              const a = Math.atan2(target.y - c.y, target.x - c.x);
                              c.angle = a + Math.PI/2; 
                              const pvx = Math.cos(a) * 10; const pvy = Math.sin(a) * 10;
                              const [tipX, tipY] = getWeaponTip(c);
                              if (state.optPool) {
                                  const deadP = dataRef.projs.current.find(p => !p.active);
                                  if (deadP) { deadP.x=tipX; deadP.y=tipY; deadP.vx=pvx; deadP.vy=pvy; deadP.life=80; deadP.team=c.team; deadP.color=getTeamColor(c.team, state.theme); deadP.active=true; deadP.type = c.weapon==="fireball"?"fireball":"laser"; }
                                  else dataRef.projs.current.push({x:tipX, y:tipY, vx:pvx, vy:pvy, life:80, team:c.team, color:getTeamColor(c.team, state.theme), active:true, type: c.weapon==="fireball"?"fireball":"laser"});
                              } else { dataRef.projs.current.push({x:tipX, y:tipY, vx:pvx, vy:pvy, life:80, team:c.team, color:getTeamColor(c.team, state.theme), active:true, type: c.weapon==="fireball"?"fireball":"laser"}); }
                              c.cooldown = c.weapon==="fireball"?1500:1000; 
                          }
                      }
                  }

                  c.x += c.vx * dtScale; c.y += c.vy * dtScale; 
                  if (!c.stunTime || c.stunTime <= 0) c.angle += c.angularV * dtScale;

                  if (isNaN(c.x) || isNaN(c.y) || Math.abs(c.vx)>100) { c.hp = 0; c.dead = true; continue; }

                  const bound = CHAR_RADIUS * c.scale + 4 + (state.modifier === "shrinking_arena" ? state.shrinkingZone : 0);

                  if (state.environment === "wrap" && c.kineticType !== "ghost") {
                      if (c.x < 0) c.x = ARENA_W; if (c.x > ARENA_W) c.x = 0;
                      if (c.y < SCOREBOARD_H) c.y = SCOREBOARD_H + ARENA_H; if (c.y > SCOREBOARD_H + ARENA_H) c.y = SCOREBOARD_H;
                  } else if (c.kineticType !== "ghost") {
                      if (state.environment === "ice") {
                        if (c.x < bound) { c.x = bound; c.vx = Math.abs(c.vx); }
                        if (c.x > ARENA_W - bound) { c.x = ARENA_W - bound; c.vx = -Math.abs(c.vx); }
                        if (c.y < SCOREBOARD_H + bound) { c.y = SCOREBOARD_H + bound; c.vy = Math.abs(c.vy); }
                        if (c.y > SCOREBOARD_H + ARENA_H - bound) { c.y = SCOREBOARD_H + ARENA_H - bound; c.vy = -Math.abs(c.vy); }
                      } else if (state.environment === "bouncy") {
                        if (c.x < bound) { c.x = bound; c.vx = Math.abs(c.vx) * 1.1; }
                        if (c.x > ARENA_W - bound) { c.x = ARENA_W - bound; c.vx = -Math.abs(c.vx) * 1.1; }
                        if (c.y < SCOREBOARD_H + bound) { c.y = SCOREBOARD_H + bound; c.vy = Math.abs(c.vy) * 1.1; }
                        if (c.y > SCOREBOARD_H + ARENA_H - bound) { c.y = SCOREBOARD_H + ARENA_H - bound; c.vy = -Math.abs(c.vy) * 1.1; }
                      } else {
                        const fric = state.moonGravity ? 0.99 : 0.9;
                        if (c.x < bound) { c.x = bound; c.vx = Math.abs(c.vx) * fric; }
                        if (c.x > ARENA_W - bound) { c.x = ARENA_W - bound; c.vx = -Math.abs(c.vx) * fric; }
                        if (c.y < SCOREBOARD_H + bound) { c.y = SCOREBOARD_H + bound; c.vy = Math.abs(c.vy) * fric; }
                        if (c.y > SCOREBOARD_H + ARENA_H - bound) { c.y = SCOREBOARD_H + ARENA_H - bound; c.vy = -Math.abs(c.vy) * fric; }
                      }
                  } else {
                      // Ghosts wrap always
                      if (c.x < 0) c.x = ARENA_W; if (c.x > ARENA_W) c.x = 0;
                      if (c.y < SCOREBOARD_H) c.y = SCOREBOARD_H + ARENA_H; if (c.y > SCOREBOARD_H + ARENA_H) c.y = SCOREBOARD_H;
                  }

                  if (state.modifier === "shrinking_arena" && (c.x <= bound || c.x >= ARENA_W - bound || c.y <= SCOREBOARD_H + bound || c.y >= SCOREBOARD_H + ARENA_H - bound)) {
                      if (Math.random() < 0.2 * dtScale) { c.hp -= 2; c.flashFrames = 2; }
                  }

                  if (state.environment === "lava" && c.y > SCOREBOARD_H + ARENA_H - ARENA_H * 0.15) { if (Math.random() < 0.1 * dtScale) { c.hp -= 1; c.flashFrames = 2; } }
              }

              for (const p of dataRef.projs.current) {
                  if (!p.active && state.optPool) continue;
                  p.x += p.vx * dtScale; p.y += p.vy * dtScale; p.life -= dtScale;
                  if (p.life <= 0) { p.active = false; continue; }
                  for (const c of chars) {
                      if (c.dead || c.team === p.team || (c.team===5 && p.team===5) || c.kineticType==="ghost" || c.kineticType==="null") continue;
                      if (Math.hypot(c.x - p.x, c.y - p.y) < CHAR_RADIUS * c.scale + 5) {
                          const dmg = p.type === "fireball" ? 8 : 4;
                          if (p.type === "fireball") triggerExplosion(p.x, p.y, 40, state, false); // AoE fireball
                          if (c.shieldHp > 0) {
                              c.shieldHp -= dmg;
                              if (state.theme === "runesite_ultimate" || state.theme === "runesite") spawnText(c.x, c.y, "0", "#4444ff", true);
                              else spawnText(c.x, c.y-20, "BLOCK", "#44aaff", false);
                          } else {
                              c.hp -= dmg; c.flashFrames = 3; state.stats.totalDmg += dmg;
                              if (state.theme === "runesite_ultimate") { spawnText(c.x, c.y, `${dmg}`, "#ff0000", true); } else { spawnText(c.x, c.y - 20, `-${dmg}`, "#fff", false); }
                          }
                          c.vx += p.vx * (0.5/c.mass); c.vy += p.vy * (0.5/c.mass); p.active = false;
                          break;
                      }
                  }
              }

              if (state.optGrid) {
                const grid = new Map<string, Character[]>();
                for (const c of chars) {
                  if (c.dead || c.kineticType === "ghost") continue;
                  const cx = Math.floor(c.x / GRID_CELL_SIZE); const cy = Math.floor(c.y / GRID_CELL_SIZE); const key = `${cx},${cy}`;
                  if (!grid.has(key)) grid.set(key, []); grid.get(key)!.push(c);
                }
                for (const c of chars) {
                  if (c.dead || c.kineticType === "ghost") continue;
                  const cx = Math.floor(c.x / GRID_CELL_SIZE); const cy = Math.floor(c.y / GRID_CELL_SIZE);
                  for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                      const cell = grid.get(`${cx + ox},${cy + oy}`);
                      if (cell) {
                        for (const b of cell) {
                          if (c.id >= b.id || b.dead) continue;
                          processCollision(c, b, state, dtScale);
                        }
                      }
                    }
                  }
                }
              } else {
                for (let i = 0; i < chars.length; i++) {
                  const a = chars[i]; if (a.dead || a.kineticType === "ghost") continue;
                  for (let j = i + 1; j < chars.length; j++) {
                    const b = chars[j]; if (b.dead || b.kineticType === "ghost") continue; processCollision(a, b, state, dtScale);
                  }
                }
              }
          } 

          if (activeCharCount > state.stats.maxChars) state.stats.maxChars = activeCharCount;

          for (const b of dataRef.bombs.current) {
              if (!b.active && state.optPool) continue;
              b.timer -= dtRaw * state.timeScale;

              if (b.type === "blackhole") {
                  chars.forEach(c => {
                      if(c.dead || c.kineticType==="ghost") return;
                      const dx = b.x - c.x; const dy = b.y - c.y; const dist = Math.hypot(dx, dy);
                      if (dist < b.radius) { c.vx += (dx/dist) * 0.5 * state.timeScale; c.vy += (dy/dist) * 0.5 * state.timeScale; }
                  });
              }

              if (b.timer <= 0) { 
                  b.active = false; 
                  if (b.type === "bomb") triggerExplosion(b.x, b.y, b.radius, state, true);
                  else if (b.type === "nuke") { state.shakeFrames+=50; triggerExplosion(b.x, b.y, b.radius, state, true); }
                  else if (b.type === "medkit") { chars.forEach(c => { if(Math.hypot(c.x-b.x, c.y-b.y) < b.radius) { c.hp = c.maxHp; spawnText(c.x, c.y-10, "+HP", "#00ff00"); }}); }
                  else if (b.type === "freeze") { chars.forEach(c => { if(Math.hypot(c.x-b.x, c.y-b.y) < b.radius) { c.stunTime = 180; spawnText(c.x, c.y-10, "FROZEN", "#00ffff"); }}); }
              }
          }
          if (!state.optPool) dataRef.bombs.current = dataRef.bombs.current.filter(b => b.timer > 0);

          for (const ft of dataRef.texts.current) {
            if (!ft.active && state.optPool) continue;
            ft.y += ft.vy * (dtRaw/16.666) * state.timeScale; ft.life -= (dtRaw/16.666) * state.timeScale;
            if (ft.life <= 0) ft.active = false;
          }
          if (!state.optPool) dataRef.texts.current = dataRef.texts.current.filter((ft) => ft.life > 0);

          for (const msg of dataRef.feed.current) {
            if (!msg.active && state.optPool) continue;
            msg.life -= (dtRaw/16.666) * state.timeScale; if (msg.life <= 0) msg.active = false;
          }
          if (!state.optPool) dataRef.feed.current = dataRef.feed.current.filter((m) => m.life > 0);

          for (let i=0; i<chars.length; i++) {
            const c = chars[i];
            if (!c.dead && c.hp <= 0) {
              c.dead = true; state.directorScore++; 
              if (state.draggingId === c.id) state.draggingId = null;

              if (state.juice !== "off") {
                  state.hitPause = state.juice === "super" ? 100 : 50;
                  if (state.sloMoKills) state.timeScale = 0.2;
              }
              if (!state.devMode) spawnExplosion(c.x, c.y, c.team, state.theme, state, dataRef.parts.current, c.kineticType);

              if (c.kineticType === "necromancer") {
                  triggerExplosion(c.x, c.y, 100, state, false);
                  chars.forEach(z => {
                      if(!z.dead && z.isZombie) {
                          z.dead = true; spawnExplosion(z.x, z.y, z.team, state.theme, state, dataRef.parts.current, z.kineticType);
                          if(Math.random()<0.1) {
                              const nk = spawnCharacter(5, state.modifier, chars, false, state.optPool, state.weaponStyle, state.fighterSpeed, z.x, z.y, "null");
                              if (!state.optPool || nk.id >= charIdCounter - 1) chars.push(nk);
                          } else {
                              triggerExplosion(z.x, z.y, 60, state, true);
                          }
                      }
                  });
              }

              if (state.explodingCorpses) triggerExplosion(c.x, c.y, 80, state, false);

              if (state.modifier === "necromancy" && Math.random() < 0.3 && !c.isZombie && c.kineticType !== "null") {
                  const z = spawnCharacter(5, state.modifier, chars, false, state.optPool, state.weaponStyle, state.fighterSpeed, c.x, c.y, "zombie");
                  if (!state.optPool || z.id >= charIdCounter - 1) chars.push(z);
              }

              if (state.mode === "infection" && c.team !== 1) {
                const z = spawnCharacter(1, state.modifier, chars, false, state.optPool, state.weaponStyle, state.fighterSpeed, c.x, c.y);
                if (!state.optPool || z.id >= charIdCounter - 1) chars.push(z);
              }

              if (state.optPool) {
                const deadG = dataRef.ghosts.current.find((g) => !g.active);
                if (deadG) { deadG.x = c.x; deadG.y = c.y; deadG.team = c.team; deadG.vy = -1.5; deadG.life = 120; deadG.scored = false; deadG.active = true; } 
                else dataRef.ghosts.current.push({ x: c.x, y: c.y, team: c.team, vy: -1.5, life: 120, maxLife: 120, scored: false, active: true });
                const deadF = dataRef.feed.current.find((f) => !f.active);
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
            if (state.environment === "blackhole") {
              const cx = ARENA_W / 2; const cy = SCOREBOARD_H + ARENA_H / 2; g.x += (cx - g.x) * 0.02; g.y += (cy - g.y) * 0.02;
            } else { g.y += g.vy * (dtRaw/16.666) * state.timeScale; }
            g.life -= (dtRaw/16.666) * state.timeScale;
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
            if (state.environment === "blackhole") {
              const cx = ARENA_W / 2; const cy = SCOREBOARD_H + ARENA_H / 2; p.vx += (cx - p.x) * 0.01; p.vy += (cy - p.y) * 0.01;
            }
            if (state.optGravity && state.environment !== "blackhole") {
              p.vy += 0.2 * (dtRaw/16.666) * state.timeScale; p.x += p.vx * (dtRaw/16.666) * state.timeScale; p.y += p.vy * (dtRaw/16.666) * state.timeScale; p.life -= (dtRaw/16.666) * state.timeScale;
              if (p.y > SCOREBOARD_H + ARENA_H - 2) { p.y = SCOREBOARD_H + ARENA_H - 2; p.vy *= -0.5; p.vx *= 0.8; }
            } else { p.x += p.vx * (dtRaw/16.666) * state.timeScale; p.y += p.vy * (dtRaw/16.666) * state.timeScale; p.life -= (dtRaw/16.666) * state.timeScale; }
            if (p.life <= 0) p.active = false;
          }
          if (!state.optPool) dataRef.parts.current = dataRef.parts.current.filter((p) => p.life > 0);
        }

        function processCollision(a: Character, b: Character, st: GameState, dt: number) {
          const dx = b.x - a.x; const dy = b.y - a.y; const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = CHAR_RADIUS * a.scale + CHAR_RADIUS * b.scale + 4;
          if (dist < minDist && dist > 0) {
            if (a.kineticType === "null") { a.contacts++; if(a.contacts>20 || Math.random()<0.1){ a.hp=0; a.dead=true; triggerExplosion(a.x,a.y, 60, st, false); return; } }
            if (b.kineticType === "null") { b.contacts++; if(b.contacts>20 || Math.random()<0.1){ b.hp=0; b.dead=true; triggerExplosion(b.x,b.y, 60, st, false); return; } }

            const overlap = (minDist - dist) / 2; const nx = dx / dist; const ny = dy / dist;
            a.x -= nx * overlap * (b.mass / (a.mass+b.mass)); a.y -= ny * overlap * (b.mass / (a.mass+b.mass)); 
            b.x += nx * overlap * (a.mass / (a.mass+b.mass)); b.y += ny * overlap * (a.mass / (a.mass+b.mass));

            const fric = st.environment === "ice" ? 1 : st.environment === "bouncy" ? 1.02 : st.moonGravity ? 0.99 : 0.85;
            const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (dot > 0) { 
                const p = 2 * dot / (a.mass + b.mass);
                a.vx -= p * b.mass * nx * fric; a.vy -= p * b.mass * ny * fric; 
                b.vx += p * a.mass * nx * fric; b.vy += p * a.mass * ny * fric; 
            }

            if (a.team !== b.team && !(a.team===5 && b.team===5) && a.kineticType!=="null" && b.kineticType!=="null") {
              const processHit = (attacker: Character, victim: Character) => {
                const [wX, wY] = getWeaponTip(attacker);
                let wR = 6; if (attacker.weapon === "dagger" || attacker.weapon === "katana" || attacker.weapon === "rapier") wR = 4; else if (attacker.weapon === "hammer" || attacker.weapon === "axe" || attacker.weapon === "mace") wR = 10;
                for (const p of victim.parts) {
                  const [rpX, rpY] = rotatePoint(p.ox, p.oy, victim.angle);
                  if (circlesOverlap(wX, wY, wR * attacker.scale, victim.x + rpX, victim.y + rpY, p.r)) {

                    const dmg = st.modifier === "sudden_death" || st.modifier === "shrinking_arena" ? 99 : getPartDamage(p.type);

                    if (victim.shieldHp > 0) {
                        victim.shieldHp -= dmg;
                        if (st.theme === "runesite_ultimate" || st.theme === "runesite") spawnText(victim.x, victim.y, "0", "#4444ff", true);
                        else spawnText(victim.x, victim.y-20, "BLOCK", "#44aaff", false);
                        break;
                    }

                    victim.hp -= dmg; victim.flashFrames = 3; st.stats.totalDmg += dmg;
                    if (p.type === "head") st.shakeFrames = st.juice === "super" ? 24 : 8;
                    if (attacker.weapon === "hammer" || attacker.weapon === "axe" || attacker.weapon === "mace") { victim.vx -= nx * 10 * attacker.scale / victim.mass; victim.vy -= ny * 10 * attacker.scale / victim.mass; }
                    if (attacker.weapon === "whip") { victim.vx += nx * 5 * attacker.scale / victim.mass; victim.vy += ny * 5 * attacker.scale / victim.mass; } 

                    if (st.modifier === "vampire_kiss") { attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * 0.5); }

                    if (st.theme === "runesite_ultimate") {
                        spawnText(victim.x, victim.y, `${dmg}`, "#ff0000", true); 
                        spawnText(attacker.x, attacker.y - 20, `+${dmg * 4} xp`, "#fff", false); 
                    } else {
                        const color = p.type === "head" ? (st.theme === "gameboy" ? "#0f380f" : "#ff4444") : "#fff";
                        spawnText(victim.x, victim.y - 20, `-${dmg}`, color, false);
                    }
                    break;
                  }
                }
              };
              processHit(a, b); processHit(b, a);
            }
          }
        }

        let targetX = ARENA_W / 2; let targetY = SCOREBOARD_H + ARENA_H / 2; let targetZoom = 1;
        const aliveChars = dataRef.chars.current.filter((c) => !c.dead);

        if (state.camera === "enhanced" && aliveChars.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            aliveChars.forEach((c) => { if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x; if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y; });
            const bw = Math.max(maxX - minX, 300); const bh = Math.max(maxY - minY, 200);
            targetX = minX + bw / 2; targetY = minY + bh / 2; targetZoom = Math.min(ARENA_W / bw, ARENA_H / bh, 2.5);
            if (targetX < ARENA_W/targetZoom/2) targetX = ARENA_W/targetZoom/2;
            if (targetX > ARENA_W - ARENA_W/targetZoom/2) targetX = ARENA_W - ARENA_W/targetZoom/2;
            if (targetY < SCOREBOARD_H + (ARENA_H/targetZoom/2)) targetY = SCOREBOARD_H + (ARENA_H/targetZoom/2);
            if (targetY > SCOREBOARD_H + ARENA_H - (ARENA_H/targetZoom/2)) targetY = SCOREBOARD_H + ARENA_H - (ARENA_H/targetZoom/2);
        } else if (state.camera === "dynamic" && aliveChars.length > 0) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          aliveChars.forEach((c) => { if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x; if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y; });
          minX -= 100; maxX += 100; minY -= 100; maxY += 100;
          if (minX < 0) minX = 0; if (maxX > ARENA_W) maxX = ARENA_W;
          if (minY < SCOREBOARD_H) minY = SCOREBOARD_H; if (maxY > SCOREBOARD_H + ARENA_H) maxY = SCOREBOARD_H + ARENA_H;
          const bw = Math.max(maxX - minX, 400); const bh = Math.max(maxY - minY, 250);
          targetX = minX + bw / 2; targetY = minY + bh / 2; targetZoom = Math.min(ARENA_W / bw, ARENA_H / bh, 2.2);
        } else if (state.camera === "action") {
          const teamChars = aliveChars.filter((c) => c.team === state.actionCamTeam);
          if (teamChars.length > 0) {
            if (state.actionCamIndex >= teamChars.length) state.actionCamIndex = 0;
            if (state.actionCamIndex < 0) state.actionCamIndex = teamChars.length - 1;
            const targetChar = teamChars[state.actionCamIndex]; targetX = targetChar.x; targetY = targetChar.y; targetZoom = 2.5;
          } else { targetZoom = 1; }
        }

        camRef.current.x += (targetX - camRef.current.x) * 0.08;
        camRef.current.y += (targetY - camRef.current.y) * 0.08;
        camRef.current.zoom += (targetZoom - camRef.current.zoom) * 0.08;

        let bgColor = "#111122";
        if (state.theme === "neon") bgColor = "#050505";
        if (state.theme === "gameboy") bgColor = "#9bbc0f";
        if (state.theme === "runesite" || state.theme === "runesite_ultimate") bgColor = "#2b2620";
        if (state.theme === "gsix") bgColor = "#080808"; // Fixed GSix Orange bug
        if (state.theme === "gilded") bgColor = "#1a0f00";
        if (state.theme === "lokmod") bgColor = "#080814";
        if (state.theme === "hacker") bgColor = "#001100";
        if (state.theme === "synthwave") bgColor = "#110022";
        if (state.theme === "vampire") bgColor = "#110000";
        if (state.theme === "oceanic") bgColor = "#001122";
        if (state.theme === "infernal" || state.theme === "overdrive") bgColor = "#220000";
        if (state.theme === "wasteland") bgColor = "#2a2a25";
        if (state.theme === "ethereal") bgColor = "#f0f8ff";
        if (state.theme === "comic") bgColor = "#ffffff";
        if (state.theme === "abyss" || state.theme === "void" || state.theme === "monochrome" || state.theme === "glitch" || state.theme === "neon_abyss" || state.theme === "rgb_cycle") bgColor = "#000000";
        if (state.environment === "blackout") bgColor = "#000";

        ctx.fillStyle = bgColor; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);

        // --- GRID RENDERING WITH PARALLAX & JIGGLE ---
        ctx.save();

        let pOffsetX = 0; let pOffsetY = 0;
        if (state.parallaxGrid && state.camera !== "static") {
            pOffsetX = -(camRef.current.x - ARENA_W / 2) * 0.15;
            pOffsetY = -(camRef.current.y - (SCOREBOARD_H + ARENA_H / 2)) * 0.15;
        }
        if (state.reactiveGrid && state.shakeFrames > 0 && state.juice !== "off") {
            pOffsetX += (Math.random() - 0.5) * (state.juice === "super" ? 15 : 6);
            pOffsetY += (Math.random() - 0.5) * (state.juice === "super" ? 15 : 6);
        }

        if (state.theme !== "abyss" && state.theme !== "hacker" && state.theme !== "void" && state.theme !== "monochrome" && state.theme !== "neon_abyss" && state.theme !== "rgb_cycle" && state.environment !== "blackout") {
          let gridColor = "#334";
          if (state.theme === "neon") gridColor = "#112244"; if (state.theme === "gameboy") gridColor = "#8bac0f";
          if (state.theme === "runesite" || state.theme === "runesite_ultimate") gridColor = "#403930"; if (state.theme === "gsix") gridColor = "#004444"; // Teal grid
          if (state.theme === "gilded") gridColor = "#664400"; if (state.theme === "synthwave") gridColor = "#440066";
          if (state.theme === "vampire" || state.theme === "overdrive") gridColor = "#440000"; if (state.theme === "oceanic") gridColor = "#004466";
          if (state.theme === "infernal") gridColor = "#661100"; if (state.theme === "wasteland") gridColor = "#404030";
          if (state.theme === "ethereal") gridColor = "#d0e0f0"; if (state.theme === "lokmod") gridColor = "#333333";
          if (state.theme === "comic") gridColor = "#aaaaaa";

          ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
          for (let gx = (pOffsetX % 40) - 40; gx <= ARENA_W + 40; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, SCOREBOARD_H); ctx.lineTo(gx, SCOREBOARD_H + ARENA_H); ctx.stroke(); }
          for (let gy = SCOREBOARD_H + (pOffsetY % 40) - 40; gy <= SCOREBOARD_H + ARENA_H + 40; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(ARENA_W, gy); ctx.stroke(); }
        }

        if (state.environment !== "ice" && state.environment !== "wrap" && state.theme !== "abyss" && state.theme !== "void" && state.theme !== "neon_abyss" && state.theme !== "rgb_cycle" && state.environment !== "blackout") {
            ctx.strokeStyle = state.theme === "gameboy" ? "#306230" : state.theme === "gilded" ? "#ffaa00" : state.theme === "ethereal" ? "#aaccff" : state.theme === "comic" ? "#000" : "rgba(255,255,255,0.2)";
            ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
            ctx.beginPath(); ctx.moveTo(ARENA_W / 2 + pOffsetX, SCOREBOARD_H); ctx.lineTo(ARENA_W / 2 + pOffsetX, SCOREBOARD_H + ARENA_H); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
        // ------------------------------------------

        ctx.save();
        if (state.shakeFrames > 0 && !state.paused && state.juice !== "off") { 
            const mag = state.juice === "super" ? 12 : 4;
            ctx.translate(Math.random() * mag - mag/2, Math.random() * mag - mag/2); 
            state.shakeFrames--; 
        }
        ctx.beginPath(); ctx.rect(0, SCOREBOARD_H, ARENA_W, ARENA_H); ctx.clip();
        ctx.translate(ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2); ctx.scale(camRef.current.zoom, camRef.current.zoom); ctx.translate(-camRef.current.x, -camRef.current.y);

        if (state.environment === "blackout") { ctx.globalCompositeOperation = "lighter"; }

        if (state.environment === "lava") {
          const lavaGrad = ctx.createLinearGradient(0, SCOREBOARD_H + ARENA_H - ARENA_H * 0.15, 0, SCOREBOARD_H + ARENA_H);
          lavaGrad.addColorStop(0, "rgba(255, 100, 0, 0)"); lavaGrad.addColorStop(1, "rgba(255, 50, 0, 0.8)");
          ctx.fillStyle = lavaGrad; ctx.fillRect(0, SCOREBOARD_H + ARENA_H - ARENA_H * 0.15, ARENA_W, ARENA_H * 0.15);
        }
        if (state.environment === "blackhole") {
          ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2, 40, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(100,0,255,0.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2, 40 + (timestamp % 1000) / 10, 0, Math.PI * 2); ctx.stroke();
        }
        if (state.environment === "storm") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          for (let i = 0; i < 30; i++) {
              const windX = (timestamp * 0.5 + i * 40) % ARENA_W; const windY = SCOREBOARD_H + (i * 30 % ARENA_H);
              ctx.fillRect(windX, windY, 40 + Math.random() * 60, 2);
          }
        }
        if (state.modifier === "shrinking_arena") {
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = "red";
            ctx.strokeRect(state.shrinkingZone, SCOREBOARD_H + state.shrinkingZone, ARENA_W - (state.shrinkingZone*2), ARENA_H - (state.shrinkingZone*2));
            ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
            ctx.fillRect(0, SCOREBOARD_H, ARENA_W, state.shrinkingZone); ctx.fillRect(0, SCOREBOARD_H + ARENA_H - state.shrinkingZone, ARENA_W, state.shrinkingZone);
            ctx.fillRect(0, SCOREBOARD_H, state.shrinkingZone, ARENA_H); ctx.fillRect(ARENA_W - state.shrinkingZone, SCOREBOARD_H, state.shrinkingZone, ARENA_H);
            ctx.shadowBlur = 0;
        }

        if (state.ads && state.theme !== "abyss" && state.theme !== "void" && state.viewMode !== "theater" && state.viewMode !== "cinematic") {
          const adTexts = [ "★ GSIX PRODUCTIONS ★", "▶ PLAY RUNESITE", "🔒 LOCK APP", "🍔 PARTY BITES CATERING" ];
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, 24); ctx.fillRect(0, SCOREBOARD_H + ARENA_H - 24, ARENA_W, 24);
          ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : state.theme === "comic" ? "#000" : "rgba(255, 255, 255, 0.7)";
          ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; const offset = (timestamp * 0.05) % 400;
          for (let i = 0; i < 6; i++) {
            const ax = i * 400 - offset; ctx.fillText(adTexts[i % adTexts.length], ax, SCOREBOARD_H + 16); ctx.fillText(adTexts[(i + 2) % adTexts.length], ax + 200, SCOREBOARD_H + ARENA_H - 8);
          }
        }

        for (const p of dataRef.parts.current) {
          if (!p.active && state.optPool) continue;
          ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.globalAlpha = 1;
        }

        for (const p of dataRef.projs.current) {
          if (!p.active && state.optPool) continue;
          ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.type==="fireball"?8:4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        }

        for (const b of dataRef.bombs.current) {
          if (!b.active) continue;
          if (b.type === "bomb" || b.type === "nuke") {
              ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(b.x, b.y, b.type==="nuke"?15:10, 0, Math.PI*2); ctx.fill();
              ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 2; ctx.stroke();
              ctx.fillStyle = "#ffff00"; ctx.font = "bold 10px sans-serif"; ctx.textAlign="center"; ctx.fillText(Math.ceil(b.timer/1000).toString(), b.x, b.y+3);
              if (Math.random() < 0.5) pushParticle(b.x, b.y-10, (Math.random()-0.5)*2, -2, 20, "#ff8800", 2, dataRef.parts.current, state.optPool);
          } else if (b.type === "blackhole") {
              ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(b.x, b.y, 15, 0, Math.PI*2); ctx.fill();
              ctx.strokeStyle = "rgba(100,0,255,0.8)"; ctx.lineWidth = 2; ctx.stroke();
          } else if (b.type === "medkit") {
              ctx.fillStyle = "#fff"; ctx.fillRect(b.x-10, b.y-10, 20, 20); ctx.fillStyle = "#00ff00"; ctx.fillRect(b.x-2, b.y-8, 4, 16); ctx.fillRect(b.x-8, b.y-2, 16, 4);
          } else if (b.type === "freeze") {
              ctx.fillStyle = "rgba(0,255,255,0.5)"; ctx.beginPath(); ctx.moveTo(b.x, b.y-10); ctx.lineTo(b.x+10, b.y+10); ctx.lineTo(b.x-10, b.y+10); ctx.fill();
          }
        }

        for (const c of dataRef.chars.current) {
          if (c.dead) continue;
          if (!state.devMode && state.trails) {
            for (let i = 0; i < c.trail.length; i++) renderChar(ctx, { ...c, x: c.trail[i].x, y: c.trail[i].y, angle: c.trail[i].angle }, false, 0.2 * (1 - i / c.trail.length), state.theme, false, state.optCache);
          }
          renderChar(ctx, c, c.flashFrames > 0, 1, state.theme, state.devMode, state.optCache);
          if (state.viewMode !== "cinematic" && state.viewMode !== "theater") drawHpBar(ctx, c, state.modifier, state.devMode, state.theme);
        }
        for (const g of dataRef.ghosts.current) {
          if (!g.active && state.optPool) continue;
          drawGhost(ctx, g, state.devMode, state.theme);
        }

        if (state.hud && state.viewMode !== "cinematic" && state.viewMode !== "theater") {
          for (const ft of dataRef.texts.current) {
            if (!ft.active && state.optPool) continue;
            ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
            if (ft.isSplat) drawOSRSplat(ctx, ft);
            else { ctx.fillStyle = ft.color; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.fillText(ft.text, ft.x, ft.y); }
            ctx.globalAlpha = 1;
          }
        }
        ctx.restore();

        // TACTICAL HUD RENDER (Always forced if state.hud is true and view is standard, decoupled from camera)
        if (state.hud && state.viewMode === "standard") {
            ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); // Hard reset transform to screen space
            const mw = 120, mh = 80, mx = ARENA_W - mw - 10, my = SCOREBOARD_H + ARENA_H - mh - 10;
            ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.9)" : state.theme === "ethereal" ? "rgba(255,255,255,0.8)" : state.theme === "comic" ? "rgba(255,255,255,0.9)" : "rgba(10,10,20,0.8)"; 
            ctx.fillRect(mx, my, mw, mh);
            ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : state.theme === "ethereal" ? "#aaccff" : state.theme === "comic" ? "#000" : "#444"; 
            ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);

            ctx.strokeStyle = state.theme === "comic" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(mx + mw/2, my); ctx.lineTo(mx + mw/2, my + mh); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(mx, my + mh/2); ctx.lineTo(mx + mw, my + mh/2); ctx.stroke();

            for (const c of dataRef.chars.current) {
              if (c.dead) continue; ctx.fillStyle = getTeamColor(c.team, state.theme, c.kineticType==="zombie"||c.team===5); 
              ctx.shadowBlur = 5; ctx.shadowColor = ctx.fillStyle; // Glowing dots
              ctx.beginPath(); ctx.arc(mx + (c.x / ARENA_W) * mw, my + ((c.y - SCOREBOARD_H) / ARENA_H) * mh, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.shadowBlur = 0;
            }

            ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : state.theme === "ethereal" || state.theme === "comic" ? "#444" : "rgba(255,255,255,0.5)";
            ctx.strokeRect(mx + ((camRef.current.x - ARENA_W / camRef.current.zoom / 2) / ARENA_W) * mw, my + ((camRef.current.y - SCOREBOARD_H - ARENA_H / camRef.current.zoom / 2) / ARENA_H) * mh, mw / camRef.current.zoom, mh / camRef.current.zoom);
            ctx.restore();

            ctx.textAlign = "right"; ctx.font = "10px monospace";
            const activeFeed = state.optPool ? dataRef.feed.current.filter((f) => f.active) : dataRef.feed.current;
            activeFeed.forEach((msg, idx) => { ctx.globalAlpha = msg.life / 120; ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : msg.color; ctx.fillText(msg.text, ARENA_W - 10, SCOREBOARD_H + 20 + idx * 15); }); ctx.globalAlpha = 1;
        }

        // Filters pass
        if (state.invertFilter) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "white"; ctx.fillRect(0,0,ARENA_W, ARENA_H+SCOREBOARD_H); ctx.globalCompositeOperation = "source-over"; }
        if (state.vhsFilter) {
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            for(let i=0; i<ARENA_H+SCOREBOARD_H; i+=10) if(Math.random()<0.1) ctx.fillRect(0, i+(timestamp%50), ARENA_W, 2);
            ctx.fillStyle = "rgba(255,0,0,0.05)"; ctx.fillRect(2, 0, ARENA_W, ARENA_H+SCOREBOARD_H);
            ctx.fillStyle = "rgba(0,0,255,0.05)"; ctx.fillRect(-2, 0, ARENA_W, ARENA_H+SCOREBOARD_H);
        }
        if (state.crtFilter) {
            ctx.fillStyle = "rgba(18, 16, 16, 0.15)";
            for (let i = 0; i < ARENA_H + SCOREBOARD_H; i += 3) ctx.fillRect(0, i, ARENA_W, 1);
            const grad = ctx.createRadialGradient(ARENA_W / 2, (ARENA_H + SCOREBOARD_H) / 2, ARENA_H * 0.5, ARENA_W / 2, (ARENA_H + SCOREBOARD_H) / 2, ARENA_W);
            grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.6)"); ctx.fillStyle = grad; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);
        }

        if (state.viewMode === "cinematic") {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, SCOREBOARD_H, ARENA_W, 60);
            ctx.fillRect(0, SCOREBOARD_H + ARENA_H - 60, ARENA_W, 60);
        }

        if (state.viewMode !== "theater" && state.viewMode !== "cinematic") {
            ctx.fillStyle = state.theme === "gameboy" ? "#8bac0f" : (state.theme === "runesite" || state.theme === "runesite_ultimate") ? "#1e1a16" : state.theme === "gilded" ? "#221100" : state.theme === "ethereal" ? "#ffffff" : state.theme === "lokmod" ? "#080814" : state.theme === "comic" ? "#ffffff" : "#0a0a18";
            ctx.fillRect(0, 0, ARENA_W, SCOREBOARD_H);
            ctx.strokeStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : state.theme === "ethereal" ? "#aaccff" : state.theme === "comic" ? "#000" : "#6644aa";
            ctx.lineWidth = 3; ctx.strokeRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);
            ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
            ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "ethereal" || state.theme === "comic" ? "#444" : "#cc4433"; ctx.fillText(`P1: ${state.p1Score}`, 140, 36);
            ctx.fillStyle = state.theme === "gameboy" ? "#306230" : state.theme === "ethereal" || state.theme === "comic" ? "#888" : "#3366cc"; ctx.fillText(`P2: ${state.p2Score}`, ARENA_W - 140, 36);
            ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : state.theme === "ethereal" || state.theme === "comic" ? "#000" : "#aaaaaa"; ctx.font = "bold 22px monospace"; ctx.fillText("KINETIC SOULS", ARENA_W / 2, 24);

            // Director Score
            ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "ethereal" || state.theme === "comic" ? "#000" : "#ffaa00"; ctx.font = "bold 10px monospace"; ctx.fillText(`DIR POINTS: ${state.directorScore}`, ARENA_W / 2, 36);

            ctx.font = "12px monospace";
            if (state.mode === "horde" || state.mode === "infection") ctx.fillText(`SURVIVE 50 KILLS | ENEMY KILLS: ${state.p2Score}/15`, ARENA_W / 2, 50);
            else if (state.mode === "unlimited") ctx.fillText(`TIME: ∞ | LIMIT: ∞`, ARENA_W / 2, 50);
            else if (state.mode === "timer") ctx.fillText(`TIME: ${Math.floor(state.timeLeft / 60)}:${Math.floor(state.timeLeft % 60).toString().padStart(2, "0")}`, ARENA_W / 2, 50);
            else ctx.fillText(`FIRST TO ${state.scoreLimit}`, ARENA_W / 2, 50);

            if (state.modifier !== "none" || state.camera !== "static" || state.p1Auto || state.opponent === "ffa") {
              ctx.fillStyle = state.theme === "gameboy" ? "#306230" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffaa00" : state.theme === "ethereal" ? "#66aaff" : state.theme === "comic" ? "#666" : "#ffaa00";
              ctx.fillText(`[MOD: ${state.modifier.toUpperCase()} | CAM: ${state.camera.toUpperCase()} | AUTO: ${state.p1Auto ? "ON" : "OFF"}]`, ARENA_W / 2, 60);
            }

            if (state.devMode) {
              ctx.textAlign = "left"; ctx.fillStyle = "#00ff00"; ctx.font = "10px monospace";
              ctx.fillText(`DEV MODE ACTIVE`, 10, SCOREBOARD_H + 20); ctx.fillText(`Entities: ${activeChars.length}`, 10, SCOREBOARD_H + 35); ctx.fillText(`Particles: ${state.optPool ? dataRef.parts.current.filter((p) => p.active).length : dataRef.parts.current.length}`, 10, SCOREBOARD_H + 50);
            }
        }

        if (state.paused) {
          ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.8)" : "rgba(0,0,0,0.8)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);
          ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffd700" : "#ccaaff"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center";
          ctx.fillText("PAUSED", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 - 50);
          drawBtn(ctx, ARENA_W / 2 - 75, SCOREBOARD_H + ARENA_H / 2 - 10, 150, 40, "RESUME", false, true, state.theme);
          drawBtn(ctx, ARENA_W / 2 - 75, SCOREBOARD_H + ARENA_H / 2 + 40, 150, 40, "LIVE MODIFIERS", false, false, state.theme);
          drawBtn(ctx, ARENA_W / 2 - 75, SCOREBOARD_H + ARENA_H / 2 + 90, 150, 40, "QUIT TO MENU", false, false, state.theme);
        } else if (!state.running && !state.over && state.viewMode !== "cinematic" && state.viewMode !== "theater") {
          ctx.fillStyle = state.theme === "gameboy" ? "rgba(139,172,15,0.6)" : "rgba(0,0,0,0.5)"; ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);
          ctx.fillStyle = state.theme === "gameboy" ? "#0f380f" : "white"; ctx.textAlign = "center"; ctx.font = "bold 20px monospace";
          ctx.fillText("Press A (P1) or L (P2) to spawn!", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2);
          ctx.font = "12px monospace";
          if (state.camera === "action") {
            ctx.fillStyle = state.theme === "gameboy" ? "#306230" : state.theme === "gilded" || state.theme === "lokmod" ? "#ffaa00" : "#ffaa00";
            ctx.fillText("Action Cam: [Up/Down] Swap Team | [Left/Right] Cycle Fighter", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 + 25);
          } else {
            ctx.fillText("Press [Q] for Auto-Spawn | Press [P] to Pause | Press [M] for Live Mods", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2 + 25);
          }
        }
      }
    timeRef.raf.current = requestAnimationFrame(gameLoop);
  }, [renderChar, drawHpBar, drawGhost, endGame, triggerExplosion, spawnText, drawOSRSplat, refs, dataRef, timeRef]);
  function drawBtn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, active: boolean, highlight: boolean, theme: ThemeMode = "classic") {
    if (theme === "gameboy") {
      ctx.fillStyle = highlight ? "#0f380f" : active ? "#306230" : "#8bac0f"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#0f380f"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = active || highlight ? "#9bbc0f" : "#0f380f";
    } else if (theme === "gilded" || theme === "lokmod") {
      ctx.fillStyle = highlight ? "#553300" : active ? "#aa8800" : "#221100"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = active ? "#ffd700" : "#aa8800"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = active || highlight ? "#ffffff" : "#ffd700";
    } else {
      ctx.fillStyle = highlight ? "#aa5500" : active ? "#443388" : "#222244"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = active ? "#9966ff" : "#445566"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = active || highlight ? "white" : "#8899aa";
    }
    ctx.font = highlight ? "bold 13px monospace" : "11px monospace"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + h / 2 + 4);
  }

  function drawAnimatedBackground(ctx: CanvasRenderingContext2D, timestamp: number, state: GameState) {
    ctx.fillStyle = "#080814"; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);

    if (state.menuGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
        for(let i=0; i<ARENA_W; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, ARENA_H+SCOREBOARD_H); ctx.stroke(); }
        for(let i=0; i<ARENA_H+SCOREBOARD_H; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(ARENA_W, i); ctx.stroke(); }
    }

    if (state.menuDrift) {
        const drift = (timestamp * 0.02) % (ARENA_H + SCOREBOARD_H);
        for (let i = 0; i < 40; i++) {
          const x = (i * 67 + 13) % ARENA_W; const staticY = i * 83 + 7; let y = (staticY - drift) % (ARENA_H + SCOREBOARD_H);
          if (y < 0) y += ARENA_H + SCOREBOARD_H; ctx.fillStyle = `rgba(80,60,150,${0.1 + (i % 5) * 0.04})`; ctx.fillRect(x, y, 6, 6);
        }
    }
    if (state.menuParticles) {
        const fall = (timestamp * 0.05) % (ARENA_H + SCOREBOARD_H);
        for (let i = 0; i < 30; i++) {
            const x = (i * 89 + 31) % ARENA_W; const staticY = i * 50 + 10; let y = (staticY + fall) % (ARENA_H + SCOREBOARD_H);
            ctx.fillStyle = `rgba(200,200,255,${0.2 + (i % 4) * 0.1})`; ctx.fillRect(x, y, 2, 2);
        }
    }
    if (state.menuCRT) {
        ctx.fillStyle = "rgba(18, 16, 16, 0.15)";
        for (let i = 0; i < ARENA_H + SCOREBOARD_H; i += 3) ctx.fillRect(0, i, ARENA_W, 1);
    }
  }

  function drawMainMenu(ctx: CanvasRenderingContext2D, mode: string, opp: string, mouse: { x: number; y: number }, timestamp: number, state: GameState) {
    drawAnimatedBackground(ctx, timestamp, state); ctx.textAlign = "center"; ctx.fillStyle = "#ccaaff"; ctx.font = "bold 52px monospace"; ctx.fillText("KINETIC", ARENA_W / 2, 120); ctx.fillStyle = "#ff9944"; ctx.font = "bold 52px monospace"; ctx.fillText("SOULS", ARENA_W / 2, 178);

    ctx.save();
    const pulse = state.menuPulse ? 1 + Math.sin(timestamp / 150) * 0.03 : 1; 
    ctx.translate(ARENA_W / 2, 205); ctx.rotate(0); ctx.scale(pulse, pulse);
    ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255, 215, 0, 0.6)"; ctx.fillStyle = "#ffff00"; ctx.font = "bold 15px monospace"; 
    ctx.fillText(currentSplash, 0, 0); ctx.restore();

    ctx.fillStyle = "#888"; ctx.font = "14px monospace"; ctx.fillText("1v1 AUTO BATTLE ARENA", ARENA_W / 2, 235);
    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.fillText("GAME MODE", ARENA_W / 2, 270);
    drawBtn(ctx, ARENA_W / 2 - 130, 285, 115, 36, "Timer: 2 Mins", mode === "timer", false); 
    drawBtn(ctx, ARENA_W / 2 + 15, 285, 115, 36, "Score: 10 Pts", mode === "score", false);

    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.fillText("OPPONENT", ARENA_W / 2, 358);
    drawBtn(ctx, ARENA_W / 2 - 130, 373, 115, 36, "Player vs Player", opp === "pvp", false);
    drawBtn(ctx, ARENA_W / 2 + 15, 373, 115, 36, "Player vs Bot", opp === "bot", false);

    drawBtn(ctx, ARENA_W / 2 - 75, 440, 150, 44, "START GAME", false, true);
    ctx.fillStyle = "#666"; ctx.font = "12px monospace"; ctx.fillText("P1: Press [A] to spawn  |  P2: Press [L] to spawn", ARENA_W / 2, 530); ctx.fillText("Characters bounce around and fight automatically!", ARENA_W / 2, 550);

    ctx.fillStyle = "#ffd700"; ctx.fillRect(ARENA_W - 160, SCOREBOARD_H + ARENA_H - 40, 150, 30); ctx.strokeStyle = "#aa8800"; ctx.strokeRect(ARENA_W - 160, SCOREBOARD_H + ARENA_H - 40, 150, 30); ctx.fillStyle = "#000"; ctx.font = "bold 12px monospace"; ctx.fillText("LoK Game Modifiers", ARENA_W - 85, SCOREBOARD_H + ARENA_H - 20);

    ctx.fillStyle = "#88aaff"; ctx.fillRect(10, SCOREBOARD_H + ARENA_H - 40, 150, 30); ctx.strokeStyle = "#4466aa"; ctx.strokeRect(10, SCOREBOARD_H + ARENA_H - 40, 150, 30); ctx.fillStyle = "#000"; ctx.font = "bold 12px monospace"; ctx.fillText("Menu Settings", 85, SCOREBOARD_H + ARENA_H - 20);
  }

  function drawSettingsMenu(ctx: CanvasRenderingContext2D, state: GameState, timestamp: number) {
    drawAnimatedBackground(ctx, timestamp, state);
    ctx.fillStyle = "#88aaff"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center"; ctx.fillText("MENU SETTINGS", ARENA_W / 2, 100);

    drawBtn(ctx, ARENA_W/2 - 160, 180, 150, 40, state.menuDrift ? "Bg Drift: ON" : "Bg Drift: OFF", state.menuDrift, false, "classic");
    drawBtn(ctx, ARENA_W/2 + 10, 180, 150, 40, state.menuParticles ? "Particles: ON" : "Particles: OFF", state.menuParticles, false, "classic");

    drawBtn(ctx, ARENA_W/2 - 160, 240, 150, 40, state.menuGrid ? "Menu Grid: ON" : "Menu Grid: OFF", state.menuGrid, false, "classic");
    drawBtn(ctx, ARENA_W/2 + 10, 240, 150, 40, state.menuPulse ? "Logo Pulse: ON" : "Logo Pulse: OFF", state.menuPulse, false, "classic");

    drawBtn(ctx, ARENA_W/2 - 75, 300, 150, 40, state.menuCRT ? "Menu CRT: ON" : "Menu CRT: OFF", state.menuCRT, false, "classic");

    drawBtn(ctx, ARENA_W / 2 - 75, 450, 150, 40, "BACK TO MAIN", false, true);
  }

  function drawLokMenu(ctx: CanvasRenderingContext2D, mode: string, theme: string, mod: string, cam: string, wep: string, env: string, view: string, mouse: { x: number; y: number }, state: GameState, timestamp: number) {
    drawAnimatedBackground(ctx, timestamp, state); ctx.fillStyle = "#ffd700"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center"; ctx.fillText("LOK MODIFIERS", ARENA_W / 2, 60);

    const cx = ARENA_W / 2; ctx.fillStyle = "#aaa"; ctx.font = "bold 13px monospace";
    ctx.fillText("MODES & ENVS", cx, 95); ctx.fillText("THEMES & VARIANTS", cx, 160); ctx.fillText("WEAPONS & MODIFIERS", cx, 275); ctx.fillText("CAMERAS & VIEW MODES", cx, 340); ctx.fillText("CUT CONTENT (VISUAL TOGGLES)", cx, 405); ctx.fillText("PRO ENGINE OPTIMIZATIONS", cx, 470);

    drawBtn(ctx, cx - 250, 110, 110, 30, "Unlimited", mode === "unlimited", false); drawBtn(ctx, cx - 120, 110, 110, 30, "Infection", mode === "infection", false); drawBtn(ctx, cx + 10, 110, 110, 30, "Env: Blackout", env === "blackout", false); drawBtn(ctx, cx + 140, 110, 110, 30, "Env: Wrap", env === "wrap", false);

    drawBtn(ctx, cx - 310, 175, 100, 30, "Classic", theme === "classic", false); drawBtn(ctx, cx - 195, 175, 100, 30, "Neon", theme === "neon", false); drawBtn(ctx, cx - 80, 175, 100, 30, "GameBoy", theme === "gameboy", false); drawBtn(ctx, cx + 35, 175, 100, 30, "Abyss", theme === "abyss", false); drawBtn(ctx, cx + 150, 175, 100, 30, "LokMod (Super)", theme === "lokmod", false);
    drawBtn(ctx, cx - 310, 210, 100, 30, "Runesite", theme === "runesite", false); drawBtn(ctx, cx - 195, 210, 100, 30, "GSix", theme === "gsix", false); drawBtn(ctx, cx - 80, 210, 100, 30, "Gilded", theme === "gilded", false); drawBtn(ctx, cx + 35, 210, 100, 30, "Glitch (Super)", theme === "glitch", false); drawBtn(ctx, cx + 150, 210, 100, 30, "Monochrome", theme === "monochrome", false);

    drawBtn(ctx, cx - 250, 290, 110, 30, "None", mod === "none", false); drawBtn(ctx, cx - 120, 290, 110, 30, "Necromancy", mod === "necromancy", false); drawBtn(ctx, cx + 10, 290, 110, 30, "Shrinking Zone", mod === "shrinking_arena", false); drawBtn(ctx, cx + 140, 290, 110, 30, "Wep: Mash", wep === "melee_mash", false);

    drawBtn(ctx, cx - 250, 355, 110, 30, "Static Cam", cam === "static", false); drawBtn(ctx, cx - 120, 355, 110, 30, "Enhanced Cam", cam === "enhanced", false); drawBtn(ctx, cx + 10, 355, 110, 30, "View: Theater", view === "theater", false); drawBtn(ctx, cx + 140, 355, 110, 30, "View: Cinematic", view === "cinematic", false);

    drawBtn(ctx, cx - 280, 420, 105, 30, state.juice !== "off" ? "Juice: ON" : "Juice: OFF", state.juice !== "off", false); drawBtn(ctx, cx - 165, 420, 105, 30, state.hud ? "HUD: ON" : "HUD: OFF", state.hud, false); drawBtn(ctx, cx - 50, 420, 105, 30, state.trails ? "Trails: ON" : "Trails: OFF", state.trails, false); drawBtn(ctx, cx + 65, 420, 105, 30, state.ads ? "Ads: ON" : "Ads: OFF", state.ads, false); drawBtn(ctx, cx + 180, 420, 105, 30, state.crtFilter ? "CRT Filter: ON" : "CRT Filter: OFF", state.crtFilter, false);
    drawBtn(ctx, cx - 280, 485, 105, 30, state.optCache ? "Cache: ON" : "Cache: OFF", state.optCache, false); drawBtn(ctx, cx - 165, 485, 105, 30, state.optDelta ? "Delta: ON" : "Delta: OFF", state.optDelta, false); drawBtn(ctx, cx - 50, 485, 105, 30, state.optGravity ? "Gravity: ON" : "Gravity: OFF", state.optGravity, false); drawBtn(ctx, cx + 65, 485, 105, 30, state.optSmartSpawn ? "SmSpawn: ON" : "SmSpawn: OFF", state.optSmartSpawn, false); drawBtn(ctx, cx + 180, 485, 105, 30, state.optGrid ? "Swarm Grid: ON" : "Swarm Grid: OFF", state.optGrid, false);

    drawBtn(ctx, cx - 75, 530, 150, 35, "BACK TO MAIN", false, true);
  }

  function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
    ctx.fillStyle = "#080814"; ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H); 
    ctx.fillStyle = "#ccaaff"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", ARENA_W / 2, 120); 
    ctx.fillStyle = "#ffee88"; ctx.font = "bold 32px monospace"; ctx.fillText(state.winner, ARENA_W / 2, 180); 

    ctx.fillStyle = "rgba(10, 5, 20, 0.85)"; ctx.fillRect(ARENA_W / 2 - 280, 240, 560, 160);
    ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 2; ctx.strokeRect(ARENA_W / 2 - 280, 240, 560, 160);

    ctx.fillStyle = "#ff6655"; ctx.font = "bold 26px monospace"; ctx.fillText(`P1 Kills: ${state.p1Score}`, ARENA_W / 2 - 140, 290); 
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px monospace"; ctx.fillText("VS", ARENA_W / 2, 290);
    ctx.fillStyle = "#5599ff"; ctx.font = "bold 26px monospace"; ctx.fillText(`Enemy Kills: ${state.p2Score}`, ARENA_W / 2 + 140, 290); 

    ctx.fillStyle = "#aaa"; ctx.font = "14px monospace"; 
    ctx.fillText(`Peak Fighters: ${state.stats.maxChars}  |  Total Damage: ${state.stats.totalDmg}`, ARENA_W / 2, 360); 

    drawBtn(ctx, ARENA_W / 2 - 90, 440, 180, 48, "MAIN MENU", false, true);
  }

  const handleMouseMove = useCallback((e: MouseEvent) => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; }, []);
  const handleMouseDown = useCallback((e: MouseEvent) => { mouseRef.current.isDown = true; }, []);
  const handleMouseUp = useCallback((e: MouseEvent) => { mouseRef.current.isDown = false; stateRef.current.draggingId = null; }, []);

  const handleClick = useCallback((e: MouseEvent) => {
      const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width); const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const screen = screenRef.current; const cx = ARENA_W / 2;

      if (screen === "menu") {
        if (mx >= cx - 130 && mx <= cx - 15 && my >= 285 && my <= 321) refs.mode.current = "timer";
        if (mx >= cx + 15 && mx <= cx + 130 && my >= 285 && my <= 321) refs.mode.current = "score";
        if (mx >= cx - 130 && mx <= cx - 15 && my >= 373 && my <= 409) refs.opp.current = "pvp";
        if (mx >= cx + 15 && mx <= cx + 130 && my >= 373 && my <= 409) refs.opp.current = "bot";
        if (mx >= cx - 75 && mx <= cx + 75 && my >= 440 && my <= 484) startGame();
        if (mx >= ARENA_W - 160 && mx <= ARENA_W - 10 && my >= SCOREBOARD_H + ARENA_H - 40 && my <= SCOREBOARD_H + ARENA_H - 10) screenRef.current = "lok_menu";
        if (mx >= 10 && mx <= 160 && my >= SCOREBOARD_H + ARENA_H - 40 && my <= SCOREBOARD_H + ARENA_H - 10) screenRef.current = "settings_menu";
      } else if (screen === "settings_menu") {
        if (mx >= cx - 160 && mx <= cx - 10 && my >= 180 && my <= 220) stateRef.current.menuDrift = !stateRef.current.menuDrift;
        if (mx >= cx + 10 && mx <= cx + 160 && my >= 180 && my <= 220) stateRef.current.menuParticles = !stateRef.current.menuParticles;
        if (mx >= cx - 160 && mx <= cx - 10 && my >= 240 && my <= 280) stateRef.current.menuGrid = !stateRef.current.menuGrid;
        if (mx >= cx + 10 && mx <= cx + 160 && my >= 240 && my <= 280) stateRef.current.menuPulse = !stateRef.current.menuPulse;
        if (mx >= cx - 75 && mx <= cx + 75 && my >= 300 && my <= 340) stateRef.current.menuCRT = !stateRef.current.menuCRT;
        if (mx >= cx - 75 && mx <= cx + 75 && my >= 450 && my <= 490) screenRef.current = "menu";
      } else if (screen === "lok_menu") {
        if (my >= 110 && my <= 140) {
          if (mx >= cx - 250 && mx <= cx - 140) refs.mode.current = refs.mode.current === "unlimited" ? "timer" : "unlimited";
          if (mx >= cx - 120 && mx <= cx - 10) refs.mode.current = refs.mode.current === "infection" ? "timer" : "infection";
          if (mx >= cx + 10 && mx <= cx + 120) refs.env.current = refs.env.current === "storm" ? "none" : "storm";
          if (mx >= cx + 140 && mx <= cx + 250) refs.env.current = refs.env.current === "wrap" ? "none" : "wrap";
        }
        if (my >= 175 && my <= 205) {
          if (mx >= cx - 310 && mx <= cx - 210) refs.theme.current = "classic";
          if (mx >= cx - 195 && mx <= cx - 95) refs.theme.current = "neon";
          if (mx >= cx - 80 && mx <= cx + 20) refs.theme.current = "gameboy";
          if (mx >= cx + 35 && mx <= cx + 135) refs.theme.current = "abyss";
          if (mx >= cx + 150 && mx <= cx + 250) refs.theme.current = "lokmod";
        }
        if (my >= 210 && my <= 240) {
          if (mx >= cx - 310 && mx <= cx - 210) refs.theme.current = "runesite";
          if (mx >= cx - 195 && mx <= cx - 95) refs.theme.current = "gsix";
          if (mx >= cx - 80 && mx <= cx + 20) refs.theme.current = "gilded";
          if (mx >= cx + 35 && mx <= cx + 135) refs.theme.current = "glitch";
          if (mx >= cx + 150 && mx <= cx + 250) refs.theme.current = "monochrome";
        }
        if (my >= 290 && my <= 320) {
          if (mx >= cx - 250 && mx <= cx - 140) refs.mod.current = "none";
          if (mx >= cx - 120 && mx <= cx - 10) refs.mod.current = "necromancy";
          if (mx >= cx + 10 && mx <= cx + 120) refs.mod.current = "shrinking_arena";
          if (mx >= cx + 140 && mx <= cx + 250) refs.wep.current = refs.wep.current === "melee_mash" ? "standard" : "melee_mash";
        }
        if (my >= 355 && my <= 385) {
          if (mx >= cx - 250 && mx <= cx - 140) refs.cam.current = "static";
          if (mx >= cx - 120 && mx <= cx - 10) refs.cam.current = "enhanced";
          if (mx >= cx + 10 && mx <= cx + 120) refs.view.current = refs.view.current === "theater" ? "standard" : "theater";
          if (mx >= cx + 140 && mx <= cx + 250) refs.view.current = refs.view.current === "cinematic" ? "standard" : "cinematic";
        }
        if (my >= 420 && my <= 450) {
          if (mx >= cx - 280 && mx <= cx - 175) stateRef.current.juice = stateRef.current.juice === "super" ? "off" : stateRef.current.juice === "normal" ? "super" : "normal";
          if (mx >= cx - 165 && mx <= cx - 60) stateRef.current.hud = !stateRef.current.hud;
          if (mx >= cx - 50 && mx <= cx + 55) stateRef.current.trails = !stateRef.current.trails;
          if (mx >= cx + 65 && mx <= cx + 170) stateRef.current.ads = !stateRef.current.ads;
          if (mx >= cx + 180 && mx <= cx + 285) stateRef.current.crtFilter = !stateRef.current.crtFilter;
        }
        if (my >= 485 && my <= 515) {
          if (mx >= cx - 280 && mx <= cx - 175) stateRef.current.optCache = !stateRef.current.optCache;
          if (mx >= cx - 165 && mx <= cx - 60) stateRef.current.optDelta = !stateRef.current.optDelta;
          if (mx >= cx - 50 && mx <= cx + 55) stateRef.current.optGravity = !stateRef.current.optGravity;
          if (mx >= cx + 65 && mx <= cx + 170) stateRef.current.optSmartSpawn = !stateRef.current.optSmartSpawn;
          if (mx >= cx + 180 && mx <= cx + 285) stateRef.current.optGrid = !stateRef.current.optGrid;
        }
        if (mx >= cx - 75 && mx <= cx + 75 && my >= 530 && my <= 565) screenRef.current = "menu";
      } else if (screen === "over") {
        if (mx >= cx - 90 && mx <= cx + 90 && my >= 430 && my <= 478) { screenRef.current = "menu"; stateRef.current.running = false; stateRef.current.over = false; }
      } else if (screen === "game") {
        if (stateRef.current.paused) {
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H / 2 - 10 && my <= SCOREBOARD_H + ARENA_H / 2 + 30) stateRef.current.paused = false;
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H / 2 + 40 && my <= SCOREBOARD_H + ARENA_H / 2 + 80) { setShowLiveMenu(true); stateRef.current.paused = false; }
          if (mx >= cx - 75 && mx <= cx + 75 && my >= SCOREBOARD_H + ARENA_H / 2 + 90 && my <= SCOREBOARD_H + ARENA_H / 2 + 130) { screenRef.current = "menu"; stateRef.current.running = false; stateRef.current.paused = false; }
        } else {
          if (stateRef.current.handOfGod && !stateRef.current.draggingId) {
            const worldX = (mx - ARENA_W / 2) / camRef.current.zoom + camRef.current.x; const worldY = (my - (SCOREBOARD_H + ARENA_H / 2)) / camRef.current.zoom + camRef.current.y;
            for (let i = dataRef.chars.current.length - 1; i >= 0; i--) {
              const c = dataRef.chars.current[i]; if (c.dead) continue;
              if (Math.hypot(worldX - c.x, worldY - c.y) < CHAR_RADIUS * c.scale * 1.5) { stateRef.current.draggingId = c.id; break; }
            }
          }
        }
      }
    }, [startGame, refs]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "m") { setShowLiveMenu((prev) => !prev); setTick((t) => t + 1); }
      if (screenRef.current === "game" && stateRef.current.running) {
        if (key === "p" || key === "escape") stateRef.current.paused = !stateRef.current.paused;
        if (!stateRef.current.paused) {
          if (key === "a") { const c = spawnCharacter(1, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle, stateRef.current.fighterSpeed); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }
          if (key === "l" && stateRef.current.opponent === "pvp") { const c = spawnCharacter(2, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle, stateRef.current.fighterSpeed); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }
          if (key === "q") stateRef.current.p1Auto = !stateRef.current.p1Auto;
          if (stateRef.current.camera === "action") {
            if (key === "arrowup") { stateRef.current.actionCamTeam = ((stateRef.current.actionCamTeam % 4) + 1) as 1 | 2 | 3 | 4; stateRef.current.actionCamIndex = 0; }
            if (key === "arrowdown") { stateRef.current.actionCamTeam = stateRef.current.actionCamTeam === 1 ? 4 : ((stateRef.current.actionCamTeam - 1) as 1 | 2 | 3 | 4); stateRef.current.actionCamIndex = 0; }
            if (key === "arrowleft") stateRef.current.actionCamIndex--; if (key === "arrowright") stateRef.current.actionCamIndex++;
          }
        }
      }
    }, [dataRef]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => { keysRef.current.delete(e.code); }, []);
  const spawnP1 = useCallback(() => { if (screenRef.current !== "game" || !stateRef.current.running || stateRef.current.paused) return; const c = spawnCharacter(1, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle, stateRef.current.fighterSpeed); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }, [dataRef]);
  const spawnP2 = useCallback(() => { if (screenRef.current !== "game" || !stateRef.current.running || stateRef.current.paused) return; if (stateRef.current.opponent !== "pvp") return; const c = spawnCharacter(2, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle, stateRef.current.fighterSpeed); if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c); }, [dataRef]);
  const handleTouchStart = useCallback((e: TouchEvent) => { e.preventDefault(); const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const touch = e.changedTouches[0]; const tx = (touch.clientX - rect.left) * (canvas.width / rect.width); joyRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 }; if (tx < ARENA_W / 2) spawnP1(); else spawnP2(); }, [spawnP1, spawnP2]);
  const handleTouchMove = useCallback((e: TouchEvent) => { e.preventDefault(); const touch = e.changedTouches[0]; joyRef.current.dx = touch.clientX - joyRef.current.startX; joyRef.current.dy = touch.clientY - joyRef.current.startY; }, []);
  const handleTouchEnd = useCallback((e: TouchEvent) => { e.preventDefault(); joyRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 }; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.addEventListener("mousemove", handleMouseMove); window.addEventListener("mousedown", handleMouseDown); window.addEventListener("mouseup", handleMouseUp); canvas.addEventListener("click", handleClick); window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false }); canvas.addEventListener("touchmove", handleTouchMove, { passive: false }); canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
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
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(15, 5, 25, 0.95)", border: "2px solid #ffd700", borderRadius: "4px", padding: "16px", color: "#ffddaa", fontFamily: "monospace", zIndex: 10, boxShadow: "0 0 20px rgba(255,215,0,0.3)", width: "260px", maxHeight: "90vh", overflowY: "auto" }}>

          <div style={{ display: "flex", justifyContent: "center", position: "relative", alignItems: "center", borderBottom: "1px solid #ffd700", paddingBottom: "8px", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#ffaa00", textAlign: "center", width: "100%" }}>⚡ LIVE LOK MODS ⚡</h3>
            <button onClick={() => setShowLiveMenu(false)} style={{ position: "absolute", right: 0, background: "transparent", color: "#ff4444", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>X</button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", gap: "5px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "10px", display: "block" }}>Time (Sec):</label>
              <input type="number" defaultValue={refs.tLimit.current} onChange={(e) => { const val = parseInt(e.target.value) || 120; refs.tLimit.current = val; stateRef.current.timeLeft = val; setTick(t=>t+1); }} style={{ width: "100%", background: "#000", color: "#66aaff", border: "1px solid #442266", padding: "2px" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "10px", display: "block" }}>Score Lim:</label>
              <input type="number" defaultValue={refs.sLimit.current} onChange={(e) => { const val = parseInt(e.target.value) || 10; refs.sLimit.current = val; stateRef.current.scoreLimit = val; setTick(t=>t+1); }} style={{ width: "100%", background: "#000", color: "#66aaff", border: "1px solid #442266", padding: "2px" }} />
            </div>
            <div style={{ flex: 1 }} onMouseEnter={() => setHoverBox({text: "Fighter Speed Multiplier (x)", x: mouseRef.current.x, y: mouseRef.current.y})} onMouseLeave={() => setHoverBox(null)}>
              <label style={{ fontSize: "10px", display: "block", color: "#ffaa00" }}>Speed (x):</label>
              <input type="number" step="0.1" defaultValue={refs.fSpeed.current} onChange={(e) => { const val = parseFloat(e.target.value) || 1; refs.fSpeed.current = val; stateRef.current.fighterSpeed = val; setTick(t=>t+1); }} style={{ width: "100%", background: "#000", color: "#ffaa00", border: "1px solid #aa8800", padding: "2px" }} />
            </div>
          </div>
          <div style={{ marginBottom: "8px" }}><label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Mode:</label><select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.mode} onChange={(e) => { stateRef.current.mode = e.target.value as GameMode; }}><option value="timer">Timer</option><option value="score">Score</option><option value="horde">Horde</option><option value="infection">Infection</option><option value="unlimited">Unlimited</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Opponent:</label><select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.opponent} onChange={(e) => { stateRef.current.opponent = e.target.value as OpponentMode; }}><option value="pvp">PvP</option><option value="bot">Bot</option><option value="ffa">4-Way FFA</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Modifier:</label><select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.modifier} onChange={(e) => { stateRef.current.modifier = e.target.value as LokModifier; }}><option value="none">None</option><option value="sudden_death">Sudden Death</option><option value="shrinking_arena">Shrinking Arena</option><option value="titans">Titans</option><option value="vampire_kiss">Vampire's Kiss (Lifesteal)</option><option value="necromancy">Necromancy</option><option value="magnet">Magnets</option><option value="repel">Repel</option></select></div>
          <div style={{ marginBottom: "8px" }}><label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Weapons:</label><select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.weaponStyle} onChange={(e) => { stateRef.current.weaponStyle = e.target.value as WeaponStyle; }}><option value="standard">Standard</option><option value="roulette">Roulette</option><option value="melee_mash">Melee Mash</option><option value="ranged_test">Ranged (Blaster)</option></select></div>

          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Camera / View:</label>
            <select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.viewMode} onChange={(e) => { stateRef.current.viewMode = e.target.value as ViewMode; }}>
              <option value="standard">Standard (UI On)</option>
              <option value="theater">Theater (No UI)</option>
              <option value="cinematic">Cinematic (Bars + Auto-Zoom)</option>
            </select>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Theme:</label>
            <select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.theme} onChange={(e) => { stateRef.current.theme = e.target.value as ThemeMode; }}>
              <optgroup label="Standard Themes">
                  <option value="classic">Classic</option>
                  <option value="runesite">Runesite</option>
                  <option value="gsix">GSix</option>
                  <option value="neon">Neon</option>
                  <option value="gameboy">GameBoy</option>
              </optgroup>
              <optgroup label="Ultimate Skins">
                  <option value="runesite_ultimate">Runesite (Ultimate)</option>
                  <option value="gilded">Gilded (GSix Ult)</option>
                  <option value="lokmod">LokMod (Super)</option>
                  <option value="glitch">Glitch (Super)</option>
                  <option value="rgb_cycle">RGB Chroma</option>
              </optgroup>
              <optgroup label="Experimental">
                  <option value="comic">Comic Book</option>
                  <option value="neon_abyss">Neon Abyss</option>
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="ethereal">Ethereal</option>
                  <option value="wasteland">Wasteland</option>
                  <option value="monochrome">Monochrome</option>
                  <option value="void">The Void</option>
                  <option value="celestial">Celestial</option>
                  <option value="overdrive">Overdrive</option>
                  <option value="abyss">Abyss</option>
                  <option value="hacker">Hacker</option>
                  <option value="synthwave">Synthwave</option>
                  <option value="vampire">Vampire</option>
                  <option value="oceanic">Oceanic</option>
                  <option value="infernal">Infernal</option>
              </optgroup>
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}><label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Environment:</label><select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", width: "100%", padding: "4px" }} defaultValue={stateRef.current.environment} onChange={(e) => { stateRef.current.environment = e.target.value as Environment; }}><option value="none">None</option><option value="ice">Ice Rink</option><option value="blackhole">Black Hole</option><option value="lava">Lava Floor</option><option value="storm">Storm</option><option value="bouncy">Bouncy Walls</option><option value="wrap">Pac-Man Wrap</option><option value="blackout">Blackout</option></select></div>

          <h4 style={{ margin: "10px 0 8px 0", color: "#ffaa00", fontSize: "13px" }}>✂️ CUT CONTENT & PHYSICS</h4>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.handOfGod} onChange={(e) => (stateRef.current.handOfGod = e.target.checked)} /> Hand of God (Mouse Grab)</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.aiMagnetic} onChange={(e) => (stateRef.current.aiMagnetic = e.target.checked)} /> Magnetic AI (Aggro Pull)</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}>
              <select style={{ background: "#000", color: "#66aaff", border: "1px solid #442266", padding: "2px", width: "100px" }} value={stateRef.current.juice} onChange={e => { stateRef.current.juice = e.target.value as JuiceLevel; setTick(t=>t+1); }}>
                  <option value="off">Juice: OFF</option>
                  <option value="normal">Juice: NORMAL</option>
                  <option value="super">Juice: SUPER</option>
              </select>
          </label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.hud} onChange={(e) => (stateRef.current.hud = e.target.checked)} /> Tactical HUD (Minimap)</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.trails} onChange={(e) => (stateRef.current.trails = e.target.checked)} /> Motion Trails</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.ads} onChange={(e) => (stateRef.current.ads = e.target.checked)} /> Arena Ads</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.crtFilter} onChange={(e) => (stateRef.current.crtFilter = e.target.checked)} /> CRT Arcade Filter</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.vhsFilter} onChange={(e) => (stateRef.current.vhsFilter = e.target.checked)} /> VHS Artifacts</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.invertFilter} onChange={(e) => (stateRef.current.invertFilter = e.target.checked)} /> Invert Colors</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.moonGravity} onChange={(e) => (stateRef.current.moonGravity = e.target.checked)} /> Moon Gravity</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.explodingCorpses} onChange={(e) => (stateRef.current.explodingCorpses = e.target.checked)} /> Exploding Corpses</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.sloMoKills} onChange={(e) => (stateRef.current.sloMoKills = e.target.checked)} /> Slo-Mo on Kill</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#66aaff", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.rainbowBlood} onChange={(e) => (stateRef.current.rainbowBlood = e.target.checked)} /> Rainbow Blood</label>

          <h4 style={{ margin: "15px 0 8px 0", color: "#ffaa00", fontSize: "13px" }}>⚙️ ENGINE OPTS</h4>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}>
              <select style={{ background: "#000", color: "#55ff55", border: "1px solid #55ff55", padding: "2px", width: "100px" }} value={stateRef.current.fpsTarget} onChange={e => { stateRef.current.fpsTarget = Number(e.target.value); setTick(t=>t+1); }}>
                  <option value={60}>60 FPS</option>
                  <option value={120}>120 FPS</option>
                  <option value={240}>240 FPS</option>
              </select> Target Refresh
          </label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optCache} onChange={(e) => (stateRef.current.optCache = e.target.checked)} /> Sprite Caching</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optGrid} onChange={(e) => (stateRef.current.optGrid = e.target.checked)} /> Swarm Grid (Spatial Part)</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optPool} onChange={(e) => (stateRef.current.optPool = e.target.checked)} /> Memory Pooling</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optDelta} onChange={(e) => (stateRef.current.optDelta = e.target.checked)} /> Delta-Time Physics</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optGravity} onChange={(e) => (stateRef.current.optGravity = e.target.checked)} /> Gravity Particles</label>
          <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#55ff55", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.optSmartSpawn} onChange={(e) => (stateRef.current.optSmartSpawn = e.target.checked)} /> Smart Spawning</label>
          <label style={{ display: "block", marginTop: "12px", cursor: "pointer", color: "#ff0000", fontSize: "12px", borderTop: "1px solid #ff0000", paddingTop: "8px" }}><input type="checkbox" defaultChecked={stateRef.current.devMode} onChange={(e) => (stateRef.current.devMode = e.target.checked)} /> DEV: Show Hitboxes</label>

          <div style={{ marginTop: "15px", borderTop: "2px solid #ffaa00", paddingTop: "15px" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#44ff44", textAlign: "center" }}>🧬 BIRTH (SPAWNER)</h4>
            <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
                <select value={birthType} onChange={e => setBirthType(e.target.value as any)} style={{ flex: 1, background: "#000", color: "#44ff44", border: "1px solid #44ff44", padding: "4px", fontSize: "11px" }}>
                    <optgroup label="Standard Kinetics">
                        <option value="standard">Standard Fighter</option>
                        <option value="tank">Tank (Heavy & Slow)</option>
                        <option value="assassin">Assassin (Fast & Fragile)</option>
                        <option value="sniper">Sniper (Ranged)</option>
                    </optgroup>
                    <optgroup label="Fantasy Kinetics">
                        <option value="giant">Giant (Titan-Class)</option>
                        <option value="shield">Shield Kinetic</option>
                        <option value="ninja">Ninja (Blinks)</option>
                        <option value="mage">Mage (Fireballs)</option>
                        <option value="juggernaut">Juggernaut (Axe)</option>
                        <option value="ghost">Ghost (Phases)</option>
                        <option value="null">Null Kinetic</option>
                        <option value="necromancer">Necromancer Boss</option>
                        <option value="zombie">Zombie (Team 5)</option>
                    </optgroup>
                </select>
                <button onClick={() => {
                    const t = birthType === "zombie" ? 5 : birthType === "null" || birthType === "necromancer" ? 0 : 2;
                    const c = spawnCharacter(t as any, stateRef.current.modifier, dataRef.chars.current, stateRef.current.optSmartSpawn, stateRef.current.optPool, stateRef.current.weaponStyle, stateRef.current.fighterSpeed, undefined, undefined, birthType);
                    if (!stateRef.current.optPool || c.id >= charIdCounter - 1) dataRef.chars.current.push(c);
                    setTick(t=>t+1);
                }} style={{ padding: "4px 8px", background: "#003300", color: "#44ff44", border: "1px solid #44ff44", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>SPAWN</button>
            </div>

            <h4 style={{ margin: "10px 0 5px", color: "#ff4400", textAlign: "center" }}>💣 ITEM DROPS</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "15px" }}>
              {["bomb", "blackhole", "medkit", "freeze", "nuke"].map(dropType => (
                <button key={dropType} onClick={() => {
                    const cx = ARENA_W/2; const cy = SCOREBOARD_H + ARENA_H/2;
                    dataRef.bombs.current.push({ type: dropType as any, x: cx, y: cy, timer: 3000, maxTimer: 3000, active: true, radius: dropType === "nuke" ? 300 : 150 });
                    setTick(t=>t+1);
                }} style={{ flex: "1 0 45%", padding: "6px", background: "#441100", color: "#ffaa00", border: "1px solid #ff4400", cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}>{dropType.toUpperCase()}</button>
              ))}
            </div>

            <h4 style={{ margin: "10px 0 5px", color: "#5599ff", textAlign: "center" }}>⚡ MIRACLES</h4>
            <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
                <select value={godAction} onChange={e => setGodAction(e.target.value as any)} style={{ flex: 1, background: "#000", color: "#5599ff", border: "1px solid #5599ff", padding: "4px", fontSize: "11px" }}>
                    <option value="smite">Smite (Kill)</option>
                    <option value="heal">Heal (Max HP)</option>
                    <option value="freeze">Freeze (Stun)</option>
                    <option value="enrage">Enrage (Speed)</option>
                    <option value="mutate">Mutate (Wep)</option>
                    <option value="infect">Infect (Zmb)</option>
                    <option value="ascend">Ascend (Gnt)</option>
                </select>
                <select value={godTarget} onChange={e => setGodTarget(Number(e.target.value))} style={{ flex: 1, background: "#000", color: "#5599ff", border: "1px solid #5599ff", padding: "4px", fontSize: "11px" }}>
                    <option value={1}>Team 1</option>
                    <option value={2}>Team 2</option>
                    <option value={3}>Team 3</option>
                    <option value={4}>Team 4</option>
                    <option value={5}>Team 5 (Zombies)</option>
                    <option value={0}>All Teams</option>
                </select>
            </div>

            <button onClick={() => {
                dataRef.chars.current.forEach(c => {
                    if (godTarget === 0 || c.team === godTarget) {
                        if (godAction === "smite") { c.hp = 0; c.dead = true; spawnExplosion(c.x, c.y, c.team, stateRef.current.theme, stateRef.current, dataRef.parts.current); }
                        if (godAction === "heal") { c.hp = c.maxHp; c.dead = false; }
                        if (godAction === "freeze") { c.stunTime = 120; }
                        if (godAction === "enrage") { c.vx *= 2; c.vy *= 2; }
                        if (godAction === "mutate") { c.weapon = getRandomWeapon(); }
                        if (godAction === "infect") { c.kineticType = "zombie"; c.team = 5; }
                        if (godAction === "ascend") { c.kineticType = "giant"; c.hp = 60; c.maxHp = 60; c.scale *= 2.5; c.weapon = "hammer"; c.mass *= 3; }
                    }
                });
            }} style={{ width: "100%", padding: "8px", background: "#001133", color: "#5599ff", border: "1px solid #5599ff", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginBottom: "15px" }}>EXECUTE MIRACLE</button>

            <button onClick={() => { dataRef.parts.current = []; setTick(t=>t+1); }} style={{ width: "100%", padding: "8px", background: "#000", color: "#aaa", border: "1px solid #666", cursor: "pointer", fontSize: "11px" }}>Clean Particles</button>

            <h4 style={{ margin: "15px 0 5px", color: "#ff44aa", textAlign: "center" }}>🌌 BACKGROUND & GRID</h4>
            <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#ffaaee", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.parallaxGrid} onChange={(e) => (stateRef.current.parallaxGrid = e.target.checked)} /> Parallax Grid (Camera Link)</label>
            <label style={{ display: "block", marginBottom: "6px", cursor: "pointer", color: "#ffaaee", fontSize: "12px" }}><input type="checkbox" defaultChecked={stateRef.current.reactiveGrid} onChange={(e) => (stateRef.current.reactiveGrid = e.target.checked)} /> Reactive Grid (Jiggle)</label>
          </div>
        </div>
      )}

      {hoverBox && (
        <div style={{ position: "absolute", left: hoverBox.x + 15, top: hoverBox.y + 15, background: "rgba(0,0,0,0.8)", border: "1px solid #ffd700", color: "#fff", padding: "4px 8px", fontSize: "10px", pointerEvents: "none", zIndex: 200 }}>
          {hoverBox.text}
        </div>
      )}

      <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H + SCOREBOARD_H} style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain", imageRendering: "pixelated", border: "3px solid #6644aa", cursor: "crosshair", touchAction: "none" }} />
      <div style={{ color: "#666", fontFamily: "monospace", fontSize: "12px", marginTop: "6px", textAlign: "center" }}>P1: [A] Spawn | P2: [L] Spawn | [Q] Auto-Spawn | [P] Pause | [M] Live Modifiers Menu</div>
      <div style={{ marginTop: "6px", textAlign: "center" }}><label style={{ color: "#888", fontFamily: "monospace", fontSize: "11px", cursor: "pointer", userSelect: "none" }}><input type="checkbox" checked={showMobileUI} onChange={(e) => setShowMobileUI(e.target.checked)} style={{ marginRight: "6px", accentColor: "#ccaaff" }} />Enable Mobile Controls</label></div>

      {showMobileUI && (
        <div style={{ display: "flex", gap: "16px", marginTop: "10px", paddingBottom: "14px", width: "100%", maxWidth: "500px", justifyContent: "center" }}>
          <button onPointerDown={(e) => { e.preventDefault(); spawnP1(); }} style={{ flex: 1, height: "70px", background: "rgba(170, 34, 17, 0.85)", border: "2px solid #ff5533", borderRadius: "12px", color: "#fff", fontFamily: "monospace", fontSize: "15px", fontWeight: "bold", cursor: "pointer", touchAction: "manipulation", userSelect: "none", boxShadow: "0 0 12px rgba(255,85,51,0.4)" }}>⚔ SPAWN P1</button>
          <button onPointerDown={(e) => { e.preventDefault(); spawnP2(); }} style={{ flex: 1, height: "70px", background: "rgba(34, 68, 170, 0.85)", border: "2px solid #3366ff", borderRadius: "12px", color: "#fff", fontFamily: "monospace", fontSize: "15px", fontWeight: "bold", cursor: "pointer", touchAction: "manipulation", userSelect: "none", boxShadow: "0 0 12px rgba(51,102,255,0.4)" }}>⚔ SPAWN P2</button>
        </div>
      )}
    </div>
  );
}