/* ============================================
   SeatMaster Pro — About Page
   打字机效果 + 团队成员
   ============================================ */

const About = {
  team: [
    '桌面端设计：@Nerfert',
    '前端UI：@末夏zx',
    '网页版设计：@Nerfert @末夏zx',
    '服务器部署：@qqqqqqq大王'
  ],

  state: {
    typing: false,
    typed: false
  },

  open() {
    Sound.pop();
    if (window.App && window.App.showAboutModal) {
      window.App.showAboutModal();
    }
    // 自动开始打字机（首次打开）
    setTimeout(() => this.startTypewriter(), 600);
  },

  close() {
    Sound.click();
    if (window.App && window.App.hideAboutModal) {
      window.App.hideAboutModal();
    }
  },

  startTypewriter() {
    if (this.state.typing) return;
    this.state.typing = true;

    const container = document.getElementById('about-team-lines');
    if (!container) {
      this.state.typing = false;
      return;
    }
    container.innerHTML = '';

    const lines = this.team;
    let lineIdx = 0;

    const typeLine = () => {
      if (lineIdx >= lines.length) {
        // 全部完成，移除最后一个光标
        const cursors = container.querySelectorAll('.cursor-blink');
        cursors.forEach(c => c.remove());
        this.state.typing = false;
        this.state.typed = true;
        return;
      }

      const line = lines[lineIdx];
      const lineEl = document.createElement('div');
      lineEl.className = 'about-team-line';
      lineEl.style.textAlign = 'center';

      const cursor = document.createElement('span');
      cursor.className = 'cursor-blink';

      container.appendChild(lineEl);
      requestAnimationFrame(() => {
        lineEl.style.opacity = '1';
        lineEl.style.transform = 'translateY(0)';
      });

      let charIdx = 0;
      const typeChar = () => {
        if (charIdx >= line.length) {
          lineEl.appendChild(cursor);
          lineIdx++;
          setTimeout(typeLine, 300);
          return;
        }
        // 移除光标
        const oldCursor = lineEl.querySelector('.cursor-blink');
        if (oldCursor) oldCursor.remove();

        const ch = line[charIdx];
        const span = document.createElement('span');
        span.textContent = ch;
        lineEl.appendChild(span);
        lineEl.appendChild(cursor);
        charIdx++;

        Sound.ding();

        // 名字高亮
        setTimeout(() => {
          if (ch === '@') {
            const rest = lineEl.textContent.split('@')[1];
            if (rest) {
              const match = rest.match(/^(\S+)/);
              if (match) {
                // 简化：暂不高亮
              }
            }
          }
        }, 0);

        setTimeout(typeChar, 30 + Math.random() * 25);
      };

      setTimeout(typeChar, 200);
    };

    typeLine();
  },

  // 重置以便重新播放
  reset() {
    this.state.typing = false;
    this.state.typed = false;
    const container = document.getElementById('about-team-lines');
    if (container) container.innerHTML = '';
  }
};

window.About = About;
