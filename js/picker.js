/* ============================================
   SeatMaster Pro — Picker (点名器)
   支持：全班随机/按大组/按列行/均衡/连点
   含老虎机动画 + 自管理覆盖层
   ============================================ */

const Picker = {
  state: {
    active: false,
    spinning: false,
    mode: 'all',
    pool: [],
    result: null,
    pickedSet: new Set()
  },

  // 覆盖层 DOM 引用
  overlay: null,
  spinnerEl: null,
  resultEl: null,
  spinNameEl: null,
  spinTitleEl: null,
  spinDotsEl: null,
  resultNamesEl: null,
  resultTagEl: null,

  // 入口
  pick(options = {}) {
    const { mode = 'all', count = 1, group, col, row, groupIndex, useWeighted = false } = options;
    this.state.mode = mode;
    this.state.pickedSet = new Set();

    // 1. 构造候选池
    let pool = Store.getStudents().filter(s => s.name);

    if (mode === 'group' && groupIndex !== undefined) {
      const groupSeats = Object.entries(Store.getSeating())
        .filter(([k]) => k.startsWith(groupIndex + '-'))
        .map(([k, sid]) => Store.getStudent(sid))
        .filter(Boolean);
      pool = groupSeats.length > 0 ? groupSeats : pool;
    } else if (mode === 'column' && col !== undefined) {
      const colSeats = Object.entries(Store.getSeating())
        .filter(([k]) => {
          const [g, c] = k.split('-').map(Number);
          return c === col;
        })
        .map(([k, sid]) => Store.getStudent(sid))
        .filter(Boolean);
      pool = colSeats.length > 0 ? colSeats : pool;
    } else if (mode === 'row' && row !== undefined) {
      const rowSeats = Object.entries(Store.getSeating())
        .filter(([k]) => {
          const parts = k.split('-').map(Number);
          return parts[2] === row;
        })
        .map(([k, sid]) => Store.getStudent(sid))
        .filter(Boolean);
      pool = rowSeats.length > 0 ? rowSeats : pool;
    }

    if (pool.length === 0) {
      return Promise.resolve({ ok: false, error: '候选池为空' });
    }

    // 2. 加权（均衡模式）
    let weights = pool.map(s => {
      if (useWeighted) {
        const counts = Store.getPickCounts();
        const c = counts[s.id] || 0;
        return 1 / (c + 1);
      }
      return 1;
    });

    // 3. 老虎机动画
    return this.slotMachine(pool, weights, count);
  },

  // 老虎机动画
  slotMachine(pool, weights, count) {
    return new Promise((resolve) => {
      this.state.active = true;
      this.state.spinning = true;
      this.state.pool = pool;

      // 创建/显示覆盖层
      this.showOverlay(pool);

      // 计算结果
      const result = [];
      const poolCopy = [...pool];
      const weightsCopy = [...weights];

      for (let i = 0; i < count && poolCopy.length > 0; i++) {
        const picked = this.weightedPick(poolCopy, weightsCopy);
        if (!picked) break;
        result.push(picked);
        if (this.state.mode === 'burst' || count > 1) {
          const idx = poolCopy.indexOf(picked);
          if (idx >= 0) {
            poolCopy.splice(idx, 1);
            weightsCopy.splice(idx, 1);
          }
        }
      }

      // 老虎机滚动 2 秒
      const totalTime = 2000;
      const tickInterval = 60;

      const tickHandler = setInterval(() => {
        Sound.tick();
        const fakeWinner = pool[Math.floor(Math.random() * pool.length)];
        this.updateSlot(fakeWinner);
      }, tickInterval);

      setTimeout(() => {
        clearInterval(tickHandler);
        let decel = 0;
        const decelHandler = setInterval(() => {
          Sound.tick();
          decel += 80;
          const fakeWinner = pool[Math.floor(Math.random() * pool.length)];
          this.updateSlot(fakeWinner);
          if (decel >= 800) {
            clearInterval(decelHandler);
            this.finish(result, resolve);
          }
        }, 80);
      }, totalTime);
    });
  },

  // 加权抽取
  weightedPick(pool, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) return pool[Math.floor(Math.random() * pool.length)];
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  },

  // 完成
  finish(result, resolve) {
    this.state.spinning = false;
    this.state.result = result;

    // 记录
    result.forEach(s => {
      Store.incrementPickCount(s.id);
      Store.recordPick(s.name, this.state.mode, { studentId: s.id });
    });

    // 播放胜利音效
    Sound.win();

    // 显示结果卡片
    this.showResult(result);

    // 触发全局事件，让 Vue 组件刷新历史
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('picker-finished', { detail: { result } }));
    }

    // 粒子效果
    if (window.particles) {
      const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981'];
      window.particles.burst(window.innerWidth / 2, window.innerHeight / 2, 80, colors);
    }

    // 高亮座位（仅单人中签）
    if (result.length === 1) {
      const student = result[0];
      const seatKey = Object.keys(Store.getSeating()).find(k => Store.getSeating()[k] === student.id);
      if (seatKey) {
        // 临时高亮座位
        const seatEl = document.querySelector(`.seat[data-group="${seatKey.split('-')[0]}"]`);
        if (seatEl) {
          const allSeats = document.querySelectorAll('.seat');
          allSeats.forEach(s => s.classList.remove('seat-picked'));
          // 用 key 找具体座位
          const [g, c, r] = seatKey.split('-').map(Number);
          const seats = document.querySelectorAll('.seat');
          let targetIdx = 0;
          for (let gi = 0; gi < g; gi++) {
            for (let ci = 0; ci < 2; ci++) {
              for (let ri = 0; ri < (gi === 1 ? 7 : 6); ri++) {
                targetIdx++;
              }
            }
          }
          // 简化：通过遍历找
          const target = Array.from(seats).find(s => {
            const sg = s.getAttribute('data-group');
            return sg !== null && seatKey.startsWith(sg + '-') && s.textContent.trim() === student.name;
          });
          if (target) {
            target.classList.add('seat-picked');
            setTimeout(() => target.classList.remove('seat-picked'), 4000);
          }
        }
      }
    }

    resolve({ ok: true, result });
  },

  // === 自管理覆盖层 ===

  ensureOverlay() {
    if (this.overlay) return this.overlay;

    const overlay = document.createElement('div');
    overlay.className = 'slot-machine';
    overlay.id = 'picker-overlay';
    overlay.innerHTML = `
      <div class="picker-spinner" style="width:540px;max-width:92vw;padding:48px 36px;text-align:center">
        <div class="picker-spin-title" style="font-size:13px;color:var(--text-3);letter-spacing:0.2em;margin-bottom:8px"></div>
        <div class="slot-display spinning" style="font-size:64px;font-weight:800;letter-spacing:0.05em;background:linear-gradient(135deg,var(--primary) 0%,var(--accent) 50%,var(--warn) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;min-height:90px;display:flex;align-items:center;justify-content:center;margin:24px 0;filter:blur(2px);animation:shake 0.05s linear infinite">准备中...</div>
        <div class="picker-dots" style="display:flex;gap:6px;justify-content:center;margin-top:8px">
          <div class="dot-pulse" style="width:8px;height:8px;border-radius:50%;background:var(--primary);animation:dotPulse 1.2s ease-in-out infinite;animation-delay:0s"></div>
          <div class="dot-pulse" style="width:8px;height:8px;border-radius:50%;background:var(--primary);animation:dotPulse 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
          <div class="dot-pulse" style="width:8px;height:8px;border-radius:50%;background:var(--primary);animation:dotPulse 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
        </div>
      </div>

      <div class="picker-result big-result-card" style="display:none">
        <div class="big-result-label">🎉 中签名单 🎉</div>
        <div class="picker-result-names"></div>
        <div class="big-result-tag picker-result-tag"></div>
        <div class="big-result-actions" style="display:flex;gap:12px;justify-content:center;margin-top:32px">
          <button class="glass-btn picker-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            关闭
          </button>
          <button class="glass-btn glass-btn-primary shine-effect picker-redo-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            再抽一次
          </button>
        </div>
      </div>
    `;

    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // 绑定关闭按钮
    overlay.querySelector('.picker-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.spinnerEl = overlay.querySelector('.picker-spinner');
    this.resultEl = overlay.querySelector('.picker-result');
    this.spinNameEl = overlay.querySelector('.slot-display');
    this.spinTitleEl = overlay.querySelector('.picker-spin-title');
    this.resultNamesEl = overlay.querySelector('.picker-result-names');
    this.resultTagEl = overlay.querySelector('.picker-result-tag');
    this.redoBtn = overlay.querySelector('.picker-redo-btn');

    return overlay;
  },

  showOverlay(pool) {
    const overlay = this.ensureOverlay();
    this.spinnerEl.style.display = 'block';
    this.spinnerEl.className = 'picker-spinner glass-strong gradient-border';
    this.spinnerEl.style.cssText = 'width:540px;max-width:92vw;padding:48px 36px;text-align:center';
    this.resultEl.style.display = 'none';
    this.spinTitleEl.textContent = pool.length + ' 人候选池';
    this.spinNameEl.textContent = pool[0]?.name || '准备中...';
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 0.3s ease';
      overlay.style.opacity = '1';
    });
  },

  updateSlot(student) {
    if (this.spinNameEl) this.spinNameEl.textContent = student.name;
  },

  showResult(result) {
    if (!this.overlay) return;

    // 隐藏 spinner
    this.spinnerEl.style.display = 'none';

    // 渲染结果
    if (result.length === 1) {
      this.resultNamesEl.innerHTML = `<div class="big-result-name">${this.escapeHtml(result[0]?.name || '')}</div>`;
    } else {
      this.resultNamesEl.innerHTML = result.map(s =>
        `<div class="big-result-multiname">${this.escapeHtml(s.name)}</div>`
      ).join('');
    }

    // 模式标签
    const modeLabels = {
      all: '全班随机',
      group: '按大组',
      column: '按列',
      row: '按行',
      weighted: '均衡模式',
      burst: `连点 ${result.length} 人`
    };
    const modeLabel = modeLabels[this.state.mode] || '已抽签';
    this.resultTagEl.textContent = modeLabel;

    // 显示结果卡片
    this.resultEl.style.display = 'block';
    this.resultEl.style.animation = 'none';
    requestAnimationFrame(() => {
      this.resultEl.style.animation = 'heroEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    // 重新绑定再抽一次按钮（每次都需要新闭包）
    const newRedoBtn = this.redoBtn.cloneNode(true);
    this.redoBtn.parentNode.replaceChild(newRedoBtn, this.redoBtn);
    this.redoBtn = newRedoBtn;
    this.redoBtn.addEventListener('click', () => {
      if (window.App && window.App.startPicker) {
        window.App.startPicker();
      } else {
        // 触发自定义事件让 Vue 处理
        window.dispatchEvent(new CustomEvent('picker-redo'));
      }
    });
  },

  escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },

  close() {
    if (!this.overlay) return;
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.spinnerEl.style.display = 'block';
      this.resultEl.style.display = 'none';
    }, 300);
    this.state.active = false;
    this.state.spinning = false;
    this.state.result = null;
  }
};

window.Picker = Picker;
