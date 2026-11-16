// Up to 4 players: keyboard+mouse counts as one, plus one gamepad each.

export interface PlayerInput {
  moveX: number; moveY: number; // strafe, forward
  lookX: number; lookY: number; // radians this frame
  drift: boolean;
  float: boolean;
  interact: boolean;
  interactPressed: boolean;
  turnLeft: boolean; // pressed this frame
  turnRight: boolean;
  photo: boolean;
  pause: boolean;
  startHeld: number; // seconds Start has been held
  any: boolean; // any button pressed this frame
}

export type DeviceId = 'kbm' | `pad${number}`;

function blank(): PlayerInput {
  return { moveX: 0, moveY: 0, lookX: 0, lookY: 0, drift: false, float: false, interact: false, interactPressed: false, turnLeft: false, turnRight: false, photo: false, pause: false, startHeld: 0, any: false };
}

export interface LookSettings { sensitivity: number; invertY: boolean }

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private mouseDown = false;
  private mousePressed = false;
  private padPrev = new Map<number, boolean[]>();
  private startHeldPad = new Map<number, number>();
  private startHeldKbm = 0;
  states = new Map<DeviceId, PlayerInput>();
  locked = false;
  enabled = true;
  /** devices that pressed something this frame (for drop-in join) */
  joins: DeviceId[] = [];
  lastKbm = 0;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'Tab', 'F1'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => (this.locked = document.pointerLockElement === this.canvas));
  }

  requestLock() {
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.()?.catch?.(() => {});
  }

  keyPressed(code: string) { return this.pressed.has(code); }
  keyDown(code: string) { return this.keys.has(code); }

  poll(dt: number, look: (d: DeviceId) => LookSettings) {
    this.joins = [];
    // keyboard + mouse
    const k = blank();
    const ls = look('kbm');
    k.moveY = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    k.moveX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const arrowsTurn = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    k.lookX = this.mouseDX * 0.0022 * ls.sensitivity + arrowsTurn * 2.2 * dt;
    k.lookY = this.mouseDY * 0.0022 * ls.sensitivity * (ls.invertY ? -1 : 1);
    this.mouseDX = this.mouseDY = 0;
    k.drift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    k.float = this.keys.has('Space');
    k.interact = this.mouseDown || this.keys.has('Enter');
    k.interactPressed = this.mousePressed || this.pressed.has('Enter');
    k.turnLeft = this.pressed.has('KeyQ');
    k.turnRight = this.pressed.has('KeyE');
    k.photo = this.pressed.has('KeyF');
    k.pause = this.pressed.has('Escape') || this.pressed.has('KeyP');
    this.startHeldKbm = this.keys.has('Backspace') ? this.startHeldKbm + dt : 0;
    k.startHeld = this.startHeldKbm;
    k.any = this.pressed.size > 0 || this.mousePressed;
    if (!this.enabled) Object.assign(k, blank());
    this.states.set('kbm', k);
    if (k.any) { this.joins.push('kbm'); this.lastKbm = performance.now(); }
    this.mousePressed = false;
    this.pressed.clear();

    // gamepads
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const id: DeviceId = `pad${pad.index}`;
      const s = blank();
      const pl = look(id);
      const prev = this.padPrev.get(pad.index) ?? [];
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const press = (i: number) => btn(i) && !prev[i];
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      s.moveX = dz(pad.axes[0] ?? 0);
      s.moveY = -dz(pad.axes[1] ?? 0);
      const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
      s.lookX = Math.sign(rx) * rx * rx * 3.0 * pl.sensitivity * dt;
      s.lookY = Math.sign(ry) * ry * ry * 2.2 * pl.sensitivity * dt * (pl.invertY ? -1 : 1);
      s.drift = btn(10);
      s.float = btn(0);
      s.interact = btn(2);
      s.interactPressed = press(2);
      s.turnLeft = press(4);
      s.turnRight = press(5);
      s.photo = press(8);
      s.pause = press(9);
      const held = btn(9) ? (this.startHeldPad.get(pad.index) ?? 0) + dt : 0;
      this.startHeldPad.set(pad.index, held);
      s.startHeld = held;
      s.any = pad.buttons.some((b, i) => b.pressed && !prev[i]);
      if (!this.enabled) Object.assign(s, blank());
      this.states.set(id, s);
      if (s.any) this.joins.push(id);
      this.padPrev.set(pad.index, pad.buttons.map((b) => b.pressed));
    }
  }

  get(id: DeviceId): PlayerInput {
    return this.states.get(id) ?? blank();
  }

  /** Bots for automated co-op tests: drive a virtual device. */
  inject(id: DeviceId, s: Partial<PlayerInput>) {
    this.states.set(id, { ...blank(), ...s });
  }
}
