import React, { useEffect, useRef, useState } from "react";

const ARENA_W = 900;
const ARENA_H = 560;
const SCOREBOARD_H = 60;

export default function KineticSouls() {
  const canvasRef = useRef(null);
  const [activeUI, setActiveUI] = useState("menu");
  const [storyEnabled, setStoryEnabled] = useState(false);
  const [score, setScore] = useState(0);
  const [unlockedBadges] = useState(["v0.1.0", "v0.2.6"]);

  const stateRef = useRef({
    shards: [],
    cameraShake: 0,
    mouse: { x: 0, y: 0 },
  });

  const triggerMasterShatter = (x, y) => {
    stateRef.current.cameraShake = 10;
    for (let i = 0; i < 25; i++) {
      stateRef.current.shards.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 20,
        life: 1.0,
        color: Math.random() > 0.5 ? "#4facfe" : "#d4af37",
        isGlitch: Math.random() > 0.8,
      });
    }
  };

  const drawBtn = (ctx, x, y, w, h, txt, high) => {
    ctx.fillStyle = high ? "#4facfe" : "#222244";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(txt, x + w / 2, y + h / 2 + 5);
  };

  const drawPassport = (ctx) => {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);
    ctx.fillStyle = "#4facfe";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText("REFLECTION PASSPORT", ARENA_W / 2, 80);

    const badgeList = [
      {
        id: "v0.1.0",
        name: "Alpha Spark",
        log: "v0.1.0: Basic Physics & Hand of God.",
      },
      {
        id: "v0.2.6",
        name: "Centurion",
        log: "v0.2.6: The Coliseum & Glory Coins.",
      },
      {
        id: "v0.3.5",
        name: "Liquidation",
        log: "v0.3.5: The Finals Shatter & Story Mode.",
      },
    ];

    badgeList.forEach((b, i) => {
      const x = 100 + i * 260;
      const y = 180;
      const unlocked = unlockedBadges.includes(b.id);
      ctx.fillStyle = unlocked ? "rgba(79, 172, 254, 0.1)" : "#111";
      ctx.fillRect(x, y, 220, 280);
      ctx.strokeStyle = unlocked ? "#4facfe" : "#333";
      ctx.strokeRect(x, y, 220, 280);
      ctx.fillStyle = unlocked ? "#fff" : "#555";
      ctx.font = "bold 16px monospace";
      ctx.fillText(unlocked ? b.name : "LOCKED", x + 110, y + 40);
      if (unlocked) {
        ctx.font = "10px monospace";
        ctx.fillText(b.log, x + 110, y + 100, 200);
      }
    });

    drawBtn(ctx, ARENA_W / 2 - 50, 500, 100, 30, "BACK", false);
  };

  const gameLoop = (ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.save();
    if (s.cameraShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * s.cameraShake,
        (Math.random() - 0.5) * s.cameraShake,
      );
      s.cameraShake *= 0.9;
    }

    ctx.clearRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);

    if (activeUI === "menu") {
      ctx.fillStyle = "#080814";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H + SCOREBOARD_H);
      ctx.fillStyle = "#4facfe";
      ctx.font = "bold 50px monospace";
      ctx.textAlign = "center";
      ctx.fillText("KINETIC SOULS", ARENA_W / 2, 150);
      drawBtn(ctx, ARENA_W / 2 - 100, 250, 200, 40, "ENTER ARENA", true);
      drawBtn(ctx, ARENA_W / 2 - 100, 310, 200, 40, "PASSPORT", false);
      drawBtn(
        ctx,
        ARENA_W / 2 - 100,
        370,
        200,
        40,
        `STORY: ${storyEnabled ? "ON" : "OFF"}`,
        false,
      );
      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.fillText("LOK HORIZON v0.4.0 ONLINE", ARENA_W / 2, 530);
    } else if (activeUI === "passport") {
      drawPassport(ctx);
    } else if (activeUI === "game") {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, SCOREBOARD_H, ARENA_W, ARENA_H);

      s.shards.forEach((sh) => {
        sh.vy += 0.6;
        sh.x += sh.vx;
        sh.y += sh.vy;
        if (sh.y > ARENA_H + SCOREBOARD_H - 10) {
          sh.y = ARENA_H + SCOREBOARD_H - 10;
          sh.vy *= -0.5;
        }
        sh.life -= 0.02;
        ctx.fillStyle = sh.isGlitch && ts % 100 > 50 ? "#fff" : sh.color;
        ctx.globalAlpha = sh.life;
        ctx.fillRect(sh.x, sh.y, 6, 6);
        ctx.globalAlpha = 1.0;
      });
      s.shards = s.shards.filter((sh) => sh.life > 0);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, ARENA_W, SCOREBOARD_H);
      ctx.fillStyle = "#4facfe";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`(BR/Kn) LIQUIDATED: ${score}`, ARENA_W / 2, 35);
      drawBtn(ctx, 20, 15, 80, 30, "EXIT", false);
    }

    ctx.restore();
    requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const handleMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (ARENA_W / rect.width);
      const my =
        (e.clientY - rect.top) * ((ARENA_H + SCOREBOARD_H) / rect.height);

      if (activeUI === "menu") {
        if (mx > 350 && mx < 550) {
          if (my > 250 && my < 290) setActiveUI("game");
          if (my > 310 && my < 350) setActiveUI("passport");
          if (my > 370 && my < 410) setStoryEnabled(!storyEnabled);
        }
      } else if (activeUI === "game") {
        if (mx < 120 && my < 60) setActiveUI("menu");
        else {
          triggerMasterShatter(mx, my);
          setScore((prev) => prev + 10);
        }
      } else if (activeUI === "passport") {
        if (my > 480) setActiveUI("menu");
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    const frame = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [activeUI, storyEnabled, score]);

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H + SCOREBOARD_H}
        style={{ border: "4px solid #4facfe", cursor: "crosshair" }}
      />
    </div>
  );
}
