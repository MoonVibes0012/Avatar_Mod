/* ===== VTuber Forge — js/io/save_load.js ===== */
// Serialize scene, Save/Load JSON, Undo/Redo logic

const meshCachePool = new Map(); // name -> _meshCache

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

function hasAnySkinnedEntity() {
    return (S.objects || []).some(o => {
        const render = o && typeof o.findComponent === 'function' ? o.findComponent('render') : null;
        if (!render || !render.meshInstances) return false;
        return render.meshInstances.some(mi => mi && mi.skinInstance != null);
    });
}
window.hasAnySkinnedEntity = hasAnySkinnedEntity;

function stateHasSkeleton(stateStr) {
    try {
        const parsed = JSON.parse(stateStr);
        return Array.isArray(parsed) && parsed.some(d => d && d.hasSkeleton === true);
    } catch (e) {
        return false;
    }
}

function serializeScene(includeMeshData = true) {
    return JSON.stringify((S.objects || []).map(o => {
        try {
            if (!o || !o.getPosition) return null;
            let meshDataArr = [];
            if (includeMeshData && Array.isArray(o._meshCache) && o._meshCache.length > 0) {
                meshDataArr = o._meshCache;
            }

            const safeVec = (v, def) => {
                if (!v) return def;
                if (typeof v.toArray === 'function') return v.toArray();
                if (Array.isArray(v) && v.length >= 3) return v.slice(0, 3);
                if (typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') return [v.x, v.y, v.z];
                return def;
            };

            let _mat = o.render ? o.render.material : null;
            if (Array.isArray(_mat)) _mat = _mat[0];
            const _hasTex = !!(_mat && _mat.diffuseMap !== null && _mat.diffuseMap !== undefined);
            const _col = _hasTex
                ? [0.5, 0.5, 0.5]
                : ((_mat && _mat.diffuse && typeof _mat.diffuse.toArray === 'function') ? _mat.diffuse.toArray() : [0.5, 0.5, 0.5]);

            let objType = (o.render && o.render.type) ? o.render.type : 'box';
            if (meshDataArr.length > 0) objType = 'custom';

            const renderComps = typeof o.findComponents === 'function' ? o.findComponents('render') : [];
            const hasSkeleton = renderComps.some(r =>
                r && r.meshInstances && r.meshInstances.some(mi => mi && mi.skinInstance != null)
            );

            return {
                name: o.name || 'Obj',
                type: objType,
                pos: safeVec(o.getPosition(), [0, 0, 0]),
                rot: safeVec(o.getEulerAngles ? o.getEulerAngles() : null, [0, 0, 0]),
                scale: safeVec(o.getLocalScale ? o.getLocalScale() : null, [1, 1, 1]),
                color: _col,
                hasTex: _hasTex,
                hasSkeleton: hasSkeleton,
                rough: (_mat && typeof _mat.gloss === 'number') ? _mat.gloss : 0.5,
                metal: (_mat && typeof _mat.metalness === 'number') ? _mat.metalness : 0,
                meshDataArr: meshDataArr,
                hasMeshCache: !!(Array.isArray(o._meshCache) && o._meshCache.length > 0),
                animSpin: !!(o._animSpin),
                animPulse: !!(o._animPulse),
                animWobble: !!(o._animWobble),
                baseScale: safeVec(o._baseScale, null),
                baseRot: safeVec(o._baseRot, null)
            };
        } catch (err) {
            logSaveLoad("WARNING: Gagal serialize objek " + ((o && o.name) || '?') + " - " + err.message);
            return null;
        }
    }).filter(x => x !== null));
}
window.serializeScene = serializeScene;

function saveState() {
    const state = serializeScene(false);
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === state) return;
    undoStack.push(state);
    if (undoStack.length > CONFIG.MAX_UNDO) undoStack.shift();
    redoStack = [];
}
window.saveState = saveState;

function buildMeshFromData(meshData, col, rough, metal) {
    const mesh = new pc.Mesh(app.graphicsDevice);
    if (meshData.pos) mesh.setPositions(new Float32Array(meshData.pos));
    if (meshData.idx) {
        if (meshData.idx.length > 65535) mesh.setIndices(new Uint32Array(meshData.idx));
        else mesh.setIndices(new Uint16Array(meshData.idx));
    }
    if (meshData.uvs) mesh.setUvs(0, new Float32Array(meshData.uvs));
    if (meshData.normals) mesh.setNormals(new Float32Array(meshData.normals));
    else if (typeof mesh.calculateNormals === 'function') mesh.calculateNormals();
    mesh.update(pc.PRIMITIVE_TRIANGLES);

    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(col[0], col[1], col[2]);
    m.gloss = (typeof rough === 'number') ? rough : 0.5;
    m.metalness = (typeof metal === 'number') ? metal : 0;
    m.update();

    const mi = new pc.MeshInstance(mesh, m);
    if (typeof pc.BoundingBox !== 'undefined') {
        mi.aabb = pc.BoundingBox.fromMesh(mesh);
    }
    return mi;
}

