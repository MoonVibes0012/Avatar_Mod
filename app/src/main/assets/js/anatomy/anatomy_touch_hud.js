/* ===== VTuber Forge — js/anatomy/anatomy_touch_hud.js ===== */
// Floating touch HUD ringkas di viewport saat Mode Anatomi aktif (Rotate/Move, Mirror, Reset)

(function () {
    'use strict';

    const HUD_ID = 'anatomyFloatingHud';

    function byId(id) {
        return document.getElementById(id);
    }

    function ensureFloatingHud() {
        let hud = byId(HUD_ID);
        if (hud) return hud;

        const vp = document.querySelector('.viewport');
        if (!vp) return null;

        hud = document.createElement('div');
        hud.id = HUD_ID;
        hud.style.cssText = [
            'position:absolute',
            'left:10px',
            'bottom:38px',
            'z-index:25',
            'display:none',
            'flex-direction:column',
            'gap:6px',
            'background:rgba(16,18,26,0.78)',
            'border:1px solid rgba(148,163,184,0.28)',
            'border-radius:10px',
            'padding:7px 8px',
            'color:#f8fafc',
            'font-family:system-ui,-apple-system,sans-serif',
            'font-size:11px',
            'backdrop-filter:blur(4px)'
        ].join(';');

        hud.innerHTML = [
            '<div id="anatHudLabel" style="font-weight:600;color:#7dd3fc;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🦴 Pilih kotak anatomi</div>',
            '<div style="display:flex;gap:5px;">',
            '  <button type="button" id="anatHudModeBtn" style="padding:5px 8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:11px;">Rotate</button>',
            '  <button type="button" id="anatHudMirrorBtn" style="padding:5px 8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:11px;">Mirror</button>',
            '  <button type="button" id="anatHudResetBtn" style="padding:5px 8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-size:11px;">Reset</button>',
            '</div>'
        ].join('');

        vp.appendChild(hud);

        byId('anatHudModeBtn').onclick = function () {
            if (!window.AnatomySelectionSphere) return;
            const next = (window.AnatomySelectionSphere.getDragMode() === 'translate') ? 'rotate' : 'translate';
            window.AnatomySelectionSphere.setDragMode(next);
            refreshHud();
        };

        byId('anatHudMirrorBtn').onclick = function () {
            if (!window.AnatomySolver) return;
            window.AnatomySolver.setMirrorEnabled(!window.AnatomySolver.isMirrorEnabled());
            refreshHud();
        };

        byId('anatHudResetBtn').onclick = function () {
            if (!window.AnatomySolver) return;
            window.AnatomySolver.resetSelectedPart();
            if (typeof saveState === 'function') saveState();
        };

        return hud;
    }

    function refreshHud() {
        const hud = ensureFloatingHud();
        if (!hud) return;

        const isOn = !!(window.AnatomyAnchorBoxes && window.AnatomyAnchorBoxes.isEnabled());
        hud.style.display = isOn ? 'flex' : 'none';
        if (!isOn) return;

        const partId = window.AnatomySelectionSphere ? window.AnatomySelectionSphere.getSelectedPart() : null;
        const def = (partId && window.AnatomyRegistry) ? window.AnatomyRegistry.getPartDef(partId) : null;
        const lbl = byId('anatHudLabel');
        if (lbl) {
            lbl.textContent = partId ? ('🎯 ' + ((def && def.label) ? def.label : partId)) : '🦴 Tap kotak kecil';
        }

        const modeBtn = byId('anatHudModeBtn');
        if (modeBtn && window.AnatomySelectionSphere) {
            const isMove = window.AnatomySelectionSphere.getDragMode() === 'translate';
            modeBtn.textContent = isMove ? 'Move' : 'Rotate';
            modeBtn.style.borderColor = isMove ? '#38bdf8' : '#475569';
        }

        const mirBtn = byId('anatHudMirrorBtn');
        if (mirBtn && window.AnatomySolver) {
            const mir = window.AnatomySolver.isMirrorEnabled();
            mirBtn.style.borderColor = mir ? '#4ade80' : '#475569';
        }
    }

    const prevSelCb = window.__vtfOnAnatomyPartSelected;
    window.__vtfOnAnatomyPartSelected = function () {
        if (typeof prevSelCb === 'function') prevSelCb.apply(this, arguments);
        refreshHud();
    };

    const prevModeCb = window.__vtfOnAnatomyModeChanged;
    window.__vtfOnAnatomyModeChanged = function () {
        if (typeof prevModeCb === 'function') prevModeCb.apply(this, arguments);
        refreshHud();
    };

    setInterval(refreshHud, 300);

    if (document.readyState !== 'loading') {
        ensureFloatingHud();
    } else {
        document.addEventListener('DOMContentLoaded', ensureFloatingHud);
    }
})();
