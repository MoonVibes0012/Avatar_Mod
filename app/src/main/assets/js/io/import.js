/* ===== VTuber Forge — js/io/import.js ===== */
// Import GLB/VRM dan Texture Downscale Optimization

function setImportStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function logImport(msg) {
    if (typeof window.dbg === 'function') {
        try { window.dbg(msg); } catch (e) {}
    } else if (typeof console !== 'undefined') {
        console.log(msg);
    }
}

function setImportControlsDisabled(disabled) {
    const ids = ['btnImport', 'importMenu', 'import'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !!disabled;
    });
}

function showImportLoading(show, text) {
    const ov = document.getElementById('loadingOverlay');
    const txt = document.getElementById('loadingText');
    if (txt && text) txt.textContent = text;
    if (ov) ov.style.display = show ? 'flex' : 'none';
}

// === TEXTURE OPTIMIZATION ===
function downscaleTexture(texture, scalePct) {
    if (!texture || scalePct >= 100) return texture;
    try {
        const img = typeof texture.getSource === 'function' ? texture.getSource() : null;
        if (!img || !img.width || !img.height) return texture;

        let w = Math.floor(img.width * (scalePct / 100));
        let h = Math.floor(img.height * (scalePct / 100));
        if (w > 4096) w = 4096;
        if (h > 4096) h = 4096;
        if (w < 2 || h < 2) return texture;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return texture;
        ctx.drawImage(img, 0, 0, w, h);

        const newTex = new pc.Texture(app.graphicsDevice, {
            width: w,
            height: h,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true
        });
        newTex.setSource(tempCanvas);
        newTex.upload();
        tempCanvas.width = 0;
        tempCanvas.height = 0;
        return newTex;
    } catch (e) {
        logImport("Texture downscale error: " + e.message);
        return texture;
    }
}

