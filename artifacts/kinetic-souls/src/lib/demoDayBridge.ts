const GAME_ID = "kinetic-souls";
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let runId: string | null = null;
let started = false;
let completed = false;

if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== "lok:demoday:init" || data.version !== 1 ||
        data.gameId !== GAME_ID || typeof data.runId !== "string" || !RUN_ID.test(data.runId)) return;
    runId = data.runId;
    started = false;
    completed = false;
  });
}

function send(event: "start" | "complete", fields: Record<string, unknown> = {}) {
  if (!runId || window.parent === window) return;
  window.parent.postMessage({ type: "lok:demoday:event", version: 1, gameId: GAME_ID, runId, event, ...fields }, window.location.origin);
}

export function startDemoDayRun() {
  if (!runId || started) return;
  started = true;
  completed = false;
  send("start");
}

export function completeDemoDayRun(score: number) {
  if (!runId || !started || completed) return;
  completed = true;
  const boundedScore = Math.max(0, Math.min(100000000, Math.floor(score)));
  send("complete", { score: boundedScore, xp: Math.min(100000, boundedScore * 10), completedAt: new Date().toISOString() });
}
