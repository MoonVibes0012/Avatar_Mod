/* ===== VTuber Forge — js/anatomy/anatomy_touch_hud_view.js ===== */
// Pembuatan DOM & style Floating Touch HUD Anatomi + update label/status HUD

(function () {
    'use strict';

    const STYLE_ID = 'vtfAnatomyTouchHudStyle';
    const HUD_ID = 'anatomyFloatingHud';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + HUD_ID + ' {',
            '  position: fixed;',
            '  left: 10px;',
            '  bottom: 44px;',
            '  z-index: 45;',
            '  display: none;',
            '  flex-direction: column;',
            '  gap: 6px;',
            '  background: rgba(16, 20, 28, 0.86);',
            '  border: 1px solid rgba(120, 195, 255, 0.35);',
            '  border-radius: 10px;',
            '  padding: 8px;',
            '  color: #eaf4ff;',
            '  font-family: system-ui, -apple-system, sans-serif;',
            '  font-size: 11px;',
            '  backdrop-filter: blur(6px);',
            '  max-width: 220px;',
            '  user-select: none;',
            '  touch-action: none;',
            '}',
            '#' + HUD_ID + '.visible { display: flex; }',
            '#' + HUD_ID + ' .hud-header {',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: space-between;',
            '  gap: 8px;',
            '  font-weight: 600;',
            '  color: #7cd4ff;',
            '}',
            '#' + HUD_ID + ' .hud-row {',
            '  display: flex;',
            '  gap: 4px;',
            '  flex-wrap: wrap;',
            '}',
            '#' + HUD_ID + ' button {',
            '  background: rgba(36, 48, 66, 0.9);',
            '  color: #eef6ff;',
            '  border: 1px solid rgba(140, 185, 230, 0.28);',
            '  border-radius: 6px;',
            '  padding: 4px 7px;',
            '  font-size: 11px;',
            '  line-height: 1.2;',
            '  cursor: pointer;',
            '}',
            '#' + HUD_ID + ' button.active {',
            '  background: rgba(34, 130, 210, 0.85);',
            '  border-color: #82d6ff;',
            '}',
            '#' + HUD_ID + ' .hud-pad {',
            '  width: 100%;',
            '  height: 54px;',
            '  border-radius: 8px;',
            '  background: rgba(24, 34, 48, 0.92);',
            '  border: 1px dashed rgba(130, 200, 255, 0.45);',
            '  display: flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  text-align: center;',
            '  color: #b8dcff;',
            '  font-size: 10px;',
            '  padding: 0 6px;',
            '  touch-action: none;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function createHudElement() {
        ensureStyles();
        let hud = document.getElementById(HUD_ID);
        if (hud) return hud;

        hud = document.createElement('div');
        hud.id = HUD_ID;
        hud.innerHTML = [
            '<div class="hud-header">',
            '  <span id="anatHudPartLabel">Bagian: -</span>',
            '  <button type="button" id="anatHudHideBtn" title="Sembunyikan HUD">✕</button>',
            '</div>',
            '<div class="hud-row">',
            '  <button type="button" id="anatHudModeBtn">Rotate</button>',
            '  <button type="button" id="anatHudMirrorBtn">Mirror: OFF</button>',
            '  <button type="button" id="anatHudResetBtn">Reset</button>',
            '</div>',
            '<div class="hud-pad" id="anatHudPad">Geser di sini untuk menggerakkan bagian aktif</div>'
        ].join('');

        document.body.appendChild(hud);
        return hud;
    }

    function updateHudDisplay(opts) {
        const hud = document.getElementById(HUD_ID);
        if (!hud) return;

        const shouldShow = !!(opts && opts.visible && opts.hasPart);
        hud.classList.toggle('visible', shouldShow);
        if (!shouldShow) return;

        const lbl = document.getElementById('anatHudPartLabel');
        if (lbl) {
            const def = (opts.partId && window.AnatomyRegistry)
                ? window.AnatomyRegistry.getPartDef(opts.partId)
                : null;
            const partName = (def && def.label) ? def.label : (opts.partId || '-');
            lbl.textContent = 'Bagian: ' + partName;
        }

        const modeBtn = document.getElementById('anatHudModeBtn');
        if (modeBtn) {
            const isTrans = opts.dragMode === 'translate';
            modeBtn.textContent = isTrans ? 'Move' : 'Rotate';
            modeBtn.classList.toggle('active', isTrans);
        }

        const mirBtn = document.getElementById('anatHudMirrorBtn');
        if (mirBtn) {
            mirBtn.textContent = opts.mirror ? 'Mirror: ON' : 'Mirror: OFF';
            mirBtn.classList.toggle('active', !!opts.mirror);
        }
    }

    function destroyHudElement() {
        const hud = document.getElementById(HUD_ID);
        if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
        const st = document.getElementById(STYLE_ID);
        if (st && st.parentNode) st.parentNode.removeChild(st);
    }

    window.AnatomyTouchHudView = {
        ensureElement: createHudElement,
        update: updateHudDisplay,
        destroy: destroyHudElement
    };
})();
