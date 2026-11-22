/* ===== VTuber Forge — js/ui/boot.js ===== */
// Inisialisasi UI utama: render panel kiri & kanan, toggle panel, & re-bind kontrol

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setBootStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function ensureBaseUiLayers() {
        const canvas = byId('gl');
        if (canvas) {
            canvas.style.position = 'fixed';
            canvas.style.inset = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = '1';
            canvas.style.display = 'block';
        }

        const topBar = document.querySelector('.top');
        if (topBar) {
            topBar.style.setProperty('position', 'fixed', 'important');
            topBar.style.setProperty('top', '0', 'important');
            topBar.style.setProperty('left', '0', 'important');
            topBar.style.setProperty('right', '0', 'important');
            topBar.style.setProperty('z-index', '40', 'important');
            topBar.style.setProperty('display', 'flex', 'important');
            topBar.style.flexWrap = 'wrap';
            topBar.style.alignItems = 'center';
            topBar.style.gap = '4px';
            topBar.style.padding = '6px';
            topBar.style.background = 'rgba(15, 19, 28, 0.9)';
        }

        ['left', 'right'].forEach((id) => {
            const panel = byId(id);
            if (!panel) return;
            panel.style.setProperty('position', 'fixed', 'important');
            panel.style.setProperty('top', '44px', 'important');
            panel.style.setProperty('bottom', '28px', 'important');
            panel.style.setProperty('width', '275px', 'important');
            panel.style.setProperty('max-width', '84vw', 'important');
            panel.style.setProperty('z-index', '35', 'important');
            panel.style.background = 'rgba(16, 20, 30, 0.95)';
            panel.style.color = '#eef4ff';
            panel.style.overflowY = 'auto';
            panel.style.setProperty('pointer-events', 'auto', 'important');
            if (id === 'left') panel.style.setProperty('left', '0', 'important');
            if (id === 'right') panel.style.setProperty('right', '0', 'important');
        });

        const statusEl = byId('status');
        if (statusEl) {
            statusEl.style.position = 'fixed';
            statusEl.style.left = '8px';
            statusEl.style.bottom = '6px';
            statusEl.style.zIndex = '40';
            statusEl.style.pointerEvents = 'none';
            statusEl.style.background = 'rgba(15, 19, 28, 0.85)';
            statusEl.style.color = '#cfe4ff';
            statusEl.style.padding = '3px 8px';
            statusEl.style.borderRadius = '6px';
            statusEl.style.fontSize = '11px';
        }
    }

    function isPanelCurrentlyOpen(panelId) {
        const panel = byId(panelId);
        if (!panel) return false;
        return panel.dataset.vtfOpen === '1' && panel.style.display !== 'none';
    }

    function setPanelOpen(panelId, open) {
        const panel = byId(panelId);
        const backdrop = byId('panelBackdrop');
        if (!panel) return;

        ensureBaseUiLayers();
        const wantOpen = !!open;
        panel.dataset.vtfOpen = wantOpen ? '1' : '0';
        panel.classList.toggle('mobile-open', wantOpen);
        panel.classList.toggle('open', wantOpen);
        panel.style.setProperty('display', wantOpen ? 'block' : 'none', 'important');

        const leftOpen = isPanelCurrentlyOpen('left');
        const rightOpen = isPanelCurrentlyOpen('right');
        if (backdrop) {
            const anyOpen = leftOpen || rightOpen;
            backdrop.hidden = !anyOpen;
            backdrop.style.setProperty('position', 'fixed', 'important');
            backdrop.style.setProperty('inset', '0', 'important');
            backdrop.style.setProperty('z-index', '30', 'important');
            backdrop.style.setProperty('display', anyOpen ? 'block' : 'none', 'important');
        }
    }

    function togglePanel(panelId) {
        const currentlyOpen = isPanelCurrentlyOpen(panelId);
        const otherId = panelId === 'left' ? 'right' : 'left';
        if (!currentlyOpen) {
            setPanelOpen(otherId, false);
            setPanelOpen(panelId, true);
        } else {
            setPanelOpen(panelId, false);
        }
    }

    window.__vtfSetPanel = setPanelOpen;
    window.__vtfTogglePanel = togglePanel;

    function rebindSubSystems() {
        try {
            if (typeof window.__vtfBindFileImport === 'function') window.__vtfBindFileImport();
        } catch (e) {}
        try {
            if (typeof window.__vtfBindTransformInputs === 'function') window.__vtfBindTransformInputs();
        } catch (e) {}
        try {
            if (typeof window.__vtfBindMaterialInputs === 'function') window.__vtfBindMaterialInputs();
        } catch (e) {}
        try {
            if (typeof window.__vtfBindMotionControls === 'function') window.__vtfBindMotionControls();
        } catch (e) {}
        try {
            if (typeof window.__vtfBindToolbarControls === 'function') window.__vtfBindToolbarControls();
        } catch (e) {}
        try {
            if (window.VtfSceneOps && typeof window.VtfSceneOps.bindButtons === 'function') {
                window.VtfSceneOps.bindButtons();
            }
        } catch (e) {}
        try {
            if (window.AnatomyBridgeUi && typeof window.AnatomyBridgeUi.refresh === 'function') {
                window.AnatomyBridgeUi.refresh();
            }
        } catch (e) {}
    }

    function bootUi() {
        ensureBaseUiLayers();

        if (typeof window.renderPanelsTemplates === 'function') {
            window.renderPanelsTemplates();
        }

        const partsBtn = byId('parts');
        if (partsBtn && partsBtn.dataset.vtfBootBound !== '1') {
            partsBtn.dataset.vtfBootBound = '1';
            partsBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel('left');
            });
        }

        const inspBtn = byId('inspector');
        if (inspBtn && inspBtn.dataset.vtfBootBound !== '1') {
            inspBtn.dataset.vtfBootBound = '1';
            inspBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel('right');
            });
        }

        document.querySelectorAll('.btn-close-panel').forEach((btn) => {
            if (btn.dataset.vtfBootBound === '1') return;
            btn.dataset.vtfBootBound = '1';
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const targetPanel = btn.getAttribute('data-panel');
                if (targetPanel) setPanelOpen(targetPanel, false);
            });
        });

        const backdrop = byId('panelBackdrop');
        if (backdrop && backdrop.dataset.vtfBootBound !== '1') {
            backdrop.dataset.vtfBootBound = '1';
            backdrop.addEventListener('click', function () {
                setPanelOpen('left', false);
                setPanelOpen('right', false);
            });
        }

        const debugBtn = byId('btnDebug');
        if (debugBtn && debugBtn.dataset.vtfBootBound !== '1') {
            debugBtn.dataset.vtfBootBound = '1';
            debugBtn.addEventListener('click', function () {
                const dbgEl = byId('debugOverlay');
                if (!dbgEl) return;
                const nextShow = dbgEl.style.display === 'none';
                dbgEl.style.display = nextShow ? 'block' : 'none';
                dbgEl.style.position = 'fixed';
                dbgEl.style.left = '8px';
                dbgEl.style.bottom = '34px';
                dbgEl.style.zIndex = '45';
                dbgEl.style.maxHeight = '35vh';
                dbgEl.style.maxWidth = '92vw';
                dbgEl.style.overflow = 'auto';
                dbgEl.style.background = 'rgba(0, 0, 0, 0.88)';
                dbgEl.style.color = '#8ef5a5';
                dbgEl.style.padding = '6px 8px';
                dbgEl.style.fontSize = '10px';
            });
        }

        setPanelOpen('left', false);
        setPanelOpen('right', false);

        rebindSubSystems();
        setBootStatus('Siap!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootUi);
    } else {
        bootUi();
    }

    window.__vtfBootUi = bootUi;
})();
