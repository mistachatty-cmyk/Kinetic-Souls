const GAME_ID = "kinetic-souls";
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let runId: string | null = null;
let started = false;
let completed = false;
let pickedFragment = false;
let hasFragment = false;
const inventoryListeners = new Set<(owned: boolean) => void>();

function updateInventory(items: unknown) {
  if (!Array.isArray(items) || items.length > 1 || !items.every((item) => item === "rift-fragment")) return;
  hasFragment = items.includes("rift-fragment");
  inventoryListeners.forEach((listener) => listener(hasFragment));
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.version !== 1 || data.gameId !== GAME_ID) return;
    if (data.type === "lok:demoday:inventory") { updateInventory(data.items); return; }
    if (data.type !== "lok:demoday:init" || typeof data.runId !== "string" || !RUN_ID.test(data.runId)) return;
    runId = data.runId;
    started = false;
    completed = false;
    pickedFragment = false;
    updateInventory(data.items);
  });
}

function send(event: "start" | "pickup" | "complete", fields: Record<string, unknown> = {}) {
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

export function pickUpDemoDayFragment() {
  if (!runId || !started || completed || pickedFragment) return false;
  pickedFragment = true;
  send("pickup", { itemKey: "rift-fragment", pickupId: "kinetic:boss:first" });
  return true;
}

export function onDemoDayInventory(listener: (owned: boolean) => void) {
  inventoryListeners.add(listener);
  listener(hasFragment);
  return () => { inventoryListeners.delete(listener); };
}