// === MODEL IMPORT ===
function loadModelFromUrl(fileName, url, isBlobUrl) {
    if (S.isLoadingModel) {
        if (isBlobUrl) URL.revokeObjectURL(url);
        alert("Sedang memuat model lain. Tunggu sampai selesai.");
        return;
    }

    const lowerName = String(fileName || '').toLowerCase();

    if (lowerName.endsWith('.gltf')) {
        if (isBlobUrl) URL.revokeObjectURL(url);
        alert("Format .gltf memerlukan file .bin dan texture terpisah.\n\nGunakan format .glb (binary, single-file).");
        return;
    }

    if (lowerName.endsWith('.vrm')) {
        if (!confirm("Format .VRM sering gagal dibaca karena ekstensi khusus VRoid.\nDisarankan export ke .GLB. Tetap lanjutkan?")) {
            if (isBlobUrl) URL.revokeObjectURL(url);
            return;
        }
    }

    S.isLoadingModel = true;
    showImportLoading(true, "Memproses " + fileName);
    setImportControlsDisabled(true);

    const asset = new pc.Asset(fileName, 'container', { url: url });

    asset.on('load', (loadedAsset) => {
        try {
            const resource = loadedAsset ? loadedAsset.resource : null;
            const entity = (resource && typeof resource.instantiateRenderEntity === 'function')
                ? resource.instantiateRenderEntity()
                : null;

            if (!entity) {
                alert("Tidak ada mesh 3D yang valid di file ini.");
                if (loadedAsset) app.assets.remove(loadedAsset);
                if (isBlobUrl) URL.revokeObjectURL(url);
                return;
            }

            if (resource && resource.animations && resource.animations.length > 0) {
                entity._animAssets = resource.animations;
                entity._animNames = resource.animations.map((a, i) => (a && a.name) ? a.name : `Anim_${i}`);
                logImport("✅ Animasi terdeteksi: " + entity._animNames.join(', '));
            }

            const renderComps = entity.findComponents('render');
            for (const comp of renderComps) {
                if (comp.meshInstances && comp.meshInstances.length > 0) {
                    const mesh = comp.meshInstances[0].mesh;
                    if (mesh && mesh.morphInstance && Array.isArray(mesh.morphInstance.morphTargets)) {
                        entity._morphInstance = mesh.morphInstance;
                        entity._morphNames = mesh.morphInstance.morphTargets.map((mt, i) => (mt && mt.name) ? mt.name : `Morph_${i}`);
                        logImport("✅ Blendshapes terdeteksi: " + entity._morphNames.join(', '));
                        break;
                    }
                }
            }

            let meshCount = 0;
            renderComps.forEach(comp => {
                if (comp.meshInstances) meshCount += comp.meshInstances.length;
            });

            if (meshCount === 0) {
                alert("Tidak ada mesh 3D yang valid di file ini.");
                if (typeof entity.destroy === 'function') entity.destroy();
                app.assets.remove(loadedAsset);
                if (isBlobUrl) URL.revokeObjectURL(url);
                return;
            }

            entity._asset = loadedAsset;
            entity.findComponents('light').forEach(l => {
                try { l.destroy(); } catch (e) {}
            });

            const meshCacheArr = [];
            const texScaleEl = document.getElementById('texScale');
            const parsedScale = texScaleEl ? parseInt(texScaleEl.value, 10) : 100;
            const texScale = isNaN(parsedScale) ? 100 : parsedScale;

            renderComps.forEach(comp => {
                if (!comp.meshInstances) return;
                comp.meshInstances.forEach(mi => {
                    if (!mi || !mi.mesh || !mi.material) return;

                    if (Array.isArray(mi.material)) {
                        mi.material = mi.material.map(m => (m && typeof m.clone === 'function') ? m.clone() : m);
                    } else if (typeof mi.material.clone === 'function') {
                        mi.material = mi.material.clone();
                    }

                    if (texScale < 100) {
                        const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                        mats.forEach(mat => {
                            if (!mat || typeof mat.getParameters !== 'function') return;
                            const params = mat.getParameters();
                            for (const key in params) {
                                if (params[key] && params[key].data instanceof pc.Texture) {
                                    const oldTex = params[key].data;
                                    const newTex = downscaleTexture(oldTex, texScale);
                                    if (newTex && newTex !== oldTex) {
                                        params[key].data = newTex;
                                    }
                                    if (typeof mat.update === 'function') mat.update();
                                }
                            }
                        });
                    }

                    if (mi.skinInstance) {
                        logImport("Skipped cache for skinned mesh: " + ((mi.mesh && mi.mesh.name) || 'unnamed'));
                        return;
                    }

                    try {
                        const pos = mi.mesh.getPositions ? mi.mesh.getPositions() : null;
                        if (pos) {
                            const idx = mi.mesh.getIndices ? (mi.mesh.getIndices() || []) : [];
                            const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;
                            const nrm = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
                            meshCacheArr.push({
                                pos: Array.from(pos),
                                idx: Array.from(idx),
                                uvs: uvs ? Array.from(uvs) : null,
                                normals: nrm ? Array.from(nrm) : null
                            });
                        }
                    } catch (ce) {
                        logImport("Cache import fail: " + ce.message);
                    }
                });
            });

            entity._meshCache = meshCacheArr;
            entity.setLocalScale(1, 1, 1);
            entity.setPosition(0, 0, 0);
            entity.setEulerAngles(0, 180, 0);
            entity._baseScale = entity.getLocalScale().clone();
            entity._baseRot = entity.getEulerAngles().clone();

            app.root.addChild(entity);
            S.objects.push(entity);
            if (typeof meshCachePool !== 'undefined' && meshCachePool && typeof meshCachePool.set === 'function') {
                meshCachePool.set(entity.name, meshCacheArr);
            }

            if (typeof saveState === 'function') saveState();
            if (typeof updateTree === 'function') updateTree();
            if (typeof selectObject === 'function') selectObject(entity);
            setImportStatus("✓ Berhasil import: " + fileName);

            if (isBlobUrl) setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (renderErr) {
            logImport("IMPORT ERROR: " + renderErr.message + "\nSTACK: " + (renderErr.stack || ''));
            alert("Gagal memproses model. Cek Debug Log (🐛) atau tekan Save Log.");
            if (loadedAsset) app.assets.remove(loadedAsset);
            if (isBlobUrl) URL.revokeObjectURL(url);
        } finally {
            S.isLoadingModel = false;
            showImportLoading(false);
            setImportControlsDisabled(false);
        }
    });

    asset.on('error', (err) => {
        logImport("ASSET ERROR: " + err);
        alert("Gagal memuat file. Format GLB mungkin tidak didukung (Draco) atau korup.");
        app.assets.remove(asset);
        if (isBlobUrl) URL.revokeObjectURL(url);
        S.isLoadingModel = false;
        showImportLoading(false);
        setImportControlsDisabled(false);
    });

    try {
        app.assets.add(asset);
        app.assets.load(asset);
    } catch (e) {
        logImport("Asset add/load failed: " + e.message);
        S.isLoadingModel = false;
        showImportLoading(false);
        setImportControlsDisabled(false);
        if (isBlobUrl) URL.revokeObjectURL(url);
    }
}
window.loadModelFromUrl = loadModelFromUrl;

const triggerFileChooser = () => {
    const fileInput = document.getElementById('file');
    if (fileInput) fileInput.click();
};

['btnImport', 'importMenu', 'import'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = triggerFileChooser;
});

const fileInputEl = document.getElementById('file');
if (fileInputEl) {
    fileInputEl.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size === 0) { alert("File kosong!"); e.target.value = ''; return; }
        const maxSize = (typeof CONFIG !== 'undefined' && CONFIG.MAX_IMPORT_SIZE) ? CONFIG.MAX_IMPORT_SIZE : (20 * 1024 * 1024);
        if (file.size > maxSize) { alert("File > 20 MB!"); e.target.value = ''; return; }
        const url = URL.createObjectURL(file);
        loadModelFromUrl(file.name, url, true);
        e.target.value = '';
    };
}

window.loadModelFromIntent = function (fileUrl) {
    try {
        const rawLast = String(fileUrl || '').split('/').pop().split('?')[0];
        const fileName = decodeURIComponent(rawLast || 'intent_model.glb');
        logImport("Intent model detected: " + fileName);
        loadModelFromUrl(fileName, fileUrl, false);
    } catch (e) {
        logImport("loadModelFromIntent error: " + e.message);
    }
};
