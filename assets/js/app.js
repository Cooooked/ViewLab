/* ViewLab hero — animated visor/aperture motif behind the headline.
   Independent illustration; no application code or internals. */
(() => {
  const cv = document.getElementById("heroCanvas");
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, raf = 0, t = 0;
  function size() {
    const r = cv.parentElement.getBoundingClientRect();
    w = cv.width = Math.min(r.width, 1800);
    h = cv.height = Math.min(r.height, 760);
  }
  size();
  window.addEventListener("resize", size);
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.30;
    // breathing aperture — two eye-buffer ellipses with a visor curve
    for (let eye = 0; eye < 2; eye++) {
      const ex = cx + (eye === 0 ? -1 : 1) * w * 0.16;
      const breathe = 1 + Math.sin(t * 0.7 + eye * 1.3) * 0.03;
      const rx = w * 0.115 * breathe, ry = h * 0.34 * breathe;
      ctx.beginPath();
      ctx.ellipse(ex, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(232,232,232,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // aperture curve (visor mask silhouette)
      ctx.beginPath();
      const squash = 0.72 + Math.sin(t * 0.5 + eye) * 0.05;
      ctx.ellipse(ex, cy, rx * 0.82, ry * squash, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = "rgba(201,0,18,0.35)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // faint scanlines inside
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, cy, rx * 0.8, ry * 0.9, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgba(37,58,85,0.20)";
      ctx.lineWidth = 1;
      for (let y = cy - ry; y < cy + ry; y += 7) {
        ctx.beginPath(); ctx.moveTo(ex - rx, y); ctx.lineTo(ex + rx, y); ctx.stroke();
      }
      ctx.restore();
    }
    t += 0.008;
    if (!reduce) raf = requestAnimationFrame(draw);
  }
  draw();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => {
      en.forEach((e) => {
        if (e.isIntersecting && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
        else cancelAnimationFrame(raf);
      });
    }).observe(cv);
  }
})();

/* ViewLab bench — illustrative simulation of ViewLab's user-facing controls.
   Renders a stylised headset view on canvas: render slice, visor mask, overlays.
   Purpose-built demo logic; does not contain or imply the application's internals. */
(() => {
  "use strict";

  const canvas = document.getElementById("viewport");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = 0;
  let W = 960, H = 600, raf = 0;

  // Shift-light highway state (declared early: render() runs during control binding)
  const highway = { notes: [], spawn: 0.4, score: 0, combo: 0, misses: 0, flash: 0, verdict: "" };
  const LANES = ["#3FA34D", "#C93A2E", "#3A6FC9", "#E0B53A"]; // G R B Y
  const VERDICTS = ["PERFECT", "GREAT", "GOOD", "EARLY", "LATE", "MISS"];

  const state = {
    mode: "total",          // "total" | "split"
    totalHeight: 0.62,
    top: 0.15,              // split tangents, fractions
    bottom: 0.15,
    visorOn: true,
    visorW: 0.78,
    visorH: 0.70,
    overlays: {
      hud: true, clock: true, note: true, cross: true,
      shift: true, spot: false, lfe: false,
    },
    compare: false,
    compareX: 0.5,
    sat: 1, con: 1,
    noteText: "FUEL — 2 LAPS · TYRES GRINNING · BOX BOX",
    noteTheme: "paper",
  };

  /* ---------- DOM wiring ---------- */
  const $ = (id) => document.getElementById(id);

  function bindRange(id, outId, fmt, fn) {
    const el = $(id), out = $(outId);
    const upd = () => { out.textContent = fmt(el.value); fn(parseFloat(el.value)); render(); };
    el.addEventListener("input", upd);
    upd();
  }
  const pct = (v) => `${v}%`;

  bindRange("totalHeight", "totalOut", pct, (v) => { state.totalHeight = v / 100; });
  bindRange("topTangent", "topOut", pct, (v) => { state.top = v / 100; });
  bindRange("botTangent", "botOut", pct, (v) => { state.bottom = v / 100; });
  bindRange("visorW", "visorWOut", pct, (v) => { state.visorW = v / 100; });
  bindRange("visorH", "visorHOut", pct, (v) => { state.visorH = v / 100; });

  $("visorOn").addEventListener("change", (e) => { state.visorOn = e.target.checked; render(); });

  $("compareOn").addEventListener("change", (e) => {
    state.compare = e.target.checked;
    $("compareCtl").hidden = !state.compare;
    render();
  });
  bindRange("compareX", "compareOut", pct, (v) => { state.compareX = v / 100; });

  // drag the compare divider directly on the canvas
  (function () {
    let dragging = false;
    const setFromX = (clientX) => {
      const r = canvas.getBoundingClientRect();
      const f = Math.min(0.85, Math.max(0.15, (clientX - r.left) / r.width));
      const pctF = Math.round(f * 100);
      const slider = $("compareX");
      if (slider) { slider.value = pctF; slider.dispatchEvent(new Event("input", { bubbles: true })); }
      state.compareX = pctF / 100;
      render();
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!state.compare) return;
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      setFromX(e.clientX);
    });
    canvas.addEventListener("pointermove", (e) => { if (dragging) setFromX(e.clientX); });
    ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { dragging = false; }));
  })();
  bindRange("sat", "satOut", pct, (v) => { state.sat = v / 100; });
  bindRange("con", "conOut", pct, (v) => { state.con = v / 100; });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      state.mode = btn.dataset.mode;
      $("totalControls").hidden = state.mode !== "total";
      $("splitControls").hidden = state.mode !== "split";
      render();
    });
  });

  $("overlayToggles").addEventListener("change", (e) => {
    const key = e.target.id.replace(/^ov/, "").toLowerCase();
    if (key === "hud") state.overlays.hud = e.target.checked;
    else if (key === "clock") state.overlays.clock = e.target.checked;
    else if (key === "note") state.overlays.note = e.target.checked;
    else if (key === "cross") state.overlays.cross = e.target.checked;
    else if (key === "shift") state.overlays.shift = e.target.checked;
    else if (key === "spot") state.overlays.spot = e.target.checked;
    else if (key === "lfe") state.overlays.lfe = e.target.checked;
    render();
  });

  $("noteText").addEventListener("input", (e) => {
    state.noteText = e.target.value;
    render();
  });
  $("noteTheme").addEventListener("change", (e) => {
    state.noteTheme = e.target.value;
    render();
  });
  var noteCtl2 = $("noteThemeCtl");
  $("noteTextCtl").hidden = $("noteThemeCtl").hidden = !state.overlays.note;
  $("ovNote").addEventListener("change", (e) => {
    $("noteTextCtl").hidden = noteCtl2.hidden = !e.target.checked;
  });

  const presets = {
    iracing: { totalHeight: 55, mode: "total", visorOn: true, visorW: 74, visorH: 62,
      overlays: { hud: true, clock: false, note: true, cross: true, shift: true, spot: true, lfe: false } },
    flight: { totalHeight: 88, mode: "total", visorOn: false, visorW: 92, visorH: 80,
      overlays: { hud: true, clock: true, note: false, cross: false, shift: false, spot: false, lfe: false } },
    cinema: { totalHeight: 100, mode: "total", visorOn: true, visorW: 96, visorH: 88,
      overlays: { hud: false, clock: true, note: false, cross: false, shift: false, spot: false, lfe: false } },
  };

  function applyPreset(name) {
    const p = presets[name];
    state.mode = p.mode; state.totalHeight = p.totalHeight / 100;
    state.visorOn = p.visorOn; state.visorW = p.visorW / 100; state.visorH = p.visorH / 100;
    Object.assign(state.overlays, p.overlays);

    $("totalHeight").value = p.totalHeight;
    $("totalOut").textContent = pct(p.totalHeight);
    $("visorW").value = p.visorW; $("visorWOut").textContent = pct(p.visorW);
    $("visorH").value = p.visorH; $("visorHOut").textContent = pct(p.visorH);
    $("visorOn").checked = p.visorOn;
    $("ovHud").checked = state.overlays.hud;
    $("ovClock").checked = state.overlays.clock;
    $("ovNote").checked = state.overlays.note;
    $("ovCross").checked = state.overlays.cross;
    $("ovShift").checked = state.overlays.shift;
    $("ovSpot").checked = state.overlays.spot;
    $("ovLfe").checked = state.overlays.lfe;

    document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === p.mode));
    $("totalControls").hidden = p.mode !== "total";
    $("splitControls").hidden = p.mode !== "split";
    document.querySelectorAll(".preset").forEach((b) => b.classList.toggle("is-active", b.dataset.preset === name));
    render();
  }
  document.querySelectorAll(".preset").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".preset").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      applyPreset(b.dataset.preset);
    }));
  applyPreset("iracing");

  /* ---------- geometry helpers ---------- */
  function sliceBand(W, H) {
    let top, height;
    if (state.mode === "total") {
      height = state.totalHeight;
      top = (1 - height) / 2;
    } else {
      // split tangents: top edge sits at 0.5 - top; slice height = top + bottom.
      // Reproduces the app's documented cases: equal tangents centre the slice;
      // top=0/bottom=0.2 yields a 20% slice shifted downward.
      height = state.top + state.bottom;
      top = 0.5 - state.top;
    }
    height = Math.max(0.01, Math.min(1, height));
    top = Math.max(0, Math.min(1 - height, top));
    return { y: top * H, h: height * H };
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- scene ---------- */
  function drawScene(W, H, t) {
    // night circuit sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0B1220");
    sky.addColorStop(0.55, "#141C2C");
    sky.addColorStop(0.72, "#1E2436");
    sky.addColorStop(1, "#0A0B0E");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 197.3) % W, sy = ((i * 89.7) % (H * 0.4));
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.globalAlpha = 0.25 * tw;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // distant grandstand band with lit windows
    const gy = H * 0.52;
    ctx.fillStyle = "#0D1119";
    ctx.fillRect(0, gy - H * 0.05, W, H * 0.07);
    for (let i = 0; i < 90; i++) {
      const wx = (i * 53.7) % W, wy = gy - H * 0.045 + ((i * 31.1) % (H * 0.05));
      const warm = i % 3 === 0;
      ctx.fillStyle = warm ? "rgba(255,190,90,0.5)" : "rgba(140,170,255,0.4)";
      ctx.fillRect(wx, wy, 3, 2);
    }

    // track: perspective ribbon
    const horizon = H * 0.56;
    const cx = W * 0.5;
    ctx.fillStyle = "#15171B";
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.06, horizon);
    ctx.lineTo(cx - W * 0.62, H);
    ctx.lineTo(cx + W * 0.62, H);
    ctx.lineTo(cx + W * 0.06, horizon);
    ctx.closePath();
    ctx.fill();

    // curbs: red/white dashes along inside edge
    for (let i = 0; i < 14; i++) {
      const f = i / 14;
      const y = horizon + (H - horizon) * Math.pow(f, 1.7);
      const spread = W * 0.06 + (W * 0.56) * Math.pow(f, 1.7);
      const dash = (i % 2 === 0);
      ctx.fillStyle = dash ? "rgba(201,0,18,0.85)" : "rgba(220,220,220,0.8)";
      ctx.fillRect(cx - spread - 8, y, 8, 3 + f * 4);
      ctx.fillRect(cx + spread, y, 8, 3 + f * 4);
    }
    // centre dashes
    ctx.fillStyle = "rgba(200,200,200,0.28)";
    for (let i = 0; i < 12; i++) {
      const f = i / 12;
      const y = horizon + (H - horizon) * Math.pow(f, 1.7);
      const w = 2 + f * 5;
      ctx.fillRect(cx - w / 2, y, w, 2 + f * 5);
    }

    // one car silhouette with taillight glow
    const carF = 0.42 + 0.08 * Math.sin(t * 0.3);
    const carY = horizon + (H - horizon) * Math.pow(carF, 1.7);
    const carSpread = W * 0.06 + (W * 0.56) * Math.pow(carF, 1.7);
    const carX = cx - carSpread * 0.55;
    const carW = 26 + carF * 60, carH = 8 + carF * 16;
    ctx.fillStyle = "#0A0C10";
    roundedRect(carX, carY - carH, carW, carH, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,40,40,0.9)";
    ctx.fillRect(carX + carW - 4, carY - carH * 0.62, 3, 3);
    ctx.fillRect(carX + carW - 4, carY - carH * 0.3, 3, 3);
    // headlight glow ahead
    const hg = ctx.createRadialGradient(carX - 30, carY - carH * 0.4, 2, carX - 30, carY - carH * 0.4, 60);
    hg.addColorStop(0, "rgba(255,240,200,0.20)");
    hg.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(carX - 90, carY - carH - 30, 120, 60);

    // light poles
    for (let i = 0; i < 5; i++) {
      const f = 0.15 + i * 0.16;
      const y = horizon + (H - horizon) * Math.pow(f, 1.7);
      const spread = W * 0.06 + (W * 0.56) * Math.pow(f, 1.7);
      const px = cx + spread + 14;
      ctx.strokeStyle = "rgba(160,170,190,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - 26 - f * 30); ctx.stroke();
      ctx.fillStyle = "rgba(255,230,160,0.85)";
      ctx.beginPath(); ctx.arc(px, y - 28 - f * 30, 2 + f * 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------- overlays ---------- */
  function drawHud(W, H, t) {
    const gpu = 58 + 8 * Math.sin(t * 0.9), cpu = 36 + 5 * Math.sin(t * 0.6 + 1);
    const framems = 6.9 + Math.sin(t * 2.1) * 0.4;
    const x = 16, y = 14, w = 218, h = 64;
    ctx.fillStyle = "rgba(8,9,10,0.78)";
    roundedRect(x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = "#3A3D42"; ctx.lineWidth = 1;
    roundedRect(x, y, w, h, 4); ctx.stroke();
    ctx.font = "600 9px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "#9A9A9A";
    ctx.fillText("PERFORMANCE HUD", x + 10, y + 15);
    ctx.font = "12px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "#E8E8E8";
    ctx.fillText(`GPU ${gpu.toFixed(0)}%   CPU ${cpu.toFixed(0)}%`, x + 10, y + 32);
    ctx.fillText(`APP ${framems.toFixed(1)}ms   144.0 FPS`, x + 10, y + 49);
    // mini bar
    ctx.fillStyle = "#C90012";
    ctx.fillRect(x + 10, y + 56, (w - 20) * (gpu / 100), 3);
    ctx.fillStyle = "#3A3D42";
    ctx.fillRect(x + 10, y + 56, w - 20, 3);
    ctx.fillStyle = "#C90012";
    ctx.fillRect(x + 10, y + 56, (w - 20) * (gpu / 100), 3);
  }

  function drawClock(W, H) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
    const x = W - 150, y = 14;
    ctx.textAlign = "right";
    ctx.font = "600 15px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "rgba(8,9,10,0.6)";
    roundedRect(x - 12, y - 4, 138, 40, 5); ctx.fill();
    ctx.fillStyle = "#E8E8E8";
    ctx.fillText(time, W - 22, y + 14);
    ctx.font = "10px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "#9A9A9A";
    ctx.fillText(date, W - 22, y + 29);
    ctx.textAlign = "left";
  }

  function drawNote(W, H) {
    const w = 190, h = 92, x = 18, y = H - h - 18;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.035);
    const themes = {
      paper: { bg: "#EDE8D8", edge: "#C9C2AC", dim: "#8A8271", ink: "#4A463C" },
      hd:    { bg: "#F4F1E6", edge: "#D8D2BC", dim: "#7A7462", ink: "#33302A" },
      dark:  { bg: "#1B1D22", edge: "#3A3D45", dim: "#8A8F9C", ink: "#D8DAE0" },
      neon:  { bg: "#101418", edge: "#39FF88", dim: "#39FF88", ink: "#E8FFF0" },
    };
    const th = themes[state.noteTheme] || themes.paper;
    ctx.fillStyle = th.bg;
    roundedRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
    ctx.strokeStyle = th.edge; ctx.lineWidth = state.noteTheme === "neon" ? 1.5 : 1;
    roundedRect(-w / 2, -h / 2, w, h, 3); ctx.stroke();
    ctx.fillStyle = th.dim;
    ctx.font = "600 10px 'Segoe UI', sans-serif";
    ctx.fillText("STICKY NOTE", -w / 2 + 12, -h / 2 + 18);
    ctx.fillStyle = th.ink;
    ctx.font = "13px 'Segoe UI', sans-serif";
    const parts = (state.noteText || "").split("·").map((p) => p.trim()).filter(Boolean);
    const lines = (parts.length ? parts : ["—"]).slice(0, 3);
    lines.forEach((ln, i) => ctx.fillText(ln.toUpperCase(), -w / 2 + 12, -h / 2 + 40 + i * 20));
    ctx.restore();
  }

  function drawCrosshair(W, H) {
    const cx = W / 2, cy = H / 2;
    ctx.strokeStyle = "rgba(232,232,232,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#C90012";
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(232,232,232,0.5)";
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 13, cy);
    ctx.moveTo(cx + 13, cy); ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 13);
    ctx.moveTo(cx, cy + 13); ctx.lineTo(cx, cy + 18);
    ctx.stroke();
  }

  // Shift-light highway: notes travel left→right toward a strike line and are judged.
  function drawShiftLight(W, H, t, dt) {
    const hw = Math.min(W * 0.46, 420), hh = 74;
    const x = W / 2 - hw / 2, y = H - hh - 26;
    const laneW = (hw - 24) / 4;
    const strikeX = x + hw - 30;
    const travel = 2.6; // seconds left edge → strike line

    // spawn
    highway.spawn -= dt;
    if (highway.spawn <= 0) {
      highway.spawn = 0.55 + Math.random() * 0.85;
      highway.notes.push({ lane: Math.floor(Math.random() * 4), prog: 0, judged: false });
    }

    // advance + judge
    highway.notes.forEach((n) => {
      if (n.judged) return;
      n.prog += dt / travel;
      if (n.prog >= 1) {
        n.judged = true;
        const roll = Math.random();
        const v = roll < 0.45 ? "PERFECT" : roll < 0.7 ? "GREAT" : roll < 0.85 ? "GOOD" : "LATE";
        highway.verdict = v;
        highway.flash = 0.7;
        highway.combo++;
        highway.score += v === "PERFECT" ? 300 : v === "GREAT" ? 200 : v === "GOOD" ? 100 : 50;
      }
    });
    highway.notes = highway.notes.filter((n) => n.prog < 1.15);
    if (highway.flash > 0) highway.flash -= dt;

    // panel
    ctx.fillStyle = "rgba(8,9,10,0.82)";
    roundedRect(x - 8, y - 30, hw + 16, hh + 52, 8); ctx.fill();
    ctx.strokeStyle = "#3A3D42"; ctx.stroke();
    ctx.font = "600 10px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#9A9A9A";
    ctx.fillText("SHIFT LIGHT", x, y - 16);

    // highway body
    const hy = y + 8;
    ctx.fillStyle = "#14161A";
    roundedRect(x, hy, hw, hh - 16, 6); ctx.fill();
    for (let i = 1; i < 4; i++) {
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath(); ctx.moveTo(x + i * laneW, hy + 4); ctx.lineTo(x + i * laneW, hy + hh - 20); ctx.stroke();
    }
    ctx.strokeStyle = "#E8E8E8"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(strikeX, hy + 2); ctx.lineTo(strikeX, hy + hh - 18); ctx.stroke();
    ctx.lineWidth = 1;

    // fret buttons at bottom of highway
    for (let i = 0; i < 4; i++) {
      const bx = x + 12 + i * laneW + laneW * 0.18;
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      roundedRect(bx, hy + hh - 26, laneW * 0.64, 18, 4); ctx.fill();
      ctx.fillStyle = LANES[i];
      ctx.globalAlpha = 0.85;
      roundedRect(bx + 2, hy + hh - 24, laneW * 0.64 - 4, 5, 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // notes
    highway.notes.forEach((n) => {
      const colX = x + 12 + n.lane * laneW + laneW * 0.18;
      const noteX = colX + (strikeX - colX - laneW * 0.64) * n.prog;
      const nw = laneW * 0.64, nh = hh - 40;
      const grad = ctx.createLinearGradient(0, hy + 8, 0, hy + 8 + nh);
      grad.addColorStop(0, LANES[n.lane]);
      grad.addColorStop(1, shade(LANES[n.lane], -45));
      ctx.fillStyle = grad;
      roundedRect(noteX, hy + 8, nw, nh, 5); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundedRect(noteX + 3, hy + 11, nw - 6, 4, 2); ctx.fill();
    });

    // verdict + score
    if (highway.flash > 0) {
      ctx.font = "700 15px 'Segoe UI', sans-serif";
      ctx.fillStyle = highway.flash > 0.35 ? "#7CFC9A" : "#E8E8E8";
      ctx.textAlign = "center";
      ctx.fillText(highway.verdict, x + hw / 2, y - 3);
      ctx.textAlign = "left";
    }
    ctx.font = "600 11px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "#C8C8C8";
    ctx.textAlign = "center";
    ctx.fillText(`SCORE ${highway.score}   COMBO x${Math.min(4, 1 + Math.floor(highway.combo / 8))}`, x + hw / 2, y + hh + 18);
    ctx.textAlign = "left";
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawSpotter(W, H, t) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3);
    const gradL = ctx.createLinearGradient(0, 0, 60, 0);
    gradL.addColorStop(0, `rgba(201,0,18,${0.5 * pulse})`);
    gradL.addColorStop(1, "rgba(201,0,18,0)");
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, 60, H);
    const gradR = ctx.createLinearGradient(W, 0, W - 60, 0);
    gradR.addColorStop(0, `rgba(230,140,0,${0.45 * pulse})`);
    gradR.addColorStop(1, "rgba(230,140,0,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(W - 60, 0, 60, H);
    ctx.font = "700 22px 'Segoe UI', sans-serif";
    ctx.fillStyle = `rgba(255,${Math.floor(120 + 100 * pulse)},60,0.9)`;
    ctx.fillText("◀", 14, H / 2);
    ctx.fillText("▶", W - 30, H / 2);
  }

  function drawLfe(W, H, t) {
    const bars = 48, bw = 6, gap = 3;
    const totalW = bars * (bw + gap);
    const x0 = W / 2 - totalW / 2, baseY = H - 12, maxH = 60;
    for (let i = 0; i < bars; i++) {
      const f = i / bars;
      const env = Math.sin(f * Math.PI);           // band-pass-ish envelope
      const v = Math.abs(Math.sin(t * (1.2 + f * 3) + i * 0.7)) * env;
      const bh = 4 + v * maxH * env;
      const hue = 30 - f * 20;
      ctx.fillStyle = `hsla(${hue},95%,${45 + v * 15}%,${0.28 + v * 0.4})`;
      ctx.fillRect(x0 + i * (bw + gap), baseY - bh, bw, bh);
    }
  }

  /* ---------- frame ---------- */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(280, rect.width);
    const cssH = cssW * (600 / 960);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";
    // logical drawing space stays 960x600; transform scales it to device pixels
    ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 600, 0, 0);
  }

  function render(now = performance.now()) {
    const t = now / 1000;
    const dt = Math.min(0.05, t - (last || t)); last = t;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.filter = `saturate(${state.sat}) contrast(${state.con})`;
    drawScene(W, H, t);
    ctx.restore();

    // render slice: dim what's not rendered
    const band = sliceBand(W, H);
    ctx.save();
    ctx.fillStyle = "rgba(4,5,7,0.55)";
    ctx.fillRect(0, 0, W, band.y);
    ctx.fillRect(0, band.y + band.h, W, H - band.y - band.h);
    // hatch marks in dead zones
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let y = 8; y < band.y - 8; y += 14) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 30); ctx.stroke();
    }
    for (let y = band.y + band.h + 8; y < H - 8; y += 14) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 30); ctx.stroke();
    }
    // band edge lines
    ctx.strokeStyle = "rgba(201,0,18,0.7)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(0, band.y); ctx.lineTo(W, band.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, band.y + band.h); ctx.lineTo(W, band.y + band.h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 10px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "rgba(154,154,154,0.9)";
    if (band.y > 44) ctx.fillText("NOT RENDERED", 12, band.y - 10);
    if (H - (band.y + band.h) > 44) ctx.fillText("NOT RENDERED", 12, band.y + band.h + 18);
    ctx.restore();

    // savings note
    const frac = state.mode === "total" ? state.totalHeight : state.top + state.bottom;
    $("savingsNote").textContent = `≈${Math.max(0, Math.round((1 - frac) * 100))}% fewer shaded pixels (approx.)`;

    // visor mask
    if (state.visorOn) {
      const aw = state.visorW * W, ah = state.visorH * H;
      const ax = W / 2 - aw / 2, ay = H / 2 - ah / 2;
      const apex = (1 - state.visorH) * H * 0.9 + 8;
      const cr = 16;
      const l = ax, r = ax + aw, tp = ay, bt = ay + ah;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.moveTo(l + cr, bt);
      ctx.lineTo(r - cr, bt);
      ctx.quadraticCurveTo(r, bt, r, bt - cr);
      ctx.lineTo(r, tp + cr);
      ctx.quadraticCurveTo(r, tp, r - cr * 0.4, tp);
      ctx.quadraticCurveTo(W / 2, tp - apex, l + cr * 0.4, tp);
      ctx.quadraticCurveTo(l, tp, l, tp + cr);
      ctx.lineTo(l, bt - cr);
      ctx.quadraticCurveTo(l, bt, l + cr, bt);
      ctx.closePath();
      ctx.fillStyle = "rgba(3,4,6,0.93)";
      ctx.fill("evenodd");
      // faint red visor edge
      ctx.strokeStyle = "rgba(201,0,18,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // overlays
    if (state.overlays.hud) drawHud(W, H, t);
    if (state.overlays.clock) drawClock(W, H);
    if (state.overlays.note) drawNote(W, H);
    if (state.overlays.cross) drawCrosshair(W, H);
    if (state.overlays.spot) drawSpotter(W, H, t);
    if (state.overlays.lfe) drawLfe(W, H, t);
    if (state.overlays.shift) drawShiftLight(W, H, t, dt);

    // A/B compare: repaint the right of the divider with the unmodified frame
    if (state.compare) {
      const dx = state.compareX * W;
      ctx.save();
      ctx.beginPath();
      ctx.rect(dx, 0, W - dx, H);
      ctx.clip();
      ctx.clearRect(dx, 0, W - dx, H);
      drawScene(W, H, t);
      ctx.restore();
      // divider + labels
      ctx.save();
      ctx.strokeStyle = "rgba(232,232,232,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 11px 'Cascadia Mono', Consolas, monospace";
      ctx.fillStyle = "rgba(232,232,232,0.9)";
      ctx.fillText("VIEWLAB", 14, 22);
      const rawW = ctx.measureText("UNMODIFIED").width;
      ctx.fillText("UNMODIFIED", W - rawW - 14, 22);
      ctx.restore();
    }
  }

  function frame(now) {
    render(now || performance.now());
    raf = requestAnimationFrame(frame);
  }

  function kick() { render(performance.now()); }

  new ResizeObserver(() => { resize(); kick(); }).observe(canvas.parentElement);
  resize();
  if (reduceMotion) {
    render(performance.now());
  } else {
    raf = requestAnimationFrame(frame);
  }
})();