function loadState(stateStr) {
    showSaveLoadLoading(true, "Memuat Scene...");

    setTimeout(() => {
        try {
            (S.objects || []).forEach(o => {
                if (typeof destroyEntity === 'function') destroyEntity(o);
            });
            S.objects = [];
            S.maxId = 1;

            const parsed = JSON.parse(stateStr);
            if (!Array.isArray(parsed)) {
                throw new Error("Format JSON bukan array.");
            }

            let maxFound = 1;
            parsed.forEach(d => {
                if (!d) return;
                const m = String(d.name || '').match(/-(\d+)$/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (!isNaN(n) && n >= maxFound) maxFound = n + 1;
                }
            });
            S.maxId = maxFound;

            let skippedSkinned = 0;
            let skippedMissingCache = 0;

            parsed.forEach(d => {
                if (!d) return;
                try {
                    const e = new pc.Entity(d.name || "Obj");
                    const col = Array.isArray(d.color) && d.color.length >= 3 ? d.color : [0.5, 0.5, 0.5];

                    if (Array.isArray(d.meshDataArr) && d.meshDataArr.length > 0) {
                        e.addComponent('render', { type: 'asset', castShadows: false });
                        const newMeshInstances = [];
                        d.meshDataArr.forEach(meshData => {
                            try {
                                newMeshInstances.push(buildMeshFromData(meshData, col, d.rough, d.metal));
                            } catch (me) {
                                logSaveLoad("Load meshData fail: " + me.message);
                            }
                        });
                        e.render.meshInstances = newMeshInstances;
                        e._meshCache = d.meshDataArr;
                        meshCachePool.set(e.name, d.meshDataArr);
                    } else if (d.hasMeshCache && meshCachePool.has(d.name)) {
                        e.addComponent('render', { type: 'asset', castShadows: false });
                        const cached = meshCachePool.get(d.name);
                        const newMeshInstances = [];
                        cached.forEach(meshData => {
                            try {
                                newMeshInstances.push(buildMeshFromData(meshData, col, d.rough, d.metal));
                            } catch (me) {
                                logSaveLoad("Load from pool fail: " + me.message);
                            }
                        });
                        e.render.meshInstances = newMeshInstances;
                        e._meshCache = cached;
                    } else if (d.hasMeshCache && !meshCachePool.has(d.name)) {
                        logSaveLoad("⚠ Mesh cache hilang untuk " + d.name + " — fallback ke primitive");
                        skippedMissingCache++;
                        const fallbackType = (d.type === 'custom' || !['box', 'sphere', 'cylinder', 'capsule'].includes(d.type)) ? 'box' : d.type;
                        e.addComponent('render', { type: fallbackType, castShadows: false });
                        const m = new pc.StandardMaterial();
                        m.diffuse = new pc.Color(col[0], col[1], col[2]);
                        m.gloss = (typeof d.rough === 'number') ? d.rough : 0.5;
                        m.metalness = (typeof d.metal === 'number') ? d.metal : 0;
                        m.update();
                        e.render.material = m;
                    } else if (d.hasSkeleton) {
                        logSaveLoad("⚠ Skinned entity di-skip (no cache): " + d.name);
                        skippedSkinned++;
                        return;
                    } else if (['box', 'sphere', 'cylinder', 'capsule'].includes(d.type)) {
                        e.addComponent('render', { type: d.type, castShadows: false });
                        const m = new pc.StandardMaterial();
                        m.diffuse = new pc.Color(col[0], col[1], col[2]);
                        m.gloss = (typeof d.rough === 'number') ? d.rough : 0.5;
                        m.metalness = (typeof d.metal === 'number') ? d.metal : 0;
                        m.update();
                        e.render.material = m;
                    } else {
                        e.addComponent('render', { type: 'box', castShadows: false });
                        const m = new pc.StandardMaterial();
                        m.diffuse = new pc.Color(col[0], col[1], col[2]);
                        m.gloss = (typeof d.rough === 'number') ? d.rough : 0.5;
                        m.metalness = (typeof d.metal === 'number') ? d.metal : 0;
                        m.update();
                        e.render.material = m;
                    }

                    const p = Array.isArray(d.pos) && d.pos.length >= 3 ? d.pos : [0, 0, 0];
                    const r = Array.isArray(d.rot) && d.rot.length >= 3 ? d.rot : [0, 0, 0];
                    const s = Array.isArray(d.scale) && d.scale.length >= 3 ? d.scale : [1, 1, 1];
                    e.setPosition(p[0], p[1], p[2]);
                    e.setEulerAngles(r[0], r[1], r[2]);
                    e.setLocalScale(s[0], s[1], s[2]);

                    e._animSpin = !!d.animSpin;
                    e._animPulse = !!d.animPulse;
                    e._animWobble = !!d.animWobble;
                    e._baseScale = e.getLocalScale().clone();
                    e._baseRot = e.getEulerAngles().clone();

                    app.root.addChild(e);
                    S.objects.push(e);
                } catch (err) {
                    logSaveLoad("Gagal load objek: " + err.message);
                }
            });

            if (skippedSkinned > 0 || skippedMissingCache > 0) {
                const partsMsg = [];
                if (skippedSkinned > 0) partsMsg.push(skippedSkinned + " model skinned di-skip (perlu re-import)");
                if (skippedMissingCache > 0) partsMsg.push(skippedMissingCache + " mesh cache hilang (fallback ke primitive)");
                setSaveLoadStatus("⚠ " + partsMsg.join(" · "));
            }

            if (typeof resetMode === 'function') resetMode();
            if (typeof selectObject === 'function') selectObject(null);
        } catch (e) {
            alert("JSON Invalid!");
        } finally {
            showSaveLoadLoading(false);
        }
    }, 50);
}
window.loadState = loadState;

