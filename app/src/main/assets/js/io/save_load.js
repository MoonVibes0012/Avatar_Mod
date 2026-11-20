/* ===== VTuber Forge — js/io/save_load.js ===== */
// Save/Load scene JSON, Undo/Redo stack, dan Save Log

(function () {
    'use strict';

    function setSaveLoadStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function logSaveLoad(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getSaveLoadApp() {
        if (typeof window.getPcApp === 'function') {
            const pcApp = window.getPcApp();
            if (pcApp) return pcApp;
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    function getUndoStack() {
        if (!Array.isArray(window.undoStack)) window.undoStack = [];
        return window.undoStack;
    }

    function getRedoStack() {
        if (!Array.isArray(window.redoStack)) window.redoStack = [];
        return window.redoStack;
    }

    function hasAnySkinnedEntity() {
        if (!Array.isArray(S.objects)) return false;
        return S.objects.some(o => {
            if (!o || typeof o.findComponents !== 'function') return false;
            return o.findComponents('render').some(c =>
                c && Array.isArray(c.meshInstances) && c.meshInstances.some(mi => mi && mi.skinInstance != null)
            );
        });
    }
    window.hasAnySkinnedEntity = hasAnySkinnedEntity;

    function serializeScene(includeMeshData) {
        if (window.SceneSerializer && typeof window.SceneSerializer.serializeSceneSnapshot === 'function') {
            return window.SceneSerializer.serializeSceneSnapshot(S.objects, !!includeMeshData);
        }
        const safeVec3 = (v, fb) => {
            if (!v) return fb.slice();
            if (typeof v.toArray === 'function') return v.toArray();
            if (typeof v.x === 'number') return [v.x, v.y, v.z];
            return fb.slice();
        };
        const items = (S.objects || []).map(o => {
            if (!o || typeof o.getPosition !== 'function') return null;
            let mat = (o.render && o.render.material) ? o.render.material : null;
            if (Array.isArray(mat)) mat = mat[0];
            const hasTex = !!(mat && mat.diffuseMap);
            return {
                name: o.name || 'Obj',
                type: (o.render && o.render.type) || 'box',
                pos: safeVec3(o.getPosition(), [0, 0, 0]),
                rot: safeVec3(typeof o.getEulerAngles === 'function' ? o.getEulerAngles() : null, [0, 0, 0]),
                scale: safeVec3(typeof o.getLocalScale === 'function' ? o.getLocalScale() : null, [1, 1, 1]),
                color: hasTex ? [0.5, 0.5, 0.5] : (mat && mat.diffuse ? safeVec3(mat.diffuse, [0.5, 0.5, 0.5]) : [0.5, 0.5, 0.5]),
                hasTex: hasTex,
                rough: (mat && typeof mat.gloss === 'number') ? mat.gloss : 0.5,
                metal: (mat && typeof mat.metalness === 'number') ? mat.metalness : 0,
                meshDataArr: (includeMeshData && Array.isArray(o._meshCache)) ? o._meshCache : [],
                hasMeshCache: !!(Array.isArray(o._meshCache) && o._meshCache.length > 0),
                morphNames: Array.isArray(o._morphNames) ? o._morphNames.slice() : [],
                morphWeights: [],
                animSpin: !!o._animSpin,
                animPulse: !!o._animPulse,
                animWobble: !!o._animWobble,
                baseScale: o._baseScale ? safeVec3(o._baseScale, [1, 1, 1]) : null,
                baseRot: o._baseRot ? safeVec3(o._baseRot, [0, 0, 0]) : null
            };
        }).filter(Boolean);
        return JSON.stringify(items);
    }
    window.serializeScene = serializeScene;

    function applyMorphWeightsToEntity(entity, morphWeights) {
        if (!entity || !entity._morphInstance || !Array.isArray(morphWeights)) return;
        for (let i = 0; i < morphWeights.length; i++) {
            const rawW = Number(morphWeights[i]);
            if (!isFinite(rawW)) continue;
            const clampedW = Math.max(0, Math.min(1, rawW));
            try {
                if (typeof entity._morphInstance.setWeight === 'function') {
                    entity._morphInstance.setWeight(i, clampedW);
                }
            } catch (e) {}
        }
    }

    function loadState(stateStr, skipClearRedo) {
        const pcApp = getSaveLoadApp();
        if (!pcApp || !pcApp.root) return;

        let arr;
        try {
            if (window.SceneSerializer && typeof window.SceneSerializer.parseSceneSnapshot === 'function') {
                arr = window.SceneSerializer.parseSceneSnapshot(stateStr);
            } else {
                arr = JSON.parse(stateStr);
            }
        } catch (e) {
            logSaveLoad("Gagal parse state: " + e.message);
            return;
        }

        if (!Array.isArray(arr)) return;

        if (typeof selectObject === 'function') selectObject(null);
        if (typeof resetMode === 'function') resetMode();

        (S.objects || []).forEach(o => {
            if (typeof destroyEntity === 'function') destroyEntity(o);
            else if (o && typeof o.destroy === 'function') o.destroy();
        });
        S.objects = [];

        arr.forEach(item => {
            if (!item) return;
            const e = new pc.Entity(item.name || 'Obj');
            const p = Array.isArray(item.pos) ? item.pos : [0, 0, 0];
            const r = Array.isArray(item.rot) ? item.rot : [0, 0, 0];
            const s = Array.isArray(item.scale) ? item.scale : [1, 1, 1];
            e.setPosition(p[0] || 0, p[1] || 0, p[2] || 0);
            e.setEulerAngles(r[0] || 0, r[1] || 0, r[2] || 0);
            e.setLocalScale(s[0] || 1, s[1] || 1, s[2] || 1);

            const m = new pc.StandardMaterial();
            const c = Array.isArray(item.color) ? item.color : [0.5, 0.5, 0.5];
            m.diffuse = new pc.Color(c[0] || 0.5, c[1] || 0.5, c[2] || 0.5);
            m.gloss = (typeof item.rough === 'number') ? item.rough : 0.5;
            m.metalness = (typeof item.metal === 'number') ? item.metal : 0;
            if (typeof m.update === 'function') m.update();

            let cachedMeshData = null;
            if (Array.isArray(item.meshDataArr) && item.meshDataArr.length > 0) {
                cachedMeshData = item.meshDataArr;
            } else if (item.name && window.meshCachePool && window.meshCachePool.has(item.name)) {
                cachedMeshData = window.meshCachePool.get(item.name);
            }

            if (item.type === 'custom' && Array.isArray(cachedMeshData) && cachedMeshData.length > 0 && pcApp.graphicsDevice) {
                e.addComponent('render', { type: 'asset', castShadows: false });
                const mis = [];
                cachedMeshData.forEach(md => {
                    if (!md || !md.pos || !md.pos.length) return;
                    const mesh = new pc.Mesh(pcApp.graphicsDevice);
                    mesh.setPositions(new Float32Array(md.pos));
                    if (md.idx && md.idx.length) {
                        const maxIdx = md.idx.reduce((a, b) => Math.max(a, b), 0);
                        mesh.setIndices(maxIdx > 65535 ? new Uint32Array(md.idx) : new Uint16Array(md.idx));
                    }
                    if (md.uvs && md.uvs.length) mesh.setUvs(0, new Float32Array(md.uvs));
                    if (md.normals && md.normals.length) mesh.setNormals(new Float32Array(md.normals));
                    else if (typeof mesh.calculateNormals === 'function') mesh.calculateNormals();
                    mesh.update(pc.PRIMITIVE_TRIANGLES);

                    const mi = new pc.MeshInstance(mesh, m);
                    if (typeof pc.BoundingBox !== 'undefined') {
                        mi.aabb = pc.BoundingBox.fromMesh(mesh);
                    }
                    mis.push(mi);
                });
                e.render.meshInstances = mis;
                e._meshCache = cachedMeshData;
            } else {
                const primType = (item.type && item.type !== 'custom' && item.type !== 'asset') ? item.type : 'box';
                e.addComponent('render', { type: primType, castShadows: false });
                e.render.material = m;
            }

            if (Array.isArray(item.morphNames) && item.morphNames.length > 0) {
                e._morphNames = item.morphNames.slice();
            }
            if (Array.isArray(item.morphWeights) && item.morphWeights.length > 0) {
                applyMorphWeightsToEntity(e, item.morphWeights);
            }

            e._animSpin = !!item.animSpin;
            e._animPulse = !!item.animPulse;
            e._animWobble = !!item.animWobble;
            e._baseScale = Array.isArray(item.baseScale)
                ? new pc.Vec3(item.baseScale[0] || 1, item.baseScale[1] || 1, item.baseScale[2] || 1)
                : e.getLocalScale().clone();
            e._baseRot = Array.isArray(item.baseRot)
                ? new pc.Vec3(item.baseRot[0] || 0, item.baseRot[1] || 0, item.baseRot[2] || 0)
                : e.getEulerAngles().clone();

            pcApp.root.addChild(e);
            S.objects.push(e);
        });

        if (!skipClearRedo) {
            getRedoStack().length = 0;
        }
        if (typeof updateTree === 'function') updateTree();
        if (S.objects.length > 0 && typeof selectObject === 'function') {
            selectObject(S.objects[S.objects.length - 1]);
        }
    }
    window.loadState = loadState;

    function saveState() {
        const uStack = getUndoStack();
        const maxUndo = (typeof window.CONFIG !== 'undefined' && window.CONFIG && window.CONFIG.MAX_UNDO)
            ? window.CONFIG.MAX_UNDO
            : 20;
        try {
            const snap = serializeScene(true);
            uStack.push(snap);
            if (uStack.length > maxUndo) {
                uStack.splice(0, uStack.length - maxUndo);
            }
            getRedoStack().length = 0;
        } catch (e) {
            logSaveLoad("saveState warning: " + e.message);
        }
    }
    window.saveState = saveState;

    function triggerUndo() {
        const uStack = getUndoStack();
        const rStack = getRedoStack();
        if (uStack.length <= 1) {
            setSaveLoadStatus("Tidak ada yang bisa di-Undo.");
            return;
        }
        const current = uStack.pop();
        rStack.push(current);
        const prev = uStack[uStack.length - 1];
        loadState(prev, true);
        setSaveLoadStatus("↶ Undo berhasil.");
    }
    window.triggerUndo = triggerUndo;

    function triggerRedo() {
        const uStack = getUndoStack();
        const rStack = getRedoStack();
        if (rStack.length === 0) {
            setSaveLoadStatus("Tidak ada yang bisa di-Redo.");
            return;
        }
        const nextState = rStack.pop();
        uStack.push(nextState);
        loadState(nextState, true);
        setSaveLoadStatus("↷ Redo berhasil.");
    }
    window.triggerRedo = triggerRedo;

    function triggerSaveScene() {
        try {
            const jsonStr = serializeScene(true);
            const filename = `vtuber_scene_${Date.now()}.json`;
            if (typeof downloadNative === 'function') {
                downloadNative(filename, jsonStr);
            }
            setSaveLoadStatus("✓ Scene disimpan: " + filename);
        } catch (e) {
            logSaveLoad("Save scene error: " + e.message);
            alert("Gagal menyimpan scene: " + e.message);
        }
    }
    window.triggerSaveScene = triggerSaveScene;

    const saveBtn = document.getElementById('save');
    if (saveBtn) saveBtn.onclick = triggerSaveScene;

    const undoBtn = document.getElementById('undo');
    if (undoBtn) undoBtn.onclick = triggerUndo;

    const redoBtn = document.getElementById('redo');
    if (redoBtn) redoBtn.onclick = triggerRedo;

    const jsonFileInput = document.getElementById('jsonFile');
    if (jsonFileInput) {
        jsonFileInput.onchange = (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            e.target.value = '';

            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev && ev.target ? ev.target.result : '';
                if (typeof text === 'string' && text.trim()) {
                    loadState(text, false);
                    saveState();
                    setSaveLoadStatus("✓ Scene dimuat dari: " + file.name);
                }
            };
            reader.readAsText(file);
        };
    }

    const saveLogBtn = document.getElementById('saveLogBtn');
    if (saveLogBtn) {
        saveLogBtn.onclick = () => {
            const logs = Array.isArray(window.allLogs) ? window.allLogs : [];
            const content = logs.length > 0
                ? logs.join('\n')
                : ("VTuber Forge Log — " + new Date().toISOString() + "\n(Kosong)");
            const filename = `vtuber_debug_${Date.now()}.log`;
            if (typeof downloadNative === 'function') {
                downloadNative(filename, content);
            }
        };
    }

    logSaveLoad("✅ save_load.js loaded");
})();
