/* 클럽 페어웨이 스크린 투어 — 공용 스크립트 (시트 읽기 · 계산 · 렌더 조각) */
(function(){
  const CFG = window.CF_CONFIG || {};
  const SHEETS = ['대회','접수','라운드','기록부문','최종결과','시상','협찬','회원'];
  const OPTIONAL = ['회원','시상','협찬'];

  // ---------- utils ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const won = n => (Number(String(n).replace(/[^\d.-]/g,''))||0).toLocaleString('ko-KR') + '원';
  const num = v => { if(v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g,'')); return Number.isNaN(n) ? null : n; };
  function isoDate(v){
    if(!v) return '';
    v = String(v).trim();
    let m = v.match(/^(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/); if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m = v.match(/^(\d{1,2})[.\-/월]\s*(\d{1,2})/); if(m) return `${CFG.season||new Date().getFullYear()}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
  }
  const fmtDate = d => { d = isoDate(d); if(!d) return '—'; const [y,m,dd] = d.split('-'); const w = ['일','월','화','수','목','금','토'][new Date(d+'T00:00:00').getDay()]; return `${Number(m)}월 ${Number(dd)}일(${w})`; };
  const period = e => e.endDate && e.endDate !== e.date ? `${fmtDate(e.date)} ~ ${fmtDate(e.endDate)}` : fmtDate(e.date);

  // ---------- CSV ----------
  function parseCSV(text){
    const rows = []; let row = [], cell = '', q = false;
    for(let i=0;i<text.length;i++){
      const c = text[i];
      if(q){ if(c === '"'){ if(text[i+1] === '"'){ cell += '"'; i++; } else q = false; } else cell += c; }
      else if(c === '"') q = true;
      else if(c === ','){ row.push(cell); cell = ''; }
      else if(c === '\n' || c === '\r'){ if(c === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
    if(!rows.length) return [];
    const head = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(x => String(x).trim() !== '')).map(r => { const o = {}; head.forEach((h,i) => o[h] = (r[i] ?? '').trim()); return o; });
  }
  function col(o, ...names){ for(const n of names){ for(const k in o){ if(k.replace(/\s/g,'') === n) return o[k]; } } for(const n of names){ for(const k in o){ if(k.includes(n)) return o[k]; } } return ''; }
  const isExample = o => Object.values(o).some(v => String(v).includes('(예시)'));

  async function fetchSheet(name){
    const url = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}&_=${Date.now()}`;
    const r = await fetch(url, {cache:'no-store'});
    if(!r.ok) throw new Error(name + ' ' + r.status);
    return parseCSV(await r.text());
  }

  // ---------- model ----------
  async function loadData(){
    const raw = {};
    const results = await Promise.allSettled(SHEETS.map(fetchSheet));
    const errors = [];
    results.forEach((res, i) => { if(res.status === 'fulfilled') raw[SHEETS[i]] = res.value; else { raw[SHEETS[i]] = []; if(!OPTIONAL.includes(SHEETS[i])) errors.push(SHEETS[i]); } });
    if(results.every(r => r.status !== 'fulfilled')) throw new Error('시트를 읽지 못했습니다');
    const S = { errors };
    S.events = raw['대회'].filter(o=>!isExample(o)).map(o => ({ id: col(o,'대회ID','ID'), title: col(o,'대회명'), date: isoDate(col(o,'시작일','일자')), endDate: isoDate(col(o,'종료일')), fee: num(col(o,'참가비'))||0, status: /종료|완료|끝/.test(col(o,'상태')) ? '종료' : '진행중', deadline: isoDate(col(o,'접수마감')), poster: col(o,'포스터파일','포스터'), brief: col(o,'요강') })).filter(e => e.id && e.title);
    S.members = raw['회원'].filter(o=>!isExample(o)).map(o => { const hcp = num(col(o,'G핸디','핸디')); const auto = gradeFromHcp(hcp); return { name: col(o,'모임닉네임','회원닉네임','이름'), gzNick: col(o,'골프존닉네임','골프존'), hcp, grade: col(o,'실력등급') || auto.grade, tier: col(o,'세부등급') || auto.tier, note: col(o,'비고') }; }).filter(m => m.name);
    S.entries = raw['접수'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), name: col(o,'모임닉네임','회원닉네임','이름'), gzNick: col(o,'골프존닉네임','골프존'), hcp: num(col(o,'G핸디','핸디')), grade: col(o,'실력등급'), tier: col(o,'세부등급'), paid: /완료|확인|입금됨|O|o|✓/.test(col(o,'입금')), date: isoDate(col(o,'접수일','타임스탬프')), memo: col(o,'하고싶은말','메모','한마디') })).filter(x => x.name);
    S.rounds = raw['라운드'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), name: col(o,'모임닉네임','닉네임','이름'), date: isoDate(col(o,'플레이날짜','날짜','타임스탬프')), gross: num(col(o,'실타','타수','스코어')), net: num(col(o,'보정타','보정')), birdies: num(col(o,'버디')), pars: num(col(o,'파')), bogeys: num(col(o,'보기')), doubles: num(col(o,'양파','더블')), note: col(o,'비고') })).filter(x => x.name && x.date);
    S.leaders = raw['기록부문'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), cat: col(o,'부문'), name: col(o,'모임닉네임','닉네임','이름'), value: col(o,'기록') })).filter(x => x.cat);
    S.scores = raw['최종결과'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), rank: num(col(o,'순위')), name: col(o,'모임닉네임','닉네임','이름'), gross: num(col(o,'실타')), net: num(col(o,'보정타','보정')), birdies: num(col(o,'버디'))||0 })).filter(x => x.name && x.gross != null).map(x => ({...x, net: x.net ?? x.gross}));
    S.prizes = raw['시상'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), title: col(o,'시상명','부문'), name: col(o,'모임닉네임','닉네임','수상자','이름'), item: col(o,'부상','협찬품') })).filter(x => x.title);
    S.sponsors = raw['협찬'].filter(o=>!isExample(o)).map(o => ({ eventId: col(o,'대회ID','ID'), name: col(o,'협찬자','협찬사'), item: col(o,'품목'), qty: num(col(o,'수량'))||1 })).filter(x => x.name);
    // 대회ID가 대회 탭에 없으면 현재 대회로 자동 배정 (운영진 페이지에서 경고 표시)
    const ids = new Set(S.events.map(e=>e.id));
    const fallback = (S.events.find(e=>e.status!=='종료') || S.events[0] || {}).id;
    S.badIds = [];
    [S.entries, S.rounds, S.leaders, S.scores, S.prizes].forEach(list => list.forEach(x => { if(x.eventId && !ids.has(x.eventId)){ S.badIds.push(x.eventId); if(fallback) x.eventId = fallback; } else if(!x.eventId && fallback) x.eventId = fallback; }));
    S.badIds = [...new Set(S.badIds)];
    // 접수 탭에서 회원 정보 보강: 회원 탭이 없어도 접수 내역만으로 명단 구성
    const byName = {}; S.members.forEach(m => byName[m.name] = m);
    S.entries.forEach(n => {
      let m = byName[n.name] || Object.values(byName).find(x => x.gzNick && x.gzNick === n.name);
      if(!m){ m = {name:n.name, gzNick:'', hcp:null, grade:'', tier:'', note:''}; byName[n.name] = m; S.members.push(m); }
      if(n.gzNick && !m.gzNick) m.gzNick = n.gzNick;
      if(n.hcp != null){ m.hcp = n.hcp; }
      if(n.grade) m.grade = n.grade; if(n.tier) m.tier = n.tier;
    });
    S.members.forEach(m => { if(m.hcp != null && (!m.grade || !m.tier)){ const a = gradeFromHcp(m.hcp); m.grade = m.grade || a.grade; m.tier = m.tier || a.tier; } });
    S.memberByName = {};
    S.members.forEach(m => { S.memberByName[m.name] = m; if(m.gzNick) S.memberByName[m.gzNick] = m; });
    S.member = n => S.memberByName[n] || null;
    S.display = n => { const m = S.member(n); return m ? m.name : n; };
    return S;
  }

  // ---------- grade ----------
  const GRADES = [['독수리','UNDER','#2b2b2b'],['매','SINGLE','#b8302c'],['학','80+','#1a5ce6'],['까치','90+','#145a2c'],['참새','100+','#7a2e9c']];
  const TIERS = ['골드','실버','브론즈'];
  function gradeFromHcp(h){
    if(h == null || Number.isNaN(Number(h))) return {grade:'', tier:''};
    h = Number(h);
    const tierIn = (lo, hi) => { const t = (h - lo) / (hi - lo); return t < 1/3 ? '골드' : t < 2/3 ? '실버' : '브론즈'; };
    if(h < 0)  return {grade:'독수리', tier: h <= -3 ? '골드' : h <= -1.5 ? '실버' : '브론즈'};
    if(h < 8)  return {grade:'매',   tier: tierIn(0, 8)};
    if(h < 18) return {grade:'학',   tier: tierIn(8, 18)};
    if(h < 28) return {grade:'까치', tier: tierIn(18, 28)};
    return {grade:'참새', tier: h < 31 ? '골드' : h < 34 ? '실버' : '브론즈'};
  }
  const gradeChip = m => { if(!m || !m.grade) return ''; const c = (GRADES.find(x=>x[0]===m.grade)||GRADES[2])[2]; const ti = TIERS.indexOf(m.tier); const t = m.tier ? ` <span class="tier t-${ti}">${esc(m.tier)}</span>` : ''; return `<span class="gchip" style="background:${c}">${esc(m.grade)}${t}</span>`; };
  const ghcp = h => { if(h == null || h === '') return ''; h = Math.round(Number(h)*10)/10; return h > 0 ? '+' + h : String(h); };

  // ---------- icons ----------
  const I = {
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    flag:'<path d="M5 21V4M5 4h11l-1.5 4L16 12H5"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    list:'<path d="M4 6h16M4 12h16M4 18h10"/>',
    fire:'<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6-.5 2-1.5 3-2.5 3.5.5-3-1-6-3.5-8 .5 3-1.5 4.5-3 6.5S5 13 5 15c0 4 3 7 7 7z"/>',
    bird:'<path d="M3 13c3 0 5-1 7-3l2-3c1-1 3-2 5-1l4 2-3 1c0 4-3 8-9 8H5l3-2c-2 0-4-1-5-2z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gift:'<path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7c-2 0-4-1.5-4-3s3-2 4 3c1-5 4-4 4-3s-2 3-4 3z"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chart:'<path d="M4 20V10M12 20V4M20 20v-7"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    warn:'<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>',
    refresh:'<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>'
  };
  const ic = (n, cls) => `<svg class="ic ${cls||''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const MEDAL = n => { const c = {1:['#f2c14e','#b8862b'],2:['#d9dde3','#8c949c'],3:['#e2a065','#a0622a']}[n]; return `<svg class="medal-svg" viewBox="0 0 28 28" aria-label="${n}위"><path d="M9 2h4l2 6-4 3zM19 2h-4l-2 6 4 3z" fill="${c[1]}"/><circle cx="14" cy="17" r="8" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.5"/><text x="14" y="21" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="11" fill="${c[1]}">${n}</text></svg>`; };
  const EMPTY_SVG = `<svg viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="60" cy="66" rx="44" ry="9" fill="var(--green-soft)"/><path d="M60 62V12" stroke="var(--muted)" stroke-width="2"/><path d="M60 12h22l-6 8 6 8H60z" fill="var(--live)"/><circle cx="46" cy="60" r="4.5" fill="#fff" stroke="var(--line)"/></svg>`;
  const CONTOUR = `<svg class="contour" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="1.2"><path d="M-20 150c60-40 120-40 180-10s120 30 260-20"/><path d="M-20 170c60-40 120-40 180-10s120 30 260-20"/><path d="M-20 190c60-40 120-40 180-10s120 30 260-20"/><path d="M220 40c40-30 90-30 200-10"/><path d="M240 60c40-30 90-30 180-10"/></g></svg>`;
  const statusPill = st => st==='종료' ? '<span class="pill done">종료</span>' : '<span class="pill live">LIVE</span>';
  const entryOpen = e => e.status!=='종료';
  const posterUrl = p => !p ? '' : (/^https?:\/\//.test(p) ? p : 'img/' + p);

  // ---------- computations ----------
  const entriesOf = (S,e) => S.entries.filter(x => x.eventId === e.id);
  const roundsOf = (S,e) => S.rounds.filter(x => x.eventId === e.id);
  const scoresOf = (S,e) => S.scores.filter(x => x.eventId === e.id);
  function currentEvent(S){
    const live = S.events.filter(e => e.status !== '종료').sort((a,b)=>a.date.localeCompare(b.date))[0]; if(live) return live;
    return S.events.filter(e => e.status==='종료').sort((a,b)=>b.date.localeCompare(a.date))[0] || null;
  }
  function board(S,e){
    const rows = scoresOf(S,e).map(s => ({...s, dname: S.display(s.name)}));
    rows.sort((a,b) => (a.rank||999)-(b.rank||999) || a.net-b.net || a.gross-b.gross || a.dname.localeCompare(b.dname,'ko'));
    rows.forEach((r,i) => { if(!r.rank) r.rank = i+1; });
    return rows;
  }
  function roundStats(S,e){
    const acc = {};
    roundsOf(S,e).forEach(r => { const k = S.display(r.name); const a = acc[k] = acc[k] || {name:k, n:0, last:'', best:null, pars:0, bogeys:0, doubles:0, birdies:0}; a.n++; if(r.date > a.last) a.last = r.date; if(r.gross) a.best = a.best==null ? r.gross : Math.min(a.best, r.gross); a.pars += r.pars||0; a.bogeys += r.bogeys||0; a.doubles += r.doubles||0; a.birdies += r.birdies||0; });
    return Object.values(acc).sort((a,b)=>b.n-a.n || a.last.localeCompare(b.last));
  }
  const AUTO_CATS = [['최다참가','fire',(st)=>{ const t = st[0]; return t && t.n ? {name:t.name, value:`${t.n}회`} : null; }],
    ['스트로크 1위','flag',(st)=>{ const t = st.filter(x=>x.best!=null).sort((a,b)=>a.best-b.best)[0]; return t ? {name:t.name, value:`${t.best}타`} : null; }],
    ['다파','list',(st)=>{ const t = st.filter(x=>x.pars>0).sort((a,b)=>b.pars-a.pars)[0]; return t ? {name:t.name, value:`${t.pars}개`} : null; }],
    ['다보기','list',(st)=>{ const t = st.filter(x=>x.bogeys>0).sort((a,b)=>b.bogeys-a.bogeys)[0]; return t ? {name:t.name, value:`${t.bogeys}개`} : null; }],
    ['다양파','list',(st)=>{ const t = st.filter(x=>x.doubles>0).sort((a,b)=>b.doubles-a.doubles)[0]; return t ? {name:t.name, value:`${t.doubles}개`} : null; }]];
  const iconFor = cat => /롱기|니어/.test(cat) ? 'target' : /홀인원/.test(cat) ? 'star' : /참가/.test(cat) ? 'fire' : /스트로크/.test(cat) ? 'flag' : 'list';
  function leaderRows(S,e){
    const st = roundStats(S,e);
    const manual = S.leaders.filter(l => l.eventId === e.id);
    const rows = [];
    AUTO_CATS.forEach(([cat, icon, fn]) => { const m = manual.find(l => l.cat.replace(/\s/g,'') === cat.replace(/\s/g,'')); const lead = (m && m.name) ? {name:S.display(m.name), value:m.value} : fn(st); rows.push({cat, icon, lead}); });
    manual.forEach(l => { if(rows.some(r => r.cat.replace(/\s/g,'') === l.cat.replace(/\s/g,''))) return; rows.push({cat:l.cat, icon:iconFor(l.cat), lead: l.name ? {name:S.display(l.name), value:l.value} : null}); });
    return rows;
  }
  function autoPrizes(S,e){
    const rows = board(S,e); if(!rows.length) return [];
    const out = [], titles = ['우승','준우승','3위'];
    rows.filter(r => r.rank <= 3).forEach(r => out.push({medal:r.rank, title:titles[r.rank-1], name:r.dname, detail: r.net !== r.gross ? `보정 ${r.net}타 (실타 ${r.gross})` : `${r.gross}타`}));
    if(rows.some(r => r.net !== r.gross)){ const g = [...rows].sort((a,b)=>a.gross-b.gross)[0]; out.push({medal:'M', title:'메달리스트 (실타 1위)', name:g.dname, detail:`${g.gross}타`}); }
    const b = [...rows].sort((a,b)=>b.birdies-a.birdies)[0]; if(b && b.birdies > 0) out.push({medal:'B', title:'버디왕', name:b.dname, detail:`버디 ${b.birdies}개`});
    return out;
  }

  // ---------- render fragments ----------
  function heroHtml(S,e){
    if(!e) return `<div class="hero green">${CONTOUR}<img class="badge-big" src="img/logo.png" alt=""><div class="eyebrow" style="text-align:center">현재 대회</div><h1 style="text-align:center">첫 대회를 준비하고 있습니다</h1><p class="meta" style="text-align:center">운영진이 대회를 등록하면 이 화면에서 바로 확인할 수 있습니다.</p></div>`;
    const contact = CFG.contactUrl ? `<a href="${esc(CFG.contactUrl)}" target="_blank" rel="noopener">${esc(CFG.contactLabel||'운영진 카톡')}</a>` : '운영진 카톡';
    return `<div class="hero green intro">${CONTOUR}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div class="eyebrow">현재 대회 · ${esc(CFG.season||'')} 시즌</div>${statusPill(e.status)}</div>
      <h1>${esc(e.title)}</h1>
      <div class="meta">${period(e)} · 참가비 ${won(e.fee)}${e.deadline ? ` · 접수 마감 ${fmtDate(e.deadline)}` : ''}</div>
      ${e.poster ? `<img class="poster-full" style="margin-top:14px" src="${esc(posterUrl(e.poster))}" alt="${esc(e.title)} 포스터">` : ''}
      <div class="hero-sec"><div class="eyebrow">${ic('info')} 대회 요강</div>${e.brief ? `<div class="brief">${esc(e.brief)}</div>` : (e.poster ? '<div class="brief sub">자세한 내용은 포스터를 참고하세요.</div>' : '<div class="brief sub">요강이 아직 등록되지 않았습니다.</div>')}<div class="sub" style="margin-top:8px">플레이 매장은 자유입니다. 결과는 골프존 대회 통계를 기준으로 운영진이 등록합니다.</div></div>
      ${entryOpen(e) ? `<div class="hero-sec apply" id="apply"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><div class="eyebrow">${ic('users')} 참가 신청 양식</div><button class="btn small" data-copy="${esc(applyForm(e))}">양식 복사</button></div><pre class="brief">${esc(applyForm(e))}</pre><div class="sub" style="margin-top:8px">대회 기간 중 언제든 참가할 수 있습니다. 양식을 채워 ${contact}으로 보내주시면 운영진이 접수·입금 확인을 반영합니다. 라운드 후 결과 화면도 같은 곳으로 보내주세요.</div></div>` : ''}
    </div>`;
  }
  const applyForm = e => `[${e.title} 참가 신청]\n모임 닉네임: \n골프존 닉네임: \n골프존 G핸디: \n입금 여부: (참가비 ${won(e.fee)}) 입금 예정 / 입금 완료\n하고 싶은 말: `;
  function briefHtml(S,e){ return ''; }
  function leaderBoardHtml(S,e){
    const rows = leaderRows(S,e); if(!rows.some(r=>r.lead)) return '';
    return `<div class="card" style="padding:4px 16px">${rows.map(r => `<div class="prize"><div class="medal ${r.cat==='최다참가'?'g':''}">${ic(r.icon)}</div><div><div class="t">${esc(r.cat)}</div><div class="w">${r.lead ? esc(r.lead.name) : '<span class="sub">아직 없음</span>'}</div></div><div class="i">${r.lead ? esc(r.lead.value||'') : ''}</div></div>`).join('')}</div>`;
  }
  function liveRows(S,e){
    const acc = {};
    roundsOf(S,e).forEach(r => { if(r.gross == null) return; const k = S.display(r.name); const net = r.net ?? r.gross; const a = acc[k] = acc[k] || {name:k, n:0, bestNet:null, bestGross:null, birdies:0, last:''}; a.n++; a.birdies += r.birdies||0; if(r.date > a.last) a.last = r.date; if(a.bestNet == null || net < a.bestNet || (net === a.bestNet && r.gross < a.bestGross)){ a.bestNet = net; a.bestGross = r.gross; } });
    const rows = Object.values(acc).sort((a,b) => a.bestNet-b.bestNet || a.bestGross-b.bestGross || b.n-a.n || a.name.localeCompare(b.name,'ko'));
    let rank = 0; rows.forEach((r,i) => { if(i===0 || r.bestNet !== rows[i-1].bestNet) rank = i+1; r.rank = rank; });
    return rows;
  }
  function liveBoardHtml(S,e){
    const rows = liveRows(S,e);
    if(!rows.length) return `<div class="empty illus">${EMPTY_SVG}첫 라운드 결과가 등록되면 현재 순위가 표시됩니다.</div>`;
    const hasNet = rows.some(r => r.bestNet !== r.bestGross);
    return `<div class="card" style="padding:4px 8px"><div class="tbl-wrap"><table><thead><tr><th></th><th>참가자</th>${hasNet?'<th class="r">보정</th>':''}<th class="r">베스트</th><th class="r">라운드</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.rank===1?'p1':''}"><td class="rank r${r.rank}">${r.rank<=3 ? MEDAL(r.rank) : r.rank}</td><td class="name">${esc(r.name)}${gradeChip(S.member(r.name))}<div class="sub">${fmtDate(r.last)}${r.birdies?` · 버디 ${r.birdies}`:''}</div></td>${hasNet?`<td class="num r" style="color:var(--green)">${r.bestNet}</td>`:''}<td class="num r">${r.bestGross}</td><td class="r sub">${r.n}</td></tr>`).join('')}</tbody></table></div></div><p class="meta" style="margin-top:8px">회원별 베스트 스코어 기준 · 운영진이 라운드를 등록할 때마다 갱신됩니다. 최종 순위는 대회 종료 후 골프존 대회 통계로 확정합니다.</p>`;
  }
  function manualLead(S,e,pattern){ const l = S.leaders.find(x => x.eventId === e.id && pattern.test(x.cat.replace(/\s/g,''))); return l && l.name ? {name:S.display(l.name), value:l.value} : null; }
  function liveSummaryHtml(S,e){
    const rows = liveRows(S,e), st = roundStats(S,e);
    const hasNet = rows.some(r => r.bestNet !== r.bestGross);
    const most = st[0] && st[0].n ? {name:st[0].name, value:`${st[0].n}회`} : null;
    const byGrade = {};
    rows.forEach(r => { const m = S.member(r.name); const g = m && m.grade ? m.grade : '등급 미정'; if(!byGrade[g]) byGrade[g] = r; });
    const gradeOrder = [...GRADES.map(g=>g[0]), '등급 미정'].filter(g => byGrade[g]);
    const item = (icon, title, lead, gold) => `<div class="prize"><div class="medal ${gold?'g':''}">${icon}</div><div><div class="t">${esc(title)}</div><div class="w">${lead ? esc(lead.name) : '<span class="sub">아직 없음</span>'}</div></div><div class="i">${lead ? esc(lead.value||'') : ''}</div></div>`;
    const gradeItems = gradeOrder.map(g => { const r = byGrade[g]; const m = S.member(r.name); const chip = m && m.grade ? gradeChip({grade:m.grade, tier:''}).replace('margin-left:6px','') : ''; return `<div class="prize"><div class="medal">${MEDAL(1)}</div><div><div class="t">${esc(g)} 1위</div><div class="w">${esc(r.name)}${m ? gradeChip(m) : ''}</div></div><div class="i">${hasNet ? `보정 ${r.bestNet} <span class="sub">(실타 ${r.bestGross})</span>` : `${r.bestGross}타`}<div class="sub">${r.n}라운드</div></div></div>`; }).join('');
    if(!rows.length && !most && !manualLead(S,e,/롱기/) && !manualLead(S,e,/니어/)) return `<div class="empty illus">${EMPTY_SVG}첫 라운드 결과가 등록되면 현황이 표시됩니다.</div>`;
    return `<div class="card" style="padding:4px 16px">
      ${item(ic('fire'), '최다참여', most, true)}
      ${gradeItems || `<div class="prize"><div class="medal">${ic('flag')}</div><div><div class="t">등급별 1위</div><div class="w"><span class="sub">아직 없음</span></div></div></div>`}
      ${item(ic('target'), '롱기스트 (남)', manualLead(S,e,/롱기.*남/))}
      ${item(ic('target'), '롱기스트 (여)', manualLead(S,e,/롱기.*여/))}
      ${item(ic('target'), '니어핀', manualLead(S,e,/니어/))}
    </div><p class="meta" style="margin-top:8px">등급별 1위는 회원별 베스트 스코어 기준. 운영진이 라운드·기록을 등록할 때마다 갱신되며, 최종 순위는 대회 종료 후 골프존 대회 통계로 확정합니다.</p>`;
  }
  function participationHtml(S,e){
    const st = roundStats(S,e); if(!st.length) return `<div class="empty">아직 등록된 라운드가 없습니다. 플레이 후 운영진에게 알려주세요.</div>`;
    return `<div class="card scroll" style="padding:4px 8px"><div class="tbl-wrap"><table><thead><tr><th>참가자</th><th class="r">라운드</th><th class="r">최근 플레이</th><th class="r">베스트</th></tr></thead><tbody>${st.map((a,i) => `<tr class="${i===0?'p1':''}"><td class="name">${esc(a.name)}${gradeChip(S.member(a.name))}</td><td class="num r">${a.n}</td><td class="r sub">${fmtDate(a.last)}</td><td class="num r">${a.best ?? '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function participantsHtml(S,e){
    const ens = entriesOf(S,e); if(!ens.length) return '<div class="empty">아직 접수된 참가자가 없습니다.</div>';
    return `<div class="card scroll" style="padding:6px 16px">${ens.map(n => `<div class="check"><span class="grow name">${esc(S.display(n.name))}${gradeChip(S.member(n.name))}</span>${n.paid ? '<span class="tag paid">입금 확인</span>' : '<span class="tag unpaid">입금 대기</span>'}</div>`).join('')}</div>`;
  }
  function boardHtml(S,e){
    const rows = board(S,e); if(!rows.length) return `<div class="empty illus">${EMPTY_SVG}최종 결과가 등록되면 순위가 표시됩니다.</div>`;
    const hasNet = rows.some(r => r.net !== r.gross);
    return `<div class="tbl-wrap scroll"><table><thead><tr><th></th><th>참가자</th><th class="r">실타</th>${hasNet?'<th class="r">보정타</th>':''}<th class="r">버디</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.rank===1?'p1':''}"><td class="rank r${r.rank}">${r.rank<=3 ? MEDAL(r.rank) : r.rank}</td><td class="name">${esc(r.dname)}${gradeChip(S.member(r.name))}</td><td class="num r">${r.gross}</td>${hasNet?`<td class="num r" style="color:var(--green)">${r.net}</td>`:''}<td class="r">${r.birdies||0}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function prizesHtml(S,e){
    const auto = autoPrizes(S,e), manual = S.prizes.filter(p => p.eventId === e.id);
    if(!auto.length && !manual.length) return '';
    const item = (medal, title, who, detail, gold) => `<div class="prize"><div class="medal ${gold?'g':''}">${typeof medal==='number' ? MEDAL(medal) : medal==='M' ? ic('flag') : medal==='B' ? ic('bird') : ic('star')}</div><div><div class="t">${esc(title)}</div><div class="w">${esc(who)}</div></div><div class="i">${esc(detail||'')}</div></div>`;
    return `<div class="card" style="padding:4px 16px">${auto.map(p => item(p.medal, p.title, p.name, p.detail, p.medal===1)).join('')}${manual.map(p => item('★', p.title, p.name ? S.display(p.name) : '(미정)', p.item, false)).join('')}</div>`;
  }
  function sponsorsHtml(S,e){
    const list = S.sponsors.filter(s => !e || s.eventId === e.id || s.eventId === '');
    if(!list.length) return '';
    return `<div class="card" style="margin-top:10px"><div class="eyebrow" style="margin-bottom:6px">협찬</div>${list.map(s => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0"><span class="name">${esc(s.name)}</span><span class="meta">${esc(s.item)}${s.qty>1?` × ${s.qty}`:''}</span></div>`).join('')}</div>`;
  }
  function footerHtml(){ return `<footer><img src="img/logo.png" alt=""><div>CLUB FAIRWAY · Attitude Over Skill, People Over Score · EST. 2026</div></footer>`; }

  // copy buttons
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-copy]'); if(!b) return;
    const txt = b.dataset.copy;
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(()=>toast('복사했습니다')).catch(()=>{ const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); toast('복사했습니다'); }catch(x){ toast('길게 눌러 직접 복사해 주세요'); } ta.remove(); });
  });
  let toastT; function toast(msg){ let t = document.getElementById('toast'); if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200); }

  window.CF = { CFG, esc, won, num, isoDate, fmtDate, period, loadData, gradeFromHcp, gradeChip, ghcp, ic, MEDAL, EMPTY_SVG, CONTOUR, statusPill, entryOpen, posterUrl, entriesOf, roundsOf, scoresOf, currentEvent, board, roundStats, leaderRows, autoPrizes, heroHtml, briefHtml, leaderBoardHtml, participationHtml, liveBoardHtml, liveSummaryHtml, liveRows, participantsHtml, boardHtml, prizesHtml, sponsorsHtml, footerHtml, toast, GRADES, TIERS };
})();
