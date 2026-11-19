/* ===== VTuber Forge — js/entities/split.js ===== */
// Object Splitting: Memisahkan mesh menjadi beberapa objek terpisah
// Mode: Connected Components, Material

/**
 * SPLIT BY CONNECTED COMPONENTS
 * Algoritma: BFS untuk menemukan kelompok vertex yang terhubung
 * Berguna untuk memisahkan mesh import yang terdiri dari beberapa bagian
 */
function splitByConnectedComponents() {
    if (!S.selected) return alert("Pilih objek dulu!");

    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
        return alert("Objek tidak memiliki mesh!");
    }

    // Cek apakah skinned mesh (tidak didukung)
    const hasSkin = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    if (hasSkin) {
        return alert("Model dengan skeleton (skinned) tidak bisa di-split.\n\nHanya mesh statis yang didukung.");
    }

    const mi = renderComp.meshInstances[0];
    if (!mi || !mi.mesh) return alert("Mesh tidak valid!");

    try {
        const positions = mi.mesh.getPositions();
        const indices = mi.mesh.getIndices();
        const normals = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
        const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;

        if (!positions || !indices || positions.length === 0) {
            return alert("Mesh data kosong atau compressed (Draco)!");
        }

        const vertexCount = positions.length / 3;
        if (vertexCount > 50000) {
            if (!confirm("Mesh besar: " + vertexCount + " vertex.\nProses split bisa lama. Lanjutkan?")) {
                return;
            }
        }

        $('status').textContent = "Menganalisis connected components...";
        $('loadingOverlay').style.display = 'flex';
        $('loadingText').textContent = "Splitting mesh...";

        // Gunakan setTimeout agar UI sempat update
        setTimeout(() => {
            try {
                // === STEP 1: Build adjacency list dari triangles ===
                const adjacency = new Array(vertexCount);
                for (let i = 0; i < vertexCount; i++) {
                    adjacency[i] = new Set();
                }

                for (let i = 0; i < indices.length; i += 3) {
                    const a = indices[i], b = indices[i+1], c = indices[i+2];
                    adjacency[a].add(b).add(c);
                    adjacency[b].add(a).add(c);
                    adjacency[c].add(a).add(b);
                }

                // === STEP 2: Find connected components via BFS ===
                const visited = new Uint8Array(vertexCount);
                const components = [];

                for (let startVertex = 0; startVertex < vertexCount; startVertex++) {
                    if (visited[startVertex]) continue;

                    const component = [];
                    const queue = [startVertex];
                    visited[startVertex] = 1;

                    while (queue.length > 0) {
                        const v = queue.shift();
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
                    $('loadingOverlay').style.display = 'none';
                    return alert("Mesh hanya memiliki 1 bagian terhubung.\nTidak ada yang bisa di-split.");
                }

                dbg("✅ Ditemukan " + components.length + " connected components");

                // === STEP 3: Buat entity baru untuk setiap component ===
                const originalEntity = S.selected;
                const originalPos = originalEntity.getPosition();
                const originalRot = originalEntity.getEulerAngles();
                const originalScale = originalEntity.getLocalScale();

                const newEntities = [];

                components.forEach((componentVertices, idx) => {
                    // Vertex mapping: old index → new index
                    const vertexMap = new Map();
                    componentVertices.forEach((oldIdx, newIdx) => {
                        vertexMap.set(oldIdx, newIdx);
                    });

                    // Extract data untuk component ini
                    const newPositions = new Float32Array(componentVertices.length * 3);
                    const newNormals = normals ? new Float32Array(componentVertices.length * 3) : null;
                    const newUvs = uvs ? new Float32Array(componentVertices.length * 2) : null;

                    componentVertices.forEach((oldIdx, newIdx) => {
                        newPositions[newIdx * 3]     = positions[oldIdx * 3];
                        newPositions[newIdx * 3 + 1] = positions[oldIdx * 3 + 1];
                        newPositions[newIdx * 3 + 2] = positions[oldIdx * 3 + 2];

                        if (newNormals) {
                            newNormals[newIdx * 3]     = normals[oldIdx * 3];
                            newNormals[newIdx * 3 + 1] = normals[oldIdx * 3 + 1];
                            newNormals[newIdx * 3 + 2] = normals[oldIdx * 3 + 2];
                        }

                        if (newUvs) {
                            newUvs[newIdx * 2]     = uvs[oldIdx * 2];
                            newUvs[newIdx * 2 + 1] = uvs[oldIdx * 2 + 1];
                        }
                    });

                    // Extract indices (hanya triangle yang semua vertex-nya ada di component)
                    const newIndices = [];
                    for (let i = 0; i < indices.length; i += 3) {
                        const a = indices[i], b = indices[i+1], c = indices[i+2];
                        if (vertexMap.has(a) && vertexMap.has(b) && vertexMap.has(c)) {
                            newIndices.push(vertexMap.get(a), vertexMap.get(b), vertexMap.get(c));
                        }
                    }

                    if (newIndices.length === 0) return;

                    // Buat mesh baru
                    const newMesh = new pc.Mesh(app.graphicsDevice);
                    newMesh.setPositions(newPositions);
                    if (newIndices.length > 65535) {
                        newMesh.setIndices(new Uint32Array(newIndices));
                    } else {
                        newMesh.setIndices(new Uint16Array(newIndices));
                    }
                    if (newNormals) newMesh.setNormals(newNormals);
                    else newMesh.calculateNormals();
                    if (newUvs) newMesh.setUvs(0, newUvs);
                    newMesh.update(pc.PRIMITIVE_TRIANGLES);

                    // Clone material dari original
                    let newMat;
                    if (mi.material) {
                        newMat = Array.isArray(mi.material) ? mi.material[0].clone() : mi.material.clone();
                    } else {
                        newMat = new pc.StandardMaterial();
                        newMat.diffuse = new pc.Color(0.6, 0.2, 0.8);
                        newMat.update();
                    }

                    // Buat entity baru
                    const newEntity = new pc.Entity(originalEntity.name + '-part' + (idx + 1));
                    newEntity.addComponent('render', { type: 'asset', castShadows: false });

                    const newMi = new pc.MeshInstance(newMesh, newMat);
                    newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
                    newEntity.render.meshInstances = [newMi];

                    // Copy transform dari original
                    newEntity.setPosition(originalPos.x, originalPos.y, originalPos.z);
                    newEntity.setEulerAngles(originalRot.x, originalRot.y, originalRot.z);
                    newEntity.setLocalScale(originalScale.x, originalScale.y, originalScale.z);
                    newEntity._baseScale = newEntity.getLocalScale().clone();
                    newEntity._baseRot = newEntity.getEulerAngles().clone();

                    // Cache mesh data untuk save/load
                    newEntity._meshCache = [{
                        pos: Array.from(newPositions),
                        idx: newIndices,
                        normals: newNormals ? Array.from(newNormals) : null,
                        uvs: newUvs ? Array.from(newUvs) : null
                    }];

                    app.root.addChild(newEntity);
                    S.objects.push(newEntity);
                    newEntities.push(newEntity);

                    dbg("✅ Part " + (idx + 1) + ": " + componentVertices.length + " vertices, " + (newIndices.length / 3) + " triangles");
                });

                // === STEP 4: Hapus entity original ===
                const toDelete = S.selected;
                selectObject(null);
                S.objects = S.objects.filter(o => o !== toDelete);
                try {
                    toDelete.enabled = false;
                    if (toDelete.parent) toDelete.parent.removeChild(toDelete);
                    toDelete.destroy();
                } catch (err) {
                    dbg("Destroy original error: " + err.message);
                }

                saveState();
                updateTree();

                // Select part pertama
                if (newEntities.length > 0) {
                    selectObject(newEntities[0]);
                }

                $('loadingOverlay').style.display = 'none';
                $('status').textContent = "✓ Mesh di-split menjadi " + newEntities.length + " bagian";

            } catch (innerErr) {
                dbg("Split inner error: " + innerErr.message + "\n" + (innerErr.stack || ""));
                $('loadingOverlay').style.display = 'none';
                alert("Gagal split mesh: " + innerErr.message);
            }
        }, 50);

    } catch (e) {
        dbg("Split error: " + e.message + "\n" + (e.stack || ""));
        $('loadingOverlay').style.display = 'none';
        alert("Gagal split mesh: " + e.message);
    }
}