/* Profile cards drive the bench presets (delegates to existing preset buttons). */
document.querySelectorAll(".profile-card").forEach((card) => {
  const main = card.querySelector(".profile-card-main");
  if (main) main.addEventListener("click", () => {
    const preset = card.dataset.preset;
    document.querySelectorAll(".profile-card").forEach((c) => c.classList.toggle("is-active", c === card));
    const btn = document.querySelector(`.preset[data-preset="${preset}"]`);
    if (btn) btn.click();
    document.getElementById("bench").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});

/* Mobile nav toggle */
const burger = document.getElementById("navBurger");
const navLinks = document.getElementById("navLinks");
if (burger && navLinks) {
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("open");
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  });
}

/* Panel layout preview — named arrangements animate panels into place. */
(function () {
  const scene = document.getElementById("panelScene");
  if (!scene) return;
  const btns = document.querySelectorAll(".pl-btn");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  btns.forEach((b) => b.addEventListener("click", () => {
    btns.forEach((x) => {
      const on = x === b;
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-pressed", on ? "true" : "false");
    });
    scene.dataset.layout = b.dataset.layout;
    // inline --x/--y/--w/--h would override the stylesheet layout — release them so the named arrangement applies
    scene.querySelectorAll(".p-panel").forEach((p) => {
      ["--x", "--y", "--w", "--h"].forEach((prop) => p.style.removeProperty(prop));
    });
    if (reduce) {
      scene.querySelectorAll(".p-panel").forEach((p) => {
        p.style.transition = "none";
        setTimeout(() => { p.style.transition = ""; }, 50);
      });
    }
  }));
})();

