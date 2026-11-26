/* ===== VTuber Forge — js/entities/create.js ===== */
// Pembuatan objek primitive, bone, dan avatar parts

(function () {
    'use strict';

    /**
     * Memperbarui teks status pada bar status aplikasi jika elemen tersedia.
     */
    function setCreateStatus(msg) {
        try {
            const el = document.getElementById('status');
            if (el) el.textContent = msg;
        } catch (e) {}
    }

    /**
     * Mengambil instance pc.Application aktif secara aman.
     */
    function getCreateApp() {
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
    function getCreateState() {
        if (typeof window.S !== 'undefined' && window.S) return window.S;
        try {
            if (typeof S !== 'undefined' && S) return S;
        } catch (e) {}
        return null;
    }

    /**
     * Membuat entitas objek primitif, bone visual, atau bagian tubuh dasar ke dalam scene.
     */
    function addObj(type, name) {
        const pcApp = getCreateApp();
        const st = getCreateState();
        if (!pcApp || !pcApp.root || !st) {
            setCreateStatus("⚠ Scene belum siap.");
            return null;
        }

        try {
            const id = (typeof st.maxId === 'number' && isFinite(st.maxId)) ? st.maxId++ : 1;
            const label = name || type || 'box';
            const e = new pc.Entity(`${label}-${id}`);
            e.addComponent('render', { type: 'box', castShadows: false });

            const m = new pc.StandardMaterial();
            m.diffuse = new pc.Color(0.68, 0.32, 0.92);
            m.metalness = 0.0;
            m.gloss = 0.45;
            if (typeof m.update === 'function') m.update();
            e.render.material = m;

            if (type === 'sphere') {
                e.render.type = 'sphere';
            } else if (type === 'cylinder') {
                e.render.type = 'cylinder';
            } else if (type === 'capsule') {
                e.render.type = 'capsule';
            } else if (type === 'plane') {
                e.render.type = 'plane';
                e.setLocalScale(2.0, 1.0, 2.0);
            } else if (type === 'bone') {
                e.render.type = 'cone';
                e.setLocalScale(0.16, 0.65, 0.16);
                e.setPosition(0, 1.0, 0);
                e._isBoneHelper = true;
                m.diffuse = new pc.Color(0.22, 0.85, 0.65);
                if (typeof m.update === 'function') m.update();
            } else if (type === 'body') {
                e.render.type = 'capsule';
                e.setLocalScale(0.7, 1.0, 0.45);
            } else if (type === 'head') {
                e.render.type = 'sphere';
                e.setLocalScale(0.55, 0.6, 0.55);
                e.setPosition(0, 1.65, 0);
            } else if (type === 'eye') {
                e.render.type = 'sphere';
                e.setLocalScale(0.1, 0.14, 0.08);
                e.setPosition(0.11, 1.68, 0.24);
            } else if (type === 'hair') {
                e.render.type = 'box';
                e.setLocalScale(0.6, 0.7, 0.35);
                e.setPosition(0, 1.55, -0.18);
            }

            e._baseScale = e.getLocalScale().clone();
            e._baseRot = e.getEulerAngles().clone();

            if (!Array.isArray(st.objects)) st.objects = [];
            pcApp.root.addChild(e);
            st.objects.push(e);

            if (typeof window.saveState === 'function') window.saveState();
            if (typeof window.updateTree === 'function') window.updateTree();
            if (typeof window.selectObject === 'function') window.selectObject(e);

            setCreateStatus("Ditambahkan: " + e.name);
            return e;
        } catch (err) {
            setCreateStatus("⚠ Gagal menambah objek: " + err.message);
            return null;
        }
    }
    window.addObj = addObj;

    /**
     * Menghubungkan seluruh tombol `[data-add]` pada panel kiri setelah template dirender.
     */
    function bindCreateControls() {
        try {
            document.querySelectorAll('[data-add]').forEach(b => {
                b.onclick = () => addObj(b.dataset.add);
            });
        } catch (err) {
            setCreateStatus("⚠ Gagal bind tombol primitif: " + err.message);
        }
    }

    bindCreateControls();
    window.__vtfBindCreateControls = bindCreateControls;
})();
