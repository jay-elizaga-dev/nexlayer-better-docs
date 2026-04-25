/**
 * Nate Factory Widget
 * Element picker + "What do you want to do?" prompt → POST to Nate worker
 *
 * Usage: include this script on any page.
 * Config: window.NATE_CONFIG = { endpoint, project, model }
 */
(function () {
  'use strict';

  const cfg = window.NATE_CONFIG || {};
  const ENDPOINT = cfg.endpoint || 'http://localhost:3000/process';
  const PROJECT  = cfg.project  || 'nexlayer-better-docs';
  const MODEL    = cfg.model    || 'sonnet';

  /* ── State ─────────────────────────────────────── */
  let pickerActive = false;
  let hoveredEl    = null;
  let selectedEl   = null;

  /* ── Styles ─────────────────────────────────────── */
  const css = `
    #nate-fab {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #22b7cb;
      color: #000;
      border: none;
      border-radius: 2rem;
      padding: 0.6rem 1.1rem 0.6rem 0.9rem;
      font-size: 0.8125rem;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(34,183,203,0.35), 0 2px 8px rgba(0,0,0,0.4);
      letter-spacing: 0.01em;
      transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
      user-select: none;
    }
    #nate-fab:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 6px 28px rgba(34,183,203,0.45), 0 3px 10px rgba(0,0,0,0.5);
    }
    #nate-fab:active { transform: scale(0.97); }
    #nate-fab .nate-fab-icon {
      width: 1.375rem;
      height: 1.375rem;
      background: rgba(0,0,0,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    /* ── Picker overlay ─── */
    #nate-picker-overlay {
      position: fixed;
      inset: 0;
      z-index: 8900;
      cursor: crosshair;
      background: transparent;
    }
    #nate-picker-hint {
      position: fixed;
      top: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9100;
      background: #22b7cb;
      color: #000;
      font-size: 0.8125rem;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      padding: 0.5rem 1.25rem;
      border-radius: 2rem;
      box-shadow: 0 4px 16px rgba(34,183,203,0.4);
      pointer-events: none;
      white-space: nowrap;
    }
    .nate-hover-ring {
      outline: 2px solid #22b7cb !important;
      outline-offset: 2px !important;
      background: rgba(34,183,203,0.06) !important;
      transition: outline 0.05s !important;
    }
    .nate-selected-ring {
      outline: 2px solid #22b7cb !important;
      outline-offset: 2px !important;
      background: rgba(34,183,203,0.1) !important;
    }

    /* ── Modal backdrop ─── */
    #nate-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9200;
      background: rgba(0,0,0,0.72);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 1.5rem;
    }

    /* ── Modal panel ─── */
    #nate-modal {
      width: 100%;
      max-width: 440px;
      background: #111;
      border: 1px solid rgba(34,183,203,0.3);
      border-radius: 12px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,183,203,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      animation: nate-slide-up 0.18s ease;
    }
    @keyframes nate-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    #nate-modal-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 1rem 1.25rem 0.875rem;
      border-bottom: 1px solid #1e1e1e;
    }
    #nate-modal-header .nx-mark {
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
    }
    #nate-modal-header h2 {
      flex: 1;
      font-size: 0.9375rem;
      font-weight: 700;
      color: #f0f0f0;
      margin: 0;
    }
    #nate-close-btn {
      background: none;
      border: none;
      color: #555;
      cursor: pointer;
      font-size: 1.125rem;
      padding: 0 0.25rem;
      line-height: 1;
      transition: color 0.1s;
    }
    #nate-close-btn:hover { color: #aaa; }

    #nate-modal-body { padding: 1rem 1.25rem 1.25rem; }

    /* Element context preview */
    #nate-el-preview {
      display: none;
      background: #0d0d0d;
      border: 1px solid #222;
      border-left: 2px solid #22b7cb;
      border-radius: 6px;
      padding: 0.625rem 0.875rem;
      margin-bottom: 0.875rem;
      font-size: 0.75rem;
    }
    #nate-el-preview.active { display: block; }
    #nate-el-preview .nate-el-label {
      color: #22b7cb;
      font-weight: 600;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.25rem;
    }
    #nate-el-selector {
      color: #7dd9e4;
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 0.6875rem;
      word-break: break-all;
    }
    #nate-el-text {
      color: #888;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #nate-clear-el {
      float: right;
      background: none;
      border: none;
      color: #444;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 0;
      margin-top: -1px;
      transition: color 0.1s;
    }
    #nate-clear-el:hover { color: #888; }

    /* Textarea */
    #nate-task-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
      margin-bottom: 0.375rem;
    }
    #nate-task {
      width: 100%;
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 6px;
      color: #e8e8e8;
      font-size: 0.875rem;
      font-family: inherit;
      line-height: 1.5;
      padding: 0.625rem 0.75rem;
      resize: vertical;
      min-height: 80px;
      outline: none;
      transition: border-color 0.15s;
    }
    #nate-task:focus { border-color: rgba(34,183,203,0.5); }
    #nate-task::placeholder { color: #3a3a3a; }

    /* Advanced config toggle */
    #nate-config-toggle {
      background: none;
      border: none;
      color: #3a3a3a;
      font-size: 0.75rem;
      font-family: inherit;
      cursor: pointer;
      padding: 0.5rem 0 0;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      transition: color 0.1s;
    }
    #nate-config-toggle:hover { color: #666; }
    #nate-config-panel {
      display: none;
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 6px;
    }
    #nate-config-panel.open { display: block; }
    .nate-cfg-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }
    .nate-cfg-row:last-child { margin-bottom: 0; }
    .nate-cfg-label {
      font-size: 0.6875rem;
      color: #444;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .nate-cfg-input {
      background: #111;
      border: 1px solid #222;
      border-radius: 4px;
      color: #888;
      font-size: 0.75rem;
      font-family: 'SF Mono', Menlo, monospace;
      padding: 0.375rem 0.5rem;
      outline: none;
      transition: border-color 0.1s;
    }
    .nate-cfg-input:focus { border-color: #333; color: #aaa; }

    /* Footer buttons */
    #nate-modal-footer {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.875rem;
    }
    #nate-pick-btn {
      flex-shrink: 0;
      background: none;
      border: 1px solid #222;
      border-radius: 6px;
      color: #555;
      cursor: pointer;
      font-size: 0.75rem;
      font-family: inherit;
      padding: 0.5rem 0.75rem;
      transition: border-color 0.15s, color 0.15s;
      white-space: nowrap;
    }
    #nate-pick-btn:hover { border-color: rgba(34,183,203,0.4); color: #22b7cb; }
    #nate-submit-btn {
      flex: 1;
      background: #22b7cb;
      border: none;
      border-radius: 6px;
      color: #000;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 700;
      font-family: inherit;
      padding: 0.5rem 1rem;
      transition: opacity 0.15s;
    }
    #nate-submit-btn:hover { opacity: 0.88; }
    #nate-submit-btn:disabled { opacity: 0.4; cursor: default; }
    #nate-submit-btn.loading { opacity: 0.6; }

    /* Status message */
    #nate-status {
      display: none;
      margin-top: 0.625rem;
      padding: 0.5rem 0.75rem;
      border-radius: 5px;
      font-size: 0.8125rem;
    }
    #nate-status.success {
      display: block;
      background: rgba(34,197,94,0.08);
      border: 1px solid rgba(34,197,94,0.2);
      color: #4ade80;
    }
    #nate-status.error {
      display: block;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #f87171;
    }
  `;

  /* ── Inject styles ───────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Nexlayer icon mark SVG ──────────────────────── */
  const nxMarkSVG = `<svg class="nx-mark" viewBox="0 0 527 497" xmlns="http://www.w3.org/2000/svg">
    <path d="M293.24,126.6V0L0,158.84v337.86l233.72-126.61v126.62l293.23-158.86V0l-233.71,126.6Z
             M233.72,158.84v143.56l-174.2,94.37v-202.48l174.2-94.37v58.92Z
             M467.43,302.4l-174.19,94.37v-202.48l174.19-94.37v202.48Z"
          fill="#22b7cb"/>
  </svg>`;

  /* ── Build FAB ───────────────────────────────────── */
  const fab = document.createElement('button');
  fab.id = 'nate-fab';
  fab.innerHTML = `<span class="nate-fab-icon">✦</span> What do you want to do?`;
  document.body.appendChild(fab);

  /* ── Build modal HTML ────────────────────────────── */
  const backdropEl = document.createElement('div');
  backdropEl.id = 'nate-backdrop';
  backdropEl.style.display = 'none';
  backdropEl.innerHTML = `
    <div id="nate-modal" role="dialog" aria-modal="true" aria-labelledby="nate-modal-title">
      <div id="nate-modal-header">
        ${nxMarkSVG}
        <h2 id="nate-modal-title">What do you want to do?</h2>
        <button id="nate-close-btn" aria-label="Close">✕</button>
      </div>
      <div id="nate-modal-body">
        <div id="nate-el-preview">
          <button id="nate-clear-el" title="Clear selection">✕</button>
          <div class="nate-el-label">Selected element</div>
          <div id="nate-el-selector"></div>
          <div id="nate-el-text"></div>
        </div>

        <label id="nate-task-label" for="nate-task">Task for Nate</label>
        <textarea
          id="nate-task"
          placeholder="Describe what you want Nate to do…&#10;&#10;e.g. Add a Python code example to this section&#10;e.g. Improve the description of this tool"
          rows="4"
        ></textarea>

        <button id="nate-config-toggle">⚙ Config</button>
        <div id="nate-config-panel">
          <div class="nate-cfg-row">
            <span class="nate-cfg-label">Endpoint</span>
            <input class="nate-cfg-input" id="cfg-endpoint" type="text" value="${ENDPOINT}" />
          </div>
          <div class="nate-cfg-row">
            <span class="nate-cfg-label">Project</span>
            <input class="nate-cfg-input" id="cfg-project" type="text" value="${PROJECT}" />
          </div>
          <div class="nate-cfg-row">
            <span class="nate-cfg-label">Model</span>
            <input class="nate-cfg-input" id="cfg-model" type="text" value="${MODEL}" />
          </div>
        </div>

        <div id="nate-modal-footer">
          <button id="nate-pick-btn">⊕ Pick element</button>
          <button id="nate-submit-btn">Send to Nate →</button>
        </div>

        <div id="nate-status"></div>
      </div>
    </div>
  `;
  document.body.appendChild(backdropEl);

  /* ── Shorthand refs ──────────────────────────────── */
  const $ = id => document.getElementById(id);
  const modal      = $('nate-modal');
  const taskInput  = $('nate-task');
  const submitBtn  = $('nate-submit-btn');
  const pickBtn    = $('nate-pick-btn');
  const statusEl   = $('nate-status');
  const elPreview  = $('nate-el-preview');
  const clearElBtn = $('nate-clear-el');
  const cfgToggle  = $('nate-config-toggle');
  const cfgPanel   = $('nate-config-panel');
  const cfgEndpoint = $('cfg-endpoint');
  const cfgProject  = $('cfg-project');
  const cfgModel    = $('cfg-model');

  /* ── Open / close modal ──────────────────────────── */
  function openModal() {
    backdropEl.style.display = 'flex';
    taskInput.focus();
    statusEl.className = '';
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }

  function closeModal() {
    backdropEl.style.display = 'none';
    stopPicker();
  }

  fab.addEventListener('click', openModal);
  $('nate-close-btn').addEventListener('click', closeModal);
  backdropEl.addEventListener('click', e => {
    if (e.target === backdropEl) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (pickerActive) stopPicker();
      else closeModal();
    }
  });

  /* ── Config toggle ───────────────────────────────── */
  cfgToggle.addEventListener('click', () => cfgPanel.classList.toggle('open'));

  /* ── Element picker ──────────────────────────────── */
  function buildSelector(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 4) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) {
        sel += '#' + cur.id;
        parts.unshift(sel);
        break;
      }
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) sel += '.' + cls;
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function showElementPreview(el) {
    const selector = buildSelector(el);
    const text = (el.innerText || el.textContent || '').trim().slice(0, 120);
    $('nate-el-selector').textContent = selector;
    $('nate-el-text').textContent = text || '(no text)';
    elPreview.classList.add('active');
    selectedEl = el;
  }

  function clearElementSelection() {
    if (selectedEl) {
      selectedEl.classList.remove('nate-selected-ring');
      selectedEl = null;
    }
    elPreview.classList.remove('active');
    $('nate-el-selector').textContent = '';
    $('nate-el-text').textContent = '';
  }

  clearElBtn.addEventListener('click', clearElementSelection);

  /* Picker overlay + hint */
  let pickerOverlay, pickerHint;

  function startPicker() {
    pickerActive = true;
    closeModal();

    pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'nate-picker-overlay';
    document.body.appendChild(pickerOverlay);

    pickerHint = document.createElement('div');
    pickerHint.id = 'nate-picker-hint';
    pickerHint.textContent = 'Click any element — Esc to cancel';
    document.body.appendChild(pickerHint);

    document.addEventListener('mousemove', onPickerMove, true);
    pickerOverlay.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKey, true);
  }

  function stopPicker() {
    if (!pickerActive) return;
    pickerActive = false;
    if (hoveredEl) { hoveredEl.classList.remove('nate-hover-ring'); hoveredEl = null; }
    if (pickerOverlay) { pickerOverlay.remove(); pickerOverlay = null; }
    if (pickerHint)    { pickerHint.remove();    pickerHint = null; }
    document.removeEventListener('mousemove', onPickerMove, true);
    document.removeEventListener('keydown', onPickerKey, true);
  }

  function onPickerMove(e) {
    // Hide overlay to hit-test the real element beneath
    pickerOverlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    pickerOverlay.style.pointerEvents = '';

    if (!target || target === pickerHint || target === pickerOverlay) return;
    if (target === hoveredEl) return;

    if (hoveredEl) hoveredEl.classList.remove('nate-hover-ring');
    hoveredEl = target;
    hoveredEl.classList.add('nate-hover-ring');
  }

  function onPickerClick(e) {
    e.preventDefault();
    e.stopPropagation();

    pickerOverlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    pickerOverlay.style.pointerEvents = '';

    if (!target || target === pickerHint || target === pickerOverlay) return;

    if (hoveredEl) { hoveredEl.classList.remove('nate-hover-ring'); hoveredEl = null; }
    if (selectedEl) selectedEl.classList.remove('nate-selected-ring');

    target.classList.add('nate-selected-ring');
    showElementPreview(target);
    stopPicker();
    openModal();
  }

  function onPickerKey(e) {
    if (e.key === 'Escape') { stopPicker(); openModal(); }
  }

  pickBtn.addEventListener('click', startPicker);

  /* ── Submit to Nate ──────────────────────────────── */
  function setStatus(type, msg) {
    statusEl.className = type;
    statusEl.style.display = 'block';
    statusEl.innerHTML = msg;
  }

  submitBtn.addEventListener('click', async () => {
    const rawTask = taskInput.value.trim();
    if (!rawTask) { taskInput.focus(); return; }

    const endpoint = cfgEndpoint.value.trim() || ENDPOINT;
    const project  = cfgProject.value.trim()  || PROJECT;
    const model    = cfgModel.value.trim()     || MODEL;

    // Build enriched task if element context exists
    let task = rawTask;
    if (selectedEl) {
      const selector = $('nate-el-selector').textContent;
      const elText   = $('nate-el-text').textContent;
      task = `[Element context: ${selector}]\n[Element text: ${elText}]\n\n${rawTask}`;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    submitBtn.classList.add('loading');
    statusEl.style.display = 'none';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, task, model })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const jobId = data.jobId || data.id || '—';
        setStatus('success',
          `✓ Queued — job <code style="font-family:monospace">${jobId}</code>` +
          (data.url ? ` &nbsp;·&nbsp; <a href="${data.url}" target="_blank" style="color:#4ade80">${data.url}</a>` : '')
        );
        taskInput.value = '';
        clearElementSelection();
      } else {
        setStatus('error', `Error ${res.status}: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('error',
        `Could not reach Nate at <code style="font-family:monospace">${endpoint}</code>.<br>` +
        `Is nate-worker running? <span style="color:#555">${err.message}</span>`
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send to Nate →';
      submitBtn.classList.remove('loading');
    }
  });

  /* ── Keyboard submit ─────────────────────────────── */
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitBtn.click();
  });

})();
