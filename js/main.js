/* ============================================
   SeatMaster Pro — Main App (Vue 3)
   ============================================ */

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const App = createApp({
  setup() {
    // === 初始化 Store ===
    Store.init();

    // === 系统级隐藏规则（铁律，不在任何界面显示；排座失败也不报告）===
    const SYSTEM_HIDDEN_RULES = [
      { type: 'lastRow', student: '邹宇轩' }
    ];

    // === 响应式数据 ===
    const view = ref('classroom');  // 当前视图
    const students = ref(Store.getStudents());
    const seating = ref(Store.getSeating());
    const presets = ref(Store.getPresets());
    const activePresetId = ref(Store.data.activePresetId);
    const theme = ref(Store.data.theme);
    const soundOn = ref(Store.data.soundOn);
    const rules = reactive({ ...Store.data.rules });
    const pickHistory = ref(Store.data.pickHistory || []);
    const pickCounts = ref(Store.getPickCounts());

    // 动态布局 — 根据学生数量自动扩展
    const layout = computed(() => {
      const n = students.value.length;
      setLayoutForStudents(n);
      return LAYOUT;
    });

    const totalSeatsCount = computed(() =>
      layout.value.reduce((sum, g) => sum + g.cols * g.rows, 0)
    );

    // 编辑学生
    const editingStudent = ref(null);
    const showImportDialog = ref(false);
    const importText = ref('');

    // 暗箱
    const showAddRule = ref(false);
    const newRule = reactive({ type: 'group', student: '', groupIndex: 0 });

    // 关于
    const showAbout = ref(false);

    // Toast
    const toast = reactive({ show: false, text: '' });

    // 点名器
    const pickerMode = ref('all');
    const pickerGroup = ref(0);
    const pickerCol = ref(0);
    const pickerRow = ref(0);
    const pickerCount = ref(3);
    const pickerSpinning = ref(false);
    const pickerOverlay = reactive({
      active: false,
      phase: 'idle',      // idle | spinning | result
      currentName: '',
      result: null,
      title: ''
    });

    // 当前抽中的座位
    const pickedSeats = ref(new Set());

    // 排座结果消息
    const lastArrangeMsg = ref('');

    // === 计算属性 ===
    const activePreset = computed(() => {
      if (!activePresetId.value) return null;
      return presets.value.find(p => p.id === activePresetId.value);
    });

    const seatedCount = computed(() => Object.keys(seating.value).length);

    // 当前大组的行数（用于 picker 大组/行模式）
    const currentMaxRows = computed(() => {
      return Math.max(...layout.value.map(g => g.rows));
    });

    // 教室尺寸自适应 class
    const classroomSizeClass = computed(() => {
      const total = totalSeatsCount.value;
      if (total > 200) return 'seats-huge';
      if (total > 120) return 'seats-very-many';
      if (total > 60) return 'seats-many';
      return '';
    });

    const topPicked = computed(() => {
      const counts = pickCounts.value;
      const list = students.value
        .map(s => ({ name: s.name, count: counts[s.id] || 0 }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const max = list[0]?.count || 1;
      list.forEach(x => x.percent = (x.count / max) * 100);
      return list;
    });

    // === 工具函数 ===
    function showToast(text, duration = 2000) {
      toast.text = text;
      toast.show = true;
      setTimeout(() => { toast.show = false; }, duration);
    }

    function getSeatStudent(group, col, row) {
      const key = `${group}-${col}-${row}`;
      const id = seating.value[key];
      return id ? Store.getStudent(id) : null;
    }

    function getSeatStudentName(group, col, row) {
      const s = getSeatStudent(group, col, row);
      return s ? s.name : null;
    }

    function isPicked(group, col, row) {
      return pickedSeats.value.has(`${group}-${col}-${row}`);
    }

    function refreshAll() {
      students.value = Store.getStudents();
      seating.value = Store.getSeating();
      presets.value = Store.getPresets();
      activePresetId.value = Store.data.activePresetId;
      pickHistory.value = Store.data.pickHistory || [];
      pickCounts.value = Store.getPickCounts();
    }

    // === 导航 ===
    function switchView(v) {
      Sound.click();
      view.value = v;
      nextTick(() => refreshIcons());
    }

    function refreshIcons() {
      if (window.lucide) lucide.createIcons();
    }

    // === 主题切换 ===
    function toggleTheme() {
      Sound.click();
      Theme.toggle();
      theme.value = Theme.current;
      nextTick(() => refreshIcons());
    }

    // === 音效切换 ===
    function toggleSound() {
      soundOn.value = !soundOn.value;
      Store.setSoundOn(soundOn.value);
      Sound.setEnabled(soundOn.value);
      if (soundOn.value) Sound.click();
      nextTick(() => refreshIcons());
    }

    // === Logo 双击彩蛋 ===
    function onLogoDoubleClick() {
      Sound.win();
      const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899'];
      particles.burst(window.innerWidth / 2, 64, 30, colors);
    }

    // === 名单管理 ===
    function addNewStudent() {
      const s = Store.addStudent({ name: '新同学' });
      refreshAll();
      editingStudent.value = { ...s };
    }

  // 加载真实名单（替换模式：清空当前学生后再灌入真实名单）
  function loadDemoData() {
    if (students.value.length > 0) {
      if (!confirm('加载真实名单将清空当前所有学生与座位，确定继续？')) return;
    }
    const realNames = (window.REAL_ROSTER || []).slice();
    if (realNames.length === 0) {
      showToast('真实名单为空');
      return;
    }
    Store.replaceStudents(realNames.map((name, i) => ({
      name,
      gender: 'unknown',
      no: String(i + 1).padStart(2, '0')
    })));
    refreshAll();
    showToast(`已载入 ${realNames.length} 个真实学生`);
    Sound.click();
  }

    function editStudent(s) {
      editingStudent.value = { ...s };
    }

    function saveStudent() {
      if (!editingStudent.value.name.trim()) {
        showToast('姓名不能为空');
        return;
      }
      Store.updateStudent(editingStudent.value.id, editingStudent.value);
      refreshAll();
      editingStudent.value = null;
      showToast('已保存');
      Sound.click();
    }

    function deleteCurrentStudent() {
      if (confirm('确认删除该学生？')) {
        Store.removeStudent(editingStudent.value.id);
        refreshAll();
        editingStudent.value = null;
        showToast('已删除');
        Sound.click();
      }
    }

    function doImportText() {
      if (!importText.value.trim()) {
        showToast('请输入名字');
        return;
      }
      const lines = importText.value.split('\n').map(l => l.trim()).filter(Boolean);
      const added = Store.addStudentsBulk(lines);
      refreshAll();
      showToast(`已导入 ${added.length} 人`);
      Sound.click();
      importText.value = '';
      showImportDialog.value = false;
    }

    function triggerFileImport() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            Store.importJSON(ev.target.result);
            refreshAll();
            showToast('已导入数据');
            Sound.click();
            showImportDialog.value = false;
          } catch (err) {
            showToast('导入失败：' + err.message);
            Sound.error();
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    function exportRoster() {
      const csv = Store.exportRosterCSV();
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `名单-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 CSV');
      Sound.click();
    }

    // === 排座 ===
    function toggleRule(key) {
      rules[key] = !rules[key];
      // 互斥：身高/视力/性别 只可启用一个
      if (rules[key] && ['height', 'vision', 'gender'].includes(key)) {
        ['height', 'vision', 'gender'].forEach(k => {
          if (k !== key) rules[k] = false;
        });
      }
      Store.setRules(rules);
      Sound.click();
    }

    function runArrange() {
      if (students.value.length === 0) {
        showToast('请先导入学生');
        return;
      }
      // 合并：系统级隐藏规则 + 用户暗箱规则 + 可见预设
      const userSecretRules = (window.SecretConfig && window.SecretConfig.getRules()) || [];
      const secretRules = [...SYSTEM_HIDDEN_RULES, ...userSecretRules];
      const result = Arranger.arrange(students.value, {
        rules,
        preset: activePreset.value,
        secretRules
      });

      if (!result.ok) {
        showToast(result.error);
        Sound.error();
        return;
      }

      Arranger.applySeating(result.seating);
      seating.value = Store.getSeating();
      Sound.shuffle();
      showToast(`✓ 已排座 ${result.placedCount} 人`);

      // 注意：lastArrangeMsg 只显示**可见**预设的失败，隐藏规则的失败不报告
      const visibleFailed = result.failed.filter(f => !secretRules.some(sr =>
        sr.student === f.rule?.student ||
        sr.studentA === f.rule?.studentA ||
        sr.studentB === f.rule?.studentB
      ));
      if (visibleFailed.length > 0) {
        lastArrangeMsg.value = `⚠️ ${visibleFailed.length} 条约束未完全满足：${visibleFailed.map(f => f.reason).join('; ')}`;
      } else {
        lastArrangeMsg.value = '✓ 排座完成';
      }

      // 飞入动画
      nextTick(() => {
        const seats = document.querySelectorAll('.seat');
        seats.forEach((el, i) => {
          el.style.opacity = '0';
          el.style.transform = 'scale(0.5)';
          setTimeout(() => {
            el.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = '1';
            el.style.transform = '';
          }, i * 15);
        });
      });

      setTimeout(() => {
        document.querySelectorAll('.seat').forEach(el => {
          el.style.transition = '';
        });
      }, 1500);
    }

    function autoArrange() {
      setTimeout(runArrange, 50);
    }

    function clearAllSeats() {
      if (!confirm('确认清空所有座位？')) return;
      Store.clearSeating();
      seating.value = {};
      showToast('已清空');
      Sound.click();
    }

    function clearPickHistory() {
      if (!pickHistory.value.length) return;
      if (!confirm('确认清空最近抽签记录？')) return;
      Store.clearPickHistory();
      pickHistory.value = [];
      showToast('抽签记录已清空');
      Sound.click();
    }

    function clearPickCounts() {
      const has = Object.keys(pickCounts.value).length > 0;
      if (!has) return;
      if (!confirm('确认清空被抽次数排行？')) return;
      Store.clearPickCounts();
      pickCounts.value = {};
      showToast('排行已清空');
      Sound.click();
    }

    function onSeatClick(group, col, row) {
      Sound.click();
      const s = getSeatStudent(group, col, row);
      if (s) {
        editingStudent.value = { ...s };
      } else {
        // 空位：从未分配的学生中选一个手动分配
        const assignedIds = new Set(Object.values(seating.value));
        const unassigned = students.value.filter(s => !assignedIds.has(s.id));
        if (unassigned.length > 0) {
          const pick = unassigned[0];
          Store.setSeat(group, col, row, pick.id);
          seating.value = Store.getSeating();
          showToast(`${pick.name} 已分配到该座位`);
        } else {
          showToast('所有学生都已分配');
        }
      }
    }

    function exportSeatingImage() {
      const classroomEl = document.querySelector('.classroom');
      if (!classroomEl) {
        showToast('找不到教室元素');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        showToast('图片导出库未加载');
        return;
      }

      showToast('正在生成图片...');
      Sound.click();

      // 临时高亮座位高亮样式（导出时清除）
      document.querySelectorAll('.seat-picked').forEach(el => el.classList.remove('seat-picked'));

      html2canvas(classroomEl, {
        backgroundColor: theme.value === 'dark' ? '#0a0e27' : '#f0f4ff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: classroomEl.scrollWidth,
        windowHeight: classroomEl.scrollHeight
      }).then(canvas => {
        // 添加水印/标题
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = theme.value === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          `SeatMaster Pro · ${new Date().toLocaleString('zh-CN')}`,
          canvas.width - 20,
          canvas.height - 20
        );

        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `座位表-${new Date().toISOString().slice(0,10)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('已导出 PNG 图片');
          Sound.win();
        }, 'image/png');
      }).catch(err => {
        console.error('导出失败:', err);
        showToast('导出失败：' + err.message);
        Sound.error();
      });
    }

    // === 点名器 ===
    async function startPicker() {
      if (students.value.length === 0) {
        showToast('请先导入学生');
        return;
      }
      pickerSpinning.value = true;

      const options = {
        mode: pickerMode.value === 'weighted' ? 'all' : pickerMode.value,
        count: pickerMode.value === 'burst' ? pickerCount.value : 1,
        useWeighted: pickerMode.value === 'weighted',
        groupIndex: pickerGroup.value,
        col: pickerCol.value,
        row: pickerRow.value
      };

      try {
        await Picker.pick(options);
      } catch (err) {
        console.error('Picker error:', err);
        showToast('抽签出错: ' + err.message);
        pickerSpinning.value = false;
      }
      // picker-finished 事件会处理 pickerSpinning.value = false
    }

    function closePicker() {
      Picker.close();
    }

    // === 暗箱操作 ===
    function createNewPreset() {
      const name = prompt('方案名称', '预设方案 ' + (presets.value.length + 1));
      if (!name) return;
      const p = Store.addPreset({ name, rules: [] });
      refreshAll();
      activePresetId.value = p.id;
      Store.setActivePreset(p.id);
      showToast('已创建');
      Sound.click();
    }

    function selectPreset(id) {
      activePresetId.value = id;
      Store.setActivePreset(id);
      Sound.click();
    }

    function savePreset() {
      if (activePreset.value) {
        Store.updatePreset(activePreset.value.id, activePreset.value);
      }
    }

    function deletePreset(id) {
      if (!confirm('确认删除该方案？')) return;
      Store.removePreset(id);
      refreshAll();
      Sound.click();
    }

    function removeRule(index) {
      if (activePreset.value) {
        activePreset.value.rules.splice(index, 1);
        savePreset();
        Sound.click();
      }
    }

    function confirmAddRule() {
      if (!activePreset.value) return;

      // 构造规则对象
      const rule = { type: newRule.type };
      if (newRule.type === 'group') {
        rule.student = newRule.student;
        rule.groupIndex = newRule.groupIndex;
      } else if (newRule.type === 'seat') {
        rule.student = newRule.student;
        rule.group = newRule.group;
        rule.col = newRule.col;
        rule.row = newRule.row;
      } else {
        rule.studentA = newRule.studentA;
        rule.studentB = newRule.studentB;
      }

      // 验证
      const v = Manipulator.validateRule(rule, students.value);
      if (!v.ok) {
        showToast(v.error);
        Sound.error();
        return;
      }

      activePreset.value.rules.push(rule);
      savePreset();
      showAddRule.value = false;
      Object.assign(newRule, { type: 'group', student: '', groupIndex: 0, group: 0, col: 0, row: 0, studentA: '', studentB: '' });
      showToast('已添加约束');
      Sound.click();
    }

    function formatRule(r) {
      switch (r.type) {
        case 'group': return `${r.student} → 第 ${r.groupIndex + 1} 大组`;
        case 'seat': return `${r.student} → 第 ${r.group+1} 组 ${r.col+1} 列 ${r.row+1} 行`;
        case 'deskmate': return `${r.studentA} ⟷ ${r.studentB}（同桌）`;
        case 'sameGroup': return `${r.studentA} ≣ ${r.studentB}（同组）`;
        case 'avoidSameGroup': return `${r.studentA} ⊘ ${r.studentB}（不同组）`;
        default: return JSON.stringify(r);
      }
    }

    // === 关于 ===
    function openAbout() {
      About.open();
      showAbout.value = true;
    }

    function closeAbout() {
      About.close();
      showAbout.value = false;
    }

    // === 初始化 ===
    onMounted(() => {
      Theme.init(theme.value);
      Sound.setEnabled(soundOn.value);
      refreshIcons();

      // 每次打开都自动展示关于界面（用户可在 modal 内手动关闭）
      setTimeout(() => {
        openAbout();
      }, 500);

      // 监听 picker 完成事件，刷新历史记录
      window.addEventListener('picker-finished', () => {
        refreshAll();
        pickerSpinning.value = false;
      });

      // 监听 picker redo 事件
      window.addEventListener('picker-redo', () => {
        startPicker();
      });
    });

    // 监听图标更新
    watch([view, () => showAbout.value, () => showImportDialog.value, () => showAddRule.value, () => editingStudent.value, soundOn, theme], () => {
      nextTick(refreshIcons);
    });

    // 暴露到模板
    return {
      // state
      view, layout, students, seating, presets, activePresetId, theme, soundOn,
      rules, pickHistory, pickerMode, pickerGroup, pickerCol, pickerRow, pickerCount,
      pickerSpinning, pickerOverlay, editingStudent, showImportDialog, importText,
      showAddRule, newRule, showAbout, toast, lastArrangeMsg,
      // computed
      activePreset, seatedCount, topPicked, totalSeatsCount, currentMaxRows, classroomSizeClass,
      // methods
      switchView, toggleTheme, toggleSound, onLogoDoubleClick,
      addNewStudent, editStudent, saveStudent, deleteCurrentStudent,
      doImportText, triggerFileImport, exportRoster, loadDemoData,
      toggleRule, runArrange, autoArrange, clearAllSeats, clearPickHistory, clearPickCounts, onSeatClick, exportSeatingImage,
      startPicker, closePicker,
      createNewPreset, selectPreset, savePreset, deletePreset, removeRule, confirmAddRule, formatRule,
      openAbout, closeAbout,
      getSeatStudent, getSeatStudentName, isPicked
    };
  }
});

const mountedApp = App.mount('#app');
// 暴露 startPicker 到 window 以便 picker.js "再抽一次" 按钮调用
window.App = { startPicker: () => mountedApp.startPicker() };
// 同时保留 setupState 上的方法访问（兼容）
window.AppMounted = mountedApp;
