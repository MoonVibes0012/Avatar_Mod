/* ===== VTuber Forge — js/ui/boot.js ===== */
// Inisialisasi UI utama: render panel kiri & kanan, toggle panel, & re-bind kontrol

(function () {
    'use strict';

    const panelStates = {
        left: false,
        right: false
    };

    /**
     * Mengambil elemen DOM berdasarkan ID secara aman.
     */
    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (e) {
            return null;
        }
    }

    /**
     * Memperbarui teks status pada elemen #status jika tersedia.
     */
    function setBootStatus(msg) {
        try {
            const el = byId('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Memastikan lapisan dasar canvas, top bar, panel samping, dan indikator status
     * memiliki tata letak dan prioritas z-index yang konsisten di layar.
     */
    function ensureBaseUiLayers() {
        try {
            const canvas = byId('gl');
            if (canvas) {
                canvas.style.setProperty('position', 'fixed', 'important');
                canvas.style.setProperty('inset', '0', 'important');
                canvas.style.setProperty('width', '100%', 'important');
                canvas.style.setProperty('height', '100%', 'important');
                canvas.style.setProperty('z-index', '1', 'important');
                canvas.style.setProperty('display', 'block', 'important');
            }

            const topBar = document.querySelector('.top');
            if (topBar) {
                topBar.style.setProperty('position', 'fixed', 'important');
                topBar.style.setProperty('top', '0', 'important');
                topBar.style.setProperty('left', '0', 'important');
                topBar.style.setProperty('right', '0', 'important');
                topBar.style.setProperty('z-index', '60', 'important');
                topBar.style.setProperty('display', 'flex', 'important');
                topBar.style.setProperty('flex-wrap', 'wrap', 'important');
                topBar.style.setProperty('align-items', 'center', 'important');
                topBar.style.setProperty('gap', '4px', 'important');
                topBar.style.setProperty('padding', '6px', 'important');
                topBar.style.setProperty('background', 'rgba(15, 19, 28, 0.92)', 'important');
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
                panel.style.setProperty('background', 'rgba(16, 20, 30, 0.96)', 'important');
                panel.style.setProperty('color', '#eef4ff', 'important');
                panel.style.setProperty('overflow-y', 'auto', 'important');
                panel.style.setProperty('pointer-events', 'auto', 'important');
                if (id === 'left') panel.style.setProperty('left', '0', 'important');
                if (id === 'right') panel.style.setProperty('right', '0', 'important');
            });

            const statusEl = byId('status');
            if (statusEl) {
                statusEl.style.setProperty('position', 'fixed', 'important');
                statusEl.style.setProperty('left', '8px', 'important');
                statusEl.style.setProperty('bottom', '6px', 'important');
                statusEl.style.setProperty('z-index', '65', 'important');
                statusEl.style.setProperty('pointer-events', 'none', 'important');
                statusEl.style.setProperty('background', 'rgba(15, 19, 28, 0.88)', 'important');
                statusEl.style.setProperty('color', '#cfe4ff', 'important');
                statusEl.style.setProperty('padding', '3px 8px', 'important');
                statusEl.style.setProperty('border-radius', '6px', 'important');
                statusEl.style.setProperty('font-size', '11px', 'important');
            }
        } catch (err) {
            console.error('Gagal menyelaraskan lapisan UI dasar:', err);
        }
    }

    /**
     * Menerapkan status visual terbuka/tertutup pada panel kiri atau kanan.
     */
    function applyPanelVisual(panelId, open) {
        const panel = byId(panelId);
        if (!panel) return;
        const wantOpen = !!open;
        panelStates[panelId] = wantOpen;

        try {
            panel.classList.toggle('mobile-open', wantOpen);
            panel.classList.toggle('open', wantOpen);
            panel.style.setProperty('display', wantOpen ? 'block' : 'none', 'important');
            panel.style.setProperty('visibility', wantOpen ? 'visible' : 'hidden', 'important');
            panel.style.setProperty('opacity', wantOpen ? '1' : '0', 'important');
            panel.style.setProperty('transform', 'translateX(0)', 'important');
        } catch (e) {}
    }

    /**
     * Mengatur status buka/tutup panel sekaligus menyinkronkan backdrop dan status teks.
     */
    function setPanelOpen(panelId, open, announce) {
        if (panelId !== 'left' && panelId !== 'right') return;
        ensureBaseUiLayers();
        const wantOpen = !!open;
        applyPanelVisual(panelId, wantOpen);

        const backdrop = byId('panelBackdrop');
        if (backdrop) {
            const anyOpen = !!(panelStates.left || panelStates.right);
            backdrop.hidden = !anyOpen;
            backdrop.style.setProperty('position', 'fixed', 'important');
            backdrop.style.setProperty('inset', '0', 'important');
            backdrop.style.setProperty('z-index', '45', 'important');
            backdrop.style.setProperty('display', anyOpen ? 'block' : 'none', 'important');
        }

        if (announce) {
            setBootStatus(
                (panelId === 'left' ? 'Panel MENU: ' : 'Panel INSPECT: ') + (wantOpen ? 'TERBUKA' : 'DITUTUP')
            );
        }
    }

    /**
     * Menukar status panel aktif dan menutup panel berlawanan jika salah satu dibuka.
     */
    function togglePanel(panelId) {
        if (panelId !== 'left' && panelId !== 'right') return;
        const nextOpen = !panelStates[panelId];
        const otherId = panelId === 'left' ? 'right' : 'left';
        if (nextOpen) {
            setPanelOpen(otherId, false, false);
        }
        setPanelOpen(panelId, nextOpen, true);
    }

    window.__vtfSetPanel = function (id, open) { setPanelOpen(id, open, true); };
    window.__vtfTogglePanel = togglePanel;

    /**
     * Mengikat ulang kontrol subsistem setelah template panel dirender atau diperbarui.
     */
    function rebindSubSystems() {
        const binders = [
            function () {
                if (typeof window.__vtfBindFileImport === 'function') window.__vtfBindFileImport();
            },
            function () {
                if (typeof window.__vtfBindTransformInputs === 'function') window.__vtfBindTransformInputs();
            },
            function () {
                if (typeof window.__vtfBindMaterialInputs === 'function') window.__vtfBindMaterialInputs();
            },
            function () {
                if (typeof window.__vtfBindMotionControls === 'function') window.__vtfBindMotionControls();
            },
            function () {
                if (typeof window.__vtfBindExpressionControls === 'function') window.__vtfBindExpressionControls();
            },
            function () {
                if (typeof window.__vtfBindSplitControls === 'function') window.__vtfBindSplitControls();
            },
            function () {
                if (typeof window.setupVertexEditing === 'function' && window.S && window.S.selected) {
                    window.setupVertexEditing();
                }
            },
            function () {
                if (typeof window.__vtfBindToolbarControls === 'function') window.__vtfBindToolbarControls();
            },
            function () {
                if (window.VtfSceneOps && typeof window.VtfSceneOps.bindButtons === 'function') {
                    window.VtfSceneOps.bindButtons();
                }
            },
            function () {
                if (window.AnatomyBridgeUI && typeof window.AnatomyBridgeUI.refresh === 'function') {
                    window.AnatomyBridgeUI.refresh();
                }
            }
        ];

        for (let i = 0; i < binders.length; i++) {
            try {
                binders[i]();
            } catch (e) {
                console.warn('Rebind subsystem warning:', e);
            }
        }
    }

    /**
     * Mendaftarkan event delegation untuk tombol toggle panel, tombol tutup, dan backdrop.
     */
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
                if (panelId) setPanelOpen(panelId, false, true);
                return;
            }
            if (target.closest('#panelBackdrop')) {
                setPanelOpen('left', false, false);
                setPanelOpen('right', false, true);
            }
        }, true);
    }

    /**
     * Menjalankan proses inisialisasi UI utama aplikasi.
     */
    function bootUi() {
        try {
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

            setPanelOpen('left', false, false);
            setPanelOpen('right', false, false);

            rebindSubSystems();
            setBootStatus('Siap!');
        } catch (err) {
            console.error('Boot UI error:', err);
            setBootStatus('⚠ Gagal memuat UI: ' + (err && err.message ? err.message : String(err)));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootUi);
    } else {
        bootUi();
    }

    window.__vtfBootUi = bootUi;
})();
