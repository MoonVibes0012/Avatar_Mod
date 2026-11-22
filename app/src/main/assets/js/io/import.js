/* ===== VTuber Forge — js/io/import.js ===== */
// Koordinator import aset (.OBJ, .DDS, serta delegasi .GLB/.VRM/.GLTF ke glb_loader.js)

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
    if (!window.VtfDdsLoader || typeof window.VtfDdsLoader.createTexture !== 'function') {
        alert('Modul DDS Loader belum siap.');
        return;
    }

    const r = new FileReader();
    r.onload = function (ev) {
        try {
            const buf = ev.target.result;
            const ddsTex = window.VtfDdsLoader.createTexture(app.graphicsDevice, buf, file.name);
            let target = (typeof S !== 'undefined' && S && S.selected) ? S.selected : null;

            if (!target && typeof addObj === 'function') {
                target = addObj('box');
                if (target) {
                    target.name = file.name.replace(/\.dds$/i, '') + '_DDS';
                }
            }

            if (!target) {
                throw new Error('Tidak ada objek target untuk menerapkan tekstur DDS.');
            }

            const count = applyDdsTextureToEntity(target, ddsTex, file.name);
            if (typeof selectObject === 'function') selectObject(target);
            if (typeof updateTree === 'function') updateTree();
            if (typeof saveState === 'function') saveState();

            const fmt = ddsTex._vtfDdsFormat || 'DDS';
            document.getElementById('status').textContent =
                '✓ Tekstur DDS (' + fmt + ', ' + ddsTex.width + 'x' + ddsTex.height + ') diterapkan ke ' +
                (target.name || 'objek') + ' (' + count + ' material)';
            if (typeof dbg === 'function') {
                dbg('✓ DDS loaded: ' + file.name + ' [' + fmt + ' ' + ddsTex.width + 'x' + ddsTex.height + ']');
            }
        } catch (err) {
            console.error('DDS Import Error:', err);
            alert('Gagal membaca file DDS: ' + (err && err.message ? err.message : err));
        }
    };
    r.readAsArrayBuffer(file);
}

function importOBJ(file) {
    const r = new FileReader();
    r.onload = (e) => {
        try {
            const lines = e.target.result.split('\n');
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

            const m = new pc.Mesh(app.graphicsDevice);
            m.setPositions(pos);
            m.setNormals(norm);
            m.setUvs(0, uv);
            m.setIndices(idx);
            m.update();

            const ent = new pc.Entity(file.name.replace(/\.obj$/i, '') + '_' + (S.cnt++));
            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(0.55, 0.45, 0.85);
            mat.gloss = 0.5;
            mat.update();

            ent.addComponent('render', { type: 'asset' });
            ent.render.meshInstances = [new pc.MeshInstance(m, mat)];
            ent.setPosition(0, 1, 0);

            ent._meshCache = {
                positions: Array.from(pos),
                indices: Array.from(idx),
                uvs: Array.from(uv),
                normals: Array.from(norm)
            };
            ent._isObj = true;
            if (typeof meshCachePool !== 'undefined') meshCachePool.push(ent._meshCache);

            app.root.addChild(ent);
            S.objs.push(ent);
            selectObject(ent);
            updateTree();
            saveState();
            document.getElementById('status').textContent = '✓ OBJ Imported: ' + file.name;
        } catch (err) {
            console.error('OBJ Import Error:', err);
            alert('Gagal import OBJ: ' + err.message);
        }
    };
    r.readAsText(file);
}

const fileInput = document.getElementById('file');
if (fileInput) {
    fileInput.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const name = f.name.toLowerCase();
        if (name.endsWith('.dds')) importDdsFile(f);
        else if (name.endsWith('.obj')) importOBJ(f);
        else if (name.endsWith('.glb') || name.endsWith('.vrm') || name.endsWith('.gltf')) {
            if (typeof window.importGLB === 'function') window.importGLB(f);
            else alert('Modul GLB Loader belum siap.');
        } else {
            alert('Format tidak didukung! Gunakan file .VRM, .GLB, .OBJ, atau .DDS.');
        }
        e.target.value = '';
    };
}