/* Shift-light highway — playable rhythm demo (illustration of the real theme). */
(function () {
  const cv = document.getElementById("slCanvas");
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 880, H = 240, LANES = 4, LANE_W = W / LANES;
  const HIT_X = W * 0.82, SPEED = 260; // px/s
  const COLORS = ["#3FA34D", "#C93A2E", "#3A6FC9", "#E0B53A"];
  const KEYS = { d: 0, f: 1, j: 2, k: 3 };
  let notes = [], score = 0, combo = 0, spawn = 0.8, raf = 0, last = 0, flash = null, flashT = 0;
  const scoreEl = document.getElementById("slScore");
  const comboEl = document.getElementById("slCombo");
  const verdictEl = document.getElementById("slVerdict");
  const bestEl = document.getElementById("slBest");
  let best = 0;
  try { best = parseInt(localStorage.getItem("vl-shiftlab-best") || "0", 10) || 0; } catch (e) {}
  if (bestEl) bestEl.textContent = "best " + best;
  function saveBest() {
    if (score > best) {
      best = score;
      try { localStorage.setItem("vl-shiftlab-best", String(best)); } catch (e) {}
      if (bestEl) bestEl.textContent = "best " + best;
    }
  }

  var restartBtn = document.getElementById("slRestart");
  if (restartBtn) restartBtn.addEventListener("click", resetGame);
  function resetGame() {
    notes = []; score = 0; combo = 0; spawn = 0.8;
    scoreEl.textContent = "0"; comboEl.textContent = "×0 combo";
    verdictEl.classList.remove("show");
    for (let i = 0; i < 3; i++) spawnNote();
  }
  function spawnNote() {
    // patterns: mostly singles, occasional doubles/chords
    const lane = Math.floor(Math.random() * LANES);
    notes.push({ lane, x: -30, hit: false, missed: false });
    if (Math.random() < 0.22) {
      const l2 = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES;
      notes.push({ lane: l2, x: -30, hit: false, missed: false });
    }
  }
  function verdict(text, cls) {
    verdictEl.textContent = text;
    verdictEl.className = "sl-verdict show " + cls;
    flashT = performance.now();
  }
  function press(lane) {
    // find nearest unhit note in lane within window
    let best = null, bd = 1e9;
    notes.forEach((n) => {
      if (n.lane !== lane || n.hit || n.missed) return;
      const d = Math.abs(n.x - HIT_X);
      if (d < bd) { bd = d; best = n; }
    });
    const win = SPEED * 0.14; // ~140ms window
    if (best && bd < win) {
      best.hit = true;
      const perfect = bd < SPEED * 0.05;
      combo++;
      score += (perfect ? 300 : 100) * Math.min(combo, 8);
      verdict(perfect ? "PERFECT" : "GOOD", perfect ? "perfect" : "good");
      saveBest();
    } else if (combo > 0) {
      combo = 0; verdict("MISS", "miss");
    }
    scoreEl.textContent = score;
    comboEl.textContent = "×" + combo + " combo";
  }
  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);
    // lanes
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(i * LANE_W, 0, LANE_W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
    }
    // hit line
    ctx.strokeStyle = "rgba(232,232,232,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(HIT_X, 10); ctx.lineTo(HIT_X, H - 10); ctx.stroke();
    // receptors
    for (let i = 0; i < LANES; i++) {
      const cx = i * LANE_W + LANE_W / 2;
      ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 3;
      ctx.strokeRect(cx - 26, H - 34, 52, 24);
      ctx.fillStyle = COLORS[i] + "33";
      ctx.fillRect(cx - 26, H - 34, 52, 24);
      ctx.fillStyle = COLORS[i];
      ctx.font = "700 11px Consolas, monospace"; ctx.textAlign = "center";
      ctx.fillText(["D", "F", "J", "K"][i], cx, H - 17);
    }
    // notes
    notes = notes.filter((n) => n.x < W + 40 && !n.missed);
    notes.forEach((n) => {
      const nx = n.x, ny = n.lane * (H / LANES) + (H / LANES) / 2;
      const s = 18;
      ctx.fillStyle = n.hit ? COLORS[n.lane] + "55" : COLORS[n.lane];
      ctx.beginPath();
      ctx.moveTo(nx, ny - s); ctx.lineTo(nx + s, ny); ctx.lineTo(nx, ny + s); ctx.lineTo(nx - s, ny);
      ctx.closePath(); ctx.fill();
      if (n.hit) { ctx.strokeStyle = COLORS[n.lane]; ctx.lineWidth = 2; ctx.stroke(); }
    });
    // spawn + move
    spawn -= dt;
    if (spawn <= 0) { spawnNote(); spawn = 0.55 + Math.random() * 0.5; }
    notes.forEach((n) => { n.x += SPEED * dt; });
    // miss detection
    notes.forEach((n) => {
      if (!n.hit && !n.missed && n.x - HIT_X > SPEED * 0.16) {
        n.missed = true; combo = 0;
        scoreEl.textContent = score; comboEl.textContent = "×0 combo";
        verdict("MISS", "miss");
      }
    });
    // fade verdict
    if (performance.now() - flashT > 600) verdictEl.classList.remove("show");
    raf = requestAnimationFrame(draw);
  }
  // input: keys + click/tap lanes
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (k in KEYS) press(KEYS[k]);
  });
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    press(Math.min(LANES - 1, Math.floor(x / LANE_W)));
  });
  if (reduce) { draw(performance.now()); cancelAnimationFrame(raf); }
  else raf = requestAnimationFrame((n) => { last = n; draw(n); });
  // pause offscreen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => {
      en.forEach((e) => {
        if (e.isIntersecting && !reduce) { last = performance.now(); raf = requestAnimationFrame(draw); }
        else cancelAnimationFrame(raf);
      });
    }).observe(cv);
  }
})();

