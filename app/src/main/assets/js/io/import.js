/* ===== VTuber Forge — js/io/import.js ===== */
// Import GLB/VRM/GLTF via file input atau intent Android

(function () {
    'use strict';

    const meshCachePool = new Map();
    window.meshCachePool = meshCachePool;

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

    function getImportApp() {
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

    function showLoading(show, text) {
        if (show && typeof window.__vtfShowLoading === 'function') {
            window.__vtfShowLoading(text);
            return;
        }
        if (!show && typeof window.__vtfHideLoading === 'function') {
            window.__vtfHideLoading();
            return;
        }
        const ov = document.getElementById('loadingOverlay');
        const txt = document.getElementById('loadingText');
        if (txt && text) txt.textContent = text;
        if (ov) ov.style.display = show ? 'flex' : 'none';
    }

    function syncPrimaryMeshCache(entity, mesh, miIndex) {
        if (!entity || !mesh) return;
        try {
            const pos = mesh.getPositions ? mesh.getPositions() : null;
            const idx = mesh.getIndices ? mesh.getIndices() : null;
            const uvs = mesh.getUvs ? mesh.getUvs() : null;
            const nrm = mesh.getNormals ? mesh.getNormals() : null;
            if (!pos || pos.length === 0) return;

            if (!Array.isArray(entity._meshCache)) {
                entity._meshCache = [];
            }
            const targetSlot = (typeof miIndex === 'number' && miIndex >= 0) ? miIndex : 0;
            entity._meshCache[targetSlot] = {
                pos: Array.from(pos),
                idx: idx ? Array.from(idx) : [],
                uvs: uvs ? Array.from(uvs) : null,
                normals: nrm ? Array.from(nrm) : null
            };
            if (entity.name) {
                meshCachePool.set(entity.name, entity._meshCache);
            }
        } catch (e) {
            logImport("syncPrimaryMeshCache warning: " + e.message);
        }
    }
    window.syncPrimaryMeshCache = syncPrimaryMeshCache;

    function downscaleTexture(tex, maxSize) {
        const pcApp = getImportApp();
        if (!tex || !pcApp || !pcApp.graphicsDevice) return tex;
        try {
            const w = tex.width || 0;
            const h = tex.height || 0;
            if (w <= maxSize && h <= maxSize) return tex;

            const src = tex.getSource ? tex.getSource() : null;
            if (!src) return tex;

            const scale = Math.min(maxSize / w, maxSize / h);
            const nw = Math.max(1, Math.round(w * scale));
            const nh = Math.max(1, Math.round(h * scale));

            const c = document.createElement('canvas');
            c.width = nw;
            c.height = nh;
            const ctx = c.getContext('2d');
            if (!ctx) return tex;
            ctx.drawImage(src, 0, 0, nw, nh);

            const newTex = new pc.Texture(pcApp.graphicsDevice, {
                width: nw,
                height: nh,
                format: tex.format || pc.PIXELFORMAT_RGBA8,
                mipmaps: !!(tex.mipmaps),
                minFilter: tex.minFilter,
                magFilter: tex.magFilter,
                addressU: tex.addressU,
                addressV: tex.addressV
            });
            newTex.setSource(c);
            if (typeof newTex.upload === 'function') newTex.upload();

            if (tex !== newTex && typeof tex.destroy === 'function') {
                try { tex.destroy(); } catch (destroyErr) {}
            }
            return newTex;
        } catch (e) {
            logImport("Downscale texture skip: " + e.message);
            return tex;
        }
    }

    function extractMorphData(rootEntity) {
        let morphInstance = null;
        let morphNames = [];
        if (!rootEntity || typeof rootEntity.findComponents !== 'function') {
            return { morphInstance: null, morphNames: [] };
        }

        const renderComps = rootEntity.findComponents('render') || [];
        for (const comp of renderComps) {
            if (!comp || !Array.isArray(comp.meshInstances)) continue;
            for (const mi of comp.meshInstances) {
                if (mi && mi.morphInstance) {
                    morphInstance = mi.morphInstance;
                    const morphObj = morphInstance.morph;
                    const targets = (morphObj && Array.isArray(morphObj.targets)) ? morphObj.targets : [];
                    morphNames = targets.map((t, i) => (t && t.name) ? t.name : ('Morph_' + i));
                    if (morphNames.length > 0) {
                        return { morphInstance, morphNames };
                    }
                }
            }
        }
        return { morphInstance, morphNames };
    }

    function processLoadedAsset(asset, fileName) {
        const pcApp = getImportApp();
        if (!pcApp || !pcApp.root) {
            showLoading(false);
            alert("Scene belum siap.");
            return;
        }

        logImport("🔄 Memproses asset: " + fileName);
        showLoading(true, "Memproses model...");

        try {
            const container = asset.resource;
            if (!container) {
                throw new Error("Container resource kosong — file mungkin rusak atau tidak didukung.");
            }

            const entity = (typeof container.instantiateRenderEntity === 'function')
                ? container.instantiateRenderEntity()
                : null;
            if (!entity) {
                throw new Error("Gagal membuat render entity dari model.");
            }

            const baseName = (fileName || 'Model').replace(/\.(glb|vrm|gltf)$/i, '');
            const id = (typeof S.maxId === 'number' && isFinite(S.maxId)) ? S.maxId++ : 1;
            entity.name = `${baseName}-${id}`;

            let maxDim = 0;
            const renderComps = entity.findComponents('render') || [];
            const meshCacheList = [];

            renderComps.forEach(comp => {
                if (!comp || !Array.isArray(comp.meshInstances)) return;
                comp.meshInstances.forEach((mi, miIdx) => {
                    if (!mi) return;
                    if (mi.aabb && mi.aabb.halfExtents) {
                        const he = mi.aabb.halfExtents;
                        maxDim = Math.max(maxDim, he.x * 2, he.y * 2, he.z * 2);
                    }
                    if (mi.mesh && mi.mesh.getPositions) {
                        try {
                            const pos = mi.mesh.getPositions();
                            const idx = mi.mesh.getIndices ? mi.mesh.getIndices() : null;
                            const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;
                            const nrm = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
                            if (pos && pos.length > 0) {
                                meshCacheList.push({
                                    pos: Array.from(pos),
                                    idx: idx ? Array.from(idx) : [],
                                    uvs: uvs ? Array.from(uvs) : null,
                                    normals: nrm ? Array.from(nrm) : null
                                });
                            }
                        } catch (e) {
                            logImport("Cache mesh skip (" + miIdx + "): " + e.message);
                        }
                    }

                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    mats.forEach(m => {
                        if (!m) return;
                        if (m.diffuseMap) m.diffuseMap = downscaleTexture(m.diffuseMap, 1024);
                        if (m.normalMap) m.normalMap = downscaleTexture(m.normalMap, 1024);
                        if (m.emissiveMap) m.emissiveMap = downscaleTexture(m.emissiveMap, 1024);
                        if (typeof m.update === 'function') m.update();
                    });
                });
            });

            if (meshCacheList.length > 0) {
                entity._meshCache = meshCacheList;
                meshCachePool.set(entity.name, meshCacheList);
            }

            if (maxDim > 0) {
                const targetSize = 2.0;
                if (maxDim > 6.0 || maxDim < 0.25) {
                    const autoScale = targetSize / maxDim;
                    entity.setLocalScale(autoScale, autoScale, autoScale);
                    logImport("📏 Auto-scale diterapkan: " + autoScale.toFixed(3) + " (maxDim=" + maxDim.toFixed(2) + ")");
                }
            }

            const morphInfo = extractMorphData(entity);
            if (morphInfo.morphInstance) {
                entity._morphInstance = morphInfo.morphInstance;
            }
            if (morphInfo.morphNames.length > 0) {
                entity._morphNames = morphInfo.morphNames;
                logImport("🎭 Morph targets ditemukan: " + morphInfo.morphNames.length);
            }

            if (Array.isArray(container.animations) && container.animations.length > 0) {
                entity._animAssets = container.animations;
                entity._animNames = container.animations.map((a, idx) => (a && a.name) ? a.name : ('Anim_' + idx));
                logImport("🎬 Animasi ditemukan: " + entity._animNames.length);
            }

            entity._baseScale = entity.getLocalScale().clone();
            entity._baseRot = entity.getEulerAngles().clone();

            pcApp.root.addChild(entity);
            S.objects.push(entity);

            if (typeof saveState === 'function') saveState();
            if (typeof updateTree === 'function') updateTree();
            if (typeof selectObject === 'function') selectObject(entity);
            if (window.CameraControls && typeof window.CameraControls.focusOn === 'function') {
                window.CameraControls.focusOn(entity);
            }

            setImportStatus("✅ Berhasil import: " + entity.name);
            logImport("✅ Import sukses: " + entity.name);
        } catch (err) {
            logImport("❌ Process asset error: " + err.message + "\n" + (err.stack || ""));
            alert("Gagal memproses model: " + err.message);
            setImportStatus("⚠ Gagal import: " + err.message);
        } finally {
            showLoading(false);
            S.isLoadingModel = false;
        }
    }

    function loadModelFromUrlOrBlob(url, fileName) {
        const pcApp = getImportApp();
        if (!pcApp || !pcApp.assets) {
            alert("PlayCanvas belum siap.");
            return;
        }
        if (S.isLoadingModel) {
            setImportStatus("⚠ Sedang memuat model lain, harap tunggu...");
            return;
        }

        S.isLoadingModel = true;
        showLoading(true, "Memuat " + (fileName || "model") + "...");
        setImportStatus("Memuat model: " + (fileName || url) + "...");

        const safeName = (fileName || 'imported_model.glb') + '_' + Date.now();
        const asset = new pc.Asset(safeName, 'container', { url: url });

        const cleanup = () => {
            if (url && url.startsWith('blob:')) {
                try { URL.revokeObjectURL(url); } catch (e) {}
            }
        };

        asset.once('load', function (loadedAsset) {
            cleanup();
            processLoadedAsset(loadedAsset, fileName || safeName);
        });

        asset.once('error', function (err) {
            cleanup();
            showLoading(false);
            S.isLoadingModel = false;
            const errMsg = (typeof err === 'string') ? err : ((err && err.message) || 'Gagal memuat file model');
            logImport("❌ Asset load error: " + errMsg);
            alert("Gagal memuat model:\n" + errMsg);
            setImportStatus("⚠ Gagal memuat model");
        });

        pcApp.assets.add(asset);
        pcApp.assets.load(asset);
    }

    window.loadModelFromIntent = function (fileUrl) {
        if (!fileUrl) return;
        const cleanName = String(fileUrl).split('/').pop().split('?')[0] || 'intent_model.glb';
        logImport("📥 Intent model diterima: " + cleanName);
        loadModelFromUrlOrBlob(fileUrl, cleanName);
    };

    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.onchange = (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const file = files[0];
            e.target.value = '';

            const maxSize = (typeof window.CONFIG !== 'undefined' && window.CONFIG && window.CONFIG.MAX_IMPORT_SIZE)
                ? window.CONFIG.MAX_IMPORT_SIZE
                : (20 * 1024 * 1024);

            if (file.size > maxSize) {
                const mb = (file.size / (1024 * 1024)).toFixed(1);
                const limitMb = (maxSize / (1024 * 1024)).toFixed(0);
                alert("File terlalu besar (" + mb + " MB).\nBatas aman di perangkat mobile adalah " + limitMb + " MB.");
                return;
            }

            const blobUrl = URL.createObjectURL(file);
            loadModelFromUrlOrBlob(blobUrl, file.name);
        };
    }

    logImport("✅ import.js loaded");
})();
