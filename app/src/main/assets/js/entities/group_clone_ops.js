/* ===== VTuber Forge — js/entities/group_clone_ops.js ===== */
// Operasi Duplicate & Group/Ungroup entitas pada scene

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

    function cloneMaterialSafe(srcMat) {
        if (!srcMat || typeof pc === 'undefined' || !pc.StandardMaterial) return srcMat;
        try {
            const m = new pc.StandardMaterial();
            if (srcMat.diffuse) m.diffuse = srcMat.diffuse.clone();
            if (srcMat.emissive) m.emissive = srcMat.emissive.clone();
            if (srcMat.diffuseMap) m.diffuseMap = srcMat.diffuseMap;
            if (srcMat.normalMap) m.normalMap = srcMat.normalMap;
            if (srcMat.emissiveMap) m.emissiveMap = srcMat.emissiveMap;
            if (srcMat.metalness !== undefined) m.metalness = srcMat.metalness;
            if (srcMat.gloss !== undefined) m.gloss = srcMat.gloss;
            if (srcMat.opacity !== undefined) m.opacity = srcMat.opacity;
            if (srcMat.blendType !== undefined) m.blendType = srcMat.blendType;
            if (srcMat.alphaTest !== undefined) m.alphaTest = srcMat.alphaTest;
            if (srcMat.twoSidedLighting !== undefined) m.twoSidedLighting = srcMat.twoSidedLighting;
            if (srcMat.cull !== undefined) m.cull = srcMat.cull;
            if (typeof m.update === 'function') m.update();
            return m;
        } catch (e) {
            return srcMat;
        }
    }

    function cloneEntityRecursive(src, stateObj) {
        if (!src || typeof pc === 'undefined') return null;
        const idx = stateObj ? (stateObj.cnt++) : Math.floor(Math.random() * 10000);
        const copy = new pc.Entity((src.name || 'Obj') + '_Copy_' + idx);

        const pos = src.getLocalPosition();
        const rot = src.getLocalEulerAngles();
        const scl = src.getLocalScale();
        copy.setLocalPosition(pos.x + 0.35, pos.y, pos.z);
        copy.setLocalEulerAngles(rot.x, rot.y, rot.z);
        copy.setLocalScale(scl.x, scl.y, scl.z);

        if (src.render && Array.isArray(src.render.meshInstances) && src.render.meshInstances.length > 0) {
            const clonedMis = src.render.meshInstances.map((mi) => {
                const mat = cloneMaterialSafe(mi.material);
                return new pc.MeshInstance(mi.mesh, mat);
            });
            copy.addComponent('render', { type: 'asset' });
            copy.render.meshInstances = clonedMis;
        }

        if (src._meshCache) {
            copy._meshCache = {
                positions: Array.isArray(src._meshCache.positions) ? src._meshCache.positions.slice() : [],
                indices: Array.isArray(src._meshCache.indices) ? src._meshCache.indices.slice() : [],
                uvs: Array.isArray(src._meshCache.uvs) ? src._meshCache.uvs.slice() : [],
                normals: Array.isArray(src._meshCache.normals) ? src._meshCache.normals.slice() : []
            };
            if (Array.isArray(window.meshCachePool)) {
                window.meshCachePool.push(copy._meshCache);
            }
        }
        copy._isObj = !!src._isObj;
        copy._isGLB = !!src._isGLB;
        copy._animSpin = !!src._animSpin;
        copy._animPulse = !!src._animPulse;
        copy._animWobble = !!src._animWobble;

        const children = src.children || [];
        for (let i = 0; i < children.length; i++) {
            const childCopy = cloneEntityRecursive(children[i], stateObj);
            if (childCopy) copy.addChild(childCopy);
        }

        return copy;
    }

    function duplicateSelected() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !st.selected || !pcApp || !pcApp.root) {
            setOpsStatus('⚠ Pilih objek dulu untuk diduplikasi.');
            return null;
        }

        const copy = cloneEntityRecursive(st.selected, st);
        if (!copy) return null;

        const parent = st.selected.parent || pcApp.root;
        parent.addChild(copy);
        if (Array.isArray(st.objs)) {
            st.objs.push(copy);
        }

        refreshSceneUiSafe(copy);
        setOpsStatus('✓ Diduplikasi: ' + (copy.name || 'Objek'));
        return copy;
    }

    function groupSelected() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !st.selected || !pcApp || !pcApp.root || typeof pc === 'undefined') {
            setOpsStatus('⚠ Pilih objek dulu untuk dibuat grup.');
            return null;
        }

        const target = st.selected;
        const grp = new pc.Entity('Group_' + (st.cnt++));
        const wPos = target.getPosition();
        grp.setPosition(wPos.x, wPos.y, wPos.z);

        const origParent = target.parent || pcApp.root;
        origParent.addChild(grp);
        origParent.removeChild(target);
        grp.addChild(target);
        target.setLocalPosition(0, 0, 0);

        if (Array.isArray(st.objs) && st.objs.indexOf(grp) === -1) {
            st.objs.push(grp);
        }

        refreshSceneUiSafe(grp);
        setOpsStatus('✓ Grup dibuat: ' + grp.name);
        return grp;
    }

    function ungroupSelected() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !st.selected || !pcApp || !pcApp.root) {
            setOpsStatus('⚠ Pilih grup dulu untuk di-ungroup.');
            return false;
        }

        const grp = st.selected;
        const children = (grp.children || []).slice();
        if (!children.length) {
            setOpsStatus('⚠ Objek terpilih tidak memiliki anak untuk di-ungroup.');
            return false;
        }

        const targetParent = grp.parent || pcApp.root;
        let firstChild = null;

        for (let i = 0; i < children.length; i++) {
            const ch = children[i];
            const chWorldPos = ch.getPosition();
            const chWorldRot = ch.getEulerAngles();
            grp.removeChild(ch);
            targetParent.addChild(ch);
            ch.setPosition(chWorldPos.x, chWorldPos.y, chWorldPos.z);
            ch.setEulerAngles(chWorldRot.x, chWorldRot.y, chWorldRot.z);
            if (!firstChild) firstChild = ch;
        }

        if (grp !== pcApp.root && Array.isArray(st.objs)) {
            const idx = st.objs.indexOf(grp);
            if (idx !== -1) st.objs.splice(idx, 1);
            if (grp.parent) grp.parent.removeChild(grp);
            try { grp.destroy(); } catch (e) {}
        }

        refreshSceneUiSafe(firstChild);
        setOpsStatus('✓ Ungroup selesai');
        return true;
    }

    function bindGroupCloneButtons() {
        const dupBtn = byId('dup');
        if (dupBtn && dupBtn.dataset.vtfOpsBound !== '1') {
            dupBtn.dataset.vtfOpsBound = '1';
            dupBtn.onclick = duplicateSelected;
        }
        const grpBtn = byId('grp');
        if (grpBtn && grpBtn.dataset.vtfOpsBound !== '1') {
            grpBtn.dataset.vtfOpsBound = '1';
            grpBtn.onclick = groupSelected;
        }
        const ungrpBtn = byId('ungrp');
        if (ungrpBtn && ungrpBtn.dataset.vtfOpsBound !== '1') {
            ungrpBtn.dataset.vtfOpsBound = '1';
            ungrpBtn.onclick = ungroupSelected;
        }
    }

    window.duplicateSelected = duplicateSelected;
    window.groupSelected = groupSelected;
    window.ungroupSelected = ungroupSelected;
    window.VtfGroupCloneOps = {
        duplicateSelected: duplicateSelected,
        groupSelected: groupSelected,
        ungroupSelected: ungroupSelected,
        bindButtons: bindGroupCloneButtons
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindGroupCloneButtons);
    } else {
        bindGroupCloneButtons();
    }
})();