/* Scroll-spy: highlight the nav link for the section in view. */
(function () {
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  const links = {};
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const id = a.getAttribute("href")?.replace("#", "");
    if (id && document.getElementById(id)) links[id] = a;
  });
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && links[en.target.id]) {
        Object.values(links).forEach((l) => l.classList.remove("is-active"));
        links[en.target.id].classList.add("is-active");
      }
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach((s) => io.observe(s));
})();

/* Profile cards — download a JSON preset file. */
document.querySelectorAll(".profile-dl").forEach((dl) => {
  dl.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = dl.dataset.dl;
    const presets = {
      iracing: { name: "iRacing · 144 Hz", render: { mode: "total", height_pct: 55 }, visor: { enabled: true, width_pct: 74, height_pct: 62 }, overlays: ["hud", "note", "crosshair", "shift", "spotter"] },
      flight:  { name: "Flight sim", render: { mode: "total", height_pct: 88 }, visor: { enabled: false }, overlays: ["hud", "clock"] },
      cinema:  { name: "Cinematic", render: { mode: "total", height_pct: 100 }, visor: { enabled: true, width_pct: 96, height_pct: 88 }, overlays: ["clock"] },
    };
    const p = presets[name];
    if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "viewlab-profile-" + name.split(" ")[0].toLowerCase() + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  });
});

