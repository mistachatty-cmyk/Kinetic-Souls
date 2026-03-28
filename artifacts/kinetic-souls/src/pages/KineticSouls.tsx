import { useEffect, useRef, useCallback } from "react";

const ARENA_W = 900;
const ARENA_H = 560;
const CHAR_RADIUS = 14;
const WEAPON_LEN = 20;
const MAX_HP = 20;
const SPAWN_SPEED = 2.8;
const BOT_MIN_INTERVAL = 2000;
const BOT_MAX_INTERVAL = 4000;
const SCOREBOARD_H = 60;

// ADDED NEW GAME MODES HERE
type GameMode = "timer" | "score" | "horde" | "sudden_death";
type OpponentMode = "pvp" | "bot";

interface GameState {
  mode: GameMode;
  opponent: OpponentMode;
  p1Score: number;
  p2Score: number;
  timeLeft: number;
  scoreLimit: number;
  running: boolean;
  over: boolean;
  winner: string;
}

interface Part {
  ox: number;
  oy: number;
  r: number;
  type: "head" | "body" | "arm" | "leg";
}

interface Character {
  id: number;
  team: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularV: number;
  hp: number;
  flashFrames: number;
  dead: boolean;
  parts: Part[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Ghost {
  x: number;
  y: number;
  team: 1 | 2;
  vy: number;
  life: number;
  maxLife: number;
  scored: boolean;
}

const PARTS: Part[] = [
  { ox: 0, oy: -20, r: 7, type: "head" },
  { ox: 0, oy: -6, r: 9, type: "body" },
  { ox: -12, oy: -8, r: 5, type: "arm" },
  { ox: 12, oy: -8, r: 5, type: "arm" },
  { ox: -6, oy: 6, r: 5, type: "leg" },
  { ox: 6, oy: 6, r: 5, type: "leg" },
];

function getPartDamage(type: "head" | "body" | "arm" | "leg"): number {
  if (type === "head") return 5;
  if (type === "body") return 3;
  if (type === "arm") return 2;
  return 1;
}

let charIdCounter = 0;

// MODIFIED TO ACCEPT GAME MODE FOR SUDDEN DEATH
function spawnCharacter(team: 1 | 2, mode: GameMode = "timer"): Character {
  const x = team === 1 ? 40 : ARENA_W - 40;
  const y = SCOREBOARD_H + 40 + Math.random() * (ARENA_H - 80);
  const angle = Math.random() * Math.PI * 2;
  const speed = SPAWN_SPEED + Math.random() * 1.5;
  const dirX = team === 1 ? 1 : -1;
  const vx = dirX * speed * (0.6 + Math.random() * 0.4);
  const vy = (Math.random() - 0.5) * speed;

  // Set HP based on mode
  const startingHp = mode === "sudden_death" ? 1 : MAX_HP;

  return {
    id: charIdCounter++,
    team,
    x,
    y,
    vx,
    vy,
    angle,
    angularV: (Math.random() - 0.5) * 0.12,
    hp: startingHp,
    flashFrames: 0,
    dead: false,
    parts: PARTS,
  };
}

function rotatePoint(ox: number, oy: number, angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [ox * cos - oy * sin, ox * sin + oy * cos];
}

function getWeaponTip(c: Character): [number, number] {
  const [wx, wy] = rotatePoint(0, -30, c.angle);
  return [c.x + wx, c.y + wy];
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

function spawnExplosion(x: number, y: number, team: 1 | 2): Particle[] {
  const color = team === 1 ? "#ff4444" : "#4488ff";
  const particles: Particle[] = [];
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      color: Math.random() > 0.4 ? color : "#ffff66",
      size: 2 + Math.random() * 4,
    });
  }
  return particles;
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  active: boolean,
  highlight = false
) {
  ctx.fillStyle = highlight ? "#996622" : active ? "#443388" : "#222244";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = highlight ? "#ffbb44" : active ? "#9966ff" : "#445566";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = highlight ? "#ffdd88" : active ? "#ccaaff" : "#8899aa";
  ctx.font = highlight ? "bold 15px monospace" : "13px monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

function drawMenu(ctx: CanvasRenderingContext2D, mode: GameMode, opp: OpponentMode) {
  ctx.fillStyle = "#080814";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);

  for (let i = 0; i < 40; i++) {
    const x = (i * 67 + 13) % ARENA_W;
    const y = (i * 83 + 7) % (ARENA_H + SCOREBOARD_H);
    ctx.fillStyle = `rgba(80,60,150,${0.1 + (i % 5) * 0.04})`;
    ctx.fillRect(x, y, 6, 6);
  }

  ctx.fillStyle = "#ccaaff";
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.fillText("KINETIC", ARENA_W / 2, 110);
  ctx.fillStyle = "#ff9944";
  ctx.fillText("SOULS", ARENA_W / 2, 165);

  ctx.fillStyle = "#888";
  ctx.font = "14px monospace";
  ctx.fillText("1v1 AUTO BATTLE ARENA", ARENA_W / 2, 196);

  ctx.fillStyle = "#aaa";
  ctx.font = "bold 16px monospace";
  ctx.fillText("GAME MODE", ARENA_W / 2, 255);

  drawButton(ctx, ARENA_W / 2 - 130, 275, 115, 36, "Timer: 2 Mins", mode === "timer");
  drawButton(ctx, ARENA_W / 2 + 15, 275, 115, 36, "Score: 10 Pts", mode === "score");
  drawButton(ctx, ARENA_W / 2 - 130, 320, 115, 36, "Horde (PvE)", mode === "horde");
  drawButton(ctx, ARENA_W / 2 + 15, 320, 115, 36, "Sudden Death", mode === "sudden_death");

  ctx.fillStyle = "#aaa";
  ctx.font = "bold 16px monospace";
  ctx.fillText("OPPONENT", ARENA_W / 2, 390);

  drawButton(ctx, ARENA_W / 2 - 130, 405, 115, 36, "Player vs Player", opp === "pvp" && mode !== "horde");
  drawButton(ctx, ARENA_W / 2 + 15, 405, 115, 36, "Player vs Bot", opp === "bot" || mode === "horde");

  drawButton(ctx, ARENA_W / 2 - 75, 465, 150, 44, "START GAME", false, true);

  ctx.fillStyle = "#666";
  ctx.font = "12px monospace";
  ctx.fillText("P1: Press [A] to spawn  |  P2: Press [L] to spawn", ARENA_W / 2, 530);

  ctx.fillStyle = "#555";
  ctx.fillText("Characters bounce around and fight automatically!", ARENA_W / 2, 550);
}

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = "#080814";
  ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);

  ctx.fillStyle = "#ccaaff";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", ARENA_W / 2, 180);

  ctx.fillStyle = "#ffee88";
  ctx.font = "bold 32px monospace";
  ctx.fillText(state.winner, ARENA_W / 2, 260);

  ctx.fillStyle = "#ff6655";
  ctx.font = "24px monospace";
  ctx.fillText(`P1 Score: ${state.p1Score}`, ARENA_W / 2 - 100, 330);
  ctx.fillStyle = "#5599ff";
  ctx.fillText(`P2 Score: ${state.p2Score}`, ARENA_W / 2 + 100, 330);

  drawButton(ctx, ARENA_W / 2 - 90, 390, 180, 48, "MAIN MENU", false, true);
}

