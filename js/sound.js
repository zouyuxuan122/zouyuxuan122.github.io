/* ============================================
   SeatMaster Pro — Sound Manager
   使用 Web Audio API 程序化生成音效（无需外部文件）
   ============================================ */

const Sound = {
  ctx: null,
  enabled: true,

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[Sound] Web Audio 不可用', e);
      }
    }
  },

  setEnabled(on) {
    this.enabled = !!on;
  },

  // 通用：播放一个音调
  tone(freq, duration = 0.1, type = 'sine', volume = 0.15, attack = 0.005, release = 0.05) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  },

  // 滑过（主题切换）
  whoosh() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.4);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  },

  // 点击（按钮）
  click() {
    this.tone(800, 0.06, 'sine', 0.12);
    setTimeout(() => this.tone(1200, 0.04, 'sine', 0.08), 30);
  },

  // 老虎机 tick
  tick() {
    this.tone(400 + Math.random() * 200, 0.02, 'square', 0.06);
  },

  // 中签（胜利）
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.3, 'triangle', 0.18), i * 80);
    });
    setTimeout(() => {
      this.tone(1318.51, 0.4, 'sine', 0.15); // E6
    }, 320);
  },

  // 打字机
  ding() {
    this.tone(1800, 0.015, 'sine', 0.04);
  },

  // 模态框弹出
  pop() {
    this.tone(440, 0.08, 'sine', 0.1);
    setTimeout(() => this.tone(880, 0.1, 'sine', 0.12), 40);
  },

  // 错误
  error() {
    this.tone(200, 0.15, 'sawtooth', 0.15);
    setTimeout(() => this.tone(150, 0.2, 'sawtooth', 0.15), 100);
  },

  // 排座完成（洗牌声）
  shuffle() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.tone(300 + i * 80, 0.05, 'triangle', 0.08), i * 60);
    }
  }
};

window.Sound = Sound;
