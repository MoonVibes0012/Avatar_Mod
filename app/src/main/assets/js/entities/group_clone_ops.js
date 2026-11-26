/* ===== VTuber Forge — js/entities/group_clone_ops.js ===== */
// Operasi Duplicate & Group/Ungroup entitas pada scene (termasuk dukungan Skinned & Morph)

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

    function getObjectsList(st) {
        if (!st) return [];
        if (Array.isArray(st.objects)) return st.objects;
        st.objects = Array.isArray(st.objs) ? st.objs : [];
        return st.objects;
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

    function cloneMeshCacheSafe(rawCache) {
        if (!rawCache) return null;
        const list = Array.isArray(rawCache) ? rawCache : [rawCache];
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item || typeof item !== 'object') continue;
            const posSrc = item.pos || item.positions;
            if (!posSrc || !posSrc.length) continue;
            const idxSrc = item.idx || item.indices || [];
            const uvSrc = item.uvs || [];
            const nrmSrc = item.normals || [];
            out.push({
                pos: Array.from(posSrc),
                idx: Array.from(idxSrc),
                uvs: Array.from(uvSrc),
                normals: Array.from(nrmSrc)
            });
        }
        return out.length > 0 ? out : null;
    }

    function cloneEntityRecursive(src, stateObj, isRoot, nodeMap, pendingSkinBindings) {
        if (!src || typeof pc === 'undefined') return null;
        const idx = stateObj ? (stateObj.cnt++) : Math.floor(Math.random() * 10000);
        const copyName = isRoot ? ((src.name || 'Obj') + '_Copy_' + idx) : (src.name || ('Node_' + idx));
        const copy = new pc.Entity(copyName);

        if (nodeMap) nodeMap.set(src, copy);

        const pos = src.getLocalPosition();
        const rot = src.getLocalEulerAngles();
        const scl = src.getLocalScale();
        copy.setLocalPosition(isRoot ? (pos.x + 0.35) : pos.x, pos.y, pos.z);
        copy.setLocalEulerAngles(rot.x, rot.y, rot.z);
        copy.setLocalScale(scl.x, scl.y, scl.z);

        let firstClonedMorphInst = null;

        if (src.render && Array.isArray(src.render.meshInstances) && src.render.meshInstances.length > 0) {
            const clonedMis = src.render.meshInstances.map((mi) => {
                const mat = cloneMaterialSafe(mi.material);
                const newMi = new pc.MeshInstance(mi.mesh, mat);

                // Salin MorphInstance & weight aktif jika ada
                if (mi.morphInstance && mi.mesh && mi.mesh.morph && typeof pc.MorphInstance === 'function') {
                    try {
                        const newMorph = new pc.MorphInstance(mi.mesh.morph);
                        const targetCount = (mi.mesh.morph.targets && mi.mesh.morph.targets.length) || 0;
                        for (let t = 0; t < targetCount; t++) {
                            if (typeof mi.morphInstance.getWeight === 'function' && typeof newMorph.setWeight === 'function') {
                                newMorph.setWeight(t, mi.morphInstance.getWeight(t) || 0);
                            }
                        }
                        newMi.morphInstance = newMorph;
                        if (!firstClonedMorphInst) firstClonedMorphInst = newMorph;
                    } catch (e) {}
                }

                // Jadwalkan pengikatan ulang SkinInstance setelah seluruh hierarki bone selesai dikloning
                if (mi.skinInstance && mi.skinInstance.skin && pendingSkinBindings) {
                    pendingSkinBindings.push({
                        meshInstance: newMi,
                        srcSkinInstance: mi.skinInstance
                    });
                }

                return newMi;
            });
            copy.addComponent('render', { type: 'asset' });
            copy.render.meshInstances = clonedMis;
        }

        const clonedCache = cloneMeshCacheSafe(src._meshCache);
        if (clonedCache) {
            copy._meshCache = clonedCache;
            if (window.meshCachePool && typeof window.meshCachePool.set === 'function') {
                window.meshCachePool.set(copy.name, copy._meshCache);
            } else if (Array.isArray(window.meshCachePool)) {
                window.meshCachePool.push(clonedCache[0]);
            }
        }

        if (Array.isArray(src._morphNames) && src._morphNames.length > 0) {
            copy._morphNames = src._morphNames.slice();
        }
        if (firstClonedMorphInst) {
            copy._morphInstance = firstClonedMorphInst;
        }

        copy._isObj = !!src._isObj;
        copy._isGLB = !!src._isGLB;
        copy._animSpin = !!src._animSpin;
        copy._animPulse = !!src._animPulse;
        copy._animWobble = !!src._animWobble;

        const children = src.children || [];
        for (let i = 0; i < children.length; i++) {
            const childCopy = cloneEntityRecursive(children[i], stateObj, false, nodeMap, pendingSkinBindings);
            if (childCopy) copy.addChild(childCopy);
        }

        return copy;
    }

    function bindClonedSkins(nodeMap, pendingSkinBindings) {
        if (!Array.isArray(pendingSkinBindings) || pendingSkinBindings.length === 0) return;
        for (let i = 0; i < pendingSkinBindings.length; i++) {
            const item = pendingSkinBindings[i];
            const srcSi = item.srcSkinInstance;
            if (!srcSi || !srcSi.skin) continue;

            try {
                const newSi = new pc.SkinInstance(srcSi.skin);
                if (!newSi.skin) newSi.skin = srcSi.skin;
                const srcBones = Array.isArray(srcSi.bones) ? srcSi.bones : [];
                newSi.bones = srcBones.map((b) => (nodeMap && nodeMap.has(b)) ? nodeMap.get(b) : b);
                if (typeof newSi.updateMatrices === 'function') {
                    newSi.updateMatrices();
                }
                item.meshInstance.skinInstance = newSi;
            } catch (e) {
                console.warn('Gagal menyalin SkinInstance saat duplikasi:', e);
            }
        }
    }

    function duplicateSelected() {
        const st = getStateSafe();
        const pcApp = getAppSafe();
        if (!st || !st.selected || !pcApp || !pcApp.root) {
            setOpsStatus('⚠ Pilih objek dulu untuk diduplikasi.');
            return null;
        }

        const nodeMap = new Map();
        const pendingSkinBindings = [];
        const copy = cloneEntityRecursive(st.selected, st, true, nodeMap, pendingSkinBindings);
        if (!copy) return null;

        bindClonedSkins(nodeMap, pendingSkinBindings);

        const parent = st.selected.parent || pcApp.root;
        parent.addChild(copy);

        const objs = getObjectsList(st);
        objs.push(copy);

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

        const objs = getObjectsList(st);
        if (objs.indexOf(grp) === -1) {
            objs.push(grp);
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

        const objs = getObjectsList(st);
        if (grp !== pcApp.root) {
            const idx = objs.indexOf(grp);
            if (idx !== -1) objs.splice(idx, 1);
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
