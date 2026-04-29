# aframe-shooter-component


> First-person shooting mechanics for [A-Frame](https://aframe.io) — bullets, hit detection, health, and death, with no dependencies beyond A-Frame itself.

![A-Frame](https://img.shields.io/badge/A--Frame-1.7.1-ef2d5e?style=flat-square)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Why this exists

Every existing A-Frame shooting kit relies on raycasting tied to the cursor, not actual projectile travel. This means collision fires the instant you click regardless of where the bullet visually is — and they all break silently on A-Frame 1.4+.

This library fires real moving spheres and checks collision every frame using world-space distance. It also correctly reads camera direction from inside A-Frame's yaw/pitch rig, so aiming up and down works properly.

---

## Installation

### CDN via unpkg

Add **after** A-Frame, **before** your `<a-scene>`:

```html
<script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
<script src="https://unpkg.com/aframe-shooter-component@1.0.0/aframe-shooter-component.js"></script>
```

> **Note:** Replace `1.0.0` with the latest version tag once published to npm. The unpkg URL is automatically generated from your npm package — no extra configuration needed.

### npm

```bash
npm install aframe-shooter-component
```

```js
require('aframe-shooter-component'); // registers both components globally
```

### Self-hosted

Download `aframe-shooter-component.js` and serve it yourself:

```html
<script src="/path/to/aframe-shooter-component.js"></script>
```

---

## Quick start

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-shooter-component@1.0.0/aframe-shooter-component.js"></script>
</head>
<body>
  <a-scene>

    <!-- Target: needs class + shootable component + material attribute -->
    <a-box
      class="shootable"
      shootable="health: 3; hitRadius: 0.8"
      position="0 1.5 -5"
      material="color: teal">
    </a-box>

    <!-- Camera is the gun -->
    <a-camera
      shooter="poolSize: 6; damage: 1"
      position="0 1.6 0"
      wasd-controls
      look-controls>
    </a-camera>

  </a-scene>
</body>
</html>
```

Click to fire. The target flashes orange on each hit and shrinks away on death.

---

## Components

### `shooter`

Attach to `<a-camera>` or any entity acting as a gun. Fires yellow bullet spheres on `mousedown`. Each bullet is a raw `THREE.Mesh` added directly to the Three.js scene — no A-Frame entity lifecycle overhead.

| Property | Type | Default | Description |
|---|---|---|---|
| `speed` | number | `15` | Bullet travel speed in metres per second |
| `maxAge` | number | `2000` | Bullet lifetime in milliseconds before it is recycled |
| `damage` | number | `1` | HP removed from a `shootable` per hit |
| `cooldown` | number | `200` | Minimum milliseconds between shots |
| `poolSize` | number | `6` | Maximum bullets in flight at the same time |
| `targetClass` | string | `.shootable` | CSS selector used to find hittable entities |
| `autoFire` | boolean | `false` | Hold mouse button to fire continuously |

```html
<a-camera
  shooter="speed: 20;
           damage: 2;
           cooldown: 100;
           poolSize: 6;
           autoFire: false;
           targetClass: .enemy"
  wasd-controls
  look-controls>
</a-camera>
```

#### Programmatic firing

Emit the `shoot` event on the entity that has the `shooter` component:

```js
document.querySelector('[shooter]').emit('shoot');
```

#### Events emitted on the shooter entity

| Event | When |
|---|---|
| _(none currently)_ | Use the `shoot` event to trigger firing |

---

### `shootable`

Attach to any entity you want bullets to be able to hit. The entity must also have:

1. **`class="shootable"`** — or whatever string you set as `targetClass` on the shooter
2. **`material="color: ..."`** — the component reads this to restore the original colour after a hit flash. The bare `color` attribute is not sufficient.

| Property | Type | Default | Description |
|---|---|---|---|
| `health` | number | `3` | Starting health points |
| `hitRadius` | number | `0.9` | Collision sphere radius in metres. Tune this to match the visual size of your entity |
| `hitColor` | color | `orange` | Colour the entity flashes when struck |
| `hitFlashMs` | number | `150` | How long the hit flash lasts in milliseconds |
| `deathColor` | color | `#ff0000` | Colour applied when health reaches zero |
| `removeOnDeath` | boolean | `true` | Remove the entity from the scene on death |
| `removeDelay` | number | `700` | Milliseconds between death and removal (gives the death animation time to play) |

```html
<a-sphere
  class="shootable"
  shootable="health: 5;
             hitRadius: 1.0;
             hitColor: white;
             hitFlashMs: 80;
             deathColor: #ff4444;
             removeOnDeath: true;
             removeDelay: 800"
  position="0 2 -6"
  material="color: #a855f7">
</a-sphere>
```

#### Events emitted on the shootable entity

| Event | Detail | When |
|---|---|---|
| `hit` | `{ hp: number }` | Each time the entity is struck and survives |
| `die` | `{}` | When health reaches zero |

```js
document.querySelector('.shootable').addEventListener('hit', e => {
  console.log('HP remaining:', e.detail.hp);
});

document.querySelector('.shootable').addEventListener('die', () => {
  console.log('Target destroyed');
});
```

#### Respawning

Call `respawn()` on the component instance to reset health, scale, and colour. Only makes sense when `removeOnDeath` is `false`.

```html
<a-box class="shootable"
  shootable="health: 3; removeOnDeath: false"
  material="color: teal">
</a-box>
```

```js
const el = document.querySelector('.shootable');
el.components.shootable.respawn();
```

---

## Recipes

### Score counter

```js
let score = 0;

document.querySelectorAll('.shootable').forEach(el => {
  el.addEventListener('die', () => {
    score += 100;
    document.querySelector('#score').setAttribute('value', 'Score: ' + score);
  });
});
```

### Respawn targets after a delay

```js
document.querySelectorAll('.shootable').forEach(el => {
  el.addEventListener('die', () => {
    setTimeout(() => el.components.shootable.respawn(), 3000);
  });
});
```

### Different targets needing different shot counts

```html
<!-- Easy target — 1 shot kill -->
<a-box class="shootable" shootable="health: 1; hitRadius: 0.8"
  material="color: #4ade80" position="-3 1.5 -6"></a-box>

<!-- Tough target — 10 shots -->
<a-sphere class="shootable" shootable="health: 10; hitRadius: 1.2"
  material="color: #ef4444" position="3 2 -8"></a-sphere>
```

### VR controller shooting

Attach `shooter` to a controller entity instead of the camera, and emit `shoot` on the trigger event:

```html
<a-entity
  id="right-hand"
  laser-controls="hand: right"
  shooter="targetClass: .shootable">
</a-entity>
```

```js
document.querySelector('#right-hand').addEventListener('triggerdown', () => {
  document.querySelector('#right-hand').emit('shoot');
});
```

### Auto-fire (hold to spray)

```html
<a-camera
  shooter="autoFire: true; cooldown: 80; poolSize: 6"
  wasd-controls look-controls>
</a-camera>
```

---

## Publishing to npm (unpkg setup)

Once your repo is ready:

```bash
# 1. Make sure package.json has "name" and "version" set, and "main" points to the JS file
#    "main": "aframe-shooter-component.js"

# 2. Login and publish
npm login
npm publish

# 3. Your script tag is then live at:
# https://unpkg.com/aframe-shooter-component@<version>/aframe-shooter-component.js
```

Minimum `package.json`:

```json
{
  "name": "aframe-shooter-component",
  "version": "1.0.0",
  "description": "A-Frame shooting mechanics — bullets, hit detection, health, death",
  "main": "aframe-shooter-component.js",
  "keywords": ["aframe", "aframe-component", "webxr", "shooter", "vr"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/aframe-shooter-component.git"
  }
}
```

unpkg serves any file from any npm package automatically — no extra configuration required.

---

## How it works

| Step | What happens |
|---|---|
| **Pool build** | On scene load, `shooter` creates `poolSize` `THREE.Mesh` sphere objects and adds them directly to `scene.object3D`. They start invisible and parked at `y: -9999`. |
| **Firing** | On `mousedown`, an inactive pool mesh is claimed. The component traverses `el.object3D` to find the actual `THREE.PerspectiveCamera` (not just the outer rig), reads its world position and quaternion, and gives the mesh a velocity along the true forward vector. |
| **Movement** | Every `tick`, active bullets move by `velocity × timeDelta`. Delta is capped at 50 ms so a stalled frame cannot tunnel bullets through thin targets. |
| **Collision** | Every `tick`, each active bullet's world position is distance-checked against every entity matching `targetClass` that has a live `shootable` component. Hit if `distance < hitRadius`. |
| **Hit / Death** | `shootable.hit()` decrements HP, flashes the material colour, and emits `hit`. At zero HP it emits `die`, plays a scale-to-zero animation, and optionally removes the entity. |
| **Recycle** | After a hit, or when `maxAge` ms has elapsed, the bullet mesh is hidden and parked off-screen, ready to be reused. |

---

## A-Frame compatibility

Tested on **A-Frame 1.7.1**. Should work on 1.4 and above.

## License

MIT
