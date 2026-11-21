/* ===== VTuber Forge — js/ui/panels_template.js ===== */
// Template & renderer isi panel MENU (#leftBody) dan INSPECT (#rightBody)

(function () {
    'use strict';

    const LEFT_HTML = [
        '<div class="sec">',
        '  <h4>+ Tambah Object</h4>',
        '  <div class="grid2">',
        '    <button type="button" data-add="box">Box</button>',
        '    <button type="button" data-add="sphere">Sphere</button>',
        '    <button type="button" data-add="cylinder">Cylinder</button>',
        '    <button type="button" data-add="capsule">Capsule</button>',
        '    <button type="button" data-add="body">Body</button>',
        '    <button type="button" data-add="head">Head</button>',
        '    <button type="button" data-add="eye">Eye</button>',
        '    <button type="button" data-add="hair">Hair</button>',
        '  </div>',
        '</div>',
        '<div class="sec">',
        '  <h4>Scene & File</h4>',
        '  <div class="grid2">',
        '    <button type="button" id="importMenu">Import Model</button>',
        '    <button type="button" id="loadSceneBtn">Load JSON</button>',
        '    <button type="button" id="x-obj">Export OBJ</button>',
        '    <button type="button" id="x-vrm">Export VRM</button>',
        '  </div>',
        '</div>',
        '<div class="sec">',
        '  <h4>Hierarchy / Objects</h4>',
        '  <div id="tree" class="tree-list">Belum ada objek.</div>',
        '</div>'
    ].join('');

    const RIGHT_HTML = [
        '<div class="sec">',
        '  <h4>Transform</h4>',
        '  <div class="row-inline">',
        '    <button type="button" id="snapToggle">Grid Snap</button>',
        '    <button type="button" id="focusBtn">Focus</button>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Pos X <span id="pxo">0.00</span></label>',
        '    <div class="in-pair"><input id="px" type="number" step="0.1" value="0"><input id="pxR" type="range" min="-10" max="10" step="0.1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Pos Y <span id="pyo">0.00</span></label>',
        '    <div class="in-pair"><input id="py" type="number" step="0.1" value="0"><input id="pyR" type="range" min="-10" max="10" step="0.1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Pos Z <span id="pzo">0.00</span></label>',
        '    <div class="in-pair"><input id="pz" type="number" step="0.1" value="0"><input id="pzR" type="range" min="-10" max="10" step="0.1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Rot X <span id="rxo">0</span></label>',
        '    <div class="in-pair"><input id="rx" type="number" step="5" value="0"><input id="rxR" type="range" min="-180" max="180" step="1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Rot Y <span id="ryo">0</span></label>',
        '    <div class="in-pair"><input id="ry" type="number" step="5" value="0"><input id="ryR" type="range" min="-180" max="180" step="1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Rot Z <span id="rzo">0</span></label>',
        '    <div class="in-pair"><input id="rz" type="number" step="5" value="0"><input id="rzR" type="range" min="-180" max="180" step="1" value="0"></div>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Scale <span id="sco">1.00</span></label>',
        '    <div class="in-pair"><input id="sc" type="number" step="0.1" min="0.01" value="1"><input id="scR" type="range" min="0.1" max="5" step="0.05" value="1"></div>',
        '  </div>',
        '</div>',
        '<div class="sec">',
        '  <h4>Material</h4>',
        '  <div class="prop">',
        '    <label>Color</label>',
        '    <input id="color" type="color" value="#ad52eb">',
        '  </div>',
        '  <div class="prop">',
        '    <label>Gloss <span id="rougho">0.50</span></label>',
        '    <input id="rough" type="range" min="0" max="1" step="0.01" value="0.5">',
        '  </div>',
        '  <div class="prop">',
        '    <label>Metalness <span id="meto">0.00</span></label>',
        '    <input id="metal" type="range" min="0" max="1" step="0.01" value="0">',
        '  </div>',
        '  <div class="prop">',
        '    <label>Tex Scale <span id="texScaleOut">1</span></label>',
        '    <input id="texScale" type="range" min="0.5" max="4" step="0.5" value="1">',
        '  </div>',
        '</div>',
        '<div class="sec">',
        '  <h4>Motion & Clips</h4>',
        '  <div class="grid3">',
        '    <button type="button" id="animSpin">Spin</button>',
        '    <button type="button" id="animPulse">Pulse</button>',
        '    <button type="button" id="animWobble">Wobble</button>',
        '  </div>',
        '  <div class="prop">',
        '    <label>Clip</label>',
        '    <select id="animSelect"><option value="">-- Tidak ada clip --</option></select>',
        '  </div>',
        '  <div class="grid3">',
        '    <button type="button" id="animPlay">Play</button>',
        '    <button type="button" id="animPause">Pause</button>',
        '    <button type="button" id="animStop">Stop</button>',
        '  </div>',
        '</div>'
    ].join('');

    function renderPanelsTemplates() {
        const leftBody = document.getElementById('leftBody');
        const rightBody = document.getElementById('rightBody');

        if (leftBody && !leftBody.dataset.vtfRendered) {
            leftBody.innerHTML = LEFT_HTML;
            leftBody.dataset.vtfRendered = '1';
        }
        if (rightBody && !rightBody.dataset.vtfRendered) {
            rightBody.innerHTML = RIGHT_HTML;
            rightBody.dataset.vtfRendered = '1';
        }

        if (typeof window.__vtfBindTransformInputs === 'function') {
            window.__vtfBindTransformInputs();
        }
        if (typeof window.__vtfBindToolbarControls === 'function') {
            window.__vtfBindToolbarControls();
        }
        if (typeof window.updateTree === 'function') {
            window.updateTree();
        }
    }

    window.renderPanelsTemplates = renderPanelsTemplates;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderPanelsTemplates);
    } else {
        renderPanelsTemplates();
    }
})();
