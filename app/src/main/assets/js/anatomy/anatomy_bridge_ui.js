/* ===== VTuber Forge — js/anatomy/anatomy_bridge_ui.js ===== */
// Integrasi kontrol Anatomi ke panel UI, undo/redo saat drag selesai, reset pose, & lifecycle GPU

(function () {
    'use strict';

    let anatomyActive = false;
    let lastWatchedRoot = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function setAnatomyStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function getCurrentModelEntity() {
        if (typeof window.S !== 'undefined' && window.S && window.S.selected) {
            return window.S.selected;
        }
        try {
            if (typeof S !== 'undefined' && S && S.selected) return S.selected;
        } catch (e) {}
        return null;
    }

    function refreshModelAnatomy(force) {
        if (!window.VrmPartExtractor || !window.AnatomySolver) return null;
        const model = getCurrentModelEntity();
        if (!model) {
            if (lastWatchedRoot !== null) {
                lastWatchedRoot = null;
                window.AnatomySolver.setRecord(null);
                populatePartSelector(null);
            }
            return null;
        }

        if (force || model !== lastWatchedRoot) {
            lastWatchedRoot = model;
            const rec = window.VrmPartExtractor.extract(model, !!force);
            window.AnatomySolver.setRecord(rec);
            populatePartSelector(rec);
            return rec;
        }
        return window.AnatomySolver.getRecord();
    }

    function populatePartSelector(record) {
        const sel = byId('anatPartSelect');
        if (!sel) return;
        const prevVal = sel.value;
        sel.textContent = '';

        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '-- Pilih Bagian Anatomi --';
        sel.appendChild(defOpt);

        if (!record || !record.parts || !window.AnatomyRegistry) return;
        const ids = Object.keys(record.parts);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const info = window.AnatomyRegistry.getPartDef(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = (info && info.label) ? info.label : id;
            sel.appendChild(opt);
        }

        if (prevVal && record.parts[prevVal]) {
            sel.value = prevVal;
        }
    }

    function ensureAnatomySectionInPanel() {
        const rightBody = byId('rightBody');
        if (!rightBody || !rightBody.dataset.vtfRendered) return;
        if (byId('anatomySectionCard')) return;

        const sec = document.createElement('div');
        sec.id = 'anatomySectionCard';
        sec.className = 'sec';
        sec.innerHTML = [
            '<h4>🦴 Gerak Anatomi</h4>',
            '<div class="grid2">',
            '  <button type="button" id="anatToggleBtn">Mode: OFF</button>',
            '  <button type="button" id="anatDensityBtn">Boxes: Core</button>',
            '</div>',
            '<div class="prop">',
            '  <label for="anatPartSelect">Bagian Aktif</label>',
            '  <select id="anatPartSelect"><option value="">-- Pilih Bagian Anatomi --</option></select>',
            '</div>',
            '<div class="grid2">',
            '  <button type="button" id="anatDragModeBtn">Aksi: Rotate</button>',
            '  <button type="button" id="anatMirrorBtn">Mirror: OFF</button>',
            '</div>',
            '<div class="grid2">',
            '  <button type="button" id="anatResetPartBtn">Reset Bagian</button>',
            '  <button type="button" id="anatResetAllBtn">Reset Semua</button>',
            '</div>'
        ].join('');

        rightBody.appendChild(sec);
        bindAnatomyUiControls();
        populatePartSelector(refreshModelAnatomy(false));
    }

    function syncAnatomyButtonsUi() {
        const tBtn = byId('anatToggleBtn');
        if (tBtn) {
            tBtn.textContent = anatomyActive ? 'Mode: ON' : 'Mode: OFF';
            tBtn.classList.toggle('on', anatomyActive);
        }
        const dBtn = byId('anatDensityBtn');
        if (dBtn && window.AnatomyAnchorBoxes) {
            const isFull = window.AnatomyAnchorBoxes.getDensityMode() === 'full';
            dBtn.textContent = isFull ? 'Boxes: Full' : 'Boxes: Core';
            dBtn.classList.toggle('on', isFull);
        }
        const mBtn = byId('anatDragModeBtn');
        if (mBtn && window.AnatomySelectionSphere) {
            const isTrans = window.AnatomySelectionSphere.getDragMode() === 'translate';
            mBtn.textContent = isTrans ? 'Aksi: Move' : 'Aksi: Rotate';
            mBtn.classList.toggle('on', isTrans);
        }
        const mirBtn = byId('anatMirrorBtn');
        if (mirBtn && window.AnatomySolver) {
            const mir = window.AnatomySolver.isMirrorEnabled();
            mirBtn.textContent = mir ? 'Mirror: ON' : 'Mirror: OFF';
            mirBtn.classList.toggle('on', mir);
        }
    }

    function setAnatomyEnabled(flag) {
        anatomyActive = !!flag;
        if (anatomyActive) {
            const rec = refreshModelAnatomy(false);
            if (!rec) {
                anatomyActive = false;
                syncAnatomyButtonsUi();
                setAnatomyStatus('⚠ Pilih atau import model .VRM / objek terlebih dahulu.');
                return;
            }
            if (window.AnatomyAnchorBoxes) {
                window.AnatomyAnchorBoxes.setTargetRecord(rec);
                window.AnatomyAnchorBoxes.setEnabled(true);
            }
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.setEnabled(true);
            }
            setAnatomyStatus('🦴 Mode Anatomi aktif — tap kotak kecil untuk memunculkan bola penanda.');
        } else {
            if (window.AnatomySelectionSphere) {
                window.AnatomySelectionSphere.setEnabled(false);
            }
            if (window.AnatomyAnchorBoxes) {
                window.AnatomyAnchorBoxes.setEnabled(false);
            }
            setAnatomyStatus('🦴 Mode Anatomi nonaktif.');
        }
        syncAnatomyButtonsUi();
    }

    function bindAnatomyUiControls() {
        const tBtn = byId('anatToggleBtn');
        if (tBtn && tBtn.dataset.vtfAnatBound !== '1') {
            tBtn.dataset.vtfAnatBound = '1';
            tBtn.onclick = function () {
                setAnatomyEnabled(!anatomyActive);
            };
        }

        const dBtn = byId('anatDensityBtn');
        if (dBtn && dBtn.dataset.vtfAnatBound !== '1') {
            dBtn.dataset.vtfAnatBound = '1';
            dBtn.onclick = function () {
                if (!window.AnatomyAnchorBoxes) return;
                const next = (window.AnatomyAnchorBoxes.getDensityMode() === 'full') ? 'core' : 'full';
                window.AnatomyAnchorBoxes.setDensityMode(next);
                syncAnatomyButtonsUi();
                setAnatomyStatus('Kepadatan kotak anatomi: ' + next.toUpperCase());
            };
        }

        const partSel = byId('anatPartSelect');
        if (partSel && partSel.dataset.vtfAnatBound !== '1') {
            partSel.dataset.vtfAnatBound = '1';
            partSel.onchange = function (e) {
                const pid = e.target.value;
                if (!pid) return;
                if (!anatomyActive) setAnatomyEnabled(true);
                refreshModelAnatomy(false);
                if (window.AnatomySolver) {
                    window.AnatomySolver.selectPart(pid);
                }
            };
        }

        const mBtn = byId('anatDragModeBtn');
        if (mBtn && mBtn.dataset.vtfAnatBound !== '1') {
            mBtn.dataset.vtfAnatBound = '1';
            mBtn.onclick = function () {
                if (!window.AnatomySelectionSphere) return;
                const next = (window.AnatomySelectionSphere.getDragMode() === 'translate') ? 'rotate' : 'translate';
                window.AnatomySelectionSphere.setDragMode(next);
                syncAnatomyButtonsUi();
                setAnatomyStatus('Mode geser bola penanda: ' + next.toUpperCase());
            };
        }

        const mirBtn = byId('anatMirrorBtn');
        if (mirBtn && mirBtn.dataset.vtfAnatBound !== '1') {
            mirBtn.dataset.vtfAnatBound = '1';
            mirBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.setMirrorEnabled(!window.AnatomySolver.isMirrorEnabled());
                syncAnatomyButtonsUi();
                setAnatomyStatus('Mirror anatomi: ' + (window.AnatomySolver.isMirrorEnabled() ? 'ON' : 'OFF'));
            };
        }

        const rpBtn = byId('anatResetPartBtn');
        if (rpBtn && rpBtn.dataset.vtfAnatBound !== '1') {
            rpBtn.dataset.vtfAnatBound = '1';
            rpBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.resetSelectedPart();
                if (typeof saveState === 'function') saveState();
                setAnatomyStatus('↩ Pose bagian terpilih di-reset.');
            };
        }

        const raBtn = byId('anatResetAllBtn');
        if (raBtn && raBtn.dataset.vtfAnatBound !== '1') {
            raBtn.dataset.vtfAnatBound = '1';
            raBtn.onclick = function () {
                if (!window.AnatomySolver) return;
                window.AnatomySolver.resetAllParts();
                if (typeof saveState === 'function') saveState();
                setAnatomyStatus('↩ Semua pose anatomi di-reset ke Rest Pose.');
            };
        }
    }

    // Callback dari SelectionSphere & AnatomySolver
    window.__vtfOnAnatomyBoxTapped = function (partId) {
        if (!window.AnatomySolver) return;
        refreshModelAnatomy(false);
        window.AnatomySolver.selectPart(partId);
        const selEl = byId('anatPartSelect');
        if (selEl) selEl.value = partId;
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('🎯 Bola aktif pada: ' + ((def && def.label) ? def.label : partId) + ' — geser bola untuk menggerakkan.');
    };

    window.__vtfOnAnatomyPartSelected = function (partId, mode) {
        const selEl = byId('anatPartSelect');
        if (selEl && partId) selEl.value = partId;
        syncAnatomyButtonsUi();
    };

    window.__vtfOnAnatomyModeChanged = function () {
        syncAnatomyButtonsUi();
    };

    window.__vtfOnAnatomyDragStart = function (partId, mode) {
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('✋ Menggeser (' + mode + '): ' + ((def && def.label) ? def.label : partId));
    };

    window.__vtfOnAnatomyDragMove = function (partId, mode, dx, dy, camEnt) {
        if (!window.AnatomySolver) return;
        window.AnatomySolver.handleDragMove(partId, mode, dx, dy, camEnt);
    };

    window.__vtfOnAnatomyDragEnd = function (partId) {
        if (typeof saveState === 'function') {
            try { saveState(); } catch (e) {}
        }
        const def = window.AnatomyRegistry ? window.AnatomyRegistry.getPartDef(partId) : null;
        setAnatomyStatus('✅ Pose diperbarui: ' + ((def && def.label) ? def.label : partId));
    };

    // Pantau perubahan seleksi objek / render panel
    const origRenderPanels = window.renderPanelsTemplates;
    if (typeof origRenderPanels === 'function') {
        window.renderPanelsTemplates = function () {
            const res = origRenderPanels.apply(this, arguments);
            ensureAnatomySectionInPanel();
            return res;
        };
    }

    setInterval(function () {
        ensureAnatomySectionInPanel();
        const cur = getCurrentModelEntity();
        if (cur !== lastWatchedRoot) {
            const rec = refreshModelAnatomy(false);
            if (anatomyActive) {
                if (rec && window.AnatomyAnchorBoxes) {
                    window.AnatomyAnchorBoxes.setTargetRecord(rec);
                    window.AnatomyAnchorBoxes.syncBoxes(true);
                } else {
                    setAnatomyEnabled(false);
                }
            }
        } else if (anatomyActive && window.AnatomyAnchorBoxes) {
            window.AnatomyAnchorBoxes.syncBoxes(false);
        }
    }, 250);

    window.AnatomyBridgeUI = {
        setEnabled: setAnatomyEnabled,
        refresh: function () { return refreshModelAnatomy(true); }
    };

    if (document.readyState !== 'loading') {
        ensureAnatomySectionInPanel();
    } else {
        document.addEventListener('DOMContentLoaded', ensureAnatomySectionInPanel);
    }
})();
