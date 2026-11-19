/* ===== VTuber Forge — js/camera/controls.js ===== */
/* FULL REPLACE — Kamera orbit + panel buka/tutup dengan sinkronisasi pivot/camera. */

(function () {
'use strict';

function $(id) { return document.getElementById(id); }
function getApp() { return (typeof window.app !== 'undefined' && window.app) ? window.app : null; }
function log(msg) {
    if (typeof window.dbg === 'function') { try { window.dbg(msg); } catch (e) {} }
    else if (typeof console !== 'undefined') { console.log(msg); }
}

// ---------- PANEL (fallback, kalau app.html tanpa __vtfSetPanel) ----------
function setPanelFallback(id, open) {
    if (typeof window.__vtfSetPanel === 'function') {
        window.__vtfSetPanel(id, open);
        return;
    }
    var panel = $(id);
    if (!panel) return;
    panel.classList.toggle('mobile-open', !!open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    var backdrop = $('panelBackdrop');
    if (backdrop) {
        var anyOpen = !!document.querySelector('.panel.mobile-open');
        backdrop.hidden = !anyOpen;
    }
    var btn = (id === 'left') ? $('parts') : $('inspector');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function setupPanels() {
    if (window.__vtfPanelsBound) return;
    window.__vtfPanelsBound = true;

    var parts = $('parts');
    if (parts) parts.addEventListener('click', function () {
        var p = $('left');
        setPanelFallback('left', p ? !p.classList.contains('mobile-open') : true);
    });
    var inspector = $('inspector');
    if (inspector) inspector.addEventListener('click', function () {
        var p = $('right');
        setPanelFallback('right', p ? !p.classList.contains('mobile-open') : true);
    });
    document.querySelectorAll('.btn-close-panel').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setPanelFallback(btn.getAttribute('data-panel'), false);
        });
    });
    var backdrop = $('panelBackdrop');
    if (backdrop) backdrop.addEventListener('click', function () {
        setPanelFallback('left', false);
        setPanelFallback('right', false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            setPanelFallback('left', false);
            setPanelFallback('right', false);
        }
    });
}

