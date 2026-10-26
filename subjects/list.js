/* 청진노트 과목 목록
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
  fix: function (id, patch) { this.fixes[id] = patch; }
};
