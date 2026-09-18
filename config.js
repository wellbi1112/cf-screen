// 클럽 페어웨이 스크린 투어 — 설정
// 구글 시트 주소의 /d/ 와 /edit 사이 문자열이 시트 ID입니다.
window.CF_CONFIG = {
  sheetId: "1LHGT5jkPuaa4Qc8H9u6ssydTWxUfvBIukcr0Qxn-8MU",
  season: "2026",
  clubName: "클럽 페어웨이",
  // 참가 신청을 받을 카톡/오픈채팅 링크가 있으면 넣으세요 (없으면 빈칸)
  contactUrl: "",
  contactLabel: "운영진 카톡",
  // 구글 폼으로 플레이 날짜 제출을 받는다면 폼 링크 (없으면 빈칸)
  roundFormUrl: "",
  // 등급 그룹 (LIVE 순위·최종 순위·시상을 이 그룹별로 나눠 보여줍니다)
  gradeGroups: [
    { label: "독수리", grades: ["독수리"] },
    { label: "매", grades: ["매"] },
    { label: "학 · 까치 · 참새", grades: ["학", "까치", "참새"] }
  ]
};
