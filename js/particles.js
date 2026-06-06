/* ============================================
   SeatMaster Pro — Particle Engine
   轻量级 Canvas 粒子系统
   ============================================ */

const particles = {
  canvas: null,
  ctx: null,
  particles: [],
  animFrame: null,

  init() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'particles-container';
    this.canvas.style.pointerEvents = 'none';
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  // 爆发粒子
  burst(x, y, count = 30, colors = ['#8b5cf6', '#06b6d4', '#f59e0b']) {
    this.init();
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 4 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,  // 略向上
        life: 1,
        decay: 0.012 + Math.random() * 0.015,
        size: 3 + Math.random() * 4,
        color,
        gravity: 0.15
      });
    }
  },

  // 散落粒子（更慢、更优雅）
  sprinkle(x, y, count = 60, colors = null) {
    this.init();
    if (!colors) {
      colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#fbbf24'];
    }
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 200,
        y: y - Math.random() * 60,
        vx: (Math.random() - 0.5) * 3,
        vy: 1 + Math.random() * 2,
        life: 1,
        decay: 0.005 + Math.random() * 0.01,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.05
      });
    }
  },

  loop() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles = this.particles.filter(p => p.life > 0);

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.life -= p.decay;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.animFrame = requestAnimationFrame(() => this.loop());
  }
};

window.particles = particles;
