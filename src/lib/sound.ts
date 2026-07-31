"use client";

// Sons sintetizados na hora (Web Audio) — sem precisar de arquivo de áudio.
// Navegador só toca áudio depois de um gesto do usuário; ensureAudioUnlock()
// "destrava" o contexto no primeiro clique/tecla.

let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Liga um listener único que destrava o áudio no primeiro gesto da pessoa. */
export function ensureAudioUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const resume = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
}

function beep(c: AudioContext, freq: number, start: number, dur: number, gain = 0.15) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.03);
}

/** msg = ding suave (2 tons). urgent = alerta forte repetido. */
export function playChime(kind: "msg" | "urgent" = "msg") {
  const c = getCtx();
  if (!c) return;
  const go = () => {
    if (kind === "urgent") {
      // alerta: 3 rodadas de dois tons agudos
      for (let i = 0; i < 3; i++) {
        beep(c, 988, i * 0.42, 0.16, 0.28);
        beep(c, 740, i * 0.42 + 0.18, 0.2, 0.28);
      }
    } else {
      beep(c, 660, 0, 0.12, 0.13);
      beep(c, 880, 0.11, 0.16, 0.13);
    }
  };
  if (c.state === "suspended") c.resume().then(go).catch(() => {});
  else go();
}
