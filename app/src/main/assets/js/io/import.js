/* ===== VTuber Forge — js/io/import.js ===== */
// Import GLB/VRM dan ASTC Texture Optimization

// === ASTC TEXTURE OPTIMIZATION ===
function downscaleTexture(texture, scalePct) {
    if (scalePct >= 100) return texture;
    try {
        const img = texture.getSource();
        if (!img || !img.width || !img.height) return texture;
        
        let w = Math.floor(img.width * (scalePct / 100));
        let h = Math.floor(img.height * (scalePct / 100));
        if (w > 4096) w = 4096;
        if (h > 4096) h = 4096;
        if (w < 2 || h < 2) return texture;
        
        const tempCanvas = document.createElement('canvas'); 
        tempCanvas.width = w; 
        tempCanvas.height = h;
        tempCanvas.getContext('2d').drawImage(img, 0, 0, w, h);
        
        // === ASTC OPTIMIZATION UNTUK MALI GPU ===
        let format = pc.PIXELFORMAT_RGBA8;
        try {
            const gl = app.graphicsDevice.gl;
            const ext = gl.getExtension('WEBGL_compressed_texture_astc');
            if (ext && scalePct <= 75) {
                format = pc.PIXELFORMAT_ASTC_4x4;
                dbg("✅ Using ASTC compression for texture: " + (texture.name || 'unnamed'));
            }
        } catch(glErr) {
            dbg("ASTC check skipped: " + glErr.message);
        }
        // ========================================
        
        const newTex = new pc.Texture(app.graphicsDevice, { 
            width: w, 
            height: h, 
            format: format, 
            mipmaps: true 
        });
        newTex.setSource(tempCanvas); 
        newTex.upload(); 
        tempCanvas.width = 0; 
        tempCanvas.height = 0; 
        return newTex;
    } catch(e) { 
        dbg("Texture downscale error: " + e.message);
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
    
    if (fileName.toLowerCase().endsWith('.gltf')) {
        if (isBlobUrl) URL.revokeObjectURL(url);
        alert("Format .gltf memerlukan file .bin dan texture terpisah.\n\nGunakan format .glb (binary, single-file).");
        return;
    }
    
    if (fileName.toLowerCase().endsWith('.vrm')) {
        if (!confirm("Format .VRM sering gagal dibaca karena ekstensi khusus VRoid.\nDisarankan export ke .GLB. Tetap lanjutkan?")) {
            if (isBlobUrl) URL.revokeObjectURL(url);
            return;
        }
    }
    
    S.isLoadingModel = true;
    $('loadingOverlay').style.display = 'flex';
    $('loadingText').textContent = "Memproses " + fileName;
    $('import').disabled = true;
    
    const asset = new pc.Asset(fileName, 'container', { url: url });
    
    asset.on('load', (loadedAsset) => {
        try {
            const entity = loadedAsset.resource.instantiateRenderEntity();
            const resource = loadedAsset.resource;
            
            // 1. Tangkap Data Animasi
            if (resource.animations && resource.animations.length > 0) {
                entity._animAssets = resource.animations;
                entity._animNames = resource.animations.map(a => a.name);
                dbg("✅ Animasi terdeteksi: " + entity._animNames.join(', '));
            }
            
            // 2. Tangkap Data Morph Targets (Blendshapes)
            const renderComps = entity.findComponents('render');
            for (const comp of renderComps) {
                if (comp.meshInstances && comp.meshInstances.length > 0) {
                    const mesh = comp.meshInstances[0].mesh;
                    if (mesh && mesh.morphInstance) {
                        entity._morphInstance = mesh.morphInstance;
                        entity._morphNames = mesh.morphInstance.morphTargets.map(mt => mt.name);
                        dbg("✅ Blendshapes terdeteksi: " + entity._morphNames.join(', '));
                        break;
                    }
                }
            }
            
            const renderCompsCheck = entity.findComponents('render');
            let meshCount = 0;
            renderCompsCheck.forEach(comp => { if (comp.meshInstances) meshCount += comp.meshInstances.length; });
            
            if (!entity || meshCount === 0) {
                alert("Tidak ada mesh 3D yang valid di file ini.");
                if (entity && typeof entity.destroy === 'function') entity.destroy();
                app.assets.remove(loadedAsset);
                if (isBlobUrl) URL.revokeObjectURL(url);
                return;
            }
            
            entity._asset = loadedAsset;
            entity.findComponents('light').forEach(l => l.destroy());
            
            let meshCacheArr = [];
            const texScale = parseInt($('texScale').value);
            
            renderCompsCheck.forEach(comp => {
                if (!comp.meshInstances) return;
                comp.meshInstances.forEach(mi => {
                    if (!mi.mesh || !mi.material) return;
                    
                    if (Array.isArray(mi.material)) mi.material = mi.material.map(m => m ? m.clone() : m);
                    else mi.material = mi.material.clone();
                    
                    if (texScale < 100) {
                        const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                        mats.forEach(mat => {
                            if (!mat) return;
                            const params = mat.getParameters();
                            for (const key in params) {
                                if (params[key].data instanceof pc.Texture) {
                                    const oldTex = params[key].data;
                                    const newTex = downscaleTexture(oldTex, texScale);
                                    if (newTex && newTex !== oldTex) { 
                                        params[key].data = newTex; 
                                    }
                                    mat.update();
                                }
                            }
                        });
                    }
                    
                    if (mi.skinInstance) {
                        dbg("Skipped cache for skinned mesh: " + (mi.mesh.name || 'unnamed'));
                        return;
                    }
                    
                    try {
                        const pos = mi.mesh.getPositions();
                        if (pos) {
                            const idx = mi.mesh.getIndices() || [];
                            const uvs = mi.mesh.getUvs ? mi.mesh.getUvs() : null;
                            const nrm = mi.mesh.getNormals ? mi.mesh.getNormals() : null;
                            meshCacheArr.push({
                                pos: Array.from(pos),
                                idx: Array.from(idx),
                                uvs: uvs ? Array.from(uvs) : null,
                                normals: nrm ? Array.from(nrm) : null
                            });
                        }
                    } catch(ce) {
                        dbg("Cache import fail: " + ce.message);
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
            meshCachePool.set(entity.name, meshCacheArr);
            
            saveState();
            updateTree(); 
            selectObject(entity);
            
            if (isBlobUrl) setTimeout(() => URL.revokeObjectURL(url), 2000);
            
        } catch (renderErr) {
            dbg("IMPORT ERROR: " + renderErr.message + "\nSTACK: " + renderErr.stack);
            alert("Gagal memproses model. Cek Debug Log (🐛) atau tekan Save Log.");
            app.assets.remove(loadedAsset);
            if (isBlobUrl) URL.revokeObjectURL(url);
        } finally {
            S.isLoadingModel = false;
            $('loadingOverlay').style.display = 'none';
            $('import').disabled = false;
        }
    });
    
    asset.on('error', (err) => {
        dbg("ASSET ERROR: " + err);
        alert("Gagal memuat file. Format GLB mungkin tidak didukung (Draco) atau korup.");
        app.assets.remove(asset);
        if (isBlobUrl) URL.revokeObjectURL(url);
        S.isLoadingModel = false;
        $('loadingOverlay').style.display = 'none';
        $('import').disabled = false;
    });
    
    try {
        app.assets.add(asset);
        app.assets.load(asset);
    } catch (e) {
        dbg("Asset add/load failed: " + e.message);
        S.isLoadingModel = false;
        $('loadingOverlay').style.display = 'none';
        $('import').disabled = false;
        if (isBlobUrl) URL.revokeObjectURL(url);
    }
}

$('import').onclick = () => $('file').click();
$('file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size === 0) { alert("File kosong!"); e.target.value = ''; return; }
    if (file.size > CONFIG.MAX_IMPORT_SIZE) { alert("File > 20 MB!"); e.target.value = ''; return; }
    const url = URL.createObjectURL(file);
    loadModelFromUrl(file.name, url, true);
    e.target.value = '';
};

window.loadModelFromIntent = function(fileUrl) {
    try {
        const fileName = decodeURIComponent(fileUrl.split('/').pop().split('?')[0]);
        dbg("Intent model detected: " + fileName);
        loadModelFromUrl(fileName, fileUrl, false);
    } catch (e) {
        dbg("loadModelFromIntent error: " + e.message);
    }
};
