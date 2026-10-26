/* 청진노트 과목 목록
 * 과목을 추가하려면:
 *  1) subjects 폴더에 과목 파일을 넣고 (health-assessment.js 형식 참고)
 *  2) 아래 목록에 한 줄을 추가하세요.
 *     { id: '과목-id', title: '과목 이름', files: ['subjects/파일이름.js'] }
 *  id는 과목 파일 안의 NSA.subject({ id: ... }) 와 같아야 합니다.
 */
window.NSA_LIST = [
  {
    id: 'health-assessment',
    title: '건강사정',
    files: [
      'subjects/health-assessment.js',
      'subjects/health-assessment-q1.js',
      'subjects/health-assessment-q2.js',
      'subjects/health-assessment-q3.js'
    ]
  }
];

/* 과목 파일이 쓰는 등록 함수 (고치지 마세요) */
window.NSA = window.NSA || {
  subjects: {},
  subject: function (def) {
    var cur = this.subjects[def.id];
    def.extraQs = (cur && cur.extraQs) || [];
    this.subjects[def.id] = def;
  },
  add: function (id, part) {
    var s = this.subjects[id] || (this.subjects[id] = { id: id, units: [], extraQs: [], pending: true });
    if (part && part.qs) s.extraQs = s.extraQs.concat(part.qs);
  }
};