/* Profile import — load a previously exported .json preset onto the bench. */
(function () {
  const btn = document.getElementById("profileImportBtn");
  const file = document.getElementById("profileFile");
  const msg = document.getElementById("profileImportMsg");
  if (!btn || !file) return;
  btn.addEventListener("click", () => file.click());
  file.addEventListener("change", () => {
    const f = file.files[0];
    file.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        const r = p.render || {}, v = p.visor || {};
        // mode
        const modeBtn = document.querySelector(`.seg-btn[data-mode="${r.mode === "split" ? "split" : "total"}"]`);
        if (modeBtn) modeBtn.click();
        // heights
        const setPct = (id, outId, val) => {
          const el = document.getElementById(id), o = document.getElementById(outId);
          if (!el || val == null) return;
          el.value = val; if (o) o.textContent = pct(val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        if (r.height_pct != null) setPct("totalHeight", "totalOut", Math.round(r.height_pct));
        if (v.width_pct != null) setPct("visorW", "visorWOut", Math.round(v.width_pct));
        if (v.height_pct != null) setPct("visorH", "visorHOut", Math.round(v.height_pct));
        // visor + overlay toggles
        const chk = (id, on) => { const el = document.getElementById(id); if (el) { el.checked = !!on; el.dispatchEvent(new Event("change", { bubbles: true })); } };
        chk("visorOn", v.enabled !== false);
        const ovMap = { hud: "ovHud", clock: "ovClock", note: "ovNote", crosshair: "ovCross", shift: "ovShift", spotter: "ovSpot", lfe: "ovLfe" };
        const list = Array.isArray(p.overlays) ? p.overlays : [];
        Object.keys(ovMap).forEach((k) => chk(ovMap[k], list.indexOf(k) !== -1));
        msg.textContent = "Profile loaded onto the bench";
        setTimeout(() => { msg.textContent = ""; }, 3000);
      } catch (err) {
        msg.textContent = "Could not read that file — expected a ViewLab .json profile";
      }
    };
    reader.readAsText(f);
  });
})();

