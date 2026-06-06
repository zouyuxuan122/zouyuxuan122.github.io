/* ============================================
   SeatMaster Pro — Data Store
   LocalStorage CRUD + JSON IO
   ============================================ */

const STORAGE_KEY = 'seatmaster_pro_v1';

// 真实名单（48 人，按用户提供的顺序；空条目已跳过）
const REAL_ROSTER = [
  '邹宇轩', '张敬森', '邱若洲', '陈嘉泽', '夏董杰', '翁琳皓', '王仁楦', '卿嘉兴',
  '郑英豪', '罗启峻', '赵乾渊', '张曜林', '柯铭铭', '王晨曦', '杨惠雯', '陈嘉文',
  '李奕菲', '王俊蔚', '王昕玥', '王熠之', '刘文辉', '晏思怡', '李嘉怡', '吴昕瑶',
  '陈小薇', '嘉硕', '刘思豫', '周靖菲', '温雅舒', '张锦程',
  '王炜斯', '彭雨蝶', '刘诗琪', '刁一珂', '郭浩', '徐瑞', '周静怡', '黄颖萱',
  '林熠', '徐晗哲', '刘洋', '陈熙', '容梓溪',
  '黎钧', '贺佩豪', '卢子瑞', '陈涛', '区浩霖'
];

// 把真实名单预填为默认数据（首次打开即生效；老数据需清空 localStorage）
function buildDefaultStudents() {
  return REAL_ROSTER.map((name, i) => ({
    id: 's_default_' + (i + 1),
    name,
    gender: 'unknown',
    height: null,
    vision: null,
    no: String(i + 1).padStart(2, '0'),
    note: '',
    tag: ''
  }));
}

const DEFAULT_DATA = {
  students: buildDefaultStudents(),  // 学生列表 [{id, name, gender, height, vision, no, note, tag}]
  seating: {},           // 当前座位 {"0-0-0": studentId, ...}  (group-col-row)
  presets: [],           // 暗箱预设方案 [{id, name, rules: [...]}]
  activePresetId: null,  // 当前激活的预设
  pickHistory: [],       // 抽签历史 [{ts, name, mode, ...}]
  pickCounts: {},        // 每人被抽次数 {studentId: count}
  seatCounts: {},        // 每座位被坐次数 {"0-0-0": count}
  theme: 'dark',         // dark | light
  soundOn: true,
  rules: {               // AI 排座规则
    height: false,
    vision: false,
    gender: false,
    shuffle: true
  }
};

// 座位布局：动态计算 — 根据学生数自动扩展
// 4 大组，每组 2 列；保持原始 6:7:6:6 比例（即第 2 大组多 2 人/列）
let LAYOUT = [
  { group: 0, cols: 2, rows: 6 },
  { group: 1, cols: 2, rows: 7, special: true },
  { group: 2, cols: 2, rows: 6 },
  { group: 3, cols: 2, rows: 6 }
];

// 基础单元 = 25 行（6+7+6+6），根据学生数等比放大
const BASE_UNITS_TOTAL = 25;
const BASE_GROUP_RATIO = [6, 7, 6, 6];  // 4 大组的原始行数比例

function calculateLayout(studentCount) {
  // 至少 25 行（原始布局），每多 50 人增加 1 个基准单元
  const rowsNeeded = Math.max(BASE_UNITS_TOTAL, Math.ceil(studentCount / 2));
  const baseUnit = Math.max(1, Math.ceil(rowsNeeded / BASE_UNITS_TOTAL));
  return [
    { group: 0, cols: 2, rows: BASE_GROUP_RATIO[0] * baseUnit },
    { group: 1, cols: 2, rows: BASE_GROUP_RATIO[1] * baseUnit, special: true },
    { group: 2, cols: 2, rows: BASE_GROUP_RATIO[2] * baseUnit },
    { group: 3, cols: 2, rows: BASE_GROUP_RATIO[3] * baseUnit }
  ];
}

function setLayoutForStudents(studentCount) {
  LAYOUT = calculateLayout(studentCount);
  return LAYOUT;
}

