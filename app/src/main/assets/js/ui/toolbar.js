/* ===== VTuber Forge — js/ui/toolbar.js ===== */
// Toolbar shortcuts, keyboard undo/redo, & panel drawer helpers

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setToolbarStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function logToolbar(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function bindOnce(el, handler) {
        if (!el || el.dataset.vtfToolbarBound === '1') return;
        el.dataset.vtfToolbarBound = '1';
        el.onclick = handler;
    }

    function bindToolbarControls() {
        bindOnce(byId('btnUndo'), () => {
            if (typeof triggerUndo === 'function') triggerUndo();
            else if (byId('undo')) byId('undo').click();
        });
        bindOnce(byId('btnRedo'), () => {
            if (typeof triggerRedo === 'function') triggerRedo();
            else if (byId('redo')) byId('redo').click();
        });
        bindOnce(byId('btnSave'), () => {
            if (typeof triggerSaveScene === 'function') triggerSaveScene();
            else if (byId('save')) byId('save').click();
        });
        bindOnce(byId('btnImport'), () => {
            const f = byId('file');
            if (f) f.click();
        });
        bindOnce(byId('btnScreenshot'), () => {
            if (typeof takeScreenshot === 'function') takeScreenshot();
            else if (byId('screenshot')) byId('screenshot').click();
        });

        bindOnce(byId('importMenu'), () => {
            const f = byId('file');
            if (f) f.click();
        });
        bindOnce(byId('loadSceneBtn'), () => {
            const jf = byId('jsonFile');
            if (jf) jf.click();
        });
        bindOnce(byId('x-obj'), () => {
            if (typeof window.exportOBJ === 'function') window.exportOBJ();
            else setToolbarStatus('⚠ Fungsi exportOBJ belum siap.');
        });
        bindOnce(byId('x-vrm'), () => {
            if (typeof exportVRM === 'function') exportVRM();
            else setToolbarStatus('⚠ Fungsi exportVRM tidak ditemukan.');
        });

        if (typeof window.__vtfBindMotionControls === 'function') {
            window.__vtfBindMotionControls();
        }
    }

    window.__vtfBindToolbarControls = bindToolbarControls;

    logToolbar('=== ENV: innerWidth=' + window.innerWidth + ' innerHeight=' + window.innerHeight + ' dpr=' + (window.devicePixelRatio || 1));

    if (!window.__vtfKeyboardBound) {
        window.__vtfKeyboardBound = true;
        window.addEventListener('keydown', (e) => {
            if (!e.target || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.repeat) return;
            if (e.key === 'z' || e.key === 'Z') {
                if (e.ctrlKey || e.metaKey) e.preventDefault();
                if (typeof triggerUndo === 'function') triggerUndo();
            } else if (e.key === 'y' || e.key === 'Y') {
                if (e.ctrlKey || e.metaKey) e.preventDefault();
                if (typeof triggerRedo === 'function') triggerRedo();
            }
        });
    }

    function closeSidePanel(panelId) {
        if (typeof window.__vtfSetPanel === 'function') {
            window.__vtfSetPanel(panelId, false);
            return;
        }
        const panel = byId(panelId);
        if (!panel) return;
        panel.classList.remove('mobile-open');
        panel.style.removeProperty('display');
    }
    window.closeSidePanel = closeSidePanel;

    function toggleSidePanel(panelId) {
        if (typeof window.__vtfTogglePanel === 'function') {
            window.__vtfTogglePanel(panelId);
            return;
        }
        const panel = byId(panelId);
        if (!panel) return;
        const isOpen = panel.classList.contains('mobile-open');
        const otherId = panelId === 'left' ? 'right' : 'left';
        closeSidePanel(otherId);
        if (isOpen) {
            closeSidePanel(panelId);
        } else {
            panel.style.removeProperty('display');
            panel.classList.add('mobile-open');
            panel.scrollTop = 0;
        }
    }
    window.toggleSidePanel = toggleSidePanel;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToolbarControls);
    } else {
        bindToolbarControls();
    }

    logToolbar('=== toolbar.js DONE ===');
})();
