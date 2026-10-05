const GEMINI_MARK_INNER="\n<path d=\"M58.6819 29.4195C53.6116 27.2369 49.1753 24.2426 45.3711 20.4403C41.5688 16.638 38.5745 12.1998 36.3919 7.12951C35.554 5.18629 34.8807 3.18883 34.3645 1.14087C34.1962 0.471311 33.5958 0 32.9057 0C32.2156 0 31.6152 0.471311 31.4469 1.14087C30.9307 3.18883 30.2574 5.18442 29.4195 7.12951C27.2369 12.1998 24.2426 16.638 20.4403 20.4403C16.638 24.2426 12.1998 27.2369 7.12951 29.4195C5.18629 30.2574 3.18883 30.9307 1.14087 31.4469C0.471311 31.6152 0 32.2156 0 32.9057C0 33.5958 0.471311 34.1962 1.14087 34.3645C3.18883 34.8807 5.18442 35.554 7.12951 36.3919C12.1998 38.5745 16.6361 41.5688 20.4403 45.3711C24.2444 49.1734 27.2369 53.6116 29.4195 58.6819C30.2574 60.6251 30.9307 62.6226 31.4469 64.6705C31.6152 65.3401 32.2156 65.8114 32.9057 65.8114C33.5958 65.8114 34.1962 65.3401 34.3645 64.6705C34.8807 62.6226 35.554 60.627 36.3919 58.6819C38.5745 53.6116 41.5688 49.1753 45.3711 45.3711C49.1734 41.5688 53.6116 38.5745 58.6819 36.3919C60.6251 35.554 62.6226 34.8807 64.6705 34.3645C65.3401 34.1962 65.8114 33.5958 65.8114 32.9057C65.8114 32.2156 65.3401 31.6152 64.6705 31.4469C62.6226 30.9307 60.627 30.2574 58.6819 29.4195Z\" fill=\"black\"/>\n";
/* Living intelligence is an illustrative, bounded evidence field, not an AI status feed. */
(() => {
  let serial = 0;
  const COUNT = 72;
  const MAX_CONNECTIONS = 96;
  const stageIndex = value => Math.max(0, Math.min(4, Math.trunc(Number(value)) || 0));
  const attribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const receiptVertices = [[263,34],[304,34],[330,60],[330,147],[321,142],[312,147],[303,142],[294,147],[285,142],[276,147],[263,142],[263,34]];

  function receiptPoint(index) {
    if (index >= 40) {
      const line = Math.floor((index - 40) / 8);
      return { x: 274 + ((index - 40) % 8) * 6, y: 77 + line * 12 };
    }
    const lengths = receiptVertices.slice(1).map((point, i) => Math.hypot(point[0] - receiptVertices[i][0], point[1] - receiptVertices[i][1]));
    let distance = index / 40 * lengths.reduce((sum, length) => sum + length, 0);
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i]) {
        const portion = distance / lengths[i];
        return { x: receiptVertices[i][0] + (receiptVertices[i + 1][0] - receiptVertices[i][0]) * portion, y: receiptVertices[i][1] + (receiptVertices[i + 1][1] - receiptVertices[i][1]) * portion };
      }
      distance -= lengths[i];
    }
    return { x: 263, y: 34 };
  }

  function target(index, stage, time) {
    const angle = index * 2.399963229728653;
    if (stage === 0) {
      const along = (index / COUNT + time * .045) % 1;
      return { x: 37 + along * 282, y: 97 + Math.sin(along * Math.PI * 2.4 + index * .095) * Math.sin(along * Math.PI) * 52 };
    }
    if (stage === 1) {
      const radius = Math.sqrt((index + .5) / COUNT);
      return { x: 180 + Math.cos(angle + time * .065) * (57 + radius * 42), y: 94 + Math.sin(angle + time * .065) * (23 + radius * 40) };
    }
    if (stage === 2) {
      const radius = Math.sqrt((index % 36 + .5) / 36);
      const center = index < 36 ? 78 : 283;
      return { x: center + Math.cos(angle) * radius * 42 + Math.sin(time * .65 + index) * 2.5, y: 93 + Math.sin(angle) * radius * 54 + Math.cos(time * .5 + index) * 2.5 };
    }
    return receiptPoint(index);
  }

  function render(stage, { mark, image }) {
    const id = `intelligence-${++serial}`;
    const dots = Array.from({ length: 36 }, (_, i) => {
      const point = target(i * 2, stageIndex(stage), 0);
      return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${i % 3 === 0 ? 2.7 : 1.7}" fill="var(--${['accent', 'violet', 'warning'][i % 3]})"/>`;
    }).join('');
    return `<div class="upload-motion agent-motion direction-intelligence" data-stage="${stageIndex(stage)}" aria-hidden="true"><canvas class="intelligence-canvas" width="720" height="440"></canvas><svg class="intelligence-svg" viewBox="0 0 360 220" fill="none"><defs><radialGradient id="${id}-light"><stop stop-color="var(--mint)" stop-opacity=".75"/><stop offset=".58" stop-color="var(--lilac)" stop-opacity=".65"/><stop offset="1" stop-color="var(--peach)" stop-opacity="0"/></radialGradient><clipPath id="${id}-film"><rect x="5" y="5" width="54" height="33" rx="4"/></clipPath></defs><ellipse class="intelligence-light" cx="180" cy="92" rx="111" ry="88" fill="url(#${id}-light)"/><g class="intelligence-static-field"><g class="intelligence-static-dots">${dots}</g><g stroke="var(--violet)" stroke-width=".8" opacity=".25"><path class="intelligence-static-link intelligence-static-in" d="M62 111C105 32 253 164 310 72M57 101C118 153 235 32 318 96M73 99C136 48 238 140 304 102"/><path class="intelligence-static-link intelligence-static-pair" d="M43 84L70 49L104 86L87 134L43 84M256 63L312 81L303 135L261 111L256 63M103 87C147 87 224 81 258 83M89 130C137 127 225 129 267 127"/></g></g><g class="intelligence-film" transform="translate(13 91)"><rect width="64" height="43" rx="7" fill="var(--dark)"/><g clip-path="url(#${id}-film)"><image href="${attribute(image)}" x="5" y="5" width="54" height="33" preserveAspectRatio="xMidYMid slice"/></g><path d="M8 3H14M23 3H29M38 3H44M52 3H58M8 40H14M23 40H29M38 40H44M52 40H58" stroke="var(--secondary-on-dark)" stroke-width="1"/></g><g class="intelligence-receipt"><path d="M263 34H304L330 60V147L321 142L312 147L303 142L294 147L285 142L276 147L263 142Z" fill="var(--surface)" fill-opacity=".75" stroke="var(--violet)" stroke-width="1.25"/><path d="M304 34V60H330" fill="var(--lilac)" stroke="var(--violet)" stroke-width="1.25"/><g class="intelligence-receipt-lines" stroke="var(--violet)" stroke-width="1.6" stroke-linecap="round"><path d="M274 77H316M274 89H313M274 101H316M274 113H309"/></g><path class="intelligence-receipt-check" d="M277 126L287 136L312 114" stroke="var(--status-sent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g><svg class="intelligence-gemini-mark" x="124" y="36" width="112" height="112" viewBox="0 0 66 66">${mark}</svg></svg><div class="gemini-name intelligence-gemini-name">Gemini</div></div>`;
  }

  function mount(element) {
    let stage = stageIndex(element.dataset.stage);
    let paused = false;
    let destroyed = false;
    let frame = null;
    let elapsed = 0;
    let previous = 0;
    let completionAge = 0;
    const points = Array.from({ length: COUNT }, (_, i) => ({ ...target(i, stage, 0), radius: 1.4 + (i % 4) * .35, color: i % 3 }));
    const canvas = element.querySelector('.intelligence-canvas');
    let context;
    try { context = canvas?.getContext('2d', { alpha: true }); } catch (_) { context = null; }
    const css = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
    const token = (name, fallback) => css?.getPropertyValue(`--${name}`).trim() || fallback;
    const colors = [token('accent', '#4e625a'), token('violet', '#59475f'), token('warning', '#864a34')];
    const pastel = [token('mint', '#dcefe3'), token('lilac', '#e8dcf0'), token('peach', '#f2dfd5')];
    const reduced = () => !!element.closest?.('.reduced') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let scale = 1, offsetX = 0, offsetY = 0, dpr = 1;
    element.dataset.fieldState = 'static';

    function draw(snap = false, delta = 16) {
      if (!context || destroyed) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
      const follow = snap ? 1 : 1 - Math.exp(-delta / 240);
      let distance = 0;
      points.forEach((point, i) => {
        const destination = target(i, stage, elapsed);
        point.x += (destination.x - point.x) * follow;
        point.y += (destination.y - point.y) * follow;
        distance = Math.max(distance, Math.hypot(destination.x - point.x, destination.y - point.y));
      });
      let connections = 0;
      const connectionBudget = MAX_CONNECTIONS - (stage === 2 ? 2 : 0);
      context.lineWidth = .8;
      for (let i = 0; i < COUNT && connections < connectionBudget; i++) {
        for (const gap of [1, 3, 11]) {
          const j = (i + gap) % COUNT;
          if (stage === 2 && (i < 36) !== (j < 36)) continue;
          if (stage >= 3 && i >= 40 && Math.floor((i - 40) / 8) !== Math.floor((j - 40) / 8)) continue;
          const length = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
          if (length > (stage >= 3 ? 19 : 55) || length < 2) continue;
          context.globalAlpha = (1 - length / 70) * (stage === 4 ? .17 : .28);
          context.strokeStyle = colors[i % 3];
          context.beginPath();context.moveTo(points[i].x, points[i].y);context.lineTo(points[j].x, points[j].y);context.stroke();
          if (++connections >= connectionBudget) break;
        }
      }
      if (stage === 2) {
        context.globalAlpha = .22;context.strokeStyle = colors[1];context.lineWidth = 1.1;
        for (const y of [67, 119]) { context.beginPath();context.moveTo(103, y);context.bezierCurveTo(147, y - 10, 222, y + 10, 259, y);context.stroke(); }
      }
      points.forEach(point => {
        context.globalAlpha = stage === 4 ? .12 : .32;
        context.fillStyle = pastel[point.color];
        context.beginPath();context.arc(point.x, point.y, point.radius * 3.3, 0, Math.PI * 2);context.fill();
        context.globalAlpha = stage === 4 ? .45 : .82;
        context.fillStyle = colors[point.color];
        context.beginPath();context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);context.fill();
      });
      context.globalAlpha = 1;
      return distance;
    }

    function resize() {
      if (!context || destroyed) return;
      const width = element.clientWidth || 360;
      const height = 220;
      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.round(width * dpr);canvas.height = Math.round(height * dpr);
      scale = Math.min(width / 360, height / 220);
      offsetX = (width - 360 * scale) / 2;offsetY = (height - 220 * scale) / 2;
      draw(true);
    }

    function stop() {
      if (frame !== null) window.cancelAnimationFrame?.(frame);
      frame = null;previous = 0;element.dataset.fieldState = 'paused';
    }

    function tick(timestamp) {
      frame = null;
      if (destroyed || paused || document.hidden || reduced()) { draw(true);return; }
      const delta = previous ? Math.min(40, timestamp - previous) : 16;
      previous = timestamp;elapsed += delta / 1000;completionAge += delta;
      const distance = draw(false, delta);
      if (stage === 4 && (distance < .06 || completionAge > 2100)) { draw(true);previous = 0;element.dataset.fieldState = 'settled';return; }
      frame = window.requestAnimationFrame(tick);
    }

    function start() {
      if (!context || destroyed || paused || reduced() || document.hidden || !window.requestAnimationFrame || frame !== null) return;
      if (stage === 4 && completionAge > 2100) { element.dataset.fieldState = 'settled';return; }
      element.dataset.fieldState = 'running';frame = window.requestAnimationFrame(tick);
    }

    function updateStatic() {
      element.querySelectorAll('.intelligence-static-dots circle').forEach((dot, i) => {
        const point = target(i * 2, stage, 0);
        dot.setAttribute('cx', point.x.toFixed(2));dot.setAttribute('cy', point.y.toFixed(2));
      });
    }

    let observer;
    if (context) {
      element.dataset.canvas = 'active';resize();
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize);observer.observe(element); }
      if (stage === 4) completionAge = 2200;
      start();
    }

    return {
      update(value) {
        stage = stageIndex(value);element.dataset.stage = String(stage);completionAge = 0;
        updateStatic();
        if (paused || reduced()) draw(true);else start();
      },
      pause(value) {
        paused = !!value;element.classList.toggle('intelligence-paused', paused);
        if (paused) { stop();draw(true); } else start();
      },
      destroy() {
        stop();destroyed = true;observer?.disconnect();element.classList.add('intelligence-paused');element.dataset.fieldState = 'destroyed';
      }
    };
  }

  window.RRDirections ||= {};
  window.RRDirections.intelligence = { render, mount };
})();