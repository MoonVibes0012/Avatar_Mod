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
            topBar.style.setProperty('z-index', '60', 'important');
            topBar.style.setProperty('display', 'flex', 'important');
            topBar.style.flexWrap = 'wrap';
            topBar.style.alignItems = 'center';
            topBar.style.gap = '4px';
            topBar.style.padding = '6px';
            topBar.style.background = 'rgba(15, 19, 28, 0.92)';
            topBar.style.setProperty('pointer-events', 'auto', 'important');
        }

        ['left', 'right'].forEach((id) => {
            const panel = byId(id);
            if (!panel) return;
            panel.style.setProperty('position', 'fixed', 'important');
            panel.style.setProperty('top', '44px', 'important');
            panel.style.setProperty('bottom', '28px', 'important');
            panel.style.setProperty('width', '275px', 'important');
            panel.style.setProperty('max-width', '84vw', 'important');
            panel.style.setProperty('z-index', '55', 'important');
            panel.style.background = 'rgba(16, 20, 30, 0.96)';
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
            statusEl.style.zIndex = '65';
            statusEl.style.pointerEvents = 'none';
            statusEl.style.background = 'rgba(15, 19, 28, 0.88)';
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
            backdrop.style.setProperty('z-index', '45', 'important');
            backdrop.style.setProperty('display', anyOpen ? 'block' : 'none', 'important');
        }

        setBootStatus(
            (panelId === 'left' ? 'Panel MENU: ' : 'Panel INSPECT: ') + (wantOpen ? 'TERBUKA' : 'DITUTUP')
        );
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

    function bindDelegatedPanelTriggers() {
        if (window.__vtfPanelDelegationBound) return;
        window.__vtfPanelDelegationBound = true;

        document.addEventListener('click', function (e) {
            const target = e && e.target && typeof e.target.closest === 'function' ? e.target : null;
            if (!target) return;

            if (target.closest('#parts')) {
                e.preventDefault();
                togglePanel('left');
                return;
            }
            if (target.closest('#inspector')) {
                e.preventDefault();
                togglePanel('right');
                return;
            }
            const closeBtn = target.closest('.btn-close-panel');
            if (closeBtn) {
                e.preventDefault();
                const panelId = closeBtn.getAttribute('data-panel');
                if (panelId) setPanelOpen(panelId, false);
                return;
            }
            if (target.closest('#panelBackdrop')) {
                setPanelOpen('left', false);
                setPanelOpen('right', false);
            }
        }, true);
    }

    function bootUi() {
        ensureBaseUiLayers();
        bindDelegatedPanelTriggers();

        if (typeof window.renderPanelsTemplates === 'function') {
            window.renderPanelsTemplates();
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
                dbgEl.style.zIndex = '70';
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
