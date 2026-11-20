/* ===== VTuber Forge — js/entities/create.js ===== */
// Pembuatan objek primitive dan avatar parts

(function () {
    'use strict';

    function setCreateStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function getCreateApp() {
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

    function addObj(type, name) {
        const pcApp = getCreateApp();
        if (!pcApp || !pcApp.root) {
            setCreateStatus("⚠ Scene belum siap.");
            return null;
        }

        const id = (typeof S.maxId === 'number' && isFinite(S.maxId)) ? S.maxId++ : 1;
        const label = name || type;
        const e = new pc.Entity(`${label}-${id}`);
        e.addComponent('render', { type: 'box', castShadows: false });

        const m = new pc.StandardMaterial();
        m.diffuse = new pc.Color(0.6, 0.2, 0.8);
        if (typeof m.update === 'function') m.update();
        e.render.material = m;

        if (type === 'sphere') {
            e.render.type = 'sphere';
        } else if (type === 'cylinder') {
            e.render.type = 'cylinder';
        } else if (type === 'capsule') {
            e.render.type = 'capsule';
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

        pcApp.root.addChild(e);
        S.objects.push(e);

        if (typeof saveState === 'function') saveState();
        if (typeof updateTree === 'function') updateTree();
        if (typeof selectObject === 'function') selectObject(e);

        setCreateStatus("Ditambahkan: " + e.name);
        return e;
    }
    window.addObj = addObj;

    document.querySelectorAll('[data-add]').forEach(b => {
        b.onclick = () => addObj(b.dataset.add);
    });
})();
