/* ===== VTuber Forge — js/io/import.js ===== */
// Koordinator import aset (.OBJ, .DDS, & delegasi .GLB/.VRM ke glb_loader.js)

(function () {
    'use strict';

    function getAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function getStateSafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    function setImportStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        }
    }

    function notifyImportError(msg) {
        console.error(msg);
        setImportStatus('⚠ ' + msg);
        try {
            if (typeof alert === 'function') alert(msg);
        } catch (e) {}
    }

    function applyDdsTextureToEntity(targetEntity, ddsTex, fileName) {
        if (!targetEntity || !ddsTex) return 0;
        let appliedCount = 0;

        if (typeof targetEntity.findComponents === 'function') {
            const renders = targetEntity.findComponents('render');
            for (let i = 0; i < renders.length; i++) {
                const mis = renders[i].meshInstances || [];
                for (let j = 0; j < mis.length; j++) {
                    const mi = mis[j];
                    if (!mi || !mi.material) continue;
                    const mats = Array.isArray(mi.material) ? mi.material : [mi.material];
                    for (let k = 0; k < mats.length; k++) {
                        const m = mats[k];
                        if (!m) continue;
                        if (m.diffuseMap && m.diffuseMap !== ddsTex && typeof m.diffuseMap.destroy === 'function') {
                            try { m.diffuseMap.destroy(); } catch (e) {}
                        }
                        m.diffuseMap = ddsTex;
                        m.diffuse = new pc.Color(1, 1, 1);
                        if (typeof m.update === 'function') m.update();
                        appliedCount++;
                    }
                }
            }
        }

        targetEntity._ddsTextureName = fileName || 'texture.dds';
        return appliedCount;
    }

    function importDdsFile(file) {
        if (!file) return;
        const pcApp = getAppSafe();
        const st = getStateSafe();

        if (!window.VtfDdsLoader || typeof window.VtfDdsLoader.createTexture !== 'function') {
            notifyImportError('Modul DDS Loader belum siap.');
            return;
        }
        if (!pcApp || !pcApp.graphicsDevice) {
            notifyImportError('Graphics device PlayCanvas belum siap.');
            return;
        }

        const target = (st && st.selected) ? st.selected : null;
        if (!target) {
            notifyImportError('Pilih model (VRM/GLB/Box) terlebih dahulu di layar, baru import file DDS!');
            return;
        }

        setImportStatus('⏳ Membaca tekstur DDS: ' + file.name + '...');
        const r = new FileReader();
        r.onload = function (ev) {
            try {
                const buf = ev.target.result;
                const ddsTex = window.VtfDdsLoader.createTexture(pcApp.graphicsDevice, buf, file.name);

                if (!target) {
                    throw new Error('Pilih model (VRM/GLB/Box) terlebih dahulu di layar, baru import file DDS!');
                }

                const count = applyDdsTextureToEntity(target, ddsTex, file.name);
                if (typeof window.selectObject === 'function') window.selectObject(target);
                else if (typeof selectObject === 'function') selectObject(target);
                if (typeof window.updateTree === 'function') window.updateTree();
                else if (typeof updateTree === 'function') updateTree();
                if (typeof window.saveState === 'function') window.saveState();
                else if (typeof saveState === 'function') saveState();

                const fmt = ddsTex._vtfDdsFormat || 'DDS';
                setImportStatus(
                    '✓ Tekstur DDS (' + fmt + ', ' + ddsTex.width + 'x' + ddsTex.height + ') diterapkan ke ' +
                    (target.name || 'objek') + ' (' + count + ' material)'
                );
            } catch (err) {
                notifyImportError('Gagal membaca file DDS: ' + (err && err.message ? err.message : err));
            }
        };
        r.onerror = function () {
            notifyImportError('Gagal membaca berkas DDS dari penyimpanan.');
        };
        r.readAsArrayBuffer(file);
    }

    function importOBJ(file) {
        const pcApp = getAppSafe();
        const st = getStateSafe();
        if (!pcApp || !pcApp.graphicsDevice || !st) {
            notifyImportError('Scene atau graphics device belum siap untuk import OBJ.');
            return;
        }

        setImportStatus('⏳ Memuat OBJ: ' + file.name + '...');
        const r = new FileReader();
        r.onload = function (e) {
            try {
                const lines = String(e.target.result || '').split('\n');
                const v = [], n = [], u = [], f = [];
                lines.forEach((l) => {
                    const p = l.trim().split(/\s+/);
                    if (p[0] === 'v') v.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0]);
                    else if (p[0] === 'vn') n.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0]);
                    else if (p[0] === 'vt') u.push([parseFloat(p[1]) || 0, parseFloat(p[2]) || 0]);
                    else if (p[0] === 'f') {
                        const poly = p.slice(1).map((s) => {
                            const i = s.split('/').map((x) => parseInt(x, 10) - 1);
                            return { v: i[0], u: i[1], n: i[2] };
                        });
                        for (let j = 1; j < poly.length - 1; j++) f.push(poly[0], poly[j], poly[j + 1]);
                    }
                });

                if (v.length === 0 || f.length === 0) {
                    throw new Error('File OBJ kosong atau format tidak valid.');
                }

                const pos = [], norm = [], uv = [], idx = [];
                let c = 0;
                f.forEach((pt) => {
                    if (v[pt.v]) {
                        pos.push(...v[pt.v]);
                        norm.push(...(n[pt.n] || [0, 1, 0]));
                        uv.push(...(u[pt.u] || [0, 0]));
                        idx.push(c++);
                    }
                });

                const m = new pc.Mesh(pcApp.graphicsDevice);
                m.setPositions(pos);
                m.setNormals(norm);
                m.setUvs(0, uv);
                m.setIndices(idx);
                m.update();

                st.cnt = st.cnt || 1;
                st.objects = st.objects || [];
                const ent = new pc.Entity(file.name.replace(/\.obj$/i, '') + '_' + (st.cnt++));
                const mat = new pc.StandardMaterial();
                mat.diffuse = new pc.Color(0.55, 0.45, 0.85);
                mat.gloss = 0.5;
                mat.update();

                ent.addComponent('render', { type: 'asset' });
                ent.render.meshInstances = [new pc.MeshInstance(m, mat)];
                ent.setPosition(0, 1, 0);

                // Standarisasi _meshCache ke format Array [{ pos, idx, uvs, normals }]
                const cacheEntry = {
                    pos: Array.from(pos),
                    idx: Array.from(idx),
                    uvs: Array.from(uv),
                    normals: Array.from(norm)
                };
                ent._meshCache = [cacheEntry];
                ent._isObj = true;
                if (window.meshCachePool && typeof window.meshCachePool.set === 'function') {
                    window.meshCachePool.set(ent.name, ent._meshCache);
                } else if (Array.isArray(window.meshCachePool)) {
                    window.meshCachePool.push(cacheEntry);
                }

                pcApp.root.addChild(ent);
                st.objects.push(ent);
                if (typeof window.selectObject === 'function') window.selectObject(ent);
                else if (typeof selectObject === 'function') selectObject(ent);
                if (typeof window.updateTree === 'function') window.updateTree();
                else if (typeof updateTree === 'function') updateTree();
                if (typeof window.saveState === 'function') window.saveState();
                else if (typeof saveState === 'function') saveState();

                setImportStatus('✓ OBJ Imported: ' + file.name);
            } catch (err) {
                notifyImportError('Gagal import OBJ: ' + (err && err.message ? err.message : err));
            }
        };
        r.onerror = function () {
            notifyImportError('Gagal membaca berkas OBJ.');
        };
        r.readAsText(file);
    }

    function handleSelectedFile(f) {
        if (!f) return;
        const name = String(f.name || '').toLowerCase();
        if (name.endsWith('.dds')) {
            importDdsFile(f);
        } else if (name.endsWith('.obj')) {
            importOBJ(f);
        } else if (name.endsWith('.glb') || name.endsWith('.vrm')) {
            if (typeof window.importGLB === 'function') {
                setImportStatus('⏳ Memuat model: ' + f.name + '...');
                window.importGLB(f);
            } else {
                notifyImportError('Modul GLB/VRM Loader belum siap.');
            }
        } else {
            notifyImportError('Format tidak didukung! Gunakan file .VRM, .GLB, .OBJ, atau .DDS.');
        }
    }

    function bindFileImport() {
        const fileInput = document.getElementById('file');
        if (!fileInput) return;
        if (fileInput.dataset.vtfImportBound === '1') return;
        fileInput.dataset.vtfImportBound = '1';

        fileInput.addEventListener('change', function (e) {
            const files = e && e.target ? e.target.files : null;
            const f = files && files[0] ? files[0] : null;
            handleSelectedFile(f);
            try {
                e.target.value = '';
            } catch (err) {}
        });
    }

    window.applyDdsTextureToEntity = applyDdsTextureToEntity;
    window.importDdsFile = importDdsFile;
    window.importOBJ = importOBJ;
    window.__vtfBindFileImport = bindFileImport;

    bindFileImport();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindFileImport);
    }
})();
