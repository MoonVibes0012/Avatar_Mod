/* ===== VTuber Forge — js/ui/boot.js ===== */
// Boot UI helper: panel drawer tunggal (anti double-toggle), loading overlay, & cek aset offline

(function () {
    'use strict';

    const byId = (id) => document.getElementById(id);

    function resolvePanelId(el) {
        if (!el) return null;
        if (el.id === 'parts') return 'left';
        if (el.id === 'inspector') return 'right';
        const dp = el.getAttribute('data-panel');
        if (dp === 'left' || dp === 'right') return dp;
        return null;
    }

    function setPanel(id, open) {
        if (id !== 'left' && id !== 'right') return;
        const panel = byId(id);
        if (!panel) return;

        const nextOpen = !!open;
        if (nextOpen) {
            const otherId = id === 'left' ? 'right' : 'left';
            const otherPanel = byId(otherId);
            if (otherPanel) {
                otherPanel.classList.remove('mobile-open');
                otherPanel.setAttribute('aria-hidden', 'true');
            }
            const otherBtn = byId(otherId === 'left' ? 'parts' : 'inspector');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }

        panel.classList.toggle('mobile-open', nextOpen);
        panel.style.removeProperty('display');
        panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        if (nextOpen) {
            panel.scrollTop = 0;
        }

        const btn = byId(id === 'left' ? 'parts' : 'inspector');
        if (btn) btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');

        const backdrop = byId('panelBackdrop');
        const anyOpen = !!document.querySelector('.panel.mobile-open');
        if (backdrop) backdrop.hidden = !anyOpen;
    }

    function togglePanel(id) {
        if (id !== 'left' && id !== 'right') return;
        const panel = byId(id);
        const isOpen = !!(panel && panel.classList.contains('mobile-open'));
        setPanel(id, !isOpen);
    }

    window.__vtfSetPanel = setPanel;
    window.__vtfTogglePanel = togglePanel;

    if (!window.__vtfPanelDelegationBound) {
        window.__vtfPanelDelegationBound = true;

        document.addEventListener('click', function (e) {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;

            const closer = target.closest('.btn-close-panel');
            if (closer) {
                e.preventDefault();
                const panelId = closer.getAttribute('data-panel');
                if (panelId === 'left' || panelId === 'right') {
                    setPanel(panelId, false);
                }
                return;
            }

            if (target.id === 'panelBackdrop') {
                e.preventDefault();
                setPanel('left', false);
                setPanel('right', false);
                return;
            }

            const opener = target.closest('#parts, #inspector, [data-panel]');
            if (opener) {
                const resolvedId = resolvePanelId(opener);
                if (resolvedId) {
                    e.preventDefault();
                    togglePanel(resolvedId);
                }
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                setPanel('left', false);
                setPanel('right', false);
            }
        });
    }

    const loadSceneBtn = byId('loadSceneBtn');
    const jsonFileInp = byId('jsonFile');
    if (loadSceneBtn && jsonFileInp) {
        loadSceneBtn.addEventListener('click', function () {
            jsonFileInp.click();
        });
    }

    const dbgBtn = byId('btnDebug');
    if (dbgBtn) {
        dbgBtn.addEventListener('click', function () {
            if (typeof window.toggleDebug === 'function') {
                window.toggleDebug();
                return;
            }
            const ov = byId('debugOverlay');
            if (ov) ov.style.display = (ov.style.display === 'block' ? 'none' : 'block');
        });
    }

    const shot2 = byId('screenshot');
    const shot1 = byId('btnScreenshot');
    if (shot2 && shot1) {
        shot2.addEventListener('click', function () {
            shot1.click();
        });
    }

    const imp2 = byId('importMenu');
    const imp1 = byId('btnImport');
    if (imp2 && imp1) {
        imp2.addEventListener('click', function () {
            imp1.click();
        });
    }

    window.__vtfShowLoading = function (text) {
        const ov = byId('loadingOverlay');
        if (!ov) return;
        if (text) {
            const t = byId('loadingText');
            if (t) t.textContent = text;
        }
        ov.style.display = 'flex';
    };

    window.__vtfHideLoading = function () {
        const ov = byId('loadingOverlay');
        if (!ov) return;
        ov.style.display = 'none';
    };

    window.addEventListener('load', function () {
        const missing = [];
        if (typeof window.pc === 'undefined') missing.push('PlayCanvas (js/playcanvas.min.js)');
        if (typeof window.FaceMesh === 'undefined') missing.push('MediaPipe FaceMesh (js/face_mesh.js)');
        const hasKalidokit = (typeof window.Kalidokit !== 'undefined') || (typeof window.KalidoKit !== 'undefined');
        if (!hasKalidokit) missing.push('Kalidokit (js/kalidokit.umd.js)');

        if (typeof window.pc === 'undefined') {
            window.__vtfShowLoading('Gagal load aset lokal: ' + missing.join(', ') + '. Periksa folder assets/js/.');
            const st = byId('status');
            if (st) st.textContent = 'Gagal load ' + missing.join(', ') + ' — periksa aset lokal.';
        } else if (missing.length > 0) {
            const st = byId('status');
            if (st) st.textContent = 'Peringatan: aset opsional belum termuat (' + missing.join(', ') + ').';
        } else if (window.__vtfStyleFailed) {
            const st2 = byId('status');
            if (st2) st2.textContent = 'Peringatan: css/style.css gagal dimuat — periksa folder assets/css/style.css.';
        }
    });
})();