// ---------- KAMERA ----------
var CameraControls = {
    camera: null,
    pivot: null,
    canvas: null,
    app: null,
    enabled: true,

    yaw: 0,
    pitch: 12,
    distance: 4.5,
    target: { x: 0, y: 1.1, z: 0 },

    minDistance: 0.8,
    maxDistance: 12,
    minPitch: -60,
    maxPitch: 80,
    rotateSpeed: 0.35,
    zoomSpeed: 0.0025,
    panSpeed: 0.002,

    _dragging: false,
    _panning: false,
    _lastX: 0,
    _lastY: 0,
    _pinchDist: 0,
    _pinchMid: null,
    _bound: false,

    init: function (app) {
        if (!app) return false;
        this.app = app;

        var cam = null;
        var piv = null;
        try {
            if (app.root) {
                piv = app.root.findByName('cameraPivot') || app.root.findByName('CameraPivot') || null;
                cam = app.root.findByName('camera') || app.root.findByName('Camera') || null;
                if (!cam && typeof app.root.findComponents === 'function') {
                    var cams = app.root.findComponents('camera');
                    if (cams && cams.length) cam = cams[0].entity;
                }
            }
        } catch (e) {
            cam = null;
            piv = null;
        }
        if (!cam) return false;

        this.camera = cam;
        this.pivot = piv;

        try {
            var pos = cam.getPosition();
            var dx = pos.x - this.target.x;
            var dy = pos.y - this.target.y;
            var dz = pos.z - this.target.z;
            this.distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || this.distance;
            this.yaw = Math.atan2(dx, dz) * 180 / Math.PI;
            var horiz = Math.sqrt(dx * dx + dz * dz) || 0.0001;
            this.pitch = Math.atan2(dy, horiz) * 180 / Math.PI;
        } catch (e) {}

        this.canvas = $('gl') || (app.graphicsDevice && app.graphicsDevice.canvas) || document.querySelector('canvas');
        this._bind();
        this.apply();
        log('✅ Camera controls aktif');
        return true;
    },

    _bind: function () {
        if (this._bound || !this.canvas) return;
        this._bound = true;
        var canvas = this.canvas;
        var self = this;

        canvas.style.touchAction = 'none';
        canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        canvas.addEventListener('mousedown', function (e) {
            if (!self.enabled) return;
            self._dragging = true;
            self._panning = (e.button === 2 || e.button === 1);
            self._lastX = e.clientX;
            self._lastY = e.clientY;
        });
        window.addEventListener('mousemove', function (e) {
            if (!self.enabled || !self._dragging) return;
            var dx = e.clientX - self._lastX;
            var dy = e.clientY - self._lastY;
            self._lastX = e.clientX;
            self._lastY = e.clientY;
            if (self._panning) self._pan(dx, dy);
            else self._rotate(dx, dy);
        });
        window.addEventListener('mouseup', function () {
            self._dragging = false;
            self._panning = false;
        });

        canvas.addEventListener('wheel', function (e) {
            if (!self.enabled) return;
            e.preventDefault();
            self._zoom(e.deltaY * self.zoomSpeed * self.distance);
        }, { passive: false });

        canvas.addEventListener('touchstart', function (e) {
            if (!self.enabled) return;
            if (e.touches.length === 1) {
                self._dragging = true;
                self._lastX = e.touches[0].clientX;
                self._lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                self._dragging = false;
                self._pinchDist = self._dist(e.touches[0], e.touches[1]);
                self._pinchMid = self._mid(e.touches[0], e.touches[1]);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', function (e) {
            if (!self.enabled) return;
            e.preventDefault();
            if (e.touches.length === 1 && self._dragging) {
                var dx = e.touches[0].clientX - self._lastX;
                var dy = e.touches[0].clientY - self._lastY;
                self._lastX = e.touches[0].clientX;
                self._lastY = e.touches[0].clientY;
                self._rotate(dx, dy);
            } else if (e.touches.length === 2) {
                var nd = self._dist(e.touches[0], e.touches[1]);
                if (self._pinchDist > 0) {
                    self._zoom((self._pinchDist - nd) * 0.01 * self.distance);
                }
                self._pinchDist = nd;
                var mid = self._mid(e.touches[0], e.touches[1]);
                if (self._pinchMid) {
                    self._pan(mid.x - self._pinchMid.x, mid.y - self._pinchMid.y);
                }
                self._pinchMid = mid;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', function (e) {
            if (e.touches.length < 2) { self._pinchDist = 0; self._pinchMid = null; }
            if (e.touches.length === 0) self._dragging = false;
        });

        canvas.addEventListener('dblclick', function () { self.reset(); });

        window.addEventListener('resize', function () { self._resize(); });
        this._resize();
    },

    _dist: function (a, b) {
        var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },
    _mid: function (a, b) {
        return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    },
    _rotate: function (dx, dy) {
        this.yaw -= dx * this.rotateSpeed;
        this.pitch += dy * this.rotateSpeed;
        if (this.pitch < this.minPitch) this.pitch = this.minPitch;
        if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
        this.apply();
    },
    _zoom: function (delta) {
        this.distance += delta;
        if (this.distance < this.minDistance) this.distance = this.minDistance;
        if (this.distance > this.maxDistance) this.distance = this.maxDistance;
        this.apply();
    },
    _pan: function (dx, dy) {
        if (!this.camera) return;
        var right = { x: 0, y: 0, z: 0 };
        var up = { x: 0, y: 0, z: 0 };
        try {
            var r = this.camera.right;
            var u = this.camera.up;
            right = { x: r.x, y: r.y, z: r.z };
            up = { x: u.x, y: u.y, z: u.z };
        } catch (e) {}
        var s = this.panSpeed * this.distance;
        this.target.x += (-dx * s * right.x + dy * s * up.x);
        this.target.y += (-dx * s * right.y + dy * s * up.y);
        this.target.z += (-dx * s * right.z + dy * s * up.z);
        this.apply();
    },
    _resize: function () {
        var app = this.app;
        if (!app || !app.graphicsDevice) return;
        try {
            var canvas = this.canvas;
            var w = canvas ? canvas.clientWidth : window.innerWidth;
            var h = canvas ? canvas.clientHeight : window.innerHeight;
            if (w > 0 && h > 0 && typeof app.resizeCanvas === 'function') app.resizeCanvas(w, h);
        } catch (e) {}
    },

    apply: function () {
        if (!this.camera) return;
        var yawR = this.yaw * Math.PI / 180;
        var pitchR = this.pitch * Math.PI / 180;
        var x = this.target.x + this.distance * Math.cos(pitchR) * Math.sin(yawR);
        var y = this.target.y + this.distance * Math.sin(pitchR);
        var z = this.target.z + this.distance * Math.cos(pitchR) * Math.cos(yawR);
        try {
            if (this.pivot && this.camera.parent === this.pivot) {
                this.pivot.setPosition(this.target.x, this.target.y, this.target.z);
                this.pivot.setEulerAngles(0, 0, 0);
                this.camera.setPosition(x, y, z);
                this.camera.lookAt(this.target.x, this.target.y, this.target.z);
            } else {
                this.camera.setPosition(x, y, z);
                this.camera.lookAt(this.target.x, this.target.y, this.target.z);
            }
        } catch (e) {}
    },

    reset: function () {
        this.yaw = 0;
        this.pitch = 12;
        this.distance = 4.5;
        this.target = { x: 0, y: 1.1, z: 0 };
        this.apply();
    },

    focusOn: function (entity) {
        if (!entity) return;
        try {
            var pos = entity.getPosition();
            this.target = { x: pos.x, y: pos.y, z: pos.z };
            this.apply();
        } catch (e) {}
    }
};

window.CameraControls = CameraControls;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPanels);
} else {
    setupPanels();
}

function tryInitCamera() {
    var app = getApp();
    if (!app) return false;
    return CameraControls.init(app);
}
if (!tryInitCamera()) {
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        if (tryInitCamera() || tries > 100) clearInterval(timer);
    }, 100);
}

document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'focusBtn') {
        var sel = (typeof window.S !== 'undefined' && window.S) ? window.S.selected : null;
        if (sel) CameraControls.focusOn(sel);
    }
});

log('✅ controls.js loaded');
})();
