# 클럽 페어웨이 스크린 투어 — 사이트 설치 안내

구글 시트에 입력하면 사이트에 바로 반영되는 구조입니다. 서버·로그인 없음.

## 파일
- `index.html` — 회원 메인 화면 (요강 · 신청 양식 · 라이브 기록 · 최종 순위 · 시상)
- `admin.html` — 운영진 페이지 (시트 바로가기 · 점검 · 운영 순서). 주소를 회원에게는 알리지 마세요.
- `config.js` — 시트 ID 등 설정 (여기만 고치면 됩니다)
- `app.js`, `style.css` — 공용 스크립트/스타일
- `img/logo.png` — 엠블럼, `img/chuseok.jpg` — 추석 대회 포스터 (대회 탭 포스터파일 칸에 `chuseok.jpg`)

## 1. 구글 시트 공유 설정 (1분)
운영 시트: https://docs.google.com/spreadsheets/d/1LHGT5jkPuaa4Qc8H9u6ssydTWxUfvBIukcr0Qxn-8MU/edit

1. 우측 상단 **공유** → 일반 액세스를 **"링크가 있는 모든 사용자" · "뷰어"** 로 변경
2. 운영진 계정은 **편집자**로 초대
3. 각 탭의 `(예시)` 행은 지우고 사용

이 설정이 없으면 사이트가 시트를 읽지 못합니다. (시트 내용은 누구나 볼 수 있게 되므로 전화번호 등 개인정보는 넣지 마세요.)

## 2. 깃허브 페이지스에 올리기 (5분)
1. github.com → **New repository** → 이름 예: `clubfairway` → Public → Create
2. **Add file → Upload files** → 이 폴더의 파일 전부(img 폴더 포함) 끌어다 놓기 → Commit
3. 저장소 **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
4. 1~2분 뒤 `https://wellbi1112.github.io/clubfairway/` 에서 확인
   - 회원 링크: `https://wellbi1112.github.io/clubfairway/`
   - 운영진 링크: `https://wellbi1112.github.io/clubfairway/admin.html`

(기존 myscore 저장소 안에 `clubfairway/` 폴더로 넣어도 됩니다 → `https://wellbi1112.github.io/myscore/clubfairway/`)

## 3. 포스터 이미지
대회 포스터는 `img/` 폴더에 올리고(깃허브에서 Upload files), 시트 대회 탭 **포스터파일** 칸에 파일명만 적습니다. 인터넷 이미지 주소(https://…)를 직접 적어도 됩니다.

## 4. 운영 흐름
1. 대회 탭에 대회 추가 (상태 `모집중`)
2. 회원이 보낸 신청 양식 → 회원 탭(처음만) + 접수 탭 입력, 입금 확인되면 `완료`
3. 대회 시작 → 상태 `진행중`
4. 매일: 라운드 탭에 플레이 날짜(+실타 등) 추가, 롱기스트·니어핀·홀인원은 기록부문 탭
5. 종료: 골프존 대회 통계를 최종결과 탭에 입력, 상태 `종료`

## 설정 (config.js)
- `sheetId` — 시트 주소의 `/d/` 와 `/edit` 사이 문자열
- `contactUrl` — 참가 신청을 받을 카톡 오픈채팅 링크 (있으면 신청 양식 아래에 링크 표시)
- `roundFormUrl` — 회원이 플레이 날짜를 직접 제출할 구글 폼 링크 (선택). 폼 응답 시트를 운영 시트에 연결하고 탭 이름을 `라운드`로 바꾸면 자동 반영됩니다. 폼 질문 제목은 `대회ID`, `모임닉네임`, `플레이날짜`, `실타`, `버디`, `파`, `보기`, `양파` 로.

## 닉네임
회원 탭의 첫 칸은 **모임 닉네임**입니다(머리글을 `모임닉네임`으로 바꿔도 되고 `이름` 그대로 두어도 인식). 접수·라운드·최종결과·시상·기록부문 탭의 이름 칸에는 모임 닉네임 또는 골프존 닉네임을 적습니다.
