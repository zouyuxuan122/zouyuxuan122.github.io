/* ============================================
   SeatMaster Pro — Manipulator (暗箱操作)
   预设约束：分组/同桌/避让
   ============================================ */

const Manipulator = {
  // 规则类型
  RULE_TYPES: [
    { type: 'group', label: '强制分组', desc: '指定学生在某个大组', fields: ['student', 'groupIndex'] },
    { type: 'seat', label: '强制座位', desc: '指定学生在某个具体座位', fields: ['student', 'group', 'col', 'row'] },
    { type: 'deskmate', label: '强制同桌', desc: 'A 和 B 必须同桌', fields: ['studentA', 'studentB'] },
    { type: 'sameGroup', label: '强制同组', desc: 'A 和 B 必须在同一大组', fields: ['studentA', 'studentB'] },
    { type: 'avoidSameGroup', label: '避让同组', desc: 'A 和 B 不能在同一大组', fields: ['studentA', 'studentB'] }
  ],

  // 创建规则
  createRule(type, data) {
    return { type, ...data, id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) };
  },

  // 验证规则合法性
  validateRule(rule, students) {
    if (!students || students.length === 0) return { ok: false, error: '请先导入学生' };

    const findName = name => students.find(s => s.name === name);
    const involved = ['student', 'studentA', 'studentB'].filter(f => rule[f]);

    for (const f of involved) {
      if (!findName(rule[f])) {
        return { ok: false, error: `找不到学生: ${rule[f]}` };
      }
    }

    if (rule.type === 'group' && (rule.groupIndex < 0 || rule.groupIndex >= LAYOUT.length)) {
      return { ok: false, error: '大组编号无效' };
    }

    if (rule.type === 'seat') {
      const g = LAYOUT[rule.group];
      if (!g) return { ok: false, error: '大组不存在' };
      if (rule.col < 0 || rule.col >= g.cols) return { ok: false, error: '列号无效' };
      if (rule.row < 0 || rule.row >= g.rows) return { ok: false, error: '行号无效' };
    }

    return { ok: true };
  },

  // 应用预设：生成可视化提示（教师视图）
  getPresetVisualHints(preset, seating) {
    if (!preset || !preset.rules) return [];
    const hints = [];

    preset.rules.forEach(rule => {
      if (rule.type === 'deskmate' || rule.type === 'sameGroup') {
        const seatA = this.findStudentSeat(rule.studentA, seating);
        const seatB = this.findStudentSeat(rule.studentB, seating);
        if (seatA && seatB) {
          hints.push({
            type: 'connection',
            from: seatA,
            to: seatB,
            style: rule.type === 'deskmate' ? 'solid' : 'dashed',
            color: 'primary'
          });
        }
      } else if (rule.type === 'avoidSameGroup') {
        const seatA = this.findStudentSeat(rule.studentA, seating);
        const seatB = this.findStudentSeat(rule.studentB, seating);
        if (seatA && seatB) {
          hints.push({
            type: 'warning',
            from: seatA,
            to: seatB,
            color: 'warn'
          });
        }
      }
    });

    return hints;
  },

  findStudentSeat(name, seating) {
    const student = Store.getStudentByName(name);
    if (!student) return null;
    const key = Object.keys(seating).find(k => seating[k] === student.id);
    if (!key) return null;
    const [group, col, row] = key.split('-').map(Number);
    return { group, col, row, key };
  }
};

window.Manipulator = Manipulator;
