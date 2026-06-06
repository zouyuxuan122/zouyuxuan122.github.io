/* ============================================
   SeatMaster Pro — Secret Config
   完全隐藏的强制规则（连老师都看不见）
   触发方式：Ctrl+Shift+H 或 Ctrl+Alt+S
   规则保存在 localStorage 的独立 key
   不会显示在任何 UI 中
   ============================================ */

const SecretConfig = {
  STORAGE_KEY: 'seatmaster_secret_v1',
  rules: [],
  modal: null,

  init() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.rules = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      this.rules = [];
    }
  },

  getRules() {
    return this.rules;
  },

  save(rulesText) {
    try {
      const parsed = JSON.parse(rulesText);
      if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组');
      this.rules = parsed;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.rules));
      return { ok: true, count: this.rules.length };
    } catch (e) {
      return { ok: false, error: 'JSON 解析失败: ' + e.message };
    }
  },

  clear() {
    this.rules = [];
    localStorage.removeItem(this.STORAGE_KEY);
  },

  open() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      this.refreshTextarea();
      this.refreshIcons();
      return;
    }
    this.createModal();
  },

  close() {
    if (this.modal) this.modal.style.display = 'none';
  },

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'secret-config-modal';
    modal.style.zIndex = '9500';
    modal.innerHTML = `
      <div class="glass-strong gradient-border" style="padding:32px;width:640px;max-width:92vw;max-height:90vh;overflow:auto">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:22px">🔒</span>
          <h3 style="font-size:20px;font-weight:700;margin:0">隐藏规则</h3>
        </div>
        <p style="font-size:13px;color:var(--text-3);margin-bottom:6px;line-height:1.6">
          本面板仅用于<span style="color:var(--warn);font-weight:600">输入</span>规则。
          规则保存后，<span style="color:var(--danger);font-weight:600">不会在任何界面显示</span>，
          排座时会静默生效。学生完全无法察觉。
        </p>
        <details style="margin-bottom:14px;font-size:12px;color:var(--text-3)">
          <summary style="cursor:pointer;padding:4px 0;letter-spacing:0.05em">📖 查看支持的规则类型</summary>
          <div style="padding:12px;background:var(--glass-bg);border-radius:8px;margin-top:8px;line-height:1.7">
            <div><b style="color:var(--primary)">强制分组：</b> <code>{"type":"group","student":"姓名","groupIndex":0-3}</code></div>
            <div><b style="color:var(--primary)">强制座位：</b> <code>{"type":"seat","student":"姓名","group":0-3,"col":0-1,"row":0-6}</code></div>
            <div><b style="color:var(--primary)">强制最后行：</b> <code>{"type":"lastRow","student":"姓名"}</code></div>
            <div><b style="color:var(--primary)">强制同桌：</b> <code>{"type":"deskmate","studentA":"A","studentB":"B"}</code></div>
            <div><b style="color:var(--primary)">强制同组：</b> <code>{"type":"sameGroup","studentA":"A","studentB":"B"}</code></div>
            <div><b style="color:var(--primary)">避让同组：</b> <code>{"type":"avoidSameGroup","studentA":"A","studentB":"B"}</code></div>
            <div><b style="color:var(--primary)">同桌性别：</b> <code>{"type":"deskmateGender","student":"A","gender":"male/female"}</code></div>
            <div><b style="color:var(--primary)">同桌排除：</b> <code>{"type":"deskmateGenderExclude","student":"A","gender":"male","excludeNames":["X","Y"]}</code></div>
            <div><b style="color:var(--primary)">强制不同桌：</b> <code>{"type":"notDeskmate","studentA":"A","studentB":"B"}</code></div>
          </div>
        </details>
        <textarea class="glass-input secret-rules-textarea"
                  style="min-height:280px;font-family:'JetBrains Mono','Consolas',monospace;font-size:12.5px;line-height:1.5;resize:vertical"
                  spellcheck="false"
                  placeholder='[
  { "type": "lastRow", "student": "邹宇轩" },
  { "type": "deskmateGenderExclude", "student": "李同桌", "gender": "male", "excludeNames": ["夏董杰", "邱若舟"] }
]'></textarea>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:space-between;align-items:center">
          <div style="font-size:11px;color:var(--text-3)">已隐藏保存 <b style="color:var(--primary)" id="secret-count">0</b> 条规则</div>
          <div style="display:flex;gap:8px">
            <button class="glass-btn secret-clear-btn" style="color:var(--danger)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path></svg>
              清空
            </button>
            <button class="glass-btn secret-cancel-btn">取消</button>
            <button class="glass-btn glass-btn-primary secret-save-btn shine-effect">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              保存（永不显示）
            </button>
          </div>
        </div>
      </div>
    `;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });
    modal.querySelector('.secret-cancel-btn').addEventListener('click', () => this.close());
    modal.querySelector('.secret-save-btn').addEventListener('click', () => this.handleSave());
    modal.querySelector('.secret-clear-btn').addEventListener('click', () => this.handleClear());

    document.body.appendChild(modal);
    this.modal = modal;
    this.refreshTextarea();
    this.refreshIcons();
  },

  refreshTextarea() {
    const ta = this.modal?.querySelector('.secret-rules-textarea');
    if (ta) ta.value = JSON.stringify(this.rules, null, 2);
    const count = this.modal?.querySelector('#secret-count');
    if (count) count.textContent = this.rules.length;
  },

  refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  },

  handleSave() {
    const ta = this.modal.querySelector('.secret-rules-textarea');
    const result = this.save(ta.value);
    if (result.ok) {
      this.refreshTextarea();
      // 闪一下 count 表示保存成功
      const count = this.modal.querySelector('#secret-count');
      if (count) {
        count.style.transition = 'all 0.3s';
        count.style.color = 'var(--success)';
        count.style.transform = 'scale(1.3)';
        setTimeout(() => {
          count.style.color = '';
          count.style.transform = '';
        }, 600);
      }
      window.dispatchEvent(new CustomEvent('secret-rules-updated'));
      // 1.5秒后自动关闭
      setTimeout(() => this.close(), 1500);
    } else {
      const ta = this.modal.querySelector('.secret-rules-textarea');
      ta.style.borderColor = 'var(--danger)';
      ta.style.boxShadow = '0 0 0 3px var(--danger-glow)';
      setTimeout(() => {
        ta.style.borderColor = '';
        ta.style.boxShadow = '';
      }, 2000);
      console.error('[Secret] 保存失败:', result.error);
    }
  },

  handleClear() {
    if (confirm('确认清空所有隐藏规则？')) {
      this.clear();
      this.refreshTextarea();
      window.dispatchEvent(new CustomEvent('secret-rules-updated'));
    }
  }
};

// 键盘快捷键（不在任何 UI 提示）
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+H 或 Ctrl+Alt+S
  if ((e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) ||
      (e.ctrlKey && e.altKey && (e.key === 'S' || e.key === 's'))) {
    e.preventDefault();
    SecretConfig.open();
  }
  // Esc 关闭
  if (e.key === 'Escape' && SecretConfig.modal && SecretConfig.modal.style.display === 'flex') {
    SecretConfig.close();
  }
});

SecretConfig.init();
window.SecretConfig = SecretConfig;