/* In-headset menu mock — click rows to cycle values (illustrates live apply). */
(function () {
  "use strict";
  var rows = document.querySelectorAll(".menu-mock .menu-row[data-opt]");
  rows.forEach(function (row) {
    row.addEventListener("click", function () {
      var opts = row.dataset.opt.split("|");
      var labels = row.dataset.labels ? row.dataset.labels.split("|") : opts;
      var idx = (parseInt(row.dataset.idx, 10) || 0);
      idx = (idx + 1) % opts.length;
      row.dataset.idx = String(idx);
      row.querySelector("b").textContent = labels[idx];
      row.classList.add("is-flash");
      setTimeout(function () { row.classList.remove("is-flash"); }, 450);
    });
  });
})();

/* Bench keyboard shortcuts: 1-7 toggle overlays, C compare, V visor. */
(function () {
  "use strict";
  var order = ["ovHud", "ovClock", "ovNote", "ovCross", "ovShift", "ovSpot", "ovLfe"];
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    var k = e.key;
    if (k >= "1" && k <= "7") {
      var el = document.getElementById(order[+k - 1]);
      if (el) { el.checked = !el.checked; el.dispatchEvent(new Event("change", { bubbles: true })); e.preventDefault(); }
    } else if (k === "c" || k === "C") {
      var cmp = document.getElementById("compareOn");
      if (cmp) { cmp.checked = !cmp.checked; cmp.dispatchEvent(new Event("change", { bubbles: true })); e.preventDefault(); }
    } else if (k === "v" || k === "V") {
      var vis = document.getElementById("visorOn");
      if (vis) { vis.checked = !vis.checked; vis.dispatchEvent(new Event("change", { bubbles: true })); e.preventDefault(); }
    }
  });
})();

