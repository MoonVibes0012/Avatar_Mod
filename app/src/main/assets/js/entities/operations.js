/* ===== VTuber Forge — js/entities/operations.js ===== */
// Operasi New Scene & Delete entitas + pembersihan cache terkait

(function () {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function setOpsStatus(msg) {
        const el = byId('status');
        if (el) el.textContent = msg;
    }

    function getStateSafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    function getAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function commitHistorySafe() {
        if (typeof window.saveState === 'function') {
            try { window.saveState(); } catch (e) {}
            return;
        }
        try {
            if (typeof saveState === 'function') saveState();
        } catch (e) {}
    }

    function refreshSceneUiSafe(ent) {
        if (typeof window.selectObject === 'function') {
            try { window.selectObject(ent || null); } catch (e) {}
        } else {
            try { if (typeof selectObject === 'function') selectObject(ent || null); } catch (e) {}
        }
        if (typeof window.updateTree === 'function') {
            try { window.updateTree(); } catch (e) {}
        } else {
            try { if (typeof updateTree === 'function') updateTree(); } catch (e) {}
        }
        commitHistorySafe();
    }

    function cleanupEntityCaches(ent) {
        if (!ent) return;
        if (window.VrmPartExtractor && typeof window.VrmPartExtractor.disposeForEntity === 'function') {
            try { window.VrmPartExtractor.disposeForEntity(ent); } catch (e) {}
        }
        if (ent._meshCache && Array.isArray(window.meshCachePool)) {
            const poolIdx = window.meshCachePool.indexOf(ent._meshCache);
            if (poolIdx !== -1) window.meshCachePool.splice(poolIdx, 1);
        }
    }

    function removeFromSceneList(st, ent) {
        if (!st || !Array.isArray(st.objs)) return;
        const idx = st.objs.indexOf(ent);
        if (idx !== -1) st.objs.splice(idx, 1);
    }

    function deleteSelected() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !st.selected || !pcApp || !pcApp.root) {
            setOpsStatus('⚠ Tidak ada objek terpilih untuk dihapus.');
            return false;
        }

        const target = st.selected;
        if (target === pcApp.root) {
            setOpsStatus('⚠ Root scene tidak dapat dihapus.');
            return false;
        }

        const nextSelect = target.parent && target.parent !== pcApp.root
            ? target.parent
            : (Array.isArray(st.objs) && st.objs.length > 1
                ? st.objs.find((o) => o !== target) || null
                : null);

        cleanupEntityCaches(target);
        removeFromSceneList(st, target);

        if (target.parent) {
            try { target.parent.removeChild(target); } catch (e) {}
        }
        try { target.destroy(); } catch (e) {}

        st.selected = nextSelect;
        refreshSceneUiSafe(nextSelect);
        setOpsStatus('🗑 Objek dihapus');
        return true;
    }

    function newScene() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !pcApp || !pcApp.root) return;

        if (window.AnatomySelectionSphere && typeof window.AnatomySelectionSphere.setEnabled === 'function') {
            try { window.AnatomySelectionSphere.setEnabled(false); } catch (e) {}
        }
        if (window.AnatomyAnchorBoxes && typeof window.AnatomyAnchorBoxes.setEnabled === 'function') {
            try { window.AnatomyAnchorBoxes.setEnabled(false); } catch (e) {}
        }

        const list = Array.isArray(st.objs) ? st.objs.slice() : [];
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (!o || o === pcApp.root) continue;
            cleanupEntityCaches(o);
            if (o.parent) {
                try { o.parent.removeChild(o); } catch (e) {}
            }
            try { o.destroy(); } catch (e) {}
        }

        st.objs.length = 0;
        st.selected = null;
        st.cnt = 1;

        if (typeof window.clearUndoStack === 'function') {
            try { window.clearUndoStack(); } catch (e) {}
        }

        refreshSceneUiSafe(null);
        setOpsStatus('📄 Scene baru dibuat');
    }

    function bindCoreOpsButtons() {
        const newBtn = byId('btnNew');
        if (newBtn && newBtn.dataset.vtfOpsBound !== '1') {
            newBtn.dataset.vtfOpsBound = '1';
            newBtn.onclick = newScene;
        }
        const delBtn = byId('del');
        if (delBtn && delBtn.dataset.vtfOpsBound !== '1') {
            delBtn.dataset.vtfOpsBound = '1';
            delBtn.onclick = deleteSelected;
        }
        if (window.VtfGroupCloneOps && typeof window.VtfGroupCloneOps.bindButtons === 'function') {
            window.VtfGroupCloneOps.bindButtons();
        }
    }

    window.newScene = newScene;
    window.deleteSelected = deleteSelected;
    window.VtfSceneOps = {
        newScene: newScene,
        deleteSelected: deleteSelected,
        bindButtons: bindCoreOpsButtons
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindCoreOpsButtons);
    } else {
        bindCoreOpsButtons();
    }
})();
