/* 하랑노트 과목 목록
 *
 * ▶ 과목을 추가하려면 (2단계)
 *   1) 과목 파일을 subjects 폴더에 올려요. (subjects/_template.js 양식 참고)
 *   2) 아래 목록에 과목 하나를 { ... } 로 추가해요. 앞 과목의 } 뒤에 쉼표(,)를 잊지 마세요.
 *
 *   {
 *     id: 'pathophysiology-1',          ← 과목 파일 안의 NSA.subject({ id: ... }) 와 똑같이
 *     title: '병태생리학1',               ← 첫 화면에 보이는 이름
 *     term: '1-2',                       ← 학년-학기 (첫 화면에서 학기별로 묶어 보여요)
 *     kind: '전공기초',                   ← 전공필수, 전공기초, 전공선택 등 (없어도 돼요)
 *     files: ['subjects/pathophysiology-1.js']   ← 파일이 여러 개면 쉼표로 이어서
 *   }
 *
 *   files를 빼면 subjects/과목id.js 하나를 불러와요.
 *   sw.js(오프라인 저장)는 고칠 필요가 없어요.
 *   앱에서 만든 반영 파일(subjects/과목id-fix.js)은 올리기만 하면 저절로 적용돼요.
 */
window.NSA_LIST = [
  {
    id: 'health-assessment',
    title: '건강사정',
    term: '1-2',
    kind: '전공필수',
    files: [
      'subjects/health-assessment.js',
      'subjects/health-assessment-q1.js',
      'subjects/health-assessment-q2.js',
      'subjects/health-assessment-q3.js',
      'subjects/health-assessment-q4.js'
    ]
  },
  {
    id: 'medical-terminology',
    title: '의학용어',
    term: '1-2',
    kind: '전공선택',
    files: [
      'subjects/medical-terminology.js',
      'subjects/medical-terminology-2.js',
      'subjects/medical-terminology-en.js'
    ]
  },
  {
    id: 'pathophysiology-1',
    title: '병태생리학1',
    term: '1-2',
    files: [
      'subjects/pathophysiology-1.js',
      'subjects/pathophysiology-1-2.js',
      'subjects/pathophysiology-1-q1.js',
      'subjects/pathophysiology-1-q2.js'
    ]
  }
];

/* 과목 파일이 쓰는 등록 함수 (고치지 마세요) */
window.NSA = window.NSA || {
  subjects: {},
  fixes: {},
  subject: function (def) {
    var cur = this.subjects[def.id];
    def.extraQs = (cur && cur.extraQs) || [];
    this.subjects[def.id] = def;
  },
  add: function (id, part) {
    var s = this.subjects[id] || (this.subjects[id] = { id: id, units: [], extraQs: [], pending: true });
    if (part && part.qs) s.extraQs = s.extraQs.concat(part.qs);
  },
  fix: function (id, patch) { this.fixes[id] = patch; },
  /* 과목 내용을 여러 파일로 나눌 때: 앞 파일의 과목에 장(units)과 표·쌍 등을 이어 붙여요 */
  more: function (id, part) {
    var s = this.subjects[id]; if (!s || !part) return;
    (part.units || []).forEach(function (u) { s.units.push(u); });
    ['pairs', 'tables', 'orders', 'numbers'].forEach(function (k) { if (part[k]) s[k] = (s[k] || []).concat(part[k]); });
    /* 단어장 과목의 영어 설명 (RN 대비): 조각·단어·약어별로 합쳐요 */
    if (part.en) { s.en = s.en || {}; ['parts', 'words', 'abbr'].forEach(function (k) { if (part.en[k]) s.en[k] = Object.assign(s.en[k] || {}, part.en[k]); }); }
  }
};
