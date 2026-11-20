/* ===== VTuber Forge — js/ui/gpu_settings_ui.js ===== */
// Antarmuka modal/drawer Pengaturan GPU yang dipanggil dari tombol toolbar #btnGpuSettings

(function () {
    'use strict';

    const MODAL_ID = 'gpuSettingsModal';
    let isOpen = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function ensureModal() {
        let modal = byId(MODAL_ID);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Pengaturan GPU');
        modal.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:9990',
            'display:none',
            'align-items:center',
            'justify-content:center',
            'background:rgba(0,0,0,0.65)',
            'padding:14px'
        ].join(';');

        modal.innerHTML = [
            '<div id="gpuModalCard" style="width:100%;max-width:380px;max-height:85vh;overflow-y:auto;background:#161822;color:#f1f5f9;border:1px solid #2e3448;border-radius:10px;padding:14px;box-shadow:0 12px 32px rgba(0,0,0,0.55);font-family:system-ui,-apple-system,sans-serif;font-size:13px;">',
            '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #272c3d;padding-bottom:8px;">',
            '    <strong>🎮 Pengaturan & Stabilitas GPU</strong>',
            '    <button type="button" id="gpuCloseBtn" style="background:#262b3d;color:#fff;border:1px solid #3c435c;border-radius:6px;padding:4px 10px;cursor:pointer;">✕</button>',
            '  </div>',
            '  <div id="gpuDeviceInfo" style="background:#10121a;border:1px solid #232838;border-radius:7px;padding:8px;margin-bottom:10px;font-size:11px;line-height:1.45;color:#cbd5e1;">Memuat info GPU...</div>',
            '  <div style="margin-bottom:10px;">',
            '    <label style="display:block;margin-bottom:4px;color:#94a3b8;font-size:12px;">Preset Stabilitas</label>',
            '    <select id="gpuPresetSelect" style="width:100%;padding:7px 8px;border-radius:6px;background:#0e1017;color:#fff;border:1px solid #333a52;">',
            '      <option value="balanced">Balanced (MP3 Friendly)</option>',
            '      <option value="stability">Max Stability (Low VRAM/GPU)</option>',
            '      <option value="quality">High Visuals</option>',
            '    </select>',
            '  </div>',
            '  <div style="margin-bottom:10px;">',
            '    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">',
            '      <span style="color:#94a3b8;">Max Pixel Ratio (DPR Cap)</span>',
            '      <span id="gpuDprVal">1.50</span>',
            '    </div>',
            '    <input id="gpuDprRange" type="range" min="0.75" max="2.5" step="0.25" value="1.5" style="width:100%;">',
            '  </div>',
            '  <div style="margin-bottom:10px;">',
            '    <label style="display:block;margin-bottom:4px;color:#94a3b8;font-size:12px;">Shader Precision</label>',
            '    <select id="gpuPrecisionSelect" style="width:100%;padding:7px 8px;border-radius:6px;background:#0e1017;color:#fff;border:1px solid #333a52;">',
            '      <option value="mediump">mediump (Lebih stabil & hemat GPU)</option>',
            '      <option value="highp">highp (Presisi tinggi)</option>',
            '    </select>',
            '  </div>',
            '  <div style="margin-bottom:10px;">',
            '    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;">',
            '      <span style="color:#94a3b8;">Ambient Light</span>',
            '      <span id="gpuAmbientVal">0.65</span>',
            '    </div>',
            '    <input id="gpuAmbientRange" type="range" min="0.1" max="1.2" step="0.05" value="0.65" style="width:100%;">',
            '  </div>',
            '  <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px;">',
            '    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">',
            '      <input id="gpuShadowCheck" type="checkbox"> Cast Shadows (Directional Light)',
            '    </label>',
            '    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">',
            '      <input id="gpuRecoverCheck" type="checkbox" checked> Auto-Recover saat WebGL Context Lost',
            '    </label>',
            '  </div>',
            '  <div style="display:flex;gap:8px;flex-wrap:wrap;">',
            '    <button type="button" id="gpuTrimCacheBtn" style="flex:1;padding:8px;border-radius:6px;border:1px solid #3b4463;background:#20263a;color:#e2e8f0;cursor:pointer;font-size:12px;">🧹 Bersihkan Cache</button>',
            '    <button type="button" id="gpuResetBtn" style="padding:8px 10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#f8fafc;cursor:pointer;font-size:12px;">Reset</button>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal) setModalOpen(false);
        });

        byId('gpuCloseBtn').onclick = function () {
            setModalOpen(false);
        };

        byId('gpuPresetSelect').onchange = function (e) {
            if (!window.GpuStability) return;
            window.GpuStability.applyPreset(e.target.value, true);
            syncControlsFromInfo();
        };

        byId('gpuDprRange').oninput = function (e) {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && window.GpuStability) {
                byId('gpuDprVal').textContent = val.toFixed(2);
                window.GpuStability.applySettings({ maxPixelRatio: val }, true);
            }
        };

        byId('gpuPrecisionSelect').onchange = function (e) {
            if (!window.GpuStability) return;
            window.GpuStability.applySettings({ precision: e.target.value }, true);
            syncControlsFromInfo();
        };

        byId('gpuAmbientRange').oninput = function (e) {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && window.GpuStability) {
                byId('gpuAmbientVal').textContent = val.toFixed(2);
                window.GpuStability.applySettings({ ambientIntensity: val }, true);
            }
        };

        byId('gpuShadowCheck').onchange = function (e) {
            if (!window.GpuStability) return;
            window.GpuStability.applySettings({ shadowsEnabled: !!e.target.checked }, true);
        };

        byId('gpuRecoverCheck').onchange = function (e) {
            if (!window.GpuStability) return;
            window.GpuStability.applySettings({ autoRecoverContext: !!e.target.checked }, true);
        };

        byId('gpuTrimCacheBtn').onclick = function () {
            if (!window.GpuStability) return;
            window.GpuStability.trimGpuMemoryCache();
            syncControlsFromInfo();
        };

        byId('gpuResetBtn').onclick = function () {
            if (!window.GpuStability) return;
            window.GpuStability.applyPreset('balanced', true);
            syncControlsFromInfo();
        };

        return modal;
    }

    function syncControlsFromInfo() {
        if (!window.GpuStability || typeof window.GpuStability.getInfo !== 'function') return;
        const info = window.GpuStability.getInfo();
        const s = info.settings || {};
        const d = info.device || {};

        const infoBox = byId('gpuDeviceInfo');
        if (infoBox) {
            infoBox.innerHTML = [
                '<div><b>Renderer:</b> ' + (d.renderer || 'WebGL') + '</div>',
                '<div><b>DPR Aktif:</b> ' + Number(d.maxPixelRatio || s.maxPixelRatio || 1).toFixed(2) + ' | <b>Precision:</b> ' + (d.precision || s.precision || 'mediump') + '</div>',
                '<div><b>Status Context:</b> ' + (d.lastGpuEvent || 'Normal') + ' (Lost: ' + (d.contextLostCount || 0) + ')</div>'
            ].join('');
        }

        if (byId('gpuPresetSelect')) byId('gpuPresetSelect').value = s.preset || 'balanced';
        if (byId('gpuDprRange')) {
            const dpr = Number(s.maxPixelRatio) || 1.5;
            byId('gpuDprRange').value = String(dpr);
            if (byId('gpuDprVal')) byId('gpuDprVal').textContent = dpr.toFixed(2);
        }
        if (byId('gpuPrecisionSelect')) byId('gpuPrecisionSelect').value = s.precision || 'mediump';
        if (byId('gpuAmbientRange')) {
            const amb = Number(s.ambientIntensity) || 0.65;
            byId('gpuAmbientRange').value = String(amb);
            if (byId('gpuAmbientVal')) byId('gpuAmbientVal').textContent = amb.toFixed(2);
        }
        if (byId('gpuShadowCheck')) byId('gpuShadowCheck').checked = !!s.shadowsEnabled;
        if (byId('gpuRecoverCheck')) byId('gpuRecoverCheck').checked = (s.autoRecoverContext !== false);
    }

    function setModalOpen(open) {
        const modal = ensureModal();
        isOpen = !!open;
        modal.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) syncControlsFromInfo();
    }

    function toggleGpuSettingsModal() {
        setModalOpen(!isOpen);
    }

    window.__vtfOnGpuSettingsUpdated = function () {
        if (isOpen) syncControlsFromInfo();
    };

    window.toggleGpuSettingsModal = toggleGpuSettingsModal;

    const btnGpu = byId('btnGpuSettings');
    if (btnGpu) {
        btnGpu.addEventListener('click', function (e) {
            e.preventDefault();
            toggleGpuSettingsModal();
        });
    }
})();