export default function KineticSouls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>({
    mode: "timer",
    opponent: "pvp",
    p1Score: 0,
    p2Score: 0,
    timeLeft: 120,
    scoreLimit: 10,
    running: false,
    over: false,
    winner: "",
  });

  const modeRef = useRef<GameMode>("timer");
  const opponentRef = useRef<OpponentMode>("pvp");

  const screenRef = useRef<"menu" | "game" | "over">("menu");
  const charactersRef = useRef<Character[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ghostsRef = useRef<Ghost[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timerAccRef = useRef<number>(0);
  const botTimerRef = useRef<number>(0);
  const botNextSpawnRef = useRef<number>(2500);

  const keysRef = useRef<Set<string>>(new Set());

  const drawPixelChar = useCallback(
    (ctx: CanvasRenderingContext2D, c: Character, flash: boolean) => {
      const teamColor = c.team === 1 ? "#ff6655" : "#5599ff";
      const darkColor = c.team === 1 ? "#aa2211" : "#2244aa";
      const skinColor = "#ffcc99";

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      if (flash) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
      }

      for (const p of c.parts) {
        const col = flash ? "white" : p.type === "head" ? skinColor : p.type === "body" ? teamColor : p.type === "arm" ? darkColor : teamColor;
        ctx.fillStyle = col;

        const px = p.ox;
        const py = p.oy;

        ctx.beginPath();
        const sr = p.r;
        ctx.fillRect(px - sr, py - sr, sr * 2, sr * 2);

        if (!flash && p.type === "head") {
          ctx.fillStyle = "#222";
          ctx.fillRect(px - 3, py - 2, 2, 3);
          ctx.fillRect(px + 1, py - 2, 2, 3);
        }
      }

      const wColor = flash ? "white" : "#ffee44";
      ctx.fillStyle = wColor;
      ctx.fillRect(-2, -38, 4, 12);
      ctx.fillStyle = flash ? "white" : "#aaaaaa";
      ctx.fillRect(-3, -46, 6, 8);

      ctx.restore();
    },
    []
  );

  const drawHpBar = useCallback((ctx: CanvasRenderingContext2D, c: Character, mode: GameMode) => {
    // Hide HP bar in Sudden Death (since it's 1-hit kill anyway)
    if (mode === "sudden_death") return;

    const barW = 28;
    const barH = 4;
    const bx = c.x - barW / 2;
    const by = c.y - 38;
    ctx.fillStyle = "#333";
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = "#22cc22";
    ctx.fillRect(bx, by, (barW * c.hp) / MAX_HP, barH);
    ctx.fillStyle = "white";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(c.hp), c.x, by - 2);
  }, []);

  const drawGhost = useCallback((ctx: CanvasRenderingContext2D, g: Ghost) => {
    const alpha = g.life / g.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g.team === 1 ? "#ff9988" : "#88aaff";

    ctx.beginPath();
    ctx.arc(g.x, g.y, 10, Math.PI, 0, false);
    ctx.lineTo(g.x + 10, g.y + 10);
    ctx.lineTo(g.x + 5, g.y + 5);
    ctx.lineTo(g.x, g.y + 10);
    ctx.lineTo(g.x - 5, g.y + 5);
    ctx.lineTo(g.x - 10, g.y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(g.x - 3, g.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(g.x + 3, g.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  const drawArena = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#111122";
    ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);

    ctx.strokeStyle = "#334";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let gx = 0; gx <= ARENA_W; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, SCOREBOARD_H);
      ctx.lineTo(gx, SCOREBOARD_H + ARENA_H);
      ctx.stroke();
    }
    for (let gy = SCOREBOARD_H; gy <= SCOREBOARD_H + ARENA_H; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(ARENA_W, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = "#6644aa";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);

    ctx.strokeStyle = "#334466";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(ARENA_W / 2, SCOREBOARD_H);
    ctx.lineTo(ARENA_W / 2, SCOREBOARD_H + ARENA_H);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const drawScoreboard = useCallback(
    (ctx: CanvasRenderingContext2D, state: GameState) => {
      ctx.fillStyle = "#0a0a18";
      ctx.fillRect(0, 0, ARENA_W, SCOREBOARD_H);

      ctx.strokeStyle = "#6644aa";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, ARENA_W, SCOREBOARD_H);

      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#cc4433";
      ctx.fillText(`P1: ${state.p1Score}`, 140, 36);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "bold 22px monospace";
      ctx.fillText("KINETIC SOULS", ARENA_W / 2, 24);

      ctx.font = "12px monospace";
      if (state.mode === "timer") {
        const mins = Math.floor(state.timeLeft / 60);
        const secs = Math.floor(state.timeLeft % 60);
        ctx.fillText(`${mins}:${secs.toString().padStart(2, "0")}`, ARENA_W / 2, 44);
      } else if (state.mode === "horde") {
        ctx.fillText(`SURVIVE THE HORDE: ${state.scoreLimit} KILLS`, ARENA_W / 2, 44);
      } else if (state.mode === "sudden_death") {
        ctx.fillText(`SUDDEN DEATH: FIRST TO ${state.scoreLimit}`, ARENA_W / 2, 44);
      } else {
        ctx.fillText(`FIRST TO ${state.scoreLimit}`, ARENA_W / 2, 44);
      }

      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "#3366cc";
      ctx.fillText(`P2: ${state.p2Score}`, ARENA_W - 140, 36);
    },
    []
  );

  const endGame = useCallback(() => {
    const st = stateRef.current;
    let winner = "";
    if (st.p1Score > st.p2Score) winner = "Player 1 Wins!";
    else if (st.p2Score > st.p1Score) winner = "Player 2 Wins!";
    else winner = "It's a Draw!";
    stateRef.current = { ...st, running: false, over: true, winner };
    screenRef.current = "over";
  }, []);

  const startGame = useCallback(() => {
    charIdCounter = 0;
    charactersRef.current = [];
    particlesRef.current = [];
    ghostsRef.current = [];
    timerAccRef.current = 0;
    botTimerRef.current = 0;

    // Setup Limits Based on Mode
    let limit = 10;
    if (modeRef.current === "horde") {
      limit = 50; 
      opponentRef.current = "bot"; // Force Bot in Horde mode
    }
    if (modeRef.current === "sudden_death") limit = 5;

    botNextSpawnRef.current = BOT_MIN_INTERVAL + Math.random() * (BOT_MAX_INTERVAL - BOT_MIN_INTERVAL);

    stateRef.current = {
      mode: modeRef.current,
      opponent: opponentRef.current,
      p1Score: 0,
      p2Score: 0,
      timeLeft: 120,
      scoreLimit: limit,
      running: true,
      over: false,
      winner: "",
    };
    screenRef.current = "game";
  }, []);

  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const screen = screenRef.current;
      const state = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (screen === "menu") {
        drawMenu(ctx, modeRef.current, opponentRef.current);
      } else if (screen === "over") {
        drawGameOver(ctx, state);
      } else {
        if (state.running) {
          if (state.mode === "timer") {
            timerAccRef.current += dt;
            if (timerAccRef.current >= 1000) {
              timerAccRef.current -= 1000;
              state.timeLeft -= 1;
              if (state.timeLeft <= 0) {
                endGame();
              }
            }
          }

          if (state.opponent === "bot") {
            botTimerRef.current += dt;

            // Adjust spawn rate for Horde Mode
            let minSpawn = BOT_MIN_INTERVAL;
            let maxSpawn = BOT_MAX_INTERVAL;
            if (state.mode === "horde") {
                minSpawn = 400; // Super fast spawning!
                maxSpawn = 1000;
            }

            if (botTimerRef.current >= botNextSpawnRef.current) {
              botTimerRef.current = 0;
              botNextSpawnRef.current = minSpawn + Math.random() * (maxSpawn - minSpawn);
              charactersRef.current.push(spawnCharacter(2, state.mode));
            }
          }

          const chars = charactersRef.current;

          for (const c of chars) {
            if (c.dead) continue;
            c.x += c.vx;
            c.y += c.vy;
            c.angle += c.angularV;

            const minY = SCOREBOARD_H + CHAR_RADIUS + 8;
            const maxY = SCOREBOARD_H + ARENA_H - CHAR_RADIUS - 8;

            if (c.x < CHAR_RADIUS + 4) {
              c.x = CHAR_RADIUS + 4;
              c.vx = Math.abs(c.vx) * (0.9 + Math.random() * 0.2);
              c.angularV += (Math.random() - 0.5) * 0.05;
            }
            if (c.x > ARENA_W - CHAR_RADIUS - 4) {
              c.x = ARENA_W - CHAR_RADIUS - 4;
              c.vx = -Math.abs(c.vx) * (0.9 + Math.random() * 0.2);
              c.angularV += (Math.random() - 0.5) * 0.05;
            }
            if (c.y < minY) {
              c.y = minY;
              c.vy = Math.abs(c.vy) * (0.9 + Math.random() * 0.2);
              c.angularV += (Math.random() - 0.5) * 0.05;
            }
            if (c.y > maxY) {
              c.y = maxY;
              c.vy = -Math.abs(c.vy) * (0.9 + Math.random() * 0.2);
              c.angularV += (Math.random() - 0.5) * 0.05;
            }

            const spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
            if (spd > 5.5) {
              c.vx = (c.vx / spd) * 5.5;
              c.vy = (c.vy / spd) * 5.5;
            }
            if (spd < SPAWN_SPEED * 0.6) {
              const boost = SPAWN_SPEED * 0.7 / Math.max(spd, 0.01);
              c.vx *= boost;
              c.vy *= boost;
            }

            if (c.flashFrames > 0) c.flashFrames--;
          }

          for (let i = 0; i < chars.length; i++) {
            const a = chars[i];
            if (a.dead) continue;
            for (let j = i + 1; j < chars.length; j++) {
              const b = chars[j];
              if (b.dead) continue;

              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const minDist = CHAR_RADIUS * 2 + 4;

              if (dist < minDist && dist > 0) {
                const overlap = (minDist - dist) / 2;
                const nx = dx / dist;
                const ny = dy / dist;
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                b.x += nx * overlap;
                b.y += ny * overlap;

                const relVx = a.vx - b.vx;
                const relVy = a.vy - b.vy;
                const dot = relVx * nx + relVy * ny;
                if (dot > 0) {
                  const restitution = 0.85;
                  a.vx -= dot * nx * restitution;
                  a.vy -= dot * ny * restitution;
                  b.vx += dot * nx * restitution;
                  b.vy += dot * ny * restitution;
                }

                if (a.team !== b.team) {
                  const [aWx, aWy] = getWeaponTip(a);
                  for (const p of b.parts) {
                    const [rpx, rpy] = rotatePoint(p.ox, p.oy, b.angle);
                    const wpx = b.x + rpx;
                    const wpy = b.y + rpy;
                    if (circlesOverlap(aWx, aWy, 6, wpx, wpy, p.r)) {
                      b.hp -= getPartDamage(p.type);
                      b.flashFrames = 3;
                      break;
                    }
                  }

                  const [bWx, bWy] = getWeaponTip(b);
                  for (const p of a.parts) {
                    const [rpx, rpy] = rotatePoint(p.ox, p.oy, a.angle);
                    const wpx = a.x + rpx;
                    const wpy = a.y + rpy;
                    if (circlesOverlap(bWx, bWy, 6, wpx, wpy, p.r)) {
                      a.hp -= getPartDamage(p.type);
                      a.flashFrames = 3;
                      break;
                    }
                  }
                }
              }
            }
          }

          for (const c of chars) {
            if (!c.dead && c.hp <= 0) {
              c.dead = true;
              const scoringTeam = c.team === 1 ? 2 : 1;
              const deathType = Math.random() > 0.5 ? "explosion" : "ghost";

              if (deathType === "explosion") {
                particlesRef.current.push(...spawnExplosion(c.x, c.y, c.team));
                if (scoringTeam === 1) state.p1Score++;
                else state.p2Score++;

                if (state.mode !== "timer" && (state.p1Score >= state.scoreLimit || state.p2Score >= state.scoreLimit)) {
                  endGame();
                }
              } else {
                ghostsRef.current.push({
                  x: c.x,
                  y: c.y,
                  team: c.team,
                  vy: -1.5,
                  life: 120,
                  maxLife: 120,
                  scored: false,
                });
              }
            }
          }

          charactersRef.current = chars.filter((c) => !c.dead);

          const ghosts = ghostsRef.current;
          for (const g of ghosts) {
            g.y += g.vy;
            g.life--;
            if (!g.scored && g.y < SCOREBOARD_H + 20) {
              g.scored = true;
              const scoringTeam = g.team === 1 ? 2 : 1;
              if (scoringTeam === 1) state.p1Score++;
              else state.p2Score++;

              if (state.mode !== "timer" && (state.p1Score >= state.scoreLimit || state.p2Score >= state.scoreLimit)) {
                endGame();
              }
            }
          }
          ghostsRef.current = ghosts.filter((g) => g.life > 0);

          const parts = particlesRef.current;
          for (const p of parts) {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
          }
          particlesRef.current = parts.filter((p) => p.life > 0);
        }

        drawArena(ctx);

        for (const p of particlesRef.current) {
          const alpha = p.life / p.maxLife;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          ctx.restore();
        }

        for (const c of charactersRef.current) {
          drawPixelChar(ctx, c, c.flashFrames > 0);
          drawHpBar(ctx, c, state.mode);
        }

        for (const g of ghostsRef.current) {
          drawGhost(ctx, g);
        }

        drawScoreboard(ctx, state);

        if (!state.running && !state.over) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);
          ctx.fillStyle = "white";
          ctx.font = "bold 20px monospace";
          ctx.textAlign = "center";
          ctx.fillText("Press A (P1) or L (P2) to spawn fighters!", ARENA_W / 2, SCOREBOARD_H + ARENA_H / 2);
        }
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [drawArena, drawPixelChar, drawHpBar, drawGhost, drawScoreboard, endGame]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const screen = screenRef.current;

      if (screen === "menu") {
        // Mode Buttons (Top Row)
        if (mx >= ARENA_W / 2 - 130 && mx <= ARENA_W / 2 - 15 && my >= 275 && my <= 311) modeRef.current = "timer";
        if (mx >= ARENA_W / 2 + 15 && mx <= ARENA_W / 2 + 130 && my >= 275 && my <= 311) modeRef.current = "score";

        // Mode Buttons (Bottom Row)
        if (mx >= ARENA_W / 2 - 130 && mx <= ARENA_W / 2 - 15 && my >= 320 && my <= 356) modeRef.current = "horde";
        if (mx >= ARENA_W / 2 + 15 && mx <= ARENA_W / 2 + 130 && my >= 320 && my <= 356) modeRef.current = "sudden_death";

        // Opponent Buttons
        if (mx >= ARENA_W / 2 - 130 && mx <= ARENA_W / 2 - 15 && my >= 405 && my <= 441) {
            if (modeRef.current !== "horde") opponentRef.current = "pvp"; // Prevent PvP in Horde
        }
        if (mx >= ARENA_W / 2 + 15 && mx <= ARENA_W / 2 + 130 && my >= 405 && my <= 441) opponentRef.current = "bot";

        // Start Button
        if (mx >= ARENA_W / 2 - 75 && mx <= ARENA_W / 2 + 75 && my >= 465 && my <= 509) {
          startGame();
        }
      } else if (screen === "over") {
        if (mx >= ARENA_W / 2 - 90 && mx <= ARENA_W / 2 + 90 && my >= 390 && my <= 438) {
          screenRef.current = "menu";
          stateRef.current = {
            ...stateRef.current,
            running: false,
            over: false,
          };
        }
      }
    },
    [startGame]
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current.add(e.key.toLowerCase());
    if (screenRef.current === "game" && stateRef.current.running) {
      if (e.key.toLowerCase() === "a") {
        charactersRef.current.push(spawnCharacter(1, stateRef.current.mode));
      }
      if (e.key.toLowerCase() === "l") {
        if (stateRef.current.opponent === "pvp") {
          charactersRef.current.push(spawnCharacter(2, stateRef.current.mode));
        }
      }
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop, handleClick, handleKeyDown, handleKeyUp]);

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px",
      }}
    >
      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H + SCOREBOARD_H}
        style={{
          maxWidth: "100%",
          imageRendering: "pixelated",
          border: "3px solid #6644aa",
          boxShadow: "0 0 40px rgba(100,60,200,0.6)",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          color: "#666",
          fontFamily: "monospace",
          fontSize: "12px",
          marginTop: "8px",
          textAlign: "center",
        }}
      >
        P1: [A] Spawn Fighter &nbsp;|&nbsp; P2: [L] Spawn Fighter (PvP mode)
      </div>
    </div>
  );
}