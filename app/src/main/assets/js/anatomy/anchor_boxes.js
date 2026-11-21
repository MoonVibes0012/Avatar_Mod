/* ===== VTuber Forge — js/anatomy/anchor_boxes.js ===== */
// Pool kotak kecil (anchor handle) pada titik anatomi, hemat draw-call untuk GPU MP3 & ramah sentuh

(function () {
    'use strict';

    const pool = [];
    const materialCache = new Map();
    let containerEntity = null;
    let enabled = false;
    let densityMode = 'core';
    let activePartId = null;
    let activeRecord = null;
    let lastUpdateMs = 0;

    function getPcAppSafe() {
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a) return a;
        }
        return (typeof window.app !== 'undefined' && window.app) ? window.app : null;
    }

    function getActiveCamera() {
        const pcApp = getPcAppSafe();
        if (!pcApp || !pcApp.root) return null;
        const camEnt = pcApp.root.findByName('camera');
        return (camEnt && camEnt.camera) ? camEnt.camera : null;
    }

    function ensureContainer() {
        const pcApp = getPcAppSafe();
        if (!pcApp || !pcApp.root) return null;
        if (containerEntity && containerEntity.parent) return containerEntity;

        containerEntity = new pc.Entity('vtf_anatomy_anchors_root');
        pcApp.root.addChild(containerEntity);
        return containerEntity;
    }

    function getUnlitBoxMaterial(rgb, dimmed) {
        const r = dimmed ? rgb[0] * 0.45 : rgb[0];
        const g = dimmed ? rgb[1] * 0.45 : rgb[1];
        const b = dimmed ? rgb[2] * 0.45 : rgb[2];
        const key = r.toFixed(2) + '_' + g.toFixed(2) + '_' + b.toFixed(2);
        if (materialCache.has(key)) return materialCache.get(key);

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(r * 0.25, g * 0.25, b * 0.25);
        mat.emissive = new pc.Color(r, g, b);
        mat.useLighting = false;
        mat.depthTest = false;
        mat.depthWrite = false;
        mat.update();

        materialCache.set(key, mat);
        return mat;
    }

    function getOrCreateBoxEntity(index) {
        const root = ensureContainer();
        if (!root) return null;

        while (pool.length <= index) {
            const ent = new pc.Entity('vtf_anchor_box_' + pool.length);
            ent.addComponent('render', {
                type: 'box',
                castShadows: false,
                receiveShadows: false
            });
            ent.enabled = false;
            root.addChild(ent);
            pool.push(ent);
        }
        return pool[index];
    }

    function hideAllBoxes() {
        for (let i = 0; i < pool.length; i++) {
            if (pool[i]) pool[i].enabled = false;
        }
    }

    function setEnabled(flag) {
        enabled = !!flag;
        if (!enabled) {
            hideAllBoxes();
        } else {
            syncBoxes(true);
        }
    }

    function setDensityMode(mode) {
        densityMode = (mode === 'full') ? 'full' : 'core';
        if (enabled) syncBoxes(true);
    }

    function setTargetRecord(record) {
        activeRecord = record || null;
        if (!activeRecord) {
            activePartId = null;
            hideAllBoxes();
            return;
        }
        if (enabled) syncBoxes(true);
    }

    function setSelectedPart(partId) {
        activePartId = partId || null;
        if (enabled) syncBoxes(true);
    }

    function getVisiblePartEntries() {
        if (!activeRecord || !activeRecord.parts || !window.AnatomyRegistry) return [];
        const allowed = window.AnatomyRegistry.getPartIdsByDensity(densityMode);
        const list = [];
        for (let i = 0; i < allowed.length; i++) {
            const id = allowed[i];
            if (activeRecord.parts[id]) {
                list.push(activeRecord.parts[id]);
            }
        }
        return list;
    }

    function syncBoxes(force) {
        if (!enabled || !activeRecord || !activeRecord.root) {
            hideAllBoxes();
            return;
        }

        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (!force && (now - lastUpdateMs) < 32) return;
        lastUpdateMs = now;

        const entries = getVisiblePartEntries();
        const scaleFactor = Math.max(0.45, Math.min(2.2, (activeRecord.modelScale || 1.5) / 1.5));

        for (let i = 0; i < entries.length; i++) {
            const partEntry = entries[i];
            const boxEnt = getOrCreateBoxEntity(i);
            if (!boxEnt || !partEntry || !partEntry.entity) continue;

            const def = window.AnatomyRegistry.getPartDef(partEntry.partId);
            const isSelected = (activePartId === partEntry.partId);
            const baseSize = ((def && def.size) ? def.size : 0.05) * scaleFactor;
            const finalSize = isSelected ? baseSize * 0.72 : baseSize;

            const wPos = partEntry.entity.getPosition();
            boxEnt.setPosition(wPos.x, wPos.y, wPos.z);
            boxEnt.setLocalScale(finalSize, finalSize, finalSize);
            boxEnt._anatomyPartId = partEntry.partId;

            if (boxEnt.render && def && def.color) {
                boxEnt.render.material = getUnlitBoxMaterial(def.color, isSelected);
            }
            boxEnt.enabled = true;
        }

        for (let j = entries.length; j < pool.length; j++) {
            if (pool[j]) pool[j].enabled = false;
        }
    }

    function hitTestScreenPoint(clientX, clientY, tolerancePx) {
        if (!enabled || !activeRecord) return null;
        const cam = getActiveCamera();
        const canvas = document.getElementById('gl');
        if (!cam || !canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const tol = Math.max(20, Number(tolerancePx) || 34);

        const screenPos = new pc.Vec3();
        let bestPartId = null;
        let bestDist = tol;

        for (let i = 0; i < pool.length; i++) {
            const box = pool[i];
            if (!box || !box.enabled || !box._anatomyPartId) continue;

            const wPos = box.getPosition();
            cam.worldToScreen(wPos, screenPos);
            if (screenPos.z < 0) continue;

            const dx = screenPos.x - x;
            const dy = screenPos.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist <= bestDist) {
                bestDist = dist;
                bestPartId = box._anatomyPartId;
            }
        }

        return bestPartId;
    }

    function destroyAll() {
        hideAllBoxes();
        for (let i = 0; i < pool.length; i++) {
            try { if (pool[i]) pool[i].destroy(); } catch (e) {}
        }
        pool.length = 0;
        materialCache.forEach(mat => {
            try { if (mat && mat.destroy) mat.destroy(); } catch (e) {}
        });
        materialCache.clear();
        if (containerEntity) {
            try { containerEntity.destroy(); } catch (e) {}
            containerEntity = null;
        }
    }

    window.AnatomyAnchorBoxes = {
        setEnabled: setEnabled,
        isEnabled: function () { return enabled; },
        setDensityMode: setDensityMode,
        getDensityMode: function () { return densityMode; },
        setTargetRecord: setTargetRecord,
        setSelectedPart: setSelectedPart,
        getSelectedPart: function () { return activePartId; },
        syncBoxes: syncBoxes,
        hitTestScreenPoint: hitTestScreenPoint,
        destroyAll: destroyAll
    };
})();
