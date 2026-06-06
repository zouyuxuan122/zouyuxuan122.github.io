/* ============================================
   SeatMaster Pro — Seating Arranger
   排座算法：随机 / AI 规则 / 暗箱约束
   ============================================ */

const Arranger = {
  // 入口：执行排座
  arrange(students, options = {}) {
    const { rules = {}, preset = null, secretRules = [], excludeExisting = false } = options;

    if (!students || students.length === 0) {
      return { ok: false, error: '没有学生' };
    }

    // 动态设置座位布局（按当前学生数）
    setLayoutForStudents(students.length);
    const totalSeats = SeatUtil.totalSeats();

    const seats = SeatUtil.allSeats();
    const seating = {};  // {key: studentId}
    const placed = new Set();  // 已放置的 studentId
    const failedConstraints = [];

    // ===== 1. 硬约束（铁律，必须满足）=====
    // 合并：可见预设 + 隐藏规则（隐藏规则静默生效）
    const allHardRules = [];
    if (preset && preset.rules && preset.rules.length > 0) {
      allHardRules.push(...preset.rules);
    }
    if (secretRules && secretRules.length > 0) {
      allHardRules.push(...secretRules);
    }
    if (allHardRules.length > 0) {
      const result = this.applyHardConstraints(allHardRules, students, seats, seating, placed);
      failedConstraints.push(...result.failed);
    }

    // ===== 2. AI 软规则排序 =====
    let remaining = students.filter(s => !placed.has(s.id));

    if (rules.height) {
      // 身高规则：矮的优先放前排（前 2 行）
      remaining = this.sortByHeight(remaining);
    } else if (rules.vision) {
      // 视力规则：近视深的放前排
      remaining = this.sortByVision(remaining);
    } else if (rules.gender) {
      // 性别规则：打散混合
      remaining = this.shuffleArray(remaining);
    } else {
      remaining = this.shuffleArray(remaining);
    }

    // ===== 3. 填充剩余座位 =====
    const freeSeats = seats.filter(s => !seating[s.key]);
    this.shuffleArray(freeSeats);  // 座位洗牌

    remaining.forEach((student, i) => {
      if (i < freeSeats.length) {
        seating[freeSeats[i].key] = student.id;
        placed.add(student.id);
      }
    });

    // ===== 4. 性别规则：后处理微调（让每组男女更均衡）=====
    if (rules.gender) {
      this.balanceGender(seating, students, freeSeats.slice(remaining.length));
    }

    return {
      ok: true,
      seating,
      failed: failedConstraints,
      placedCount: placed.size
    };
  },

  // 应用暗箱硬约束
  applyHardConstraints(rules, students, seats, seating, placed) {
    const failed = [];
    const studentByName = name => students.find(s => s.name === name);

    rules.forEach(rule => {
      try {
        switch (rule.type) {
          case 'group': {
            // 某人必须在第 N 大组
            const stu = studentByName(rule.student);
            if (!stu) { failed.push({ rule, reason: '找不到学生 ' + rule.student }); return; }
            const groupSeats = seats.filter(s => s.group === rule.groupIndex);
            if (groupSeats.length === 0) { failed.push({ rule, reason: '大组不存在' }); return; }
            const freeSeat = groupSeats.find(s => !seating[s.key]);
            if (!freeSeat) { failed.push({ rule, reason: '该大组已满' }); return; }
            seating[freeSeat.key] = stu.id;
            placed.add(stu.id);
            break;
          }
          case 'seat': {
            // 某人必须在指定座位 (group, col, row)
            const stu = studentByName(rule.student);
            if (!stu) { failed.push({ rule, reason: '找不到学生' }); return; }
            const key = `${rule.group}-${rule.col}-${rule.row}`;
            if (seating[key]) { failed.push({ rule, reason: '该座位已被占用' }); return; }
            seating[key] = stu.id;
            placed.add(stu.id);
            break;
          }
          case 'lastRow': {
            // 某人必须在某个大组的最后一行
            const stu = studentByName(rule.student);
            if (!stu) { failed.push({ rule, reason: '找不到学生' }); return; }
            if (placed.has(stu.id)) { failed.push({ rule, reason: '学生已安排' }); return; }
            // 收集所有大组的最后一行空座（使用动态 LAYOUT）
            const currentLayout = SeatUtil.layout;
            const lastRowSeats = [];
            currentLayout.forEach((g, gi) => {
              const lastRow = g.rows - 1;
              seats.forEach(s => {
                if (s.group === gi && s.row === lastRow && !seating[s.key]) {
                  lastRowSeats.push(s);
                }
              });
            });
            if (lastRowSeats.length === 0) { failed.push({ rule, reason: '最后一行已满' }); return; }
            const chosen = lastRowSeats[Math.floor(Math.random() * lastRowSeats.length)];
            seating[chosen.key] = stu.id;
            placed.add(stu.id);
            break;
          }
          case 'deskmate': {
            // A 必须和 B 同桌（同大组同行）
            const a = studentByName(rule.studentA);
            const b = studentByName(rule.studentB);
            if (!a || !b) { failed.push({ rule, reason: '找不到学生' }); return; }
            if (placed.has(a.id) || placed.has(b.id)) { failed.push({ rule, reason: '学生已被安排' }); return; }
            // 找空桌
            const freePairs = SeatUtil.deskPairs().filter(([s1, s2]) =>
              !seating[s1.key] && !seating[s2.key]
            );
            if (freePairs.length === 0) { failed.push({ rule, reason: '没有空桌' }); return; }
            const [s1, s2] = freePairs[Math.floor(Math.random() * freePairs.length)];
            seating[s1.key] = a.id;
            seating[s2.key] = b.id;
            placed.add(a.id);
            placed.add(b.id);
            break;
          }
          case 'sameGroup': {
            // A 必须和 B 同组
            const a = studentByName(rule.studentA);
            const b = studentByName(rule.studentB);
            if (!a || !b) { failed.push({ rule, reason: '找不到学生' }); return; }
            if (placed.has(a.id) || placed.has(b.id)) { failed.push({ rule, reason: '学生已被安排' }); return; }
            const currentLayout = SeatUtil.layout;
            const groupSeats = [];
            for (let g = 0; g < currentLayout.length; g++) {
              const list = seats.filter(s => s.group === g && !seating[s.key]);
              if (list.length >= 2) {
                groupSeats.push({ group: g, seats: this.shuffleArray([...list]) });
              }
            }
            if (groupSeats.length === 0) { failed.push({ rule, reason: '没有足够位置' }); return; }
            const chosen = groupSeats[Math.floor(Math.random() * groupSeats.length)];
            seating[chosen.seats[0].key] = a.id;
            seating[chosen.seats[1].key] = b.id;
            placed.add(a.id);
            placed.add(b.id);
            break;
          }
          case 'avoidSameGroup': {
            // A 和 B 不能同组
            const a = studentByName(rule.studentA);
            const b = studentByName(rule.studentB);
            if (!a || !b) { failed.push({ rule, reason: '找不到学生' }); return; }
            if (!placed.has(a.id)) {
              const freeSeats = seats.filter(s => !seating[s.key]);
              if (freeSeats.length === 0) { failed.push({ rule, reason: '没有空位' }); return; }
              const aSeat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
              seating[aSeat.key] = a.id;
              placed.add(a.id);
            }
            if (!placed.has(b.id)) {
              const aSeat = seats.find(s => seating[s.key] === a.id);
              const avoidGroup = aSeat.group;
              const freeSeats = seats.filter(s => !seating[s.key] && s.group !== avoidGroup);
              if (freeSeats.length === 0) { failed.push({ rule, reason: '没有合适的避让位置' }); return; }
              const bSeat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
              seating[bSeat.key] = b.id;
              placed.add(b.id);
            }
            break;
          }
          case 'notDeskmate': {
            // A 和 B 不能同桌
            const a = studentByName(rule.studentA);
            const b = studentByName(rule.studentB);
            if (!a || !b) { failed.push({ rule, reason: '找不到学生' }); return; }
            // 先放 A
            if (!placed.has(a.id)) {
              const freeSeats = seats.filter(s => !seating[s.key]);
              if (freeSeats.length === 0) { failed.push({ rule, reason: '没有空位' }); return; }
              const aSeat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
              seating[aSeat.key] = a.id;
              placed.add(a.id);
            }
            // 放 B 时避开 A 的同桌位
            if (!placed.has(b.id)) {
              const aSeat = seats.find(s => seating[s.key] === a.id);
              const avoidKey = `${aSeat.group}-${1 - aSeat.col}-${aSeat.row}`;
              const freeSeats = seats.filter(s => !seating[s.key] && s.key !== avoidKey);
              if (freeSeats.length === 0) { failed.push({ rule, reason: '没有合适位置' }); return; }
              const bSeat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
              seating[bSeat.key] = b.id;
              placed.add(b.id);
            }
            break;
          }
          case 'deskmateGender':
          case 'deskmateGenderExclude': {
            // 同桌必须满足性别 + 排除名单
            const stu = studentByName(rule.student);
            if (!stu) { failed.push({ rule, reason: '找不到学生' }); return; }
            if (placed.has(stu.id)) { failed.push({ rule, reason: '学生已安排' }); return; }
            const excludeIds = (rule.excludeNames || [])
              .map(n => studentByName(n)?.id)
              .filter(Boolean);
            // 找空桌 + 候选同桌
            const freePairs = SeatUtil.deskPairs().filter(([s1, s2]) =>
              !seating[s1.key] && !seating[s2.key]
            );
            const candidates = students.filter(c =>
              !placed.has(c.id) &&
              c.id !== stu.id &&
              (rule.gender ? c.gender === rule.gender : true) &&
              !excludeIds.includes(c.id)
            );
            const validPairs = freePairs.filter(() => candidates.length > 0);
            if (validPairs.length === 0) {
              failed.push({ rule, reason: '没有符合条件的同桌' });
              return;
            }
            const [s1, s2] = validPairs[Math.floor(Math.random() * validPairs.length)];
            seating[s1.key] = stu.id;
            placed.add(stu.id);
            const partner = candidates[Math.floor(Math.random() * candidates.length)];
            seating[s2.key] = partner.id;
            placed.add(partner.id);
            break;
          }
        }
      } catch (e) {
        failed.push({ rule, reason: e.message });
      }
    });

    return { failed };
  },

  // 身高排序：矮的在前
  sortByHeight(students) {
    return [...students].sort((a, b) => {
      const ah = a.height || 170;
      const bh = b.height || 170;
      return ah - bh;
    });
  },

  // 视力排序：近视深的在前
  sortByVision(students) {
    return [...students].sort((a, b) => {
      const av = a.vision || 0;
      const bv = b.vision || 0;
      return bv - av;  // 大的（前 2 排）
    });
  },

  // 性别平衡
  balanceGender(seating, students, _unusedSeats) {
    // 简化实现：尽量让每组男女比均衡
    // 收集每组的学生
    const groups = {};
    Object.keys(seating).forEach(key => {
      const seat = seatsCache.find(s => s.key === key);
      if (!seat) return;
      if (!groups[seat.group]) groups[seat.group] = [];
      groups[seat.group].push({ key, studentId: seating[key] });
    });

    // 简单实现：如果某组男生过多，随机换位
    // 这里简化不做，复杂逻辑
  },

  // 洗牌（Fisher-Yates）
  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // 应用座位表到 Store
  applySeating(seating) {
    Store.data.seating = seating;
    Store.save();
  }
};

const seatsCache = SeatUtil.allSeats();

window.Arranger = Arranger;
