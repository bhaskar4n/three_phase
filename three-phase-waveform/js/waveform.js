(() => {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  const phasorCanvas = document.getElementById('phasorCanvas');
  const phasorCtx = phasorCanvas.getContext('2d');

  const starCanvas = document.getElementById('starCanvas');
  const starCtx = starCanvas.getContext('2d');

  const els = {
    frequency: document.getElementById('frequency'),
    voltageAmp: document.getElementById('voltageAmp'),
    currentAmp: document.getElementById('currentAmp'),
    phaseAngle: document.getElementById('phaseAngle'),
    speed: document.getElementById('speed'),
    toggleBtn: document.getElementById('toggleBtn'),
    resetBtn: document.getElementById('resetBtn'),
    showCurrent: document.getElementById('showCurrent'),
    showVoltage: document.getElementById('showVoltage'),
  };

  const valueLabels = {
    frequency: document.getElementById('frequencyVal'),
    voltageAmp: document.getElementById('voltageAmpVal'),
    currentAmp: document.getElementById('currentAmpVal'),
    phaseAngle: document.getElementById('phaseAngleVal'),
    speed: document.getElementById('speedVal'),
  };

  const PHASES = [
    { name: 'A', offsetDeg: 0, color: '#ff5252', schematicDeg: 90 },
    { name: 'B', offsetDeg: -120, color: '#4caf50', schematicDeg: 210 },
    { name: 'C', offsetDeg: -240, color: '#2196f3', schematicDeg: 330 },
  ];

  const state = {
    frequency: Number(els.frequency.value),
    voltageAmp: Number(els.voltageAmp.value),
    currentAmp: Number(els.currentAmp.value),
    phaseAngleDeg: Number(els.phaseAngle.value),
    speed: Number(els.speed.value),
    running: true,
    showCurrent: els.showCurrent.checked,
    showVoltage: els.showVoltage.checked,
    timeOffset: 0,
  };

  els.frequency.addEventListener('input', () => {
    state.frequency = Number(els.frequency.value);
    valueLabels.frequency.textContent = state.frequency;
  });
  els.voltageAmp.addEventListener('input', () => {
    state.voltageAmp = Number(els.voltageAmp.value);
    valueLabels.voltageAmp.textContent = state.voltageAmp;
  });
  els.currentAmp.addEventListener('input', () => {
    state.currentAmp = Number(els.currentAmp.value);
    valueLabels.currentAmp.textContent = state.currentAmp;
  });
  els.phaseAngle.addEventListener('input', () => {
    state.phaseAngleDeg = Number(els.phaseAngle.value);
    valueLabels.phaseAngle.textContent = state.phaseAngleDeg;
  });
  els.speed.addEventListener('input', () => {
    state.speed = Number(els.speed.value);
    valueLabels.speed.textContent = state.speed.toFixed(1);
  });

  els.toggleBtn.addEventListener('click', () => {
    state.running = !state.running;
    els.toggleBtn.textContent = state.running ? 'Pause' : 'Resume';
  });

  els.resetBtn.addEventListener('click', () => {
    state.timeOffset = 0;
  });

  els.showCurrent.addEventListener('change', () => {
    state.showCurrent = els.showCurrent.checked;
  });
  els.showVoltage.addEventListener('change', () => {
    state.showVoltage = els.showVoltage.checked;
  });

  function resizeCanvas(el, context) {
    const dpr = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resizeCanvases() {
    resizeCanvas(canvas, ctx);
    resizeCanvas(phasorCanvas, phasorCtx);
    resizeCanvas(starCanvas, starCtx);
  }
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  const deg2rad = (d) => (d * Math.PI) / 180;

  function drawGrid(width, height, padding) {
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    ctx.strokeStyle = '#2a2e3a';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#9aa0ac';

    // Vertical gridlines every 90 degrees across 2 cycles (0..720)
    const totalDeg = 720;
    for (let d = 0; d <= totalDeg; d += 90) {
      const x = padding.left + (d / totalDeg) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      if (d % 360 === 0) {
        ctx.fillText(`${d}°`, x + 2, padding.top + plotH + 14);
      }
    }

    // Horizontal center + gridlines
    const midY = padding.top + plotH / 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, midY);
    ctx.lineTo(padding.left + plotW, midY);
    ctx.stroke();

    ctx.strokeStyle = '#3a3f4d';
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotH);
    ctx.stroke();
  }

  function drawWave(width, height, padding, phaseOffsetDeg, amp, maxAmp, color, thetaOffsetRad, dashed) {
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const midY = padding.top + plotH / 2;
    const totalDeg = 720;
    const samples = 720;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [6, 4] : []);

    for (let i = 0; i <= samples; i++) {
      const deg = (i / samples) * totalDeg;
      const theta = deg2rad(deg) + thetaOffsetRad + deg2rad(phaseOffsetDeg);
      const y = amp * Math.sin(theta);
      const px = padding.left + (deg / totalDeg) * plotW;
      const py = midY - (y / maxAmp) * (plotH / 2 - 10);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawArrow(context, x0, y0, x1, y1, color, dashed) {
    const headLen = 10;
    const angle = Math.atan2(y1 - y0, x1 - x0);

    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2;
    context.setLineDash(dashed ? [5, 4] : []);

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
    context.setLineDash([]);

    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
    context.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }

  function drawPhasorDiagram(thetaOffsetRad) {
    const rect = phasorCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 26;
    const voltageR = maxR * 0.85;
    const currentR = maxR * 0.5;

    phasorCtx.clearRect(0, 0, width, height);

    // Reference circles for the voltage and current phasor magnitudes.
    phasorCtx.strokeStyle = '#2a2e3a';
    phasorCtx.lineWidth = 1;
    [voltageR, currentR].forEach((r) => {
      phasorCtx.beginPath();
      phasorCtx.arc(cx, cy, r, 0, Math.PI * 2);
      phasorCtx.stroke();
    });

    // Axes
    phasorCtx.beginPath();
    phasorCtx.moveTo(cx - maxR, cy);
    phasorCtx.lineTo(cx + maxR, cy);
    phasorCtx.moveTo(cx, cy - maxR);
    phasorCtx.lineTo(cx, cy + maxR);
    phasorCtx.stroke();

    phasorCtx.font = '11px sans-serif';
    phasorCtx.fillStyle = '#9aa0ac';

    if (state.showVoltage) {
      PHASES.forEach((p) => {
        const angle = thetaOffsetRad + deg2rad(p.offsetDeg);
        const x = cx + voltageR * Math.cos(angle);
        const y = cy - voltageR * Math.sin(angle);
        drawArrow(phasorCtx, cx, cy, x, y, p.color, false);
        phasorCtx.fillText(p.name, x + 6 * Math.cos(angle), y - 6 * Math.sin(angle));
      });
    }

    if (state.showCurrent) {
      PHASES.forEach((p) => {
        const angle = thetaOffsetRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
        const x = cx + currentR * Math.cos(angle);
        const y = cy - currentR * Math.sin(angle);
        drawArrow(phasorCtx, cx, cy, x, y, p.color, true);
      });
    }
  }

  function instantaneousCurrent(p, thetaOffsetRad) {
    const angle = thetaOffsetRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
    return state.currentAmp * Math.sin(angle);
  }

  function drawStarWinding(thetaOffsetRad) {
    const rect = starCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 34;
    const coilFraction = 0.55;
    const coilW = 30;
    const coilH = 14;

    starCtx.clearRect(0, 0, width, height);

    PHASES.forEach((p) => {
      const angleRad = deg2rad(p.schematicDeg);
      const tx = cx + maxR * Math.cos(angleRad);
      const ty = cy - maxR * Math.sin(angleRad);
      const current = instantaneousCurrent(p, thetaOffsetRad);
      const isOut = current >= 0;

      if (state.showCurrent) {
        if (isOut) {
          drawArrow(starCtx, cx, cy, tx, ty, p.color, false);
        } else {
          drawArrow(starCtx, tx, ty, cx, cy, p.color, false);
        }
      } else {
        starCtx.strokeStyle = p.color;
        starCtx.lineWidth = 2;
        starCtx.beginPath();
        starCtx.moveTo(cx, cy);
        starCtx.lineTo(tx, ty);
        starCtx.stroke();
      }

      // Winding symbol: a small box straddling the line, breaking it up
      // visually like a coil.
      const coilCx = cx + coilFraction * (tx - cx);
      const coilCy = cy + coilFraction * (ty - cy);
      const lineAngleCanvas = Math.atan2(ty - cy, tx - cx);
      starCtx.save();
      starCtx.translate(coilCx, coilCy);
      starCtx.rotate(lineAngleCanvas);
      starCtx.fillStyle = '#171a23';
      starCtx.fillRect(-coilW / 2, -coilH / 2, coilW, coilH);
      starCtx.strokeStyle = p.color;
      starCtx.lineWidth = 2;
      starCtx.strokeRect(-coilW / 2, -coilH / 2, coilW, coilH);
      starCtx.beginPath();
      for (let k = -1; k <= 1; k++) {
        starCtx.moveTo((k * coilW) / 4, -coilH / 2);
        starCtx.lineTo((k * coilW) / 4 + 4, coilH / 2);
      }
      starCtx.stroke();
      starCtx.restore();

      // Phase + terminal label
      starCtx.font = 'bold 12px sans-serif';
      starCtx.fillStyle = p.color;
      const labelX = cx + (maxR + 14) * Math.cos(angleRad);
      const labelY = cy - (maxR + 14) * Math.sin(angleRad);
      starCtx.textAlign = 'center';
      starCtx.fillText(p.name, labelX, labelY);

      // Direction + magnitude readout
      if (state.showCurrent) {
        starCtx.font = '11px sans-serif';
        starCtx.fillStyle = '#9aa0ac';
        const readoutY = labelY + (Math.sin(angleRad) < 0 ? 16 : -6);
        starCtx.fillText(`${Math.abs(current).toFixed(1)} A ${isOut ? 'OUT' : 'IN'}`, labelX, readoutY);
      }
      starCtx.textAlign = 'left';
    });

    // Neutral point
    starCtx.beginPath();
    starCtx.arc(cx, cy, 5, 0, Math.PI * 2);
    starCtx.fillStyle = '#e6e8ee';
    starCtx.fill();
    starCtx.font = '11px sans-serif';
    starCtx.fillStyle = '#9aa0ac';
    starCtx.fillText('N', cx + 8, cy - 8);
  }

  let lastTs = null;

  function render(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (state.running) {
      state.timeOffset += dt * state.speed;
    }

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 26, left: 20 };

    ctx.clearRect(0, 0, width, height);
    drawGrid(width, height, padding);

    // Voltage and current are scaled independently (dual y-axis) since their
    // magnitudes differ by orders of magnitude in real systems.
    const maxV = state.voltageAmp * 1.15 || 1;
    const maxI = state.currentAmp * 1.15 || 1;
    const thetaOffset = 2 * Math.PI * state.frequency * state.timeOffset;

    if (state.showVoltage) {
      PHASES.forEach((p) => {
        drawWave(width, height, padding, p.offsetDeg, state.voltageAmp, maxV, p.color, thetaOffset, false);
      });
    }

    if (state.showCurrent) {
      PHASES.forEach((p) => {
        drawWave(
          width,
          height,
          padding,
          p.offsetDeg - state.phaseAngleDeg,
          state.currentAmp,
          maxI,
          p.color,
          thetaOffset,
          true
        );
      });
    }

    drawPhasorDiagram(thetaOffset);
    drawStarWinding(thetaOffset);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
