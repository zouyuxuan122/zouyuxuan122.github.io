/* ============================================
   SeatMaster Pro — Theme Manager
   含圆形扩散扫过动画（View Transitions + clip-path）
   ============================================ */

const Theme = {
  current: 'dark',

  init(initial) {
    this.current = initial || Store.data.theme || 'dark';
    document.documentElement.setAttribute('data-theme', this.current);
  },

  // 获取主题切换按钮位置（用于圆形扫过的圆心）
  getTogglePosition() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return { x: window.innerWidth - 50, y: 30 };
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  // 圆形扫过动画切换主题
  async toggle() {
    const newTheme = this.current === 'dark' ? 'light' : 'dark';
    const pos = this.getTogglePosition();
    const maxR = Math.hypot(
      Math.max(pos.x, window.innerWidth - pos.x),
      Math.max(pos.y, window.innerHeight - pos.y)
    );

    // 播放 whoosh
    Sound.whoosh();

    // 创建扫过元素
    const sweep = document.createElement('div');
    sweep.className = 'theme-sweep';
    const size = maxR * 2;
    sweep.style.cssText = `
      left: ${pos.x - maxR}px;
      top: ${pos.y - maxR}px;
      width: ${size}px;
      height: ${size}px;
      background: ${newTheme === 'dark'
        ? 'linear-gradient(135deg, #0a0e27 0%, #1e1b4b 50%, #312e81 100%)'
        : 'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 50%, #ffe4e6 100%)'};
      clip-path: circle(0px at ${maxR}px ${maxR}px);
      transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10000;
    `;
    document.body.appendChild(sweep);

    // 强制 reflow
    sweep.offsetHeight;

    // 扩散
    requestAnimationFrame(() => {
      sweep.style.clipPath = `circle(${maxR}px at ${maxR}px ${maxR}px)`;
    });

    // 中途切换主题
    setTimeout(() => {
      this.apply(newTheme);
    }, 300);

    // 清理
    setTimeout(() => {
      sweep.style.transition = 'opacity 0.2s ease';
      sweep.style.opacity = '0';
      setTimeout(() => sweep.remove(), 250);
    }, 620);
  },

  // 直接应用主题
  apply(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Store.setTheme(theme);
  },

  // 切换（无动画）
  toggleInstant() {
    this.toggle();
  }
};

window.Theme = Theme;
