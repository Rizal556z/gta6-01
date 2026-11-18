// Solmar Bay — all sound is synthesized live with WebAudio. No audio files.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.sirenOn = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine: two detuned saw oscillators through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.type = 'sawtooth'; osc2.type = 'square';
    this.engineOsc.frequency.value = 60; osc2.frequency.value = 30;
    this.engineOsc.connect(filt); osc2.connect(filt);
    filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); osc2.start();
    this._engineOsc2 = osc2;
  }

  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this._engineOsc2.frequency.setTargetAtTime(28 + speed01 * 65, t, 0.08);
  }

  // Duck everything (pause menu) or bring it back.
  setMasterVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _noise(dur, filterFreq, gainVal) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = gainVal;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }

  _tone(freq, dur, type, gainVal, slideTo) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
  }

  shoot() { this._noise(0.14, 1800, 0.5); this._tone(160, 0.1, 'square', 0.25, 60); }
  punch() { this._noise(0.08, 500, 0.4); }
  horn() { this._tone(370, 0.25, 'square', 0.12); this._tone(466, 0.25, 'square', 0.1); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); setTimeout(() => this._tone(880, 0.14, 'sine', 0.25), 90); }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.28), i * 120));
  }
  busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.2), i * 160)); }
  crash() { this._noise(0.25, 700, 0.5); }
  footstep() { this._noise(0.05, 300, 0.12); }

  siren(on) {
    if (on === this.sirenOn || !this.ctx) return;
    this.sirenOn = on;
    if (on) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.045;
      this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.master);
      this._sirenOsc.start();
      let hi = true;
      this._sirenInt = setInterval(() => {
        if (!this._sirenOsc) return;
        this._sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, this.ctx.currentTime, 0.05);
        hi = !hi;
      }, 420);
    } else if (this._sirenOsc) {
      clearInterval(this._sirenInt);
      this._sirenOsc.stop(); this._sirenOsc = null;
    }
  }

  // Simple sunset-drive bassline loop, scheduled a bar at a time.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4]; // A1 A1 C2 G1 A1 A1 E2 D2
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      this._tone(bass[step % bass.length], 0.42, 'triangle', 0.16);
      if (step % 4 === 0) this._tone(bass[step % bass.length] * 4, 0.18, 'sine', 0.05);
      step++;
    }, 430);
  }

  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
