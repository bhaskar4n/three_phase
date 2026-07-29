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
    marker: document.getElementById('marker'),
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
    marker: document.getElementById('markerVal'),
  };

  const readout = {
    angle: document.getElementById('markerAngleVal'),
    Va: document.getElementById('markerVa'),
    Ia: document.getElementById('markerIa'),
    Vb: document.getElementById('markerVb'),
    Ib: document.getElementById('markerIb'),
    Vc: document.getElementById('markerVc'),
    Ic: document.getElementById('markerIc'),
  };

  const PHASES = [
    { name: 'R', offsetDeg: 0, color: '#ff5252', schematicDeg: 90 },
    { name: 'Y', offsetDeg: -120, color: '#ffd600', schematicDeg: 210 },
    { name: 'B', offsetDeg: -240, color: '#2196f3', schematicDeg: 330 },
  ];

  const phaseReadoutEls = [
    { v: readout.Va, i: readout.Ia },
    { v: readout.Vb, i: readout.Ib },
    { v: readout.Vc, i: readout.Ic },
  ];

  const summary = {
    ms: document.getElementById('summaryMs'),
    angle: document.getElementById('summaryAngle'),
    RY: document.getElementById('summaryRY'),
    YB: document.getElementById('summaryYB'),
    BR: document.getElementById('summaryBR'),
  };

  const summaryPhaseEls = [
    { v: document.getElementById('summaryVr'), pol: document.getElementById('summaryPolR'), i: document.getElementById('summaryIr'), dir: document.getElementById('summaryDirR') },
    { v: document.getElementById('summaryVy'), pol: document.getElementById('summaryPolY'), i: document.getElementById('summaryIy'), dir: document.getElementById('summaryDirY') },
    { v: document.getElementById('summaryVb'), pol: document.getElementById('summaryPolB'), i: document.getElementById('summaryIb'), dir: document.getElementById('summaryDirB') },
  ];

  // Fixed oscilloscope-style time window: the x-axis always spans this many
  // milliseconds, so higher frequencies pack in more visible cycles and
  // lower frequencies show fewer (at the default 50 Hz this is exactly 2
  // cycles, matching the previous fixed-cycle view).
  const WINDOW_MS = 40;
  const PADDING = { top: 20, right: 20, bottom: 26, left: 20 };

  const wavePanel = canvas.closest('.wave-panel');
  const waveTooltip = document.getElementById('waveTooltip');
  let hoverMs = null;
  let hoverClientX = 0;
  let hoverClientY = 0;

  const state = {
    frequency: Number(els.frequency.value),
    voltageAmp: Number(els.voltageAmp.value),
    currentAmp: Number(els.currentAmp.value),
    phaseAngleDeg: Number(els.phaseAngle.value),
    speed: Number(els.speed.value),
    markerMs: Number(els.marker.value),
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
  els.marker.addEventListener('input', () => {
    state.markerMs = Number(els.marker.value);
    valueLabels.marker.textContent = state.markerMs.toFixed(1);
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

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const plotW = rect.width - PADDING.left - PADDING.right;
    const relX = e.clientX - rect.left - PADDING.left;
    hoverMs = Math.min(WINDOW_MS, Math.max(0, (relX / plotW) * WINDOW_MS));
    hoverClientX = e.clientX;
    hoverClientY = e.clientY;
    waveTooltip.style.display = 'block';
  });
  canvas.addEventListener('mouseleave', () => {
    hoverMs = null;
    waveTooltip.style.display = 'none';
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
  const rad2deg = (r) => (r * 180) / Math.PI;
  const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;

  // Formats an angle as its standard 0-360deg notation, plus its
  // equivalent signed -180..180deg notation in parentheses when the two
  // differ (electrical engineering commonly uses either convention).
  function angleLabel(deg, decimals = 1) {
    const pos = normalizeDeg(deg);
    const signed = pos > 180 ? pos - 360 : pos;
    const posStr = `${pos.toFixed(decimals)}°`;
    if (Math.abs(signed - pos) < 1e-9) return posStr;
    return `${posStr} (${signed.toFixed(decimals)}°)`;
  }

  function drawGrid(width, height, padding) {
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    ctx.strokeStyle = '#2a2e3a';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#9aa0ac';

    // Vertical gridlines every 5ms across the fixed time window, labeled
    // every 10ms.
    for (let t = 0; t <= WINDOW_MS; t += 5) {
      const x = padding.left + (t / WINDOW_MS) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      if (t % 10 === 0) {
        ctx.fillText(`${t} ms`, x + 2, padding.top + plotH + 14);
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
    const samples = 720;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [6, 4] : []);

    for (let i = 0; i <= samples; i++) {
      const tMs = (i / samples) * WINDOW_MS;
      // The phase swept per millisecond scales with frequency, so higher
      // frequencies pack more cycles into the fixed time window.
      const theta = 2 * Math.PI * state.frequency * (tMs / 1000) + thetaOffsetRad + deg2rad(phaseOffsetDeg);
      const y = amp * Math.sin(theta);
      const px = padding.left + (tMs / WINDOW_MS) * plotW;
      const py = midY - (y / maxAmp) * (plotH / 2 - 10);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMarker(width, height, padding, maxV, maxI, thetaOffsetRad) {
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const midY = padding.top + plotH / 2;
    const markerRad = 2 * Math.PI * state.frequency * (state.markerMs / 1000);
    const mx = padding.left + (state.markerMs / WINDOW_MS) * plotW;

    ctx.strokeStyle = '#e6e8ee';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, padding.top);
    ctx.lineTo(mx, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    readout.angle.textContent = angleLabel(rad2deg(thetaOffsetRad + markerRad));

    PHASES.forEach((p, idx) => {
      const els = phaseReadoutEls[idx];

      const vAngle = thetaOffsetRad + markerRad + deg2rad(p.offsetDeg);
      const v = state.voltageAmp * Math.sin(vAngle);
      els.v.textContent = `${v.toFixed(1)} V ∠${angleLabel(rad2deg(vAngle))}`;
      if (state.showVoltage) {
        const py = midY - (v / maxV) * (plotH / 2 - 10);
        ctx.beginPath();
        ctx.arc(mx, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = '#0f1117';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const iAngle = thetaOffsetRad + markerRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
      const i = state.currentAmp * Math.sin(iAngle);
      els.i.textContent = `${i.toFixed(1)} A ∠${angleLabel(rad2deg(iAngle))}`;
      if (state.showCurrent) {
        const py = midY - (i / maxI) * (plotH / 2 - 10);
        ctx.beginPath();
        ctx.arc(mx, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#171a23';
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function drawHoverCrosshair(width, height, padding, maxV, maxI, thetaOffsetRad) {
    if (hoverMs === null) return;

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const midY = padding.top + plotH / 2;
    const hoverRad = 2 * Math.PI * state.frequency * (hoverMs / 1000);
    const hx = padding.left + (hoverMs / WINDOW_MS) * plotW;

    ctx.strokeStyle = '#5c6270';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(hx, padding.top);
    ctx.lineTo(hx, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    PHASES.forEach((p) => {
      if (state.showVoltage) {
        const v = instantaneousVoltage(p, thetaOffsetRad + hoverRad);
        const py = midY - (v / maxV) * (plotH / 2 - 10);
        ctx.beginPath();
        ctx.arc(hx, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      if (state.showCurrent) {
        const i = instantaneousCurrent(p, thetaOffsetRad + hoverRad);
        const py = midY - (i / maxI) * (plotH / 2 - 10);
        ctx.beginPath();
        ctx.arc(hx, py, 3, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  function updateHoverTooltip(thetaOffsetRad) {
    if (hoverMs === null) return;

    const hoverRad = 2 * Math.PI * state.frequency * (hoverMs / 1000);
    const totalAngle = thetaOffsetRad + hoverRad;
    const rows = PHASES.map((p) => {
      const vAngle = totalAngle + deg2rad(p.offsetDeg);
      const iAngle = totalAngle + deg2rad(p.offsetDeg - state.phaseAngleDeg);
      const v = instantaneousVoltage(p, totalAngle);
      const i = instantaneousCurrent(p, totalAngle);
      return `<div class="wave-tooltip-row">
        <i class="dot" style="background:${p.color}"></i>${p.name}:
        <span>${v.toFixed(1)} V ∠${angleLabel(rad2deg(vAngle), 0)}</span>
        <span>${i.toFixed(1)} A ∠${angleLabel(rad2deg(iAngle), 0)}</span>
      </div>`;
    }).join('');

    waveTooltip.innerHTML = `<div class="wave-tooltip-header">t = ${hoverMs.toFixed(1)} ms &mdash; ${angleLabel(rad2deg(totalAngle))}</div>${rows}`;

    const panelRect = wavePanel.getBoundingClientRect();
    let left = hoverClientX - panelRect.left + 16;
    let top = hoverClientY - panelRect.top + 16;
    const tooltipW = waveTooltip.offsetWidth;
    const tooltipH = waveTooltip.offsetHeight;
    if (left + tooltipW > panelRect.width) {
      left = hoverClientX - panelRect.left - tooltipW - 16;
    }
    if (top + tooltipH > panelRect.height) {
      top = hoverClientY - panelRect.top - tooltipH - 16;
    }
    waveTooltip.style.left = `${left}px`;
    waveTooltip.style.top = `${top}px`;
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
        phasorCtx.font = 'bold 11px sans-serif';
        phasorCtx.fillStyle = p.color;
        phasorCtx.fillText(p.name, x + 6 * Math.cos(angle), y - 6 * Math.sin(angle));
        phasorCtx.font = '10px sans-serif';
        phasorCtx.fillStyle = '#9aa0ac';
        phasorCtx.fillText(angleLabel(rad2deg(angle), 0), x + 6 * Math.cos(angle), y - 6 * Math.sin(angle) + 12);
      });
    }

    if (state.showCurrent) {
      PHASES.forEach((p) => {
        const angle = thetaOffsetRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
        const x = cx + currentR * Math.cos(angle);
        const y = cy - currentR * Math.sin(angle);
        drawArrow(phasorCtx, cx, cy, x, y, p.color, true);
        phasorCtx.font = '10px sans-serif';
        phasorCtx.fillStyle = p.color;
        phasorCtx.fillText(angleLabel(rad2deg(angle), 0), x + 6 * Math.cos(angle), y - 6 * Math.sin(angle));
      });
    }
  }

  function instantaneousCurrent(p, thetaOffsetRad) {
    const angle = thetaOffsetRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
    return state.currentAmp * Math.sin(angle);
  }

  function instantaneousVoltage(p, thetaOffsetRad) {
    const angle = thetaOffsetRad + deg2rad(p.offsetDeg);
    return state.voltageAmp * Math.sin(angle);
  }

  // Consolidated bottom summary of every waveform + star winding value at
  // the marker instant, reusing the same instantaneousVoltage/Current
  // helpers the waveform readout and star winding diagram use, so all three
  // views always agree.
  function updateSummaryPanel(markerAngleRad) {
    summary.ms.textContent = state.markerMs.toFixed(1);
    summary.angle.textContent = angleLabel(rad2deg(markerAngleRad));

    const voltages = PHASES.map((p) => instantaneousVoltage(p, markerAngleRad));
    const currents = PHASES.map((p) => instantaneousCurrent(p, markerAngleRad));

    PHASES.forEach((p, idx) => {
      const els = summaryPhaseEls[idx];
      const vAngle = markerAngleRad + deg2rad(p.offsetDeg);
      const iAngle = markerAngleRad + deg2rad(p.offsetDeg - state.phaseAngleDeg);
      els.v.textContent = `${voltages[idx].toFixed(1)} V ∠${angleLabel(rad2deg(vAngle))}`;
      els.pol.textContent = voltages[idx] >= 0 ? '+' : '-';
      els.i.textContent = `${currents[idx].toFixed(1)} A ∠${angleLabel(rad2deg(iAngle))}`;
      els.dir.textContent = currents[idx] >= 0 ? 'OUT' : 'IN';
    });

    summary.RY.textContent = `${(voltages[0] - voltages[1]).toFixed(1)} V`;
    summary.YB.textContent = `${(voltages[1] - voltages[2]).toFixed(1)} V`;
    summary.BR.textContent = `${(voltages[2] - voltages[0]).toFixed(1)} V`;
  }

  function drawStarWinding(thetaOffsetRad) {
    const rect = starCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 48;
    const coilFraction = 0.55;
    const coilW = 30;
    const coilH = 14;

    starCtx.clearRect(0, 0, width, height);

    const terminals = PHASES.map((p) => {
      const angleRad = deg2rad(p.schematicDeg);
      return {
        x: cx + maxR * Math.cos(angleRad),
        y: cy - maxR * Math.sin(angleRad),
      };
    });

    PHASES.forEach((p, idx) => {
      const angleRad = deg2rad(p.schematicDeg);
      const tx = terminals[idx].x;
      const ty = terminals[idx].y;
      const current = instantaneousCurrent(p, thetaOffsetRad);
      const voltage = instantaneousVoltage(p, thetaOffsetRad);
      const isOut = current >= 0;
      const isPositive = voltage >= 0;

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

      // Phase + terminal label, stacked outward (away from N) so the
      // voltage/current readout lines don't collide with the winding lines.
      const stackDir = Math.sin(angleRad) < 0 ? 1 : -1;
      const lineStep = 13;
      starCtx.font = 'bold 12px sans-serif';
      starCtx.fillStyle = p.color;
      const labelX = cx + (maxR + 12) * Math.cos(angleRad);
      const labelY = cy - (maxR + 12) * Math.sin(angleRad);
      starCtx.textAlign = 'center';
      starCtx.fillText(p.name, labelX, labelY);

      let lineY = labelY + stackDir * lineStep;

      // Instantaneous voltage with polarity relative to neutral.
      if (state.showVoltage) {
        starCtx.font = '11px sans-serif';
        starCtx.fillStyle = '#e6e8ee';
        starCtx.fillText(`${Math.abs(voltage).toFixed(1)} V (${isPositive ? '+' : '-'})`, labelX, lineY);
        lineY += stackDir * lineStep;
      }

      // Current direction + magnitude readout
      if (state.showCurrent) {
        starCtx.fillStyle = '#9aa0ac';
        starCtx.fillText(`${Math.abs(current).toFixed(1)} A ${isOut ? 'OUT' : 'IN'}`, labelX, lineY);
      }
      starCtx.textAlign = 'left';
    });

    // Line-to-line voltages (RY, YB, BR) across each pair of terminals.
    if (state.showVoltage) {
      const linePairs = [
        [0, 1],
        [1, 2],
        [2, 0],
      ];

      starCtx.font = '11px sans-serif';
      starCtx.textAlign = 'center';

      linePairs.forEach(([fromIdx, toIdx]) => {
        const from = terminals[fromIdx];
        const to = terminals[toIdx];
        const vLine =
          instantaneousVoltage(PHASES[fromIdx], thetaOffsetRad) - instantaneousVoltage(PHASES[toIdx], thetaOffsetRad);
        const label = `${PHASES[fromIdx].name}${PHASES[toIdx].name}`;

        starCtx.strokeStyle = '#4a4f5e';
        starCtx.lineWidth = 1;
        starCtx.setLineDash([3, 3]);
        starCtx.beginPath();
        starCtx.moveTo(from.x, from.y);
        starCtx.lineTo(to.x, to.y);
        starCtx.stroke();
        starCtx.setLineDash([]);

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        // Push the label outward, away from the neutral point, so it sits
        // clear of the triangle edge and the coil symbols.
        const outX = midX - cx;
        const outY = midY - cy;
        const outLen = Math.hypot(outX, outY) || 1;
        const labelX = midX + (outX / outLen) * 14;
        const labelY = midY + (outY / outLen) * 14;

        starCtx.fillStyle = '#c7cbd4';
        starCtx.fillText(`${label}: ${vLine.toFixed(1)} V`, labelX, labelY);
      });

      starCtx.textAlign = 'left';
    }

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
    const padding = PADDING;

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

    drawMarker(width, height, padding, maxV, maxI, thetaOffset);
    drawHoverCrosshair(width, height, padding, maxV, maxI, thetaOffset);
    updateHoverTooltip(thetaOffset);

    const markerPhaseRad = 2 * Math.PI * state.frequency * (state.markerMs / 1000);
    const markerAngle = thetaOffset + markerPhaseRad;
    drawPhasorDiagram(markerAngle);
    drawStarWinding(markerAngle);
    updateSummaryPanel(markerAngle);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
