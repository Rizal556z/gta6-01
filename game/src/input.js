// Solmar Bay — keyboard + mouse input state, plus pointer-lock look.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (['KeyE', 'KeyF', 'KeyM'].includes(e.code)) this._pressed = e.code;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.lookDX += e.movementX; this.lookDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
  }

  down(code) { return this.keys.has(code); }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }

  // One-shot key presses, consumed by the caller each frame.
  takePressed(code) {
    if (this._pressed === code) { this._pressed = null; return true; }
    return false;
  }

  // Drop any pending one-shot press (e.g. when opening a menu).
  clearPressed() { this._pressed = null; }

  consumeLook() {
    const dx = this.lookDX, dy = this.lookDY;
    this.lookDX = 0; this.lookDY = 0;
    return { dx, dy };
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }
}