function triggerSaveScene() {
    if (typeof hasAnySkinnedEntity === 'function' && hasAnySkinnedEntity()) {
        if (!confirm("⚠ PENTING!\n\nModel skinned TIDAK BISA disimpan (batasan engine).\nSetelah Save, model skinned akan HILANG dari file JSON.\nPrimitives & model statis tetap tersimpan normal.\n\nLanjutkan Save?")) return;
    }
    if (!confirm("PENTING: File JSON hanya menyimpan bentuk/warna, tekstur gambar akan HILANG (menjadi warna solid). Lanjutkan?")) return;

    setSaveLoadStatus("Menyimpan...");
    setTimeout(() => {
        const dataStr = serializeScene(true);
        if (dataStr.length > 10 * 1024 * 1024) {
            setSaveLoadStatus("Gagal: Scene > 10 MB (batal disimpan).");
            return alert("Scene > 10 MB! Gagal save.");
        }
        if (typeof downloadNative === 'function') {
            downloadNative('vtuber_scene.json', dataStr, 'application/json');
        }
        setSaveLoadStatus("Saved!");
    }, 100);
}

['btnSave', 'save'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = triggerSaveScene;
});

function loadSceneJsonText(jsonText) {
    if (typeof hasAnySkinnedEntity === 'function' && hasAnySkinnedEntity()) {
        if (!confirm("⚠ PENTING!\n\nModel skinned di scene akan HILANG setelah Load.\nFile JSON tidak menyimpan skeleton (batasan engine).\n\nLanjutkan?")) return;
    }
    try {
        JSON.parse(jsonText);
        saveState();
        loadState(jsonText);
        undoStack = [serializeScene(false)];
        redoStack = [];
    } catch (err) {
        alert("File JSON invalid.");
    }
}
window.loadSceneJsonText = loadSceneJsonText;

const jsonFileEl = document.getElementById('jsonFile');
if (jsonFileEl) {
    jsonFileEl.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert("File > 10MB!"); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            loadSceneJsonText(ev.target.result);
        };
        reader.readAsText(file);
        e.target.value = '';
    };
}

const loadBtnEl = document.getElementById('load');
if (loadBtnEl && jsonFileEl) loadBtnEl.onclick = () => jsonFileEl.click();

function triggerUndo() {
    if (!Array.isArray(undoStack) || undoStack.length <= 1) return;
    const targetState = undoStack[undoStack.length - 2];
    const currentHasSkin = hasAnySkinnedEntity();
    const targetHadSkin = stateHasSkeleton(targetState);

    if (currentHasSkin || targetHadSkin) {
        if (!confirm("⚠ PENTING!\n\nModel skinned akan HILANG dari scene setelah Undo (batasan engine).\nTidak bisa di-restore tanpa re-import file asli.\n\nLanjutkan?")) return;
    }

    redoStack.push(undoStack.pop());
    loadState(undoStack[undoStack.length - 1]);
    setSaveLoadStatus("Undo. Catatan: tekstur & skeleton tidak bisa di-restore.");
}

function triggerRedo() {
    if (!Array.isArray(redoStack) || redoStack.length === 0) return;
    const targetState = redoStack[redoStack.length - 1];
    const currentHasSkin = hasAnySkinnedEntity();
    const targetHadSkin = stateHasSkeleton(targetState);

    if (currentHasSkin || targetHadSkin) {
        if (!confirm("⚠ PENTING!\n\nModel skinned akan HILANG dari scene setelah Redo (batasan engine).\nTidak bisa di-restore tanpa re-import file asli.\n\nLanjutkan?")) return;
    }

    const state = redoStack.pop();
    undoStack.push(state);
    loadState(state);
    setSaveLoadStatus("Redo. Catatan: tekstur & skeleton tidak bisa di-restore.");
}

['btnUndo', 'undo'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = triggerUndo;
});

['btnRedo', 'redo'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = triggerRedo;
});
