/* ===== VTuber Forge — js/entities/split.js ===== */
// Object Splitting: Memisahkan mesh menjadi beberapa objek terpisah
// Mode: Connected Components, Material

(function () {
    'use strict';

    /**
     * Memperbarui teks status pada bar status aplikasi bila elemen tersedia.
     */
    function setSplitStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mencatat log debug ke overlay debug atau konsol browser.
     */
    function logSplit(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    /**
     * Mengambil instance pc.Application aktif secara aman.
     */
    function getSplitApp() {
        if (typeof window.getPcApp === 'function') {
            try {
                const pcApp = window.getPcApp();
                if (pcApp) return pcApp;
            } catch (e) {}
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    /**
     * Mengambil state scene global `S` secara aman.
     */
    function getSplitState() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    /**
     * Menampilkan atau menyembunyikan overlay loading saat proses split berjalan.
     */
    function showSplitLoading(show, text) {
        try {
            const ov = document.getElementById('loadingOverlay');
            const txt = document.getElementById('loadingText');
            if (txt && text) txt.textContent = text;
            if (ov) ov.style.display = show ? 'flex' : 'none';
        } catch (e) {}
    }

    /**
     * Menggandakan material mesh dengan fallback material standar yang aman.
     */
    function cloneSplitMaterial(mat) {
        if (!mat) {
            const fallback = new pc.StandardMaterial();
            fallback.diffuse = new pc.Color(0.6, 0.2, 0.8);
            if (typeof fallback.update === 'function') fallback.update();
            return fallback;
        }
        try {
            if (Array.isArray(mat)) {
                const first = mat[0];
                return (first && typeof first.clone === 'function') ? first.clone() : first;
            }
            return (typeof mat.clone === 'function') ? mat.clone() : mat;
        } catch (e) {
            const fallback = new pc.StandardMaterial();
            fallback.diffuse = new pc.Color(0.6, 0.2, 0.8);
            if (typeof fallback.update === 'function') fallback.update();
            return fallback;
        }
    }

    /**
     * Memisahkan objek statis menjadi beberapa entitas baru berdasarkan connected components.
     */
    function splitByConnectedComponents() {
        const pcApp = getSplitApp();
        const st = getSplitState();
        if (!pcApp || !pcApp.root || !pcApp.graphicsDevice) {
            setSplitStatus("⚠ Scene belum siap.");
            return;
        }
        if (!st || !st.selected) {
            setSplitStatus("⚠ Pilih objek dulu sebelum split.");
            return;
        }

        const renderComp = typeof st.selected.findComponent === 'function' ? st.selected.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
            setSplitStatus("⚠ Objek tidak memiliki mesh.");
            return;
        }

        const hasSkin = renderComp.meshInstances.some(mi => mi && mi.skinInstance != null);
        if (hasSkin) {
            setSplitStatus("⚠ Model skinned tidak bisa di-split.");
            return;
        }

        const mi = renderComp.meshInstances[0];
        if (!mi || !mi.mesh) {
            setSplitStatus("⚠ Mesh tidak valid.");
            return;
        }

        try {
            const positions = mi.mesh.getPositions ? mi.mesh.getPositions() : null;
            const indices = mi.mesh.getIndices ? mi.mesh.getIndices() : null;
            const normals = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
            const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;

            if (!positions || !indices || positions.length === 0 || indices.length < 3) {
                setSplitStatus("⚠ Mesh data kosong atau compressed.");
                return;
            }

            const vertexCount = Math.floor(positions.length / 3);
            setSplitStatus("Menganalisis connected components...");
            showSplitLoading(true, "Splitting mesh...");

            setTimeout(() => {
                try {
                    const adjacency = new Array(vertexCount);
                    for (let i = 0; i < vertexCount; i++) {
                        adjacency[i] = new Set();
                    }

                    const triLimit = indices.length - (indices.length % 3);
                    for (let i = 0; i < triLimit; i += 3) {
                        const a = indices[i], b = indices[i + 1], c = indices[i + 2];
                        if (a < vertexCount && b < vertexCount && c < vertexCount) {
                            adjacency[a].add(b).add(c);
                            adjacency[b].add(a).add(c);
                            adjacency[c].add(a).add(b);
                        }
                    }

                    const visited = new Uint8Array(vertexCount);
                    const components = [];

                    for (let startVertex = 0; startVertex < vertexCount; startVertex++) {
                        if (visited[startVertex]) continue;

                        const component = [];
                        const queue = [startVertex];
                        let head = 0;
                        visited[startVertex] = 1;

                        while (head < queue.length) {
                            const v = queue[head++];
                            component.push(v);

                            for (const neighbor of adjacency[v]) {
                                if (!visited[neighbor]) {
                                    visited[neighbor] = 1;
                                    queue.push(neighbor);
                                }
                            }
                        }

                        if (component.length >= 3) {
                            components.push(component);
                        }
                    }

                    if (components.length <= 1) {
                        showSplitLoading(false);
                        setSplitStatus("Mesh hanya memiliki 1 bagian terhubung.");
                        return;
                    }

                    logSplit("✅ Ditemukan " + components.length + " connected components");

                    const originalEntity = st.selected;
                    const originalPos = originalEntity.getPosition();
                    const originalRot = originalEntity.getEulerAngles();
                    const originalScale = originalEntity.getLocalScale();

                    if (!Array.isArray(st.objects)) st.objects = [];
                    const newEntities = [];

                    components.forEach((componentVertices, idx) => {
                        const vertexMap = new Map();
                        componentVertices.forEach((oldIdx, newIdx) => {
                            vertexMap.set(oldIdx, newIdx);
                        });

                        const newPositions = new Float32Array(componentVertices.length * 3);
                        const newNormals = normals ? new Float32Array(componentVertices.length * 3) : null;
                        const newUvs = uvs ? new Float32Array(componentVertices.length * 2) : null;

                        componentVertices.forEach((oldIdx, newIdx) => {
                            newPositions[newIdx * 3] = positions[oldIdx * 3] || 0;
                            newPositions[newIdx * 3 + 1] = positions[oldIdx * 3 + 1] || 0;
                            newPositions[newIdx * 3 + 2] = positions[oldIdx * 3 + 2] || 0;

                            if (newNormals) {
                                newNormals[newIdx * 3] = normals[oldIdx * 3] || 0;
                                newNormals[newIdx * 3 + 1] = normals[oldIdx * 3 + 1] || 0;
                                newNormals[newIdx * 3 + 2] = normals[oldIdx * 3 + 2] || 0;
                            }

                            if (newUvs) {
                                newUvs[newIdx * 2] = uvs[oldIdx * 2] || 0;
                                newUvs[newIdx * 2 + 1] = uvs[oldIdx * 2 + 1] || 0;
                            }
                        });

                        const newIndices = [];
                        let maxMappedIdx = 0;
                        for (let i = 0; i < triLimit; i += 3) {
                            const a = indices[i], b = indices[i + 1], c = indices[i + 2];
                            if (vertexMap.has(a) && vertexMap.has(b) && vertexMap.has(c)) {
                                const na = vertexMap.get(a);
                                const nb = vertexMap.get(b);
                                const nc = vertexMap.get(c);
                                if (na > maxMappedIdx) maxMappedIdx = na;
                                if (nb > maxMappedIdx) maxMappedIdx = nb;
                                if (nc > maxMappedIdx) maxMappedIdx = nc;
                                newIndices.push(na, nb, nc);
                            }
                        }

                        if (newIndices.length === 0) return;

                        const newMesh = new pc.Mesh(pcApp.graphicsDevice);
                        newMesh.setPositions(newPositions);
                        if (maxMappedIdx > 65535) {
                            newMesh.setIndices(new Uint32Array(newIndices));
                        } else {
                            newMesh.setIndices(new Uint16Array(newIndices));
                        }
                        if (newNormals) newMesh.setNormals(newNormals);
                        else if (typeof newMesh.calculateNormals === 'function') newMesh.calculateNormals();
                        if (newUvs) newMesh.setUvs(0, newUvs);
                        newMesh.update(pc.PRIMITIVE_TRIANGLES);

                        const newMat = cloneSplitMaterial(mi.material);
                        const newEntity = new pc.Entity((originalEntity.name || "Obj") + '-part' + (idx + 1));
                        newEntity.addComponent('render', { type: 'asset', castShadows: false });

                        const newMi = new pc.MeshInstance(newMesh, newMat);
                        if (typeof pc.BoundingBox !== 'undefined') {
                            newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
                        }
                        newEntity.render.meshInstances = [newMi];

                        newEntity.setPosition(originalPos.x, originalPos.y, originalPos.z);
                        newEntity.setEulerAngles(originalRot.x, originalRot.y, originalRot.z);
                        newEntity.setLocalScale(originalScale.x, originalScale.y, originalScale.z);
                        newEntity._baseScale = newEntity.getLocalScale().clone();
                        newEntity._baseRot = newEntity.getEulerAngles().clone();

                        newEntity._meshCache = [{
                            pos: Array.from(newPositions),
                            idx: newIndices,
                            normals: newNormals ? Array.from(newNormals) : null,
                            uvs: newUvs ? Array.from(newUvs) : null
                        }];

                        pcApp.root.addChild(newEntity);
                        st.objects.push(newEntity);
                        newEntities.push(newEntity);

                        logSplit("✅ Part " + (idx + 1) + ": " + componentVertices.length + " vertices, " + (newIndices.length / 3) + " triangles");
                    });

                    const toDelete = originalEntity;
                    if (typeof window.selectObject === 'function') window.selectObject(null);
                    st.objects = st.objects.filter(o => o !== toDelete);
                    if (typeof window.destroyEntity === 'function') {
                        window.destroyEntity(toDelete);
                    } else {
                        try {
                            toDelete.enabled = false;
                            if (toDelete.parent) toDelete.parent.removeChild(toDelete);
                            if (typeof toDelete.destroy === 'function') toDelete.destroy();
                        } catch (err) {
                            logSplit("Destroy original error: " + err.message);
                        }
                    }

                    if (typeof window.saveState === 'function') window.saveState();
                    if (typeof window.updateTree === 'function') window.updateTree();

                    if (newEntities.length > 0 && typeof window.selectObject === 'function') {
                        window.selectObject(newEntities[0]);
                    }

                    showSplitLoading(false);
                    setSplitStatus("✓ Mesh di-split menjadi " + newEntities.length + " bagian");
                } catch (innerErr) {
                    logSplit("Split inner error: " + innerErr.message + "\n" + (innerErr.stack || ""));
                    showSplitLoading(false);
                    setSplitStatus("⚠ Gagal split mesh: " + innerErr.message);
                }
            }, 50);
        } catch (e) {
            logSplit("Split error: " + e.message + "\n" + (e.stack || ""));
            showSplitLoading(false);
            setSplitStatus("⚠ Gagal split mesh: " + e.message);
        }
    }
    window.splitByConnectedComponents = splitByConnectedComponents;

    /**
     * Memisahkan multi-material mesh menjadi beberapa entitas baru berdasarkan meshInstance.
     */
    function splitByMaterial() {
        const pcApp = getSplitApp();
        const st = getSplitState();
        if (!pcApp || !pcApp.root) {
            setSplitStatus("⚠ Scene belum siap.");
            return;
        }
        if (!st || !st.selected) {
            setSplitStatus("⚠ Pilih objek dulu sebelum split.");
            return;
        }

        const renderComp = typeof st.selected.findComponent === 'function' ? st.selected.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances) {
            setSplitStatus("⚠ Objek tidak memiliki mesh.");
            return;
        }

        if (renderComp.meshInstances.length <= 1) {
            setSplitStatus("Mesh hanya memiliki 1 material.");
            return;
        }

        const hasSkin = renderComp.meshInstances.some(mi => mi && mi.skinInstance != null);
        if (hasSkin) {
            setSplitStatus("⚠ Model skinned tidak bisa di-split.");
            return;
        }

        try {
            const originalEntity = st.selected;
            const originalPos = originalEntity.getPosition();
            const originalRot = originalEntity.getEulerAngles();
            const originalScale = originalEntity.getLocalScale();

            if (!Array.isArray(st.objects)) st.objects = [];
            const newEntities = [];

            renderComp.meshInstances.forEach((mi, idx) => {
                if (!mi || !mi.mesh) return;

                const newEntity = new pc.Entity((originalEntity.name || "Obj") + '-mat' + (idx + 1));
                newEntity.addComponent('render', { type: 'asset', castShadows: false });

                const newMesh = (typeof window.cloneMesh === 'function') ? window.cloneMesh(mi.mesh) : null;
                if (!newMesh) return;

                const newMat = cloneSplitMaterial(mi.material);
                const newMi = new pc.MeshInstance(newMesh, newMat);
                if (typeof pc.BoundingBox !== 'undefined') {
                    newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
                }
                newEntity.render.meshInstances = [newMi];

                newEntity.setPosition(originalPos.x, originalPos.y, originalPos.z);
                newEntity.setEulerAngles(originalRot.x, originalRot.y, originalRot.z);
                newEntity.setLocalScale(originalScale.x, originalScale.y, originalScale.z);
                newEntity._baseScale = newEntity.getLocalScale().clone();
                newEntity._baseRot = newEntity.getEulerAngles().clone();

                pcApp.root.addChild(newEntity);
                st.objects.push(newEntity);
                newEntities.push(newEntity);
            });

            const toDelete = originalEntity;
            if (typeof window.selectObject === 'function') window.selectObject(null);
            st.objects = st.objects.filter(o => o !== toDelete);
            if (typeof window.destroyEntity === 'function') {
                window.destroyEntity(toDelete);
            } else {
                try {
                    toDelete.enabled = false;
                    if (toDelete.parent) toDelete.parent.removeChild(toDelete);
                    if (typeof toDelete.destroy === 'function') toDelete.destroy();
                } catch (err) {
                    logSplit("Destroy original error: " + err.message);
                }
            }

            if (typeof window.saveState === 'function') window.saveState();
            if (typeof window.updateTree === 'function') window.updateTree();

            if (newEntities.length > 0 && typeof window.selectObject === 'function') {
                window.selectObject(newEntities[0]);
            }

            setSplitStatus("✓ Mesh di-split menjadi " + newEntities.length + " bagian berdasarkan material");
        } catch (e) {
            logSplit("Split by material error: " + e.message);
            setSplitStatus("⚠ Gagal split berdasarkan material: " + e.message);
        }
    }
    window.splitByMaterial = splitByMaterial;

    /**
     * Menghubungkan event klik tombol splitConnected dan splitMaterial pada DOM saat ini.
     */
    function bindSplitButtons() {
        try {
            const splitConnBtn = document.getElementById('splitConnected');
            if (splitConnBtn) splitConnBtn.onclick = splitByConnectedComponents;

            const splitMatBtn = document.getElementById('splitMaterial');
            if (splitMatBtn) splitMatBtn.onclick = splitByMaterial;
        } catch (e) {
            logSplit("bindSplitButtons error: " + e.message);
        }
    }

    bindSplitButtons();
    window.__vtfBindSplitControls = bindSplitButtons;

    logSplit("✅ split.js loaded");
})();
