(() => {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

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
    { name: 'A', offsetDeg: 0, color: '#ff5252' },
    { name: 'B', offsetDeg: -120, color: '#4caf50' },
    { name: 'C', offsetDeg: -240, color: '#2196f3' },
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

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

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

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
