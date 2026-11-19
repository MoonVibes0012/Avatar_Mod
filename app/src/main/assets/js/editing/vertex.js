/* ===== VTuber Forge — js/editing/vertex.js ===== */
// Mode editing vertex

let currentMesh = null, currentPositions = null, currentMeshInstance = null;

function setVertexStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logVertex(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function syncMeshCacheSafe(entity, mesh) {
    if (typeof window.syncPrimaryMeshCache === 'function') {
        try {
            window.syncPrimaryMeshCache(entity, mesh);
            return;
        } catch (e) {
            logVertex("syncPrimaryMeshCache warning: " + e.message);
        }
    }
    if (!entity || !mesh) return;
    try {
        const pos = mesh.getPositions ? mesh.getPositions() : null;
        const idx = mesh.getIndices ? mesh.getIndices() : null;
        const uvs = mesh.getUvs ? mesh.getUvs() : null;
        const nrm = mesh.getNormals ? mesh.getNormals() : null;
        if (pos && Array.isArray(entity._meshCache) && entity._meshCache.length > 0) {
            entity._meshCache[0] = {
                pos: Array.from(pos),
                idx: idx ? Array.from(idx) : [],
                uvs: uvs ? Array.from(uvs) : null,
                normals: nrm ? Array.from(nrm) : null
            };
        }
    } catch (e) {}
}

function setupVertexEditing() {
    currentMesh = null;
    currentPositions = null;
    currentMeshInstance = null;

    if (!S.selected) return;
    const renderComp = S.selected.findComponent('render');
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) return;

    const hasAnySkinned = renderComp.meshInstances.some(mi => mi.skinInstance != null);
    if (hasAnySkinned) {
        alert("Mode Vertex Edit tidak tersedia untuk model dengan tulang (Skinned Mesh).\n\nGunakan Mode Bone untuk menggerakkan karakter.");
        if (typeof resetMode === 'function') resetMode();
        return;
    }

    currentMeshInstance = renderComp.meshInstances[0];
    currentMesh = currentMeshInstance ? currentMeshInstance.mesh : null;
    if (!currentMesh) return;

    const viEl = document.getElementById('vi');
    const viOEl = document.getElementById('viO');
    const vxEl = document.getElementById('vx');
    const vxoEl = document.getElementById('vxo');
    const vyEl = document.getElementById('vy');
    const vyoEl = document.getElementById('vyo');
    const vzEl = document.getElementById('vz');
    const vzoEl = document.getElementById('vzo');

    try {
        currentPositions = currentMesh.getPositions();
        if (!currentPositions || currentPositions.length === 0) {
            throw new Error("Mesh data kosong atau compressed (Draco).");
        }

        const numVertices = Math.floor(currentPositions.length / 3);
        if (numVertices <= 0) {
            throw new Error("Jumlah vertex tidak valid.");
        }
        if (numVertices > 5000) {
            alert('Mesh ini memiliki ' + numVertices + ' vertex. Mode Vertex Edit dibatasi maksimal 5000 vertex agar HP tidak hang.');
            if (typeof resetMode === 'function') resetMode();
            return;
        }

        if (viEl) {
            viEl.min = 0;
            viEl.max = numVertices - 1;
            viEl.value = 0;
        }

        const updateSliderValues = () => {
            if (!currentPositions) return;
            const rawIdx = viEl ? parseInt(viEl.value, 10) : 0;
            const idx = isNaN(rawIdx) ? 0 : Math.max(0, Math.min(numVertices - 1, rawIdx));
            if (viOEl) viOEl.textContent = String(idx);

            const x = currentPositions[idx * 3] || 0;
            const y = currentPositions[idx * 3 + 1] || 0;
            const z = currentPositions[idx * 3 + 2] || 0;

            if (vxEl) vxEl.value = x;
            if (vxoEl) vxoEl.textContent = x.toFixed(2);
            if (vyEl) vyEl.value = y;
            if (vyoEl) vyoEl.textContent = y.toFixed(2);
            if (vzEl) vzEl.value = z;
            if (vzoEl) vzoEl.textContent = z.toFixed(2);
        };

        if (viEl) viEl.oninput = updateSliderValues;
        updateSliderValues();

        const updateMesh = () => {
            try {
                if (!currentMesh || !currentPositions || !S.selected) return;
                const rawIdx = viEl ? parseInt(viEl.value, 10) : 0;
                const idx = isNaN(rawIdx) ? 0 : Math.max(0, Math.min(numVertices - 1, rawIdx));

                let nx = vxEl ? parseFloat(vxEl.value) : 0; if (!isFinite(nx)) nx = 0;
                let ny = vyEl ? parseFloat(vyEl.value) : 0; if (!isFinite(ny)) ny = 0;
                let nz = vzEl ? parseFloat(vzEl.value) : 0; if (!isFinite(nz)) nz = 0;

                if (vxoEl) vxoEl.textContent = nx.toFixed(2);
                if (vyoEl) vyoEl.textContent = ny.toFixed(2);
                if (vzoEl) vzoEl.textContent = nz.toFixed(2);

                currentPositions[idx * 3] = nx;
                currentPositions[idx * 3 + 1] = ny;
                currentPositions[idx * 3 + 2] = nz;

                currentMesh.setPositions(currentPositions);
                if (typeof currentMesh.calculateNormals === 'function') {
                    currentMesh.calculateNormals();
                }
                currentMesh.update(pc.PRIMITIVE_TRIANGLES);
                if (currentMeshInstance && typeof pc.BoundingBox !== 'undefined') {
                    currentMeshInstance.aabb = pc.BoundingBox.fromMesh(currentMesh);
                }
                syncMeshCacheSafe(S.selected, currentMesh);
            } catch (e) {
                logVertex("updateMesh error: " + e.message);
                setVertexStatus("⚠ Edit vertex gagal: " + e.message);
            }
        };

        const commitVertexEdit = () => {
            updateMesh();
            if (typeof saveState === 'function') saveState();
        };

        if (vxEl) vxEl.onchange = commitVertexEdit;
        if (vyEl) vyEl.onchange = commitVertexEdit;
        if (vzEl) vzEl.onchange = commitVertexEdit;

    } catch (err) {
        logVertex("Vertex edit gagal: " + err.message);
        setVertexStatus("⚠ Mesh compressed/korup — tidak bisa edit vertex.");
        if (typeof resetMode === 'function') resetMode();
    }
}
window.setupVertexEditing = setupVertexEditing;
