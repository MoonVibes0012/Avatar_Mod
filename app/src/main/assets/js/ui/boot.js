/* ===== VTuber Forge — js/ui/boot.js ===== */
// Boot UI helper: panel drawer, overlay loading, dan pengecekan aset offline

(function () {
    'use strict';

    const byId = (id) => document.getElementById(id);

    function setPanel(id, open) {
        const panel = byId(id);
        if (!panel) return;
        panel.classList.toggle('mobile-open', !!open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');

        const btn = document.querySelector(
            '[data-panel="' + id + '"].top-btn, #' + (id === 'left' ? 'parts' : 'inspector')
        );
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');

        const backdrop = byId('panelBackdrop');
        const anyOpen = !!document.querySelector('.panel.mobile-open');
        if (backdrop) backdrop.hidden = !anyOpen;
    }

    window.__vtfSetPanel = setPanel;

    document.addEventListener('click', function (e) {
        const target = e.target;
        if (!target || typeof target.closest !== 'function') return;

        const opener = target.closest('[data-panel]');
        if (opener && (opener.id === 'parts' || opener.id === 'inspector')) {
            const id = opener.getAttribute('data-panel');
            const panel = byId(id);
            setPanel(id, panel ? !panel.classList.contains('mobile-open') : true);
            return;
        }

        const closer = target.closest('.btn-close-panel');
        if (closer) {
            setPanel(closer.getAttribute('data-panel'), false);
            return;
        }

        if (target.id === 'panelBackdrop') {
            setPanel('left', false);
            setPanel('right', false);
        }
    });

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
