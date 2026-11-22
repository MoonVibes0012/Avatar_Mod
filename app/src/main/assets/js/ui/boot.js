/* ===== VTuber Forge — js/ui/boot.js ===== */
// Inisialisasi UI utama: render panel kiri & kanan, binding tombol atas, & toggle panel

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
            topBar.style.position = 'fixed';
            topBar.style.top = '0';
            topBar.style.left = '0';
            topBar.style.right = '0';
            topBar.style.zIndex = '30';
            topBar.style.display = 'flex';
            topBar.style.flexWrap = 'wrap';
            topBar.style.alignItems = 'center';
            topBar.style.gap = '4px';
            topBar.style.padding = '6px';
            topBar.style.background = 'rgba(15, 19, 28, 0.85)';
        }

        ['left', 'right'].forEach((id) => {
            const panel = byId(id);
            if (!panel) return;
            panel.style.position = 'fixed';
            panel.style.top = '44px';
            panel.style.bottom = '28px';
            panel.style.width = '270px';
            panel.style.maxWidth = '82vw';
            panel.style.zIndex = '25';
            panel.style.background = 'rgba(16, 20, 30, 0.92)';
            panel.style.color = '#eef4ff';
            panel.style.overflowY = 'auto';
            if (id === 'left') panel.style.left = '0';
            if (id === 'right') panel.style.right = '0';
        });

        const statusEl = byId('status');
        if (statusEl) {
            statusEl.style.position = 'fixed';
            statusEl.style.left = '8px';
            statusEl.style.bottom = '6px';
            statusEl.style.zIndex = '30';
            statusEl.style.pointerEvents = 'none';
            statusEl.style.background = 'rgba(15, 19, 28, 0.8)';
            statusEl.style.color = '#cfe4ff';
            statusEl.style.padding = '3px 8px';
            statusEl.style.borderRadius = '6px';
            statusEl.style.fontSize = '11px';
        }
    }

    function setPanelOpen(panelId, open) {
        const panel = byId(panelId);
        const backdrop = byId('panelBackdrop');
        if (!panel) return;

        ensureBaseUiLayers();
        panel.classList.toggle('mobile-open', !!open);
        panel.classList.toggle('open', !!open);
        panel.style.display = open ? 'block' : 'none';

        const leftOpen = !!(byId('left') && byId('left').style.display !== 'none');
        const rightOpen = !!(byId('right') && byId('right').style.display !== 'none');
        if (backdrop) {
            const anyOpen = leftOpen || rightOpen;
            backdrop.hidden = !anyOpen;
            backdrop.style.display = anyOpen ? 'block' : 'none';
            backdrop.style.position = 'fixed';
            backdrop.style.inset = '0';
            backdrop.style.zIndex = '20';
        }
    }

    function togglePanel(panelId) {
        const panel = byId(panelId);
        if (!panel) return;
        const isVisible = panel.style.display !== 'none' &&
            (panel.classList.contains('mobile-open') || panel.classList.contains('open') || panel.style.display === 'block');
        const otherId = panelId === 'left' ? 'right' : 'left';
        if (!isVisible) {
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
            partsBtn.onclick = function () {
                togglePanel('left');
            };
        }

        const inspBtn = byId('inspector');
        if (inspBtn && inspBtn.dataset.vtfBootBound !== '1') {
            inspBtn.dataset.vtfBootBound = '1';
            inspBtn.onclick = function () {
                togglePanel('right');
            };
        }

        document.querySelectorAll('.btn-close-panel').forEach((btn) => {
            if (btn.dataset.vtfBootBound === '1') return;
            btn.dataset.vtfBootBound = '1';
            btn.onclick = function () {
                const targetPanel = btn.getAttribute('data-panel');
                if (targetPanel) setPanelOpen(targetPanel, false);
            };
        });

        const backdrop = byId('panelBackdrop');
        if (backdrop && backdrop.dataset.vtfBootBound !== '1') {
            backdrop.dataset.vtfBootBound = '1';
            backdrop.onclick = function () {
                setPanelOpen('left', false);
                setPanelOpen('right', false);
            };
        }

        const debugBtn = byId('btnDebug');
        if (debugBtn && debugBtn.dataset.vtfBootBound !== '1') {
            debugBtn.dataset.vtfBootBound = '1';
            debugBtn.onclick = function () {
                const dbgEl = byId('debugOverlay');
                if (!dbgEl) return;
                const nextShow = dbgEl.style.display === 'none';
                dbgEl.style.display = nextShow ? 'block' : 'none';
                dbgEl.style.position = 'fixed';
                dbgEl.style.left = '8px';
                dbgEl.style.bottom = '32px';
                dbgEl.style.zIndex = '40';
                dbgEl.style.maxHeight = '35vh';
                dbgEl.style.maxWidth = '90vw';
                dbgEl.style.overflow = 'auto';
                dbgEl.style.background = 'rgba(0, 0, 0, 0.85)';
                dbgEl.style.color = '#8ef5a5';
                dbgEl.style.padding = '6px 8px';
                dbgEl.style.fontSize = '10px';
            };
        }

        // Default tertutup di layar kecil agar canvas tetap lega, tapi tombol & isi panel siap dibuka
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