/* Bench reset — restore factory defaults without touching presets. */
(function () {
  "use strict";
  var btn = document.getElementById("benchReset");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var set = function (id, v) { var el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    var chk = function (id, v) { var el = document.getElementById(id); if (el) { el.checked = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("totalHeight", 62); set("visorW", 78); set("visorH", 70);
    set("sat", 100); set("con", 100); set("compareX", 50);
    chk("visorOn", true); chk("compareOn", false); chk("compareCtl", false);
    chk("ovHud", true); chk("ovClock", true); chk("ovNote", true); chk("ovCross", true);
    chk("ovShift", true); chk("ovSpot", false); chk("ovLfe", false);
    document.querySelector('.seg-btn[data-mode="total"]').click();
    var nt = document.getElementById("noteText");
    if (nt) { nt.value = "FUEL — 2 LAPS · TYRES GRINNING · BOX BOX"; nt.dispatchEvent(new Event("input", { bubbles: true })); }
    var nth = document.getElementById("noteTheme");
    if (nth) { nth.value = "paper"; nth.dispatchEvent(new Event("change", { bubbles: true })); }
    document.querySelectorAll(".preset").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-done"); btn.textContent = "Bench reset";
    setTimeout(() => { btn.classList.remove("is-done"); btn.textContent = "Reset bench to defaults"; }, 1400);
  });
})();

/* VR panel preview — click a panel to select it (mirrors in-VR selection). */
(function () {
  "use strict";
  var scene = document.getElementById("panelScene");
  var hint = document.getElementById("panelHint");
  if (!scene || !hint) return;
  var baseHint = hint.textContent;
  var zTop = 2;
  scene.querySelectorAll(".p-panel").forEach(function (p) {
    p.addEventListener("click", function () {
      scene.querySelectorAll(".p-panel").forEach(function (o) { o.classList.remove("is-sel"); });
      p.classList.add("is-sel");
      p.style.zIndex = ++zTop;
      hint.textContent = "Selected: " + p.querySelector("span").textContent +
        " — in VR you drag it with the mouse and scroll to resize.";
    });
  });
  // layout switch resets selection + hint
  document.querySelectorAll(".pl-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      scene.querySelectorAll(".p-panel").forEach(function (o) { o.classList.remove("is-sel"); o.style.zIndex = ""; });
      hint.textContent = baseHint;
    });
  });
})();
