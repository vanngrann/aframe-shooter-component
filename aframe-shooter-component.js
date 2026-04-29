/**
 * aframe-shooter-component
 *
 * A-Frame components for first-person shooting mechanics.
 * Provides two components:
 *   - `shooter`   : attach to <a-camera>; fires bullets on click
 *   - `shootable` : attach to any entity that should be hittable
 *
 * Bullets are raw Three.js meshes (no A-Frame entity overhead).
 * Collision is a per-frame world-space distance check — no raycasting.
 * Camera direction is sourced from the actual PerspectiveCamera inside
 * A-Frame's yaw/pitch rig, so vertical aim works correctly.
 *
 * @version 1.0.0
 * @license MIT
 * @see     https://github.com/vanngrann/aframe-shooter-component
 */

/* global AFRAME, THREE */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // shootable
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('shootable', {
    schema: {
      health:        { type: 'number',  default: 3        },
      hitRadius:     { type: 'number',  default: 0.9      },
      hitColor:      { type: 'color',   default: 'orange' },
      hitFlashMs:    { type: 'number',  default: 150      },
      deathColor:    { type: 'color',   default: '#ff0000'},
      removeOnDeath: { type: 'boolean', default: true     },
      removeDelay:   { type: 'number',  default: 700      },
    },

    init: function () {
      this.hp         = this.data.health;
      this.isDead     = false;
      this._origColor = '#ffffff';
      this._timer     = null;

      this.el.addEventListener('loaded', () => {
        const mat = this.el.getAttribute('material');
        if (mat && mat.color) {
          const c = mat.color;
          this._origColor = (typeof c === 'string')
            ? c
            : '#' + new THREE.Color(c.r, c.g, c.b).getHexString();
        }
      });
    },

    hit: function (dmg) {
      if (this.isDead) return;
      this.hp -= (dmg || 1);
      this.el.emit('hit', { hp: this.hp }, false);

      this.el.setAttribute('material', 'color', this.data.hitColor);
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        if (!this.isDead) {
          this.el.setAttribute('material', 'color', this._origColor);
        }
      }, this.data.hitFlashMs);

      if (this.hp <= 0) this._die();
    },

    _die: function () {
      if (this.isDead) return;
      this.isDead = true;
      clearTimeout(this._timer);

      this.el.setAttribute('material', 'color', this.data.deathColor);
      this.el.emit('die', {}, false);

      this.el.setAttribute('animation__die', {
        property: 'scale',
        to:       '0 0 0',
        dur:      Math.round(this.data.removeDelay * 0.8),
        easing:   'easeInBack',
      });

      if (this.data.removeOnDeath) {
        setTimeout(() => {
          if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
        }, this.data.removeDelay);
      }
    },

    respawn: function () {
      this.hp = this.data.health;
      this.isDead = false;
      clearTimeout(this._timer);
      this.el.setAttribute('scale', '1 1 1');
      this.el.setAttribute('material', 'color', this._origColor);
      this.el.removeAttribute('animation__die');
    },
  });

  // ---------------------------------------------------------------------------
  // shooter
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('shooter', {
    schema: {
      speed:       { type: 'number',  default: 15           },
      maxAge:      { type: 'number',  default: 2000         },
      damage:      { type: 'number',  default: 1            },
      cooldown:    { type: 'number',  default: 200          },
      poolSize:    { type: 'number',  default: 6            },
      targetClass: { type: 'string',  default: '.shootable' },
      autoFire:    { type: 'boolean', default: false        },
    },

    init: function () {
      this._pool     = [];
      this._held     = false;
      this._lastShot = 0;

      this._vB   = new THREE.Vector3();
      this._vT   = new THREE.Vector3();
      this._vD   = new THREE.Vector3();
      this._vO   = new THREE.Vector3();
      this._quat = new THREE.Quaternion();

      const build = () => {
        const scene = this.el.sceneEl.object3D;
        const geo   = new THREE.SphereGeometry(0.08, 8, 6);
        const mat   = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

        for (let i = 0; i < this.data.poolSize; i++) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.visible = false;
          scene.add(mesh);
          this._pool.push({ mesh, active: false, vel: new THREE.Vector3(), born: 0 });
        }
        console.log('[aframe-shooter] pool ready —', this.data.poolSize, 'bullets');
      };

      if (this.el.sceneEl.hasLoaded) {
        build();
      } else {
        this.el.sceneEl.addEventListener('loaded', build, { once: true });
      }

      this._onDown = () => {
        this._held = true;
        if (!this.data.autoFire) this._fire();
      };
      this._onUp = () => { this._held = false; };

      window.addEventListener('mousedown',  this._onDown);
      window.addEventListener('mouseup',    this._onUp);
      window.addEventListener('touchstart', this._onDown, { passive: true });
      window.addEventListener('touchend',   this._onUp,   { passive: true });

      this.el.addEventListener('shoot', () => this._fire());
    },

    remove: function () {
      window.removeEventListener('mousedown',  this._onDown);
      window.removeEventListener('mouseup',    this._onUp);
      window.removeEventListener('touchstart', this._onDown);
      window.removeEventListener('touchend',   this._onUp);

      const scene = this.el.sceneEl.object3D;
      for (const b of this._pool) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
      }
    },

    _fire: function () {
      if (!this._pool.length) return;

      const now = performance.now();
      if (now - this._lastShot < this.data.cooldown) return;
      this._lastShot = now;

      const b = this._pool.find(b => !b.active);
      if (!b) return;

      let camObj = this.el.object3D;
      this.el.object3D.traverse(obj => { if (obj.isCamera) camObj = obj; });

      camObj.getWorldPosition(this._vO);
      this._vD
        .set(0, 0, -1)
        .applyQuaternion(camObj.getWorldQuaternion(this._quat))
        .normalize();

      b.mesh.position.copy(this._vO).addScaledVector(this._vD, 0.5);
      b.vel.copy(this._vD).multiplyScalar(this.data.speed);
      b.born         = now;
      b.active       = true;
      b.mesh.visible = true;
    },

    _recycle: function (b) {
      b.active       = false;
      b.mesh.visible = false;
      b.mesh.position.set(0, -9999, 0);
    },

    tick: function (time, delta) {
      if (this.data.autoFire && this._held) this._fire();

      const dt  = Math.min(delta, 50) / 1000;
      const now = performance.now();

      const targets = Array.from(
        this.el.sceneEl.querySelectorAll(this.data.targetClass)
      ).filter(el => el.components?.shootable && !el.components.shootable.isDead);

      for (const b of this._pool) {
        if (!b.active) continue;

        if (now - b.born > this.data.maxAge) { this._recycle(b); continue; }

        b.mesh.position.addScaledVector(b.vel, dt);

        this._vB.copy(b.mesh.position);
        for (const t of targets) {
          t.object3D.getWorldPosition(this._vT);
          if (this._vB.distanceTo(this._vT) < t.components.shootable.data.hitRadius) {
            t.components.shootable.hit(this.data.damage);
            this._recycle(b);
            break;
          }
        }
      }
    },
  });

}());