/**
 * SPLIT BY MATERIAL
 * Memisahkan mesh instances yang berbeda material menjadi entity terpisah
 */
function splitByMaterial() {
    if (!S.selected) return alert("Pilih objek dulu!");

    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances) {
        return alert("Objek tidak memiliki mesh!");
    }

    if (renderComp.meshInstances.length <= 1) {
        return alert("Mesh hanya memiliki 1 material.\nTidak ada yang bisa di-split berdasarkan material.");
    }

    const hasSkin = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    if (hasSkin) {
        return alert("Model dengan skeleton (skinned) tidak bisa di-split.");
    }

    const originalEntity = S.selected;
    const originalPos = originalEntity.getPosition();
    const originalRot = originalEntity.getEulerAngles();
    const originalScale = originalEntity.getLocalScale();

    const newEntities = [];

    renderComp.meshInstances.forEach((mi, idx) => {
        if (!mi.mesh) return;

        const newEntity = new pc.Entity(originalEntity.name + '-mat' + (idx + 1));
        newEntity.addComponent('render', { type: 'asset', castShadows: false });

        // Clone mesh
        const newMesh = new pc.Mesh(app.graphicsDevice);
        try {
            if (mi.mesh.getPositions()) newMesh.setPositions(mi.mesh.getPositions());
            if (mi.mesh.getIndices()) newMesh.setIndices(mi.mesh.getIndices());
            if (mi.mesh.getUvs()) newMesh.setUvs(0, mi.mesh.getUvs());
            if (mi.mesh.getNormals()) newMesh.setNormals(mi.mesh.getNormals());
            else newMesh.calculateNormals();
            newMesh.update(pc.PRIMITIVE_TRIANGLES);
        } catch(e) {
            dbg("Clone mesh warning: " + e.message);
            return;
        }

        // Clone material
        const newMat = mi.material ? (Array.isArray(mi.material) ? mi.material[0].clone() : mi.material.clone()) : new pc.StandardMaterial();

        const newMi = new pc.MeshInstance(newMesh, newMat);
        newMi.aabb = pc.BoundingBox.fromMesh(newMesh);
        newEntity.render.meshInstances = [newMi];

        // Copy transform
        newEntity.setPosition(originalPos.x, originalPos.y, originalPos.z);
        newEntity.setEulerAngles(originalRot.x, originalRot.y, originalRot.z);
        newEntity.setLocalScale(originalScale.x, originalScale.y, originalScale.z);
        newEntity._baseScale = newEntity.getLocalScale().clone();
        newEntity._baseRot = newEntity.getEulerAngles().clone();

        app.root.addChild(newEntity);
        S.objects.push(newEntity);
        newEntities.push(newEntity);
    });

    // Hapus original
    const toDelete = S.selected;
    selectObject(null);
    S.objects = S.objects.filter(o => o !== toDelete);
    try {
        toDelete.enabled = false;
        if (toDelete.parent) toDelete.parent.removeChild(toDelete);
        toDelete.destroy();
    } catch (err) {
        dbg("Destroy original error: " + err.message);
    }

    saveState();
    updateTree();

    if (newEntities.length > 0) {
        selectObject(newEntities[0]);
    }

    $('status').textContent = "✓ Mesh di-split menjadi " + newEntities.length + " bagian berdasarkan material";
}

// === UI BINDINGS ===
if ($('splitConnected')) $('splitConnected').onclick = splitByConnectedComponents;
if ($('splitMaterial')) $('splitMaterial').onclick = splitByMaterial;

dbg("✅ split.js loaded");
