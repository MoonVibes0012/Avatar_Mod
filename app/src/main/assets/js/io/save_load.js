/* ===== VTuber Forge — js/io/save_load.js ===== */
// Scene Save/Load JSON, Undo/Redo, New Scene, dan Debug Log download

(function () {
    'use strict';

    if (window.__vtfSaveLoadLoaded) return;
    window.__vtfSaveLoadLoaded = true;

    const meshCachePool = window.meshCachePool instanceof Map ? window.meshCachePool : new Map();
    window.meshCachePool = meshCachePool;

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

    function showSaveLoadLoading(show, text) {
        const ov = document.getElementById('loadingOverlay');
        const txt = document.getElementById('loadingText');
        if (txt && text) txt.textContent = text;
        if (ov) ov.style.display = show ? 'flex' : 'none';
    }

    function captureEntityMeshCache(entity) {
        if (!entity || typeof entity.findComponents !== 'function') return [];
        const renderComps = entity.findComponents('render');
        if (!Array.isArray(renderComps)) return [];

        const dataArr = [];
        renderComps.forEach(comp => {
            if (!comp || !Array.isArray(comp.meshInstances)) return;
            comp.meshInstances.forEach(mi => {
                if (!mi || !mi.mesh || mi.skinInstance != null) return;
                const pos = mi.mesh.getPositions ? mi.mesh.getPositions() : null;
                const idx = mi.mesh.getIndices ? mi.mesh.getIndices() : null;
                const norms = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
                const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;
                if (pos && idx && pos.length > 0 && idx.length > 0) {
                    dataArr.push({
                        pos: Array.from(pos),
                        idx: Array.from(idx),
                        normals: norms ? Array.from(norms) : null,
                        uvs: uvs ? Array.from(uvs) : null
                    });
                }
            });
        });
        return dataArr;
    }

    function ensureMeshCacheForEntities(objects) {
        const list = Array.isArray(objects) ? objects : [];
        list.forEach(obj => {
            if (!obj) return;
            if (!Array.isArray(obj._meshCache) || obj._meshCache.length === 0) {
                const captured = captureEntityMeshCache(obj);
                if (captured.length > 0) {
                    obj._meshCache = captured;
                }
            }
            if (Array.isArray(obj._meshCache) && obj._meshCache.length > 0 && obj.name) {
                meshCachePool.set(obj.name, obj._meshCache);
            }
        });
    }

    function serializeScene(includeMeshData = true) {
        const objs = (typeof S !== 'undefined' && S && Array.isArray(S.objects)) ? S.objects : [];
        ensureMeshCacheForEntities(objs);

        if (window.SceneSerializer && typeof window.SceneSerializer.serializeSceneSnapshot === 'function') {
            return window.SceneSerializer.serializeSceneSnapshot(objs, includeMeshData);
        }

        const data = [];
        objs.forEach(obj => {
            if (!obj) return;
            let meshDataArr = [];
            if (includeMeshData && Array.isArray(obj._meshCache) && obj._meshCache.length > 0) {
                meshDataArr = obj._meshCache;
            }

            let mat = (obj.render && obj.render.material) ? obj.render.material : null;
            if (Array.isArray(mat)) mat = mat[0];

            const hasTex = !!(mat && mat.diffuseMap !== null && mat.diffuseMap !== undefined);
            const colorArr = hasTex
                ? [0.5, 0.5, 0.5]
                : ((mat && mat.diffuse && typeof mat.diffuse.toArray === 'function') ? mat.diffuse.toArray() : [0.5, 0.5, 0.5]);

            let objType = (obj.render && obj.render.type) ? obj.render.type : 'box';
            if (meshDataArr.length > 0) objType = 'custom';

            const pos = obj.getPosition();
            const rot = obj.getEulerAngles();
            const scale = obj.getLocalScale();

            data.push({
                name: obj.name || 'Obj',
                type: objType,
                pos: pos ? [pos.x, pos.y, pos.z] : [0, 0, 0],
                rot: rot ? [rot.x, rot.y, rot.z] : [0, 0, 0],
                scale: scale ? [scale.x, scale.y, scale.z] : [1, 1, 1],
                color: colorArr,
                hasTex: hasTex,
                rough: (mat && typeof mat.gloss === 'number') ? mat.gloss : 0.5,
                metal: (mat && typeof mat.metalness === 'number') ? mat.metalness : 0,
                meshDataArr: meshDataArr,
                hasMeshCache: !!(Array.isArray(obj._meshCache) && obj._meshCache.length > 0),
                animSpin: !!(obj._animSpin),
                animPulse: !!(obj._animPulse),
                animWobble: !!(obj._animWobble),
                baseScale: obj._baseScale ? [obj._baseScale.x, obj._baseScale.y, obj._baseScale.z] : null,
                baseRot: obj._baseRot ? [obj._baseRot.x, obj._baseRot.y, obj._baseRot.z] : null
            });
        });

        return JSON.stringify(data);
    }

    function saveState() {
        try {
            const objs = (typeof S !== 'undefined' && S && Array.isArray(S.objects)) ? S.objects : [];
            ensureMeshCacheForEntities(objs);
            const state = serializeScene(false);
            if (typeof undoStack !== 'undefined' && Array.isArray(undoStack)) {
                undoStack.push(state);
                const maxUndo = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.MAX_UNDO) ? CONFIG.MAX_UNDO : 30;
                if (undoStack.length > maxUndo) {
                    undoStack.shift();
                }
            }
            if (typeof redoStack !== 'undefined') {
                redoStack = [];
            }
        } catch (e) {
            logSaveLoad("Save state error: " + e.message);
        }
    }
    window.saveState = saveState;

    function loadState(stateStr, skipSaveState = false) {
        try {
            const data = (window.SceneSerializer && typeof window.SceneSerializer.parseSceneSnapshot === 'function')
                ? window.SceneSerializer.parseSceneSnapshot(stateStr)
                : JSON.parse(stateStr);

            if (!Array.isArray(data)) {
                throw new Error("Format state tidak valid.");
            }

            const toRemove = S.objects.slice();
            if (typeof selectObject === 'function') selectObject(null);
            S.objects = [];
            toRemove.forEach(o => {
                if (!o) return;
                if (typeof destroyEntity === 'function') {
                    destroyEntity(o);
                } else {
                    try {
                        o.enabled = false;
                        if (o.parent) o.parent.removeChild(o);
                        if (typeof o.destroy === 'function') o.destroy();
                    } catch (err) {}
                }
            });

            data.forEach(d => {
                if (!d) return;
                const e = new pc.Entity(d.name || 'Obj');
                let meshDataArr = Array.isArray(d.meshDataArr) ? d.meshDataArr : [];

                if (meshDataArr.length === 0 && d.name && meshCachePool.has(d.name)) {
                    meshDataArr = meshCachePool.get(d.name);
                }

                if (meshDataArr.length > 0) {
                    e.addComponent('render', { type: 'asset', castShadows: false });
                    const mis = [];
                    meshDataArr.forEach(mData => {
                        if (!mData || !Array.isArray(mData.pos) || !Array.isArray(mData.idx)) return;
                        const mesh = new pc.Mesh(app.graphicsDevice);
                        const posArr = new Float32Array(mData.pos);
                        const idxArr = mData.idx.some(v => v > 65535)
                            ? new Uint32Array(mData.idx)
                            : new Uint16Array(mData.idx);
                        mesh.setPositions(posArr);
                        mesh.setIndices(idxArr);
                        if (Array.isArray(mData.normals) && mData.normals.length > 0) {
                            mesh.setNormals(new Float32Array(mData.normals));
                        } else if (typeof mesh.calculateNormals === 'function') {
                            mesh.calculateNormals();
                        }
                        if (Array.isArray(mData.uvs) && mData.uvs.length > 0) {
                            mesh.setUvs(0, new Float32Array(mData.uvs));
                        }
                        mesh.update(pc.PRIMITIVE_TRIANGLES);

                        const mat = new pc.StandardMaterial();
                        const col = Array.isArray(d.color) ? d.color : [0.5, 0.5, 0.5];
                        mat.diffuse = new pc.Color(col[0] ?? 0.5, col[1] ?? 0.5, col[2] ?? 0.5);
                        if (typeof d.rough === 'number') mat.gloss = d.rough;
                        if (typeof d.metal === 'number') mat.metalness = d.metal;
                        if (typeof mat.update === 'function') mat.update();

                        const mi = new pc.MeshInstance(mesh, mat);
                        if (typeof pc.BoundingBox !== 'undefined') {
                            mi.aabb = pc.BoundingBox.fromMesh(mesh);
                        }
                        mis.push(mi);
                    });
                    if (mis.length > 0) {
                        e.render.meshInstances = mis;
                    } else {
                        e.render.type = 'box';
                    }
                    e._meshCache = meshDataArr;
                    if (e.name) meshCachePool.set(e.name, meshDataArr);
                } else {
                    const renderType = (d.type && d.type !== 'custom') ? d.type : 'box';
                    e.addComponent('render', { type: renderType, castShadows: false });
                    const m = new pc.StandardMaterial();
                    const col = Array.isArray(d.color) ? d.color : [0.5, 0.5, 0.5];
                    m.diffuse = new pc.Color(col[0] ?? 0.5, col[1] ?? 0.5, col[2] ?? 0.5);
                    if (typeof d.rough === 'number') m.gloss = d.rough;
                    if (typeof d.metal === 'number') m.metalness = d.metal;
                    if (typeof m.update === 'function') m.update();
                    e.render.material = m;
                }

                if (Array.isArray(d.pos) && d.pos.length >= 3) {
                    e.setPosition(Number(d.pos[0]) || 0, Number(d.pos[1]) || 0, Number(d.pos[2]) || 0);
                }
                if (Array.isArray(d.rot) && d.rot.length >= 3) {
                    e.setEulerAngles(Number(d.rot[0]) || 0, Number(d.rot[1]) || 0, Number(d.rot[2]) || 0);
                }
                if (Array.isArray(d.scale) && d.scale.length >= 3) {
                    e.setLocalScale(Number(d.scale[0]) || 1, Number(d.scale[1]) || 1, Number(d.scale[2]) || 1);
                }

                e._animSpin = !!d.animSpin;
                e._animPulse = !!d.animPulse;
                e._animWobble = !!d.animWobble;
                e._baseScale = Array.isArray(d.baseScale) && d.baseScale.length >= 3
                    ? new pc.Vec3(Number(d.baseScale[0]) || 1, Number(d.baseScale[1]) || 1, Number(d.baseScale[2]) || 1)
                    : e.getLocalScale().clone();
                e._baseRot = Array.isArray(d.baseRot) && d.baseRot.length >= 3
                    ? new pc.Vec3(Number(d.baseRot[0]) || 0, Number(d.baseRot[1]) || 0, Number(d.baseRot[2]) || 0)
                    : e.getEulerAngles().clone();

                app.root.addChild(e);
                S.objects.push(e);
            });

            if (typeof updateTree === 'function') updateTree();
            if (S.objects.length > 0 && typeof selectObject === 'function') {
                selectObject(S.objects[0]);
            }
            if (typeof window.syncMotionButtons === 'function') {
                window.syncMotionButtons(S.selected);
            }

            if (!skipSaveState) {
                saveState();
            }
        } catch (e) {
            logSaveLoad("Load state error: " + e.message);
            alert("Gagal load state: " + e.message);
        }
    }
    window.loadState = loadState;

    function triggerUndo() {
        if (typeof undoStack === 'undefined' || !Array.isArray(undoStack) || undoStack.length <= 1) {
            setSaveLoadStatus("Tidak ada lagi yang bisa di-Undo");
            return;
        }
        const current = undoStack.pop();
        if (typeof redoStack !== 'undefined' && Array.isArray(redoStack)) {
            redoStack.push(current);
        }
        const prev = undoStack[undoStack.length - 1];
        loadState(prev, true);
        setSaveLoadStatus("↶ Undo");
    }
    window.triggerUndo = triggerUndo;

    function triggerRedo() {
        if (typeof redoStack === 'undefined' || !Array.isArray(redoStack) || redoStack.length === 0) {
            setSaveLoadStatus("Tidak ada lagi yang bisa di-Redo");
            return;
        }
        const next = redoStack.pop();
        if (typeof undoStack !== 'undefined' && Array.isArray(undoStack)) {
            undoStack.push(next);
        }
        loadState(next, true);
        setSaveLoadStatus("↷ Redo");
    }
    window.triggerRedo = triggerRedo;

    function triggerSaveScene() {
        try {
            showSaveLoadLoading(true, "Menyimpan scene...");
            setTimeout(() => {
                try {
                    const jsonStr = serializeScene(true);
                    const fileName = 'vtuber_scene_' + Date.now() + '.json';

                    if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
                        const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
                        window.AndroidBridge.downloadFile(fileName, base64, 'application/json');
                    } else {
                        const blob = new Blob([jsonStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                    showSaveLoadLoading(false);
                    setSaveLoadStatus("💾 Scene disimpan: " + fileName);
                } catch (err) {
                    showSaveLoadLoading(false);
                    alert("Gagal menyimpan scene: " + err.message);
                }
            }, 50);
        } catch (e) {
            showSaveLoadLoading(false);
            alert("Gagal menyimpan scene: " + e.message);
        }
    }
    window.triggerSaveScene = triggerSaveScene;

    function triggerNewScene() {
        if (!confirm("Mulai scene baru? Semua objek saat ini akan dihapus.")) return;

        if (typeof window.stopFaceTracking === 'function') {
            try { window.stopFaceTracking(); } catch (e) {}
        }

        const toRemove = S.objects.slice();
        if (typeof selectObject === 'function') selectObject(null);
        S.objects = [];
        toRemove.forEach(o => {
            if (!o) return;
            if (typeof destroyEntity === 'function') {
                destroyEntity(o);
            } else {
                try {
                    o.enabled = false;
                    if (o.parent) o.parent.removeChild(o);
                    if (typeof o.destroy === 'function') o.destroy();
                } catch (err) {}
            }
        });

        if (typeof undoStack !== 'undefined') undoStack = [];
        if (typeof redoStack !== 'undefined') redoStack = [];
        meshCachePool.clear();
        if (typeof updateTree === 'function') updateTree();
        saveState();
        setSaveLoadStatus("✨ Scene baru siap");
    }
    window.triggerNewScene = triggerNewScene;

    function bindSaveLoadControls() {
        const jsonInp = document.getElementById('jsonFile');
        if (jsonInp && !jsonInp.dataset.saveLoadBound) {
            jsonInp.dataset.saveLoadBound = '1';
            jsonInp.onchange = (e) => {
                const file = e.target && e.target.files ? e.target.files[0] : null;
                if (!file) return;

                showSaveLoadLoading(true, "Memuat scene...");
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const content = ev.target ? ev.target.result : '';
                        if (typeof content !== 'string' || !content.trim()) {
                            throw new Error("File JSON kosong.");
                        }
                        loadState(content, false);
                        showSaveLoadLoading(false);
                        setSaveLoadStatus("✓ Scene dimuat: " + file.name);
                    } catch (err) {
                        showSaveLoadLoading(false);
                        alert("Gagal memuat scene JSON: " + err.message);
                    }
                    jsonInp.value = '';
                };
                reader.onerror = () => {
                    showSaveLoadLoading(false);
                    alert("Gagal membaca file JSON.");
                    jsonInp.value = '';
                };
                reader.readAsText(file);
            };
        }

        const newBtn = document.getElementById('btnNew');
        if (newBtn && !newBtn.dataset.saveLoadBound) {
            newBtn.dataset.saveLoadBound = '1';
            newBtn.onclick = triggerNewScene;
        }

        const logBtn = document.getElementById('saveLogBtn');
        if (logBtn && !logBtn.dataset.saveLoadBound) {
            logBtn.dataset.saveLoadBound = '1';
            logBtn.onclick = () => {
                try {
                    const logText = Array.isArray(window.allLogs) ? window.allLogs.join('\n') : '';
                    const fileName = 'vtuber_debug_' + Date.now() + '.log';
                    if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
                        const base64 = btoa(unescape(encodeURIComponent(logText)));
                        window.AndroidBridge.downloadFile(fileName, base64, 'text/plain');
                    } else {
                        const blob = new Blob([logText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                    setSaveLoadStatus("📄 Debug log disimpan: " + fileName);
                } catch (e) {
                    alert("Gagal menyimpan log: " + e.message);
                }
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindSaveLoadControls);
    } else {
        bindSaveLoadControls();
    }

    logSaveLoad("✅ save_load.js loaded");
})();