const Store = {
  data: null,

  init() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // file:// 或隐私模式: localStorage 不可用
      console.warn('[Store] localStorage 不可用，使用内存模式', e);
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      return this.data;
    }
    if (raw) {
      try {
        this.data = { ...DEFAULT_DATA, ...JSON.parse(raw) };
      } catch (e) {
        console.warn('[Store] 数据损坏，重置', e);
        this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    } else {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('[Store] 保存失败', e);
    }
  },

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
    return this.data;
  },

  // === 学生管理 ===
  getStudents() {
    return this.data.students || [];
  },

  addStudent(s) {
    const student = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: '',
      gender: 'unknown',  // male | female | unknown
      height: null,
      vision: null,
      no: '',
      note: '',
      tag: '',
      ...s
    };
    this.data.students.push(student);
    this.save();
    return student;
  },

  addStudentsBulk(list) {
    const added = [];
    list.forEach(name => {
      if (typeof name === 'string' && name.trim()) {
        added.push(this.addStudent({ name: name.trim() }));
      } else if (typeof name === 'object' && name.name) {
        added.push(this.addStudent(name));
      }
    });
    return added;
  },

  // 替换全部学生（清空座位、抽签计数）
  replaceStudents(list) {
    this.data.students = [];
    this.data.seating = {};
    this.data.pickCounts = {};
    this.data.seatCounts = {};
    this.save();
    return this.addStudentsBulk(list);
  },

  updateStudent(id, patch) {
    const idx = this.data.students.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.data.students[idx] = { ...this.data.students[idx], ...patch };
      this.save();
    }
  },

  removeStudent(id) {
    this.data.students = this.data.students.filter(s => s.id !== id);
    // 同时清理座位
    Object.keys(this.data.seating).forEach(key => {
      if (this.data.seating[key] === id) delete this.data.seating[key];
    });
    delete this.data.pickCounts[id];
    this.save();
  },

  getStudent(id) {
    return this.data.students.find(s => s.id === id);
  },

  getStudentByName(name) {
    return this.data.students.find(s => s.name === name);
  },

  // === 座位 ===
  getSeating() {
    return this.data.seating || {};
  },

  setSeat(group, col, row, studentId) {
    const key = `${group}-${col}-${row}`;
    if (studentId === null || studentId === undefined) {
      delete this.data.seating[key];
    } else {
      this.data.seating[key] = studentId;
    }
    this.save();
  },

  getSeatStudent(group, col, row) {
    const key = `${group}-${col}-${row}`;
    const id = this.data.seating[key];
    return id ? this.getStudent(id) : null;
  },

  clearSeating() {
    this.data.seating = {};
    this.save();
  },

  // === 抽签 ===
  recordPick(name, mode, extras = {}) {
    this.data.pickHistory.unshift({
      ts: Date.now(),
      name,
      mode,
      ...extras
    });
    if (this.data.pickHistory.length > 500) {
      this.data.pickHistory = this.data.pickHistory.slice(0, 500);
    }
    this.save();
  },

  incrementPickCount(studentId) {
    this.data.pickCounts[studentId] = (this.data.pickCounts[studentId] || 0) + 1;
    this.save();
  },

  getPickCounts() {
    return this.data.pickCounts || {};
  },

  clearPickCounts() {
    this.data.pickCounts = {};
    this.save();
  },

  clearPickHistory() {
    this.data.pickHistory = [];
    this.save();
  },

  // === 暗箱预设 ===
  getPresets() {
    return this.data.presets || [];
  },

  addPreset(preset) {
    const p = {
      id: 'p_' + Date.now(),
      name: '新方案',
      rules: [],
      ...preset
    };
    this.data.presets.push(p);
    this.save();
    return p;
  },

  updatePreset(id, patch) {
    const idx = this.data.presets.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.data.presets[idx] = { ...this.data.presets[idx], ...patch };
      this.save();
    }
  },

  removePreset(id) {
    this.data.presets = this.data.presets.filter(p => p.id !== id);
    if (this.data.activePresetId === id) this.data.activePresetId = null;
    this.save();
  },

  getActivePreset() {
    if (!this.data.activePresetId) return null;
    return this.data.presets.find(p => p.id === this.data.activePresetId);
  },

  setActivePreset(id) {
    this.data.activePresetId = id;
    this.save();
  },

  // === 主题/设置 ===
  setTheme(theme) {
    this.data.theme = theme;
    this.save();
  },

  setSoundOn(on) {
    this.data.soundOn = !!on;
    this.save();
  },

  setRules(rules) {
    this.data.rules = { ...this.data.rules, ...rules };
    this.save();
  },

  // === 导入导出 ===
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    this.data = { ...DEFAULT_DATA, ...parsed };
    this.save();
    return this.data;
  },

  exportRosterCSV() {
    const rows = [['姓名', '性别', '身高(cm)', '视力', '学号', '备注', '标签']];
    this.data.students.forEach(s => {
      rows.push([s.name, s.gender, s.height || '', s.vision || '', s.no || '', s.note || '', s.tag || '']);
    });
    return rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  }
};

// === 工具：座位遍历 ===
const SeatUtil = {
  get layout() { return LAYOUT; },

  // 生成所有座位 key 列表
  allSeats() {
    const list = [];
    LAYOUT.forEach(g => {
      for (let c = 0; c < g.cols; c++) {
        for (let r = 0; r < g.rows; r++) {
          list.push({ group: g.group, col: c, row: r, key: `${g.group}-${c}-${r}` });
        }
      }
    });
    return list;
  },

  // 同桌：(group, col, row) 与 (group, col^1, row) 是同桌
  isDeskMate(a, b) {
    return a.group === b.group && a.row === b.row && a.col !== b.col;
  },

  // 同组
  isSameGroup(a, b) {
    return a.group === b.group;
  },

  totalSeats() {
    return LAYOUT.reduce((sum, g) => sum + g.cols * g.rows, 0);
  },

  // 同桌 key 配对
  deskPairs() {
    const pairs = [];
    LAYOUT.forEach(g => {
      for (let r = 0; r < g.rows; r++) {
        pairs.push([
          { group: g.group, col: 0, row: r, key: `${g.group}-0-${r}` },
          { group: g.group, col: 1, row: r, key: `${g.group}-1-${r}` }
        ]);
      }
    });
    return pairs;
  }
};

window.Store = Store;
window.SeatUtil = SeatUtil;
window.LAYOUT = LAYOUT;
window.REAL_ROSTER = REAL_ROSTER;
