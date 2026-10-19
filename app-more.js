/* صابر أونلاين ERP — المرحلة 2
   الدوام والمراقبة، صندوق الرسائل، المهام، الإعلانات، صفحات الهبوط، تقوية الصفحة،
   المحاسبة، الموظفين والرواتب، الوكالة وبوابة العملاء، العملاء المحتملين، المساعد الذكي. */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmt, jd, pct, sum, today, addDays, monthOf, monthEnd, fmtDT, pill, kpi, head, table, chips, toast,
  openForm, openInfo, closeM, copyText, can, isAdmin, isClient, V, A, ST, ui, ACT_SEC, P} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});
const me = () => K.me;
const rule = (k, d) => N(ST.settings?.rules?.[k] ?? d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const minsAgo = t => t ? (Date.now() - new Date(t).getTime()) / 60000 : 0;
const dur = ms => { const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + 'س ' + (m % 60) + 'د' : m + ':' + String(s % 60).padStart(2, '0'); };
const hm = t => t ? new Date(t).toLocaleTimeString('en-GB', {timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit'}) : '—';
const pct0 = n => Math.round(N(n) * 100) + '%';
const opt = (list, cur, empty) => (empty != null ? `<option value="">${esc(empty)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
const sel = (id, list, cur, empty, attrs = '') => `<select id="${id}" class="inl" ${attrs}>${opt(list, cur, empty)}</select>`;
const people = async () => { ST.people = (await db.q('profiles', {eq: {active: true}, select: 'id,name,role,email', order: ['name', true]})).filter(p => p.role !== 'عميل'); return ST.people; };
const nameOf = id => ST.people?.find(p => p.id === id)?.name || '—';
const periodChips = (cur, act, list = [[1, 'اليوم'], [7, '7 أيام'], [14, '14 يوم'], [30, '30 يوم']]) => `<div class="chips">${list.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="${act}" data-id="${k}">${l}</button>`).join('')}</div>`;
const pnum = n => `<span class="num">${fmt(n)}</span>`;

Object.assign(ACT_SEC, {
  nudge: 'control', moveWaiting: 'control', simForm: 'control', readAlerts: 'control', convAssign: 'control',
  warnForm: 'team', taskForm: 'tasks', taskDel: 'tasks', adAccForm: 'ads', adSync: 'ads', adManual: 'ads', adLink: 'ads',
  landingForm: 'landing', landingToggle: 'landing', postForm: 'page', postToggle: 'page', qrForm: 'page', qrDel: 'page',
  empForm: 'staff', depForm: 'staff', payAdj: 'staff', paySalary: 'staff', clientForm: 'agency', genInvoices: 'agency',
  campForm: 'agency', delivForm: 'agency', stageForm: 'agency', stageSet: 'agency', invForm: 'agency', invToggle: 'agency',
  updForm: 'agency', portalLogin: 'agency', srvForm: 'agency', leadForm: 'leads', leadConvert: 'leads',
  aiProducts: 'ai', aiTasks: 'ai', aiAsk: 'ai', aiCreate: 'ai', saveRules: 'settings', metaPageForm: 'settings', backup: 'settings'
});
ACT_SEC.leadStage = 'leads';

/* ================= الحضور: إشارة كل دقيقة ================= */
const PR = {last: Date.now(), timer: 0, sent: '', status: ''};
const curState = () => document.hidden ? 'away' : (Date.now() - PR.last > 120000 ? 'idle' : 'active');
async function ping() {
  if (!K.me || isClient()) return;
  const st = curState(); PR.sent = st;
  try {
    const r = await db.rpc('presence_ping', {st});
    PR.status = r; K.statusLine = r === 'on' ? 'بالدوام' : r === 'break' ? 'استراحة' : '';
    const sm = $('#me small'); if (sm) sm.textContent = me().role + (K.statusLine ? ' · ' + K.statusLine : '');
  } catch (e) {}
}
['mousemove','keydown','click','scroll','touchstart','input'].forEach(ev => document.addEventListener(ev, () => {
  PR.last = Date.now(); if (PR.sent && PR.sent !== 'active' && PR.status === 'on') { PR.sent = 'active'; ping(); }
}, {passive: true}));
document.addEventListener('visibilitychange', () => { if (PR.status === 'on' || !document.hidden) ping(); });
K.onEnter.push(() => { clearInterval(PR.timer); if (isClient()) return; ping(); PR.timer = setInterval(ping, 60000); refreshBadges(); loadAdsList(); });
K.onLogout.push(() => { clearInterval(PR.timer); PR.status = ''; K.statusLine = ''; });

/* ================= تنبيهات مباشرة وصوت ================= */
let actx = null;
const soundOn = () => { try { return localStorage.getItem('saber-sound') === '1'; } catch (e) { return false; } };
function beep() {
  if (!soundOn()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 660, 880].forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = f; o.connect(g); g.connect(actx.destination); g.gain.value = .07; o.start(actx.currentTime + i * .22); o.stop(actx.currentTime + i * .22 + .16); });
  } catch (e) {}
}
['attendance','alerts','conversations','messages','tasks'].forEach(t => K.liveIgnore.add(t));
Object.assign(K.liveViews, {control: ['attendance','alerts','conversations','messages'], inbox: ['conversations','messages'], myday: ['attendance'], mytasks: ['tasks'], tasks: ['tasks'], dash: ['conversations']});
K.onLive.push((table, p) => {
  if (table === 'alerts' && p?.eventType === 'INSERT' && (can('control') || can('team'))) {
    const a = p.new || {};
    if (a.level === 'bad') { beep(); toast(a.text, true); } else if (a.level === 'warn' && ui.view !== 'control') toast(a.text);
  }
  if (table === 'alerts' && p?.eventType === 'INSERT' && p.new?.user_id === me()?.id && p.new?.kind === 'تنبيه من الإدارة') { beep(); toast('تنبيه من الإدارة: ارجعي للصفحة وردي على الرسائل', true); }
  if (table === 'messages' && p?.eventType === 'INSERT' && p.new?.dir === 'in' && ui.view !== 'inbox' && can('inbox', 'edit')) toast('وصلت رسالة جديدة');
  if (['alerts','conversations','messages'].includes(table)) { clearTimeout(refreshBadges.t); refreshBadges.t = setTimeout(refreshBadges, 1500); }
});
function setBadge(k, n, red) {
  K.badges[k] = n || ''; K.badgeRed[k] = !!red;
  const b = document.querySelector(`#nav [data-act=go][data-id="${k}"]`); if (!b) return;
  let em = b.querySelector('em'); if (!n) { em?.remove(); return; }
  if (!em) { em = document.createElement('em'); b.appendChild(em); } em.textContent = n; em.className = red ? 'red' : '';
}
async function refreshBadges() {
  if (!K.me || isClient()) return;
  try {
    if (can('inbox')) { const w = await db.q('v_conversations', {eq: {waiting: true}, select: 'id,last_in'}); setBadge('inbox', w.length, w.some(c => minsAgo(c.last_in) > rule('sla', 5))); }
    if (can('control')) { const a = await db.q('alerts', {eq: {read: false, level: 'bad'}, select: 'id'}); setBadge('control', a.length, true); }
    const t = await db.q('tasks', {eq: {assignee: me().id}, in: {status: ['جديدة','قيد العمل']}, select: 'id,due'});
    setBadge('mytasks', t.length, t.some(x => x.due && x.due < today()));
  } catch (e) {}
}
setInterval(refreshBadges, 60000);
setInterval(() => {
  $$('[data-since]').forEach(el => { const ms = Date.now() - new Date(el.dataset.since).getTime(); el.textContent = dur(ms);
    if (el.dataset.sla) { const m = ms / 60000; el.className = 'tmr ' + (m > rule('escalate', 15) ? 'bad' : m > rule('sla', 5) ? 'warn' : 'ok'); } });
}, 1000);
setInterval(() => { if (['control','inbox'].includes(ui.view) && K.me && document.visibilityState === 'visible') K.softRender(); }, 30000);
async function loadAdsList() { try { if (can('orders', 'edit')) K.adsList = await db.q('ads', {select: 'ad_id,name', order: ['updated_at', false], limit: 150}); } catch (e) {} }

/* ================= دوامي ================= */
function liveState(a) {
  if (!a?.check_in) return ['offline', 'ما سجّلت دخول', null];
  if (a.check_out) return ['offline', 'خرجت الساعة ' + hm(a.check_out), null];
  if (a.break_since) return ['break', 'استراحة', a.break_since];
  if (!a.last_ping || minsAgo(a.last_ping) > 2.5) return ['away', 'برا الصفحة', a.last_ping || a.check_in];
  if (a.state === 'away') return ['away', 'برا الصفحة', a.state_since];
  if (a.state === 'idle') return ['idle', 'خاملة', a.state_since];
  return ['online', 'متصلة وشغالة', null];
}
const ST_PILL = {online: 'good', idle: 'bad', away: 'bad', break: 'warn', offline: ''};
V.myday = async () => {
  const u = me(), m = monthOf(today());
  const [[att], stats, warns, emp, myOrders, tasks] = await Promise.all([
    db.q('attendance', {eq: {user_id: u.id, day: today()}}), db.rpc('team_stats', {d_from: today(), d_to: today()}),
    db.q('v_warnings', {eq: {user_id: u.id}, order: ['at', false], limit: 20}), db.q('employees', {eq: {user_id: u.id}}),
    can('orders') ? db.q('v_orders', {eq: {created_by: u.id}, gte: {day: m + '-01'}, select: 'id,status'}) : [],
    db.q('v_tasks', {eq: {assignee: u.id}, in: {status: ['جديدة','قيد العمل','بانتظار مراجعة']}, select: 'id,due'})]);
  const s = (Array.isArray(stats) ? stats : []).find(r => r.user_id === u.id) || {};
  const e = emp[0]; const [st, label, since] = liveState(att);
  const delivered = myOrders.filter(o => o.status === 'مكتمل مسلم').length;
  const btns = !att?.check_in || att.check_out ? '<button class="btn pri" data-act="checkIn">تسجيل دخول للدوام</button>'
    : `<button class="btn" data-act="breakToggle">${att.break_since ? 'رجعت من الاستراحة' : 'بدي استراحة'}</button><button class="btn" data-act="checkOut">تسجيل خروج</button>`;
  return head('دوامي', e ? `${esc(e.job_title || '')} ${e.shift_from ? '· الدوام ' + e.shift_from.slice(0, 5) + ' – ' + (e.shift_to || '').slice(0, 5) : ''}` : '', btns) +
    `<div class="ebar"><div class="row"><span class="dot ${st}"></span> ${pill(label, ST_PILL[st])} ${since ? `<span class="tmr" data-since="${since}">${dur(Date.now() - new Date(since))}</span>` : ''}
      ${att?.check_in ? `<small class="m">دخلت ${hm(att.check_in)}${att.late_min >= rule('late', 10) ? ` · <b class="neg">متأخرة ${att.late_min} د</b>` : ''}</small>` : ''}</div></div>
    <p class="note">النظام بيعرف إنك موجود من استخدامك للنظام. إذا سكّرت الصفحة أو قلبت لتطبيق ثاني، أو ما في أي نشاط ${rule('idle', 10)} دقائق وإنت بالدوام، بيوصل للإدارة تنبيه. الاستراحة لازم تكون من الزر فوق.</p>
    <div class="kpis">${kpi('محادثات اليوم', N(s.convs), 'رديت على ' + N(s.replied))}${kpi('متوسط أول رد', s.avg_first_min != null ? s.avg_first_min + ' د' : '—', 'الهدف أقل من ' + rule('sla', 5) + ' د')}
     ${kpi('رسائل ضاعت', N(s.missed), '', N(s.missed) ? 'red' : '')}${kpi('برا الصفحة اليوم', N(s.away_min) + ' د', 'خمول ' + N(s.idle_min) + ' د')}
     ${kpi('طلباتي هالشهر', myOrders.length, delivered + ' انسلّمت')}${e && N(e.commission) ? kpi('عمولتي هالشهر', jd(delivered * N(e.commission)), jd(e.commission) + ' على كل طلب مسلّم', 'hl') : ''}
     ${kpi('مهامي المفتوحة', tasks.length, tasks.filter(t => t.due && t.due < today()).length + ' متأخرة')}</div>
    <div class="card"><h2>الإنذارات</h2>${table([{h:'التاريخ', f:w => fmtDT(w.at)}, {h:'السبب', f:w => esc(w.text), c:'wrap'}, {h:'من', f:w => esc(w.by_name || '')}], warns, 'ما في إنذارات. كمّل هيك.')}</div>`;
};
Object.assign(A, {
  checkIn: async () => { const a = await db.rpc('check_in'); PR.status = 'on'; toast(N(a?.late_min) >= rule('late', 10) ? `سجّلت دخول، متأخر ${a.late_min} دقيقة` : 'سجّلت دخول، يعطيك العافية'); ping(); K.render(); },
  checkOut: async (_, b) => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟ اضغط مرة ثانية'; return; } await db.rpc('check_out'); PR.status = 'off'; toast('سجّلت خروج'); K.render(); },
  breakToggle: async () => { const r = await db.rpc('break_toggle'); PR.status = r; toast(r === 'break' ? 'استراحة موفقة، ما تطوّل أكثر من ' + rule('break_max', 20) + ' دقيقة' : 'أهلين رجعت'); K.render(); }
});

/* ================= غرفة التحكم ================= */
V.control = async () => {
  try { await db.rpc('check_presence'); } catch (e) {}
  const af = ui.alertFilter || 'unread';
  const ao = {order: ['at', false], limit: 60}; if (af === 'unread') ao.eq = {read: false}; else if (af !== 'all') ao.eq = {kind: af};
  const [team, waiting, alerts] = await Promise.all([db.q('v_attendance_today', {order: ['name', true]}), db.q('v_conversations', {eq: {waiting: true}, order: ['last_in', true], limit: 100}), db.q('alerts', ao)]);
  const rank = {away: 0, idle: 1, break: 2, online: 3, offline: 4};
  const rows = team.map(a => ({a, s: liveState(a)})).sort((x, y) => rank[x.s[0]] - rank[y.s[0]] || N(y.a.waiting) - N(x.a.waiting));
  const on = rows.filter(r => r.s[0] !== 'offline');
  const cards = rows.map(({a, s: [st, label, since]}) => {
    const alarm = (st === 'away' || st === 'idle') && since && minsAgo(since) > rule('idle', 10);
    return `<div class="tm ${alarm || (N(a.waiting) && st !== 'online') ? 'alarm' : ''}">
      <div class="top"><div class="row"><span class="av">${esc((a.name || '؟')[0])}</span><div><h3>${esc(a.name)}</h3><small class="m">${esc(a.department || a.role)}${a.shift_from ? ' · ' + a.shift_from.slice(0, 5) + '–' + (a.shift_to || '').slice(0, 5) : ''}</small></div></div><span class="dot ${st}" title="${label}"></span></div>
      <div class="kv"><span>الحالة</span><b>${pill(label, ST_PILL[st])}</b></div>
      ${since ? `<div class="kv"><span>من</span><b><span class="tmr ${alarm ? 'bad' : st === 'break' ? 'warn' : ''}" data-since="${since}">${dur(Date.now() - new Date(since))}</span></b></div>` : ''}
      <div class="kv"><span>مستنيين رد</span><b class="${N(a.waiting) ? 'neg' : ''}">${N(a.waiting)}</b></div>
      <div class="kv"><span>محادثات اليوم / أول رد</span><b>${N(a.convs_today)} / ${a.avg_first_min != null ? a.avg_first_min + ' د' : '—'}</b></div>
      <div class="kv"><span>دخول</span><b>${a.check_in ? hm(a.check_in) + (a.late_min >= rule('late', 10) ? ` ${pill('متأخرة ' + a.late_min + 'د', 'bad')}` : '') : '—'}</b></div>
      <div class="kv"><span>برا الصفحة / خمول</span><b>${Math.round(N(a.away_s) / 60)} د / ${Math.round(N(a.idle_s) / 60)} د</b></div>
      <div class="row" style="margin-top:4px"><button class="btn sm ${alarm ? 'dng' : ''}" data-act="nudge" data-id="${a.user_id}">نبّه</button>${N(a.waiting) ? `<button class="btn sm" data-act="moveWaiting" data-id="${a.user_id}">حوّل محادثاته</button>` : ''}<button class="btn sm ghost" data-act="warnForm" data-id="${a.user_id}">إنذار</button></div></div>`;
  }).join('');
  const sOn = soundOn();
  return head('غرفة التحكم', 'متابعة مباشرة للموظفين والرسائل. التنبيه بيطلع لحاله إذا حدا تأخر بالرد أو ترك الصفحة، وبتتحدث كل 30 ثانية',
      `<button class="btn ${sOn ? 'pri' : ''}" data-act="soundToggle">${sOn ? 'صوت التنبيه شغّال' : 'شغّل صوت التنبيه'}</button><button class="btn" data-act="simForm">+ رسالة تجريبية</button>`) +
    `<div class="kpis">${kpi('بالدوام الآن', on.length + ' / ' + rows.length)}${kpi('برا الصفحة أو خاملين', rows.filter(r => ['away','idle'].includes(r.s[0])).length, '', rows.some(r => ['away','idle'].includes(r.s[0])) ? 'red' : '')}
      ${kpi('زبائن مستنيين', waiting.length, waiting.filter(c => minsAgo(c.last_in) > rule('sla', 5)).length + ' متأخرين عن ' + rule('sla', 5) + ' د', waiting.some(c => minsAgo(c.last_in) > rule('escalate', 15)) ? 'red' : '')}
      ${kpi('تنبيهات غير مقروءة', alerts.filter(a => !a.read).length)}</div>
    <div class="team">${cards || '<p class="note">ما في موظفين مفعّلين غير المدير. أضف موظفين من المستخدمين والصلاحيات.</p>'}</div>
    <div class="cols">
     <div class="card"><h2>طابور الانتظار (${waiting.length})</h2>${waiting.length ? table([{h:'الزبون', f:c => esc(c.customer || 'زبون') + ` <small class="m">${esc(c.channel)}</small>`}, {h:'الموظف', f:c => esc(c.agent_name || 'بدون')}, {h:'المنتج', f:c => esc(c.product_name || '—')},
        {h:'بيستنى', f:c => `<span class="tmr" data-since="${c.last_in}" data-sla="1">${dur(Date.now() - new Date(c.last_in))}</span>`}, {h:'', f:c => `<button class="btn sm" data-act="openConv" data-id="${c.id}">افتح</button>`}], waiting) : '<p class="note">ولا زبون مستني. ممتاز.</p>'}</div>
     <div class="card"><div class="head" style="margin-bottom:10px"><h2>التنبيهات</h2><button class="btn sm" data-act="readAlerts">علّم الكل مقروء</button></div>
      <div class="chips" style="margin-bottom:10px">${[['unread','غير مقروء'], ['all','الكل'], ['ترك الصفحة','ترك الصفحة'], ['رسائل','رسائل'], ['تصعيد','تصعيد'], ['دوام','دوام'], ['رد من برا النظام','رد من برا النظام']].map(([k, l]) => `<button class="chip ${af === k ? 'on' : ''}" data-act="alertFilter" data-id="${k}">${l}</button>`).join('')}</div>
      <div class="feed">${alerts.map(a => `<div class="al ${a.level} ${a.read ? 'read' : ''}"><span class="ic">${a.level === 'bad' ? '!' : a.level === 'warn' ? '•' : 'i'}</span><div><div>${esc(a.text)}</div><time>${fmtDT(a.at)} · ${esc(a.kind)}</time></div>${a.conv_id ? `<button class="btn sm ghost" data-act="openConv" data-id="${a.conv_id}">افتح</button>` : ''}</div>`).join('') || '<p class="note">ما في تنبيهات.</p>'}</div></div></div>`;
};
Object.assign(A, {
  soundToggle: () => { const v = !soundOn(); try { localStorage.setItem('saber-sound', v ? '1' : '0'); } catch (e) {} if (v) { soundOnce(); } K.render(); },
  alertFilter: k => { ui.alertFilter = k; K.render(); },
  readAlerts: async () => { await db.rpc('mark_alerts_read', {ids: null}); refreshBadges(); K.render(); },
  nudge: async id => { await db.rpc('nudge', {uid: id}); toast('انبعت التنبيه'); },
  moveWaiting: async id => { const n = await db.rpc('move_waiting', {from_uid: id}); toast(n ? `انتقلت ${n} محادثة` : 'ما في حدا ثاني متاح بالدوام هلأ', !n); K.render(); },
  warnForm: id => openForm('إنذار', [{k:'text', l:'السبب', t:'select', opts:['تأخير متكرر بالرد على الرسائل','ترك الصفحة وقت الدوام','تأخير عن بداية الدوام','رسائل ضاعت بدون رد','رد من برا النظام','أسلوب رد غير مناسب','أخرى']}, {k:'note', l:'تفاصيل (اختياري)', wide: 1}], null,
    async v => { await db.rpc('add_warning', {uid: id, txt: v.text + (v.note ? ' - ' + v.note : '')}); toast('انسجل الإنذار'); }),
  simForm: () => openForm('رسالة تجريبية', [{k:'cust', l:'اسم الزبون', def: 'زبون تجربة'}, {k:'txt', l:'الرسالة', def: 'قديش السعر؟', wide: 1}, {k:'pid', l:'المنتج', t:'select', opts: [['', '—'], ...ST.products.filter(p => p.active).map(p => [p.id, p.name])]}], null,
    async v => { await db.rpc('simulate_incoming', {cust: v.cust, txt: v.txt, pid: v.pid || null}); toast('وصلت رسالة تجريبية وانوزعت على موظف بالدوام'); refreshBadges(); K.render(); })
});
function soundOnce() { const was = soundOn(); try { localStorage.setItem('saber-sound', '1'); } catch (e) {} beep(); if (!was) try { localStorage.setItem('saber-sound', '1'); } catch (e) {} }

/* ================= صندوق الرسائل ================= */
const CLOSE_REASONS = ['سأل عن السعر بس','غالي عليه','بدو يفكر','مش جدّي','رقم غلط / ما رد','خارج منطقة التوصيل','طلب من قبل'];
const CH_SOURCE = {'ماسنجر': 'ماسنجر', 'إنستغرام': 'إنستغرام', 'تعليق': 'تعليقات', 'تجربة': 'ماسنجر'};
V.inbox = async () => {
  const f = ui.ifilter || 'waiting', o = {order: ['last_in', false], limit: 150};
  if (f === 'waiting') { o.eq = {waiting: true}; o.order = ['last_in', true]; } else if (f === 'orders') o.eq = {status: 'طلب'}; else if (f === 'closed') o.in = {status: ['مغلقة','ضائعة']};
  const needAtt = can('inbox', 'edit') && !can('control');
  const [list, qr, att] = await Promise.all([db.q('v_conversations', o), db.q('quick_replies', {order: ['created_at', true]}),
    needAtt ? db.q('attendance', {eq: {user_id: me().id, day: today()}}) : []]);
  let cur = ui.conv ? (list.find(c => c.id === ui.conv) || (await db.q('v_conversations', {eq: {id: ui.conv}}))[0]) : list[0];
  if (cur) ui.conv = cur.id;
  const msgs = cur ? await db.q('messages', {eq: {conv_id: cur.id}, order: ['at', true], limit: 300}) : [];
  ui.convData = cur;
  const notIn = needAtt && (!att[0]?.check_in || att[0]?.check_out);
  const li = list.map(c => `<button class="ci ${cur && c.id === cur.id ? 'on' : ''}" data-act="openConv" data-id="${c.id}">
     <span class="l1"><span>${esc(c.customer || 'زبون')}</span>${c.waiting ? `<span class="tmr" data-since="${c.last_in}" data-sla="1">${dur(Date.now() - new Date(c.last_in))}</span>` : pill(c.status, c.status === 'طلب' ? 'good' : c.status === 'ضائعة' ? 'bad' : '')}</span>
     <span class="l2">${esc(c.channel)}${c.product_name ? ' · ' + esc(c.product_name) : ''}${can('control') ? ' · ' + esc(c.agent_name || 'بدون موظف') : ''}</span><span class="l2">${esc(c.last_text || '')}</span></button>`).join('');
  let th = '<div class="empty">اختار محادثة من القائمة</div>';
  if (cur) {
    const closed = cur.status !== 'مفتوحة', canReply = can('inbox', 'edit') || can('control', 'edit');
    th = `<div class="thh"><div><h3>${esc(cur.customer || 'زبون')} ${pill(cur.channel, 'info')}</h3><small class="m">${cur.ad_name ? 'جاي من إعلان: ' + esc(cur.ad_name) : cur.ad_id ? 'جاي من إعلان' : 'بدون إعلان'}${cur.first_reply_at ? ' · أول رد بعد ' + dur(new Date(cur.first_reply_at) - new Date(cur.first_in || cur.created_at)) : ''}</small></div>
      <div class="row">${sel('cv_prod', ST.products.filter(p => p.active).map(p => [p.id, p.name]), cur.product_id, 'المنتج: —', `data-chg="convProduct" data-id="${cur.id}" aria-label="المنتج"`)}
      ${can('control', 'edit') ? sel('cv_agent', (ST.people || []).map(p => [p.id, p.name]), cur.assigned_to, 'بدون موظف', `data-chg="convAssign" data-id="${cur.id}" aria-label="الموظف"`) : ''}</div></div>
     <div class="msgs" id="msgs">${msgs.map(m => m.dir === 'note' ? `<div class="bub s">${esc(m.text)} · ${hm(m.at)}</div>` : `<div class="bub ${m.dir === 'in' ? 'c' : 'e'} ${m.outside ? 'outside' : ''}">${esc(m.text)}<small>${hm(m.at)}${m.dir === 'out' ? ' · ' + esc(m.by_name || '') : ''}${m.outside ? ' · ⚠ من برا النظام' : ''}</small></div>`).join('')}</div>
     ${closed ? `<div class="composer"><p class="note">المحادثة ${esc(cur.status)}${cur.close_reason ? ' · السبب: ' + esc(cur.close_reason) : ''}</p><div class="row"><button class="btn sm" data-act="convReopen" data-id="${cur.id}">إعادة فتح</button></div></div>`
     : canReply ? `<div class="composer"><div class="chips">${qr.map(q => `<button class="chip" data-act="qr" data-id="${q.id}">${esc(q.title)}</button>`).join('')}</div>
       <textarea id="reply" rows="2" placeholder="اكتب ردك هون… (Ctrl+Enter للإرسال)"></textarea>
       <div class="row"><button class="btn pri" data-act="sendReply" data-id="${cur.id}">إرسال</button>${can('orders', 'edit') ? `<button class="btn" data-act="convOrder" data-id="${cur.id}">حوّلها لطلب</button>` : ''}<button class="btn" data-act="convClose" data-id="${cur.id}">إغلاق بدون طلب</button></div></div>` : ''}`;
  }
  ui.qr = qr;
  return head(can('control') ? 'صندوق الرسائل' : 'رسائلي', 'ماسنجر وإنستغرام والتعليقات بمكان واحد. الرد يدوي، وكل رد بينحسب على الموظف اللي رد، وكل محادثة مربوطة بالإعلان اللي جابها') +
    (notIn ? '<div class="note warnbar">إنت مش مسجّل دخول للدوام، فما رح توصلك محادثات جديدة. <button class="btn sm pri" data-act="checkIn">تسجيل دخول للدوام</button></div>' : '') +
    `<div class="inbox"><div class="ilist">${chips([['waiting','بانتظار الرد'], ['all','الكل'], ['orders','طلبات'], ['closed','مغلقة']], f, 'ifilter')}<div class="iscroll" id="iscroll">${li || '<div class="empty">ما في محادثات هون</div>'}</div></div><div class="ithread">${th}</div></div>`;
};
const fillQ = (t, c) => t.replaceAll('{المنتج}', c?.product_name || 'المنتج').replaceAll('{السعر}', c?.product_price != null ? fmt(c.product_price) : '');
Object.assign(A, {
  openConv: id => { ui.conv = id; if (ui.view !== 'inbox') { ui.view = 'inbox'; ui.ifilter = 'all'; } K.render().then?.(() => { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; }); },
  ifilter: k => { ui.ifilter = k; ui.conv = ''; K.render(); },
  qr: id => { const q = ui.qr?.find(x => x.id === id); const ta = $('#reply'); if (!q || !ta) return; ta.value = (ta.value ? ta.value + ' ' : '') + fillQ(q.text, ui.convData); ta.focus(); },
  sendReply: async id => {
    const ta = $('#reply'); const text = ta?.value.trim(); if (!text) { toast('اكتب الرد أول', true); return; }
    const c = ui.convData;
    if (!c || c.page_id === 'test' || c.channel === 'تجربة') await db.rpc('record_reply', {cid: id, txt: text});
    else await db.fn('meta-send', {conv_id: id, text});
    ta.value = ''; await K.render(); const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; refreshBadges();
  },
  convOrder: id => { const c = ui.convData; const p = c?.product_id ? P(c.product_id) : null;
    K.openOrderForm({customer: c?.customer || '', conv_id: id, source: CH_SOURCE[c?.channel] || 'ماسنجر', items: p ? [{product_id: p.id, qty: 1, price: p.price}] : null}); },
  convClose: id => openForm('إغلاق بدون طلب', [{k:'reason', l:'السبب', t:'select', opts: CLOSE_REASONS, wide: 1}], null,
    async v => { await db.rpc('conv_close', {cid: id, reason: v.reason}); toast(['سأل عن السعر بس','غالي عليه','بدو يفكر'].includes(v.reason) ? 'انغلقت وانضاف الزبون لقائمة المتابعة' : 'انغلقت'); refreshBadges(); K.render(); }),
  convReopen: async id => { await db.rpc('conv_reopen', {cid: id}); K.render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'reply' && ui.conv) A.sendReply(ui.conv).catch(x => toast(K.arabicErr(x), true)); });
document.addEventListener('change', async e => {
  const t = e.target; const c = t.dataset?.chg; if (!c) return;
  try {
    if (c === 'convProduct') { await db.rpc('conv_set_product', {cid: t.dataset.id, pid: t.value || null}); toast('انحفظ المنتج'); K.render(); }
    if (c === 'convAssign') { if (!t.value) return; await db.rpc('conv_assign', {cid: t.dataset.id, uid: t.value}); toast('انتقلت المحادثة'); K.render(); }
    if (c === 'taskStatus') { await db.rpc('task_status', {tid: t.dataset.id, st: t.value}); toast('تحدّثت المهمة'); refreshBadges(); K.render(); }
    if (c === 'delivStatus') { await db.upd('deliverables', {id: t.dataset.id}, {status: t.value}); toast('تحدّث'); K.render(); }
    if (c === 'leadStage') { await db.upd('leads', {id: t.dataset.id}, {stage: t.value, updated_at: new Date().toISOString()}); toast('تحدّث'); K.render(); }
    if (c === 'adProduct') { await db.rpc('ad_set_product', {aid: t.dataset.id, pid: t.value || null}); toast('انربط الإعلان بالمنتج'); K.render(); }
    if (c === 'stageSet') { await db.upd('stages', {id: t.dataset.id}, {status: t.value, done_at: t.value === 'منتهي' ? new Date().toISOString() : null}); toast('تحدّثت المرحلة'); K.render(); }
    if (c === 'pmonth') { ui.pmonth = t.value || monthOf(today()); K.render(); }
  } catch (x) { toast(K.arabicErr(x), true); K.render(); }
});

/* ================= مراقبة الموظفين ================= */
function score(r, days) {
  const d = Math.max(1, N(r.days) || days), sla = rule('sla', 5);
  let s = 100 - N(r.away_min) / (d * 2) - N(r.idle_min) / (d * 3) - N(r.late_login_min) / (d * 1.5) - N(r.warnings) * 2;
  if (N(r.convs)) { s -= Math.max(0, N(r.avg_first_min) - sla) * 4 + (N(r.missed) / N(r.convs)) * 180; s += clamp((N(r.orders) / N(r.convs) - .12) * 70, -15, 10); }
  return Math.round(clamp(s, 0, 100));
}
V.team = async () => {
  const d = ui.teamDays || 1, from = addDays(today(), -(d - 1));
  const [rows, warns] = await Promise.all([db.rpc('team_stats', {d_from: from, d_to: today()}), db.q('v_warnings', {order: ['at', false], limit: 60})]);
  const list = (rows || []).filter(r => r.role !== 'مدير عام').map(r => ({...r, score: score(r, d)}));
  const cls = s => s >= 75 ? 'good' : s >= 55 ? 'warn' : 'bad';
  return head('مراقبة الموظفين', 'سرعة الرد، الرسائل الضايعة، الخمول، الخروج من الصفحة، التأخير، والتحويل لطلبات', periodChips(d, 'teamDays', [[1, 'اليوم'], [7, '7 أيام'], [30, '30 يوم']])) +
    table([{h:'الموظف', f:r => `<b>${esc(r.name)}</b><br><small class="m">${esc(r.role)}</small>`}, {h:'التقييم', f:r => pill(r.score + '/100', cls(r.score))}, {h:'أيام دوام', f:r => r.days},
      {h:'محادثات', f:r => r.convs}, {h:'أول رد', f:r => `<span class="${N(r.avg_first_min) > rule('sla', 5) ? 'neg' : ''}">${r.avg_first_min != null ? r.avg_first_min + ' د' : '—'}</span>`}, {h:'رد متأخر', f:r => r.late_replies},
      {h:'ضاعت', f:r => `<b class="${N(r.missed) ? 'neg' : ''}">${r.missed}</b>`}, {h:'برا الصفحة', f:r => `<span class="${N(r.away_min) > 30 * d ? 'neg' : ''}">${fmt(r.away_min)} د</span>`}, {h:'خمول', f:r => fmt(r.idle_min) + ' د'},
      {h:'استراحة', f:r => fmt(r.break_min) + ' د'}, {h:'تأخير دخول', f:r => r.late_login_min + ' د'}, {h:'طلبات', f:r => r.orders}, {h:'انسلّمت / رجعت', f:r => r.delivered + ' / ' + r.returned},
      {h:'تحويل', f:r => N(r.convs) ? pct(N(r.orders) / N(r.convs)) : '—'}, {h:'مهام', f:r => r.tasks_done + ' خلصت / ' + r.tasks_open + ' مفتوحة'}, {h:'إنذارات', f:r => r.warnings},
      {h:'', f:r => `<button class="btn sm ghost" data-act="warnForm" data-id="${r.user_id}">إنذار</button>`}], list, 'ما في موظفين', r => r.score < 55 ? 'flag' : '') +
    `<div class="cols"><div class="card"><h2>سجل الإنذارات</h2>${table([{h:'التاريخ', f:w => fmtDT(w.at)}, {h:'الموظف', f:w => esc(w.name)}, {h:'السبب', f:w => esc(w.text), c:'wrap'}, {h:'من', f:w => esc(w.by_name || '')}], warns, 'ما في إنذارات')}</div>
     <div class="card"><h2>كيف بيشتغل التنبيه</h2><ol class="todo">
      <li>${pill('1', 'info')}<span>رسالة بدون رد <b>${rule('sla', 5)} دقائق</b>: تنبيه أصفر بغرفة التحكم.</span></li>
      <li>${pill('2', 'warn')}<span>الموظف سكّر النظام أو قلب لتطبيق ثاني، أو ما في نشاط <b>${rule('idle', 10)} دقائق</b> وهو بالدوام: تنبيه أحمر "ترك الصفحة" مع صوت.</span></li>
      <li>${pill('3', 'bad')}<span>رسالة وصلت <b>${rule('escalate', 15)} دقيقة</b> بدون رد: تصعيد للإدارة، وبتقدر تحوّل المحادثات بضغطة.</span></li>
      <li>${pill('4', 'bad')}<span>أي رد انبعت من Business Suite أو الجوال بدل النظام: تنبيه "رد من برا النظام".</span></li>
      <li>${pill('5', 'brand')}<span>كل هاد بيدخل بالتقييم اليومي، والحدود بتتعدل من الإعدادات.</span></li></ol></div></div>`;
};
A.teamDays = k => { ui.teamDays = +k; K.render(); };

/* ================= المهام ================= */
const PRIO = ['عاجلة','عالية','عادية','منخفضة'], PRIO_CLS = {'عاجلة': 'bad', 'عالية': 'warn', 'عادية': 'info', 'منخفضة': ''};
const TSTAT = ['جديدة','قيد العمل','بانتظار مراجعة','منتهية'];
function taskCard(t, mine) {
  const late = t.due && t.due < today() && t.status !== 'منتهية';
  return `<div class="tcard ${late ? 'late' : ''}"><div class="row" style="justify-content:space-between"><b>${esc(t.title)}</b>${pill(t.priority, PRIO_CLS[t.priority])}</div>
    ${t.details ? `<p class="m tdet">${esc(t.details)}</p>` : ''}
    <small class="m">${mine ? '' : esc(t.assignee_name || 'بدون') + ' · '}${t.client_name ? esc(t.client_name) + ' · ' : ''}${t.department ? esc(t.department) + ' · ' : ''}${t.due ? (late ? '<b class="neg">متأخرة: ' + t.due + '</b>' : 'لـ ' + t.due) : 'بدون موعد'}${t.ai ? ' · ' + pill('AI', 'brand') : ''}</small>
    <div class="row">${sel('ts_' + t.id, TSTAT.map(s => [s, s]), t.status, null, `data-chg="taskStatus" data-id="${t.id}" aria-label="الحالة"`)}${!mine ? `<button class="btn sm" data-act="taskForm" data-id="${t.id}">تعديل</button><button class="btn sm ghost" data-act="taskDel" data-id="${t.id}">حذف</button>` : ''}</div></div>`;
}
V.tasks = async () => {
  await people();
  const f = ui.tfilter || {}, o = {order: ['created_at', false], limit: 400};
  o.eq = {}; if (f.assignee) o.eq.assignee = f.assignee; if (f.dep) o.eq.department_id = f.dep;
  const [list, deps] = await Promise.all([db.q('v_tasks', o), db.q('departments', {order: ['name', true]})]);
  ST.deps = deps; ui.tasksCache = list;
  const vis = list.filter(t => t.status !== 'منتهية' || (t.done_at && minsAgo(t.done_at) < 60 * 24 * 7));
  return head('المهام', 'وزّع الشغل على الفريق وتابع شو خلص وشو متأخر. الموظف بيشوف مهامه من "مهامي"', '<button class="btn" data-act="go" data-id="ai">اقتراح مهام بالذكاء الاصطناعي</button><button class="btn pri" data-act="taskForm">+ مهمة</button>') +
    `<div class="row">${sel('tf_a', (ST.people || []).map(p => [p.id, p.name]), f.assignee, 'كل الموظفين', 'data-chg="tfAssignee" aria-label="الموظف"')}${sel('tf_d', deps.map(d => [d.id, d.name]), f.dep, 'كل الأقسام', 'data-chg="tfDep" aria-label="القسم"')}</div>
    <div class="kpis">${kpi('مفتوحة', list.filter(t => t.status !== 'منتهية').length)}${kpi('متأخرة', list.filter(t => t.due && t.due < today() && t.status !== 'منتهية').length, '', list.some(t => t.due && t.due < today() && t.status !== 'منتهية') ? 'red' : '')}${kpi('بانتظار مراجعة', list.filter(t => t.status === 'بانتظار مراجعة').length)}${kpi('خلصت هالأسبوع', list.filter(t => t.status === 'منتهية' && t.done_at && minsAgo(t.done_at) < 60 * 24 * 7).length)}</div>
    <div class="board">${TSTAT.map(s => `<div class="col"><h3>${s} <small class="m">${vis.filter(t => t.status === s).length}</small></h3>${vis.filter(t => t.status === s).map(t => taskCard(t)).join('') || '<p class="m empty">—</p>'}</div>`).join('')}</div>`;
};
document.addEventListener('change', e => { const t = e.target; if (t.dataset?.chg === 'tfAssignee' || t.dataset?.chg === 'tfDep') { ui.tfilter = {...(ui.tfilter || {}), [t.dataset.chg === 'tfAssignee' ? 'assignee' : 'dep']: t.value}; K.render(); } });
V.mytasks = async () => {
  const u = me();
  const [list, delivs] = await Promise.all([db.q('v_tasks', {eq: {assignee: u.id}, order: ['due', true], limit: 200}), db.q('v_deliverables', {eq: {assignee: u.id}, in: {status: ['قيد العمل','بانتظار موافقة العميل']}, order: ['due', true], limit: 100})]);
  const open = list.filter(t => t.status !== 'منتهية');
  return head('مهامي', 'غيّر حالة المهمة لما تبلّش فيها ولما تخلص. المهمة اللي بتخلّصها بتروح للمراجعة', '<button class="btn pri" data-act="selfTask">+ مهمة لنفسي</button>') +
    `<div class="kpis">${kpi('مفتوحة', open.length)}${kpi('متأخرة', open.filter(t => t.due && t.due < today()).length, '', open.some(t => t.due && t.due < today()) ? 'red' : '')}${kpi('تسليمات للعملاء', delivs.length)}</div>
    <div class="tgrid">${open.map(t => taskCard(t, true)).join('') || '<p class="note">ما عندك مهام مفتوحة.</p>'}</div>
    ${delivs.length ? `<div class="card"><h2>تسليماتي لعملاء الوكالة</h2>${table([{h:'العميل', f:x => esc(x.client_name)}, {h:'النوع', f:x => pill(x.type)}, {h:'العنوان', f:x => esc(x.title), c:'wrap'}, {h:'الموعد', f:x => x.due || '—'}, {h:'الحالة', f:x => pill(x.status, x.status === 'قيد العمل' ? 'warn' : 'info')}, {h:'الرابط', f:x => x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">فتح</a>` : '—'}], delivs)}</div>` : ''}
    ${list.filter(t => t.status === 'منتهية').length ? `<div class="card"><h2>خلصت</h2>${table([{h:'المهمة', f:t => esc(t.title), c:'wrap'}, {h:'خلصت', f:t => fmtDT(t.done_at)}], list.filter(t => t.status === 'منتهية').slice(0, 20))}</div>` : ''}`;
};
async function taskFields(t) {
  await people(); const deps = ST.deps || await db.q('departments', {order: ['name', true]});
  const clients = can('agency') ? await db.q('agency_clients', {eq: {status: 'نشط'}, select: 'id,name', order: ['name', true]}) : [];
  return [{k:'title', l:'المهمة', req: 1, wide: 1}, {k:'details', l:'التفاصيل', t:'textarea'}, {k:'assignee', l:'الموظف', t:'select', opts: [['', '—'], ...(ST.people || []).map(p => [p.id, p.name])]},
    {k:'department_id', l:'القسم', t:'select', opts: [['', '—'], ...deps.map(d => [d.id, d.name])]}, ...(clients.length ? [{k:'client_id', l:'عميل الوكالة', t:'select', opts: [['', '—'], ...clients.map(c => [c.id, c.name])]}] : []),
    {k:'due', l:'الموعد', t:'date'}, {k:'priority', l:'الأولوية', t:'select', opts: PRIO, def: 'عادية'}];
}
Object.assign(A, {
  taskForm: async id => {
    const t = id ? (ui.tasksCache || []).find(x => x.id === id) : null;
    openForm(t ? 'تعديل مهمة' : 'مهمة جديدة', await taskFields(t), t || {priority: 'عادية'}, async v => {
      const row = {title: v.title, details: v.details || null, assignee: v.assignee || null, department_id: v.department_id || null, client_id: v.client_id || null, due: v.due || null, priority: v.priority};
      if (t) await db.upd('tasks', {id}, row); else await db.ins('tasks', {...row, created_by_name: me().name});
      toast('انحفظت المهمة'); refreshBadges(); K.render();
    });
  },
  selfTask: () => openForm('مهمة لنفسي', [{k:'title', l:'المهمة', req: 1, wide: 1}, {k:'details', l:'التفاصيل', t:'textarea'}, {k:'due', l:'الموعد', t:'date'}, {k:'priority', l:'الأولوية', t:'select', opts: PRIO, def: 'عادية'}], null,
    async v => { await db.ins('tasks', {title: v.title, details: v.details || null, due: v.due || null, priority: v.priority, assignee: me().id, created_by_name: me().name}); toast('انضافت'); refreshBadges(); K.render(); }),
  taskDel: async (id, b) => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } await db.del('tasks', {id}); toast('انحذفت'); K.render(); }
});

/* ================= الحسابات الإعلانية ================= */
function adCalc(r) {
  const g = {...r}; ['spend','impressions','clicks','reach','messages','orders','delivered','returned','pending','revenue','pending_rev','margin_del','margin_pend','ret_cost'].forEach(k => g[k] = N(r[k]));
  g.cpm = g.impressions ? g.spend / g.impressions * 1000 : 0; g.ctr = g.impressions ? g.clicks / g.impressions : 0; g.freq = g.reach ? g.impressions / g.reach : 0;
  g.cpMsg = g.messages ? g.spend / g.messages : 0; g.cv = g.messages ? g.orders / g.messages : 0; g.roas = g.spend ? g.revenue / g.spend : 0;
  g.roasExp = g.spend ? (g.revenue + g.pending_rev * .8) / g.spend : 0; g.cpa = g.orders ? g.spend / g.orders : 0;
  g.profit = g.margin_del + g.margin_pend * .8 - g.spend - g.ret_cost; return g;
}
function diagnose(g) {
  const d = [];
  if (!g.spend) return [{l: '', k: 'بدون صرف', t: 'ما في صرف بهالفترة'}];
  if (g.impressions && g.cpm > rule('cpm_max', 3)) d.push({l: 'bad', k: 'CPM عالي', t: `الظهور غالي (${fmt(g.cpm)} د.أ لكل 1000 ظهور): الجمهور ضيق أو المنافسة عالية. وسّع الجمهور أو جرّب جمهور مفتوح.`});
  if (g.impressions && g.ctr < .008) d.push({l: 'bad', k: 'CTR ضعيف', t: `الناس بتشوف الإعلان وما بتضغط (${pct(g.ctr)}): الكريتف ما بيوقف السكرول. غيّر أول 3 ثواني والهوك.`});
  if (g.reach && g.freq > rule('freq_max', 3.5)) d.push({l: 'warn', k: 'تكرار عالي', t: `نفس الناس شافت الإعلان ${g.freq.toFixed(1)} مرات: الجمهور ملّ، جدّد الكريتف.`});
  if (g.messages >= 10 && g.cv < .1) d.push({l: 'bad', k: 'مشكلة بيع', t: `الرسائل بتيجي (${g.messages}) بس ${pct(g.cv)} بس صاروا طلبات: المشكلة مش بالإعلان. راجع ردود الموظفين والسعر والعرض.`});
  if (g.orders >= 5 && g.returned / Math.max(1, g.delivered + g.returned) > .2) d.push({l: 'warn', k: 'مرتجع عالي', t: `نسبة المرتجع من هالإعلان عالية: الإعلان بيوعد بإشي غير المنتج، أو الزبائن مش جديين. أكّد الطلبات قبل الشحن.`});
  if (g.roasExp >= 4 && !d.some(x => x.l === 'bad')) d.unshift({l: 'good', k: 'رابح', t: 'الإعلان رابح: كبّر الميزانية 20% كل 3 أيام وراقب التكلفة.'});
  else if (g.roasExp < rule('roas_min', 2.5) && !d.length) d.push({l: 'warn', k: 'عائد ضعيف', t: 'العائد أقل من الحد بدون سبب واضح بالأرقام: راجع السعر والعرض وهامش المنتج.'});
  if (!d.length) d.push({l: 'brand', k: 'مستقر', t: 'الأرقام طبيعية، كمّل وراقب.'});
  return d;
}
V.ads = async () => {
  const d = ui.adDays || 7, from = addDays(today(), -(d - 1));
  const [rows, accs, lastAd] = await Promise.all([db.rpc('ad_perf', {d_from: from, d_to: today()}), db.q('ad_accounts', {order: ['name', true]}), db.q('ads', {order: ['updated_at', false], limit: 1, select: 'updated_at'})]);
  const ads = (rows || []).map(adCalc).filter(g => g.spend || g.orders).sort((a, b) => b.spend - a.spend);
  const T = {}; ['spend','messages','orders','delivered','returned','revenue','pending_rev','profit','impressions','clicks'].forEach(k => T[k] = sum(ads, g => g[k]));
  const roas = T.spend ? T.revenue / T.spend : 0, roasE = T.spend ? (T.revenue + T.pending_rev * .8) / T.spend : 0;
  const byP = {}; ads.forEach(g => { const k = g.product_id || 'none'; const x = byP[k] = byP[k] || {name: g.product_name || 'بدون منتج', product_id: g.product_id, spend: 0, messages: 0, orders: 0, delivered: 0, returned: 0, revenue: 0, pending_rev: 0, profit: 0}; ['spend','messages','orders','delivered','returned','revenue','pending_rev','profit'].forEach(f => x[f] += g[f]); });
  const prods = Object.values(byP).map(x => ({...x, roasE: x.spend ? (x.revenue + x.pending_rev * .8) / x.spend : 0, cpa: x.orders ? x.spend / x.orders : 0, margin: x.product_id ? N(P(x.product_id)?.price) - N(P(x.product_id)?.cost) : 0})).sort((a, b) => b.spend - a.spend);
  const rc = r => r >= 4 ? 'good' : r >= rule('roas_min', 2.5) ? 'warn' : 'bad';
  const dec = x => !x.spend ? pill('بدون إعلان') : x.roasE >= 4 ? pill('كبّر الميزانية', 'good') : x.roasE >= rule('roas_min', 2.5) ? pill('راقب', 'warn') : pill('وقّف أو غيّر العرض', 'bad');
  const pOpts = ST.products.filter(p => p.active).map(p => [p.id, p.name]);
  return head('الحسابات الإعلانية', 'العائد محسوب على الطلبات اللي فعلاً انطلبت وانسلّمت، مش على الرسائل. كل إعلان لازم ينربط بمنتج',
      periodChips(d, 'adDays') + '<button class="btn" data-act="adManual">+ صرف يدوي</button><button class="btn pri" data-act="adSync">مزامنة من Meta</button>') +
    `<div class="row">${accs.map(a => pill(a.name || a.account_id, a.active ? 'good' : '')).join('')}<button class="btn sm" data-act="adAccForm">+ حساب إعلاني</button><small class="m">آخر تحديث: ${lastAd[0] ? fmtDT(lastAd[0].updated_at) : 'ما في'}</small></div>
    <div class="kpis">${kpi('صرف الإعلانات', jd(T.spend), '', 'hl')}${kpi('رسائل', fmt(T.messages), 'تكلفة الرسالة ' + jd(T.messages ? T.spend / T.messages : 0))}${kpi('طلبات من الإعلانات', T.orders, 'تحويل ' + pct(T.messages ? T.orders / T.messages : 0))}
     ${kpi('ROAS مسلّم', roas.toFixed(2) + 'x', 'على اللي انسلّم بس')}${kpi('ROAS متوقع', roasE.toFixed(2) + 'x', 'مسلّم + 80% من اللي بالطريق')}${kpi('ربح بعد الإعلان', jd(T.profit), '', T.profit < 0 ? 'red' : '')}</div>
    <div class="card"><h2>المنتجات: كم باع كل منتج وكم رجّع إعلانه</h2>${table([{h:'المنتج', f:x => esc(x.name)}, {h:'صرف', f:x => jd(x.spend)}, {h:'رسائل', f:x => x.messages}, {h:'طلبات', f:x => x.orders}, {h:'انسلّم / رجع', f:x => x.delivered + ' / ' + x.returned}, {h:'تكلفة الطلب', f:x => x.cpa ? jd(x.cpa) : '—'}, {h:'ربح القطعة', f:x => x.product_id ? jd(x.margin) : '—'},
      {h:'ROAS متوقع', f:x => x.spend ? pill(x.roasE.toFixed(2) + 'x', rc(x.roasE)) : '—'}, {h:'ربح بعد الإعلان', f:x => `<b class="${x.profit < 0 ? 'neg' : 'pos'}">${jd(x.profit)}</b>`}, {h:'القرار', f:x => dec(x)}], prods, 'ما في صرف ولا طلبات من إعلانات بهالفترة')}
     <p class="note" style="margin-top:10px">قاعدة سريعة: إذا تكلفة الطلب أعلى من ربح القطعة، الإعلان خسران حتى لو الرسائل كثيرة.</p></div>
    <div class="card"><h2>الإعلانات: ليش هالإعلان غالي؟</h2>${table([{h:'الإعلان', f:g => `<b>${esc(g.name)}</b><br><small class="m">${esc(g.campaign || '')}</small>`}, {h:'المنتج', f:g => sel('adp_' + g.ad_id.replace(/[^a-z0-9]/gi, ''), pOpts, g.product_id, '— اربط بمنتج —', `data-chg="adProduct" data-id="${esc(g.ad_id)}" aria-label="المنتج" ${can('ads', 'edit') ? '' : 'disabled'}`)},
      {h:'صرف', f:g => jd(g.spend)}, {h:'CPM', f:g => g.impressions ? `<span class="${g.cpm > rule('cpm_max', 3) ? 'neg' : ''}">${fmt(g.cpm)}</span>` : '—'}, {h:'CTR', f:g => g.impressions ? `<span class="${g.ctr < .008 ? 'neg' : ''}">${pct(g.ctr)}</span>` : '—'}, {h:'تكرار', f:g => g.reach ? `<span class="${g.freq > rule('freq_max', 3.5) ? 'neg' : ''}">${g.freq.toFixed(1)}</span>` : '—'},
      {h:'رسائل', f:g => g.messages}, {h:'تكلفة الرسالة', f:g => g.messages ? jd(g.cpMsg) : '—'}, {h:'طلبات', f:g => g.orders}, {h:'تحويل', f:g => g.messages ? `<span class="${g.cv < .1 ? 'neg' : ''}">${pct(g.cv)}</span>` : '—'},
      {h:'ROAS', f:g => pill(g.roasExp.toFixed(2) + 'x', rc(g.roasExp))}, {h:'التشخيص', f:g => diagnose(g).map(x => `<div style="margin-bottom:4px">${pill(x.k, x.l)} ${esc(x.t)}</div>`).join(''), c:'wrap'}], ads, 'ما في إعلانات لسا. اربط حساب Meta أو أضف صرف يدوي')}</div>`;
};
Object.assign(A, {
  adDays: k => { ui.adDays = +k; K.render(); },
  adSync: async () => { toast('جاري المزامنة…'); const r = await db.fn('meta-ads-sync', {days: Math.max(3, ui.adDays || 7)}); toast(`تمت المزامنة: ${N(r?.rows)} سطر`); loadAdsList(); K.render(); },
  adAccForm: () => openForm('حساب إعلاني', [{k:'account_id', l:'رقم الحساب (act_123...)', req: 1}, {k:'name', l:'الاسم'}], null,
    async v => { const id = v.account_id.startsWith('act_') ? v.account_id : 'act_' + v.account_id.replace(/\D/g, ''); await db.ins('ad_accounts', {account_id: id, name: v.name || id}); toast('انضاف الحساب'); K.render(); }),
  adManual: () => openForm('صرف إعلان يدوي', [{k:'name', l:'اسم الإعلان أو الحملة', req: 1, wide: 1}, {k:'pid', l:'المنتج', t:'select', opts: [['', '—'], ...ST.products.filter(p => p.active).map(p => [p.id, p.name])]}, {k:'d', l:'التاريخ', t:'date', def: today()}, {k:'amount', l:'المصروف (د.أ)', t:'number'}, {k:'msgs', l:'رسائل', t:'number', def: 0}, {k:'platform', l:'المنصة', t:'select', opts: ['فيسبوك وإنستغرام','تيك توك','سناب شات','جوجل','يدوي']}], null,
    async v => { if (!(N(v.amount) > 0)) return 'اكتب المصروف'; await db.rpc('manual_ad_spend', {ad_name: v.name, pid: v.pid || null, d: v.d || today(), amount: N(v.amount), msgs: Math.round(N(v.msgs)), platform: v.platform}); toast('انسجل الصرف'); loadAdsList(); K.render(); })
});

/* ================= صفحات الهبوط ================= */
const siteBase = () => location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
const landUrl = p => siteBase() + 'p.html?s=' + encodeURIComponent(p.slug);
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
V.landing = async () => {
  const d30 = addDays(today(), -29);
  const [ps, lo] = await Promise.all([db.q('products', {eq: {active: true}, order: ['name', true]}), db.q('v_orders', {eq: {landing: true}, gte: {day: d30}, select: 'id,status,value,items_txt'})]);
  const stat = p => { const os = lo.filter(o => (o.items_txt || '').startsWith(p.name)); return {n: os.length, del: os.filter(o => ['تم التوصيل','مكتمل مسلم'].includes(o.status)).length, val: sum(os.filter(o => !(o.status === 'ملغي')), o => o.value)}; };
  return head('صفحات الهبوط', 'لكل منتج صفحة بيع خاصة فيه. الزبون بيطلب من الصفحة والطلب بينزل لحاله بالطلبات، ومربوط بالإعلان إذا حطيت رقمه بالرابط') +
    `<p class="note">بإعلانات Meta حط الرابط وزيد عليه <b>&amp;ad={{ad.id}}</b> بخانة URL parameters، هيك كل طلب بينربط بالإعلان اللي جابه.</p>` +
    table([{h:'المنتج', f:p => `<b>${esc(p.name)}</b><br><small class="m">${p.slug ? esc(p.slug) : 'ما إلها رابط'}</small>`}, {h:'الحالة', f:p => p.landing_on && p.slug ? pill('منشورة', 'good') : pill('مطفية')},
      {h:'العنوان', f:p => esc(p.landing?.headline || p.name), c:'wrap'}, {h:'طلبات 30 يوم', f:p => stat(p).n}, {h:'انسلّم', f:p => stat(p).del}, {h:'قيمتها', f:p => jd(stat(p).val)},
      {h:'', f:p => `<div class="row" style="flex-wrap:nowrap"><button class="btn sm pri" data-act="landingForm" data-id="${p.id}">تعديل الصفحة</button>${p.slug ? `<button class="btn sm" data-act="landingCopy" data-id="${p.id}">انسخ الرابط</button><a class="btn sm" href="${esc(landUrl(p))}" target="_blank" rel="noopener">افتح</a>` : ''}<button class="btn sm ghost" data-act="landingToggle" data-id="${p.id}">${p.landing_on ? 'إطفاء' : 'تشغيل'}</button></div>`}], ps, 'أضف منتجات أول');
};
Object.assign(A, {
  landingForm: id => {
    const p = P(id); const L = p.landing || {};
    openForm('صفحة الهبوط: ' + p.name, [{k:'slug', l:'رابط الصفحة (أحرف إنجليزي وأرقام)', req: 1, ph: 'vacuum-cleaner'}, {k:'old_price', l:'السعر قبل الخصم (اختياري)', t:'number'},
      {k:'headline', l:'العنوان الرئيسي', wide: 1}, {k:'sub', l:'سطر تحت العنوان', wide: 1}, {k:'features', l:'المميزات (كل ميزة بسطر)', t:'textarea'},
      {k:'cta', l:'نص زر الطلب', def: 'اطلب الآن والدفع عند الاستلام'}, {k:'badge', l:'شريط تحت السعر', def: 'توصيل لكل المملكة · الدفع عند الاستلام'}, {k:'on', l:'الحالة', t:'select', opts: [['true','منشورة'], ['false','مطفية']]}],
      {slug: p.slug || slugify(p.sku || '') || '', old_price: L.old_price ?? null, headline: L.headline || p.name, sub: L.sub || '', features: (L.features || []).join('\n'), cta: L.cta, badge: L.badge, on: String(p.landing_on || !p.slug)},
      async v => {
        const slug = slugify(v.slug); if (!slug) return 'اكتب رابط بالإنجليزي، مثلاً vacuum';
        try { await db.upd('products', {id}, {slug, landing_on: v.on === 'true', landing: {headline: v.headline, sub: v.sub, old_price: v.old_price, features: v.features.split('\n').map(x => x.trim()).filter(Boolean), cta: v.cta, badge: v.badge}}); }
        catch (x) { if (/duplicate|unique/i.test(x.message)) return 'هالرابط مستخدم لمنتج ثاني، اختار غيره'; throw x; }
        ST.products = await db.q('products', {order: ['name', true]}); toast('انحفظت الصفحة'); K.render();
      });
  },
  landingCopy: id => copyText(landUrl(P(id))),
  landingToggle: async id => { const p = P(id); if (!p.slug) { A.landingForm(id); return; } await db.upd('products', {id}, {landing_on: !p.landing_on}); ST.products = await db.q('products', {order: ['name', true]}); K.render(); }
});

/* ================= تقوية الصفحة ================= */
const fuMsg = f => f.reason === 'غالي عليه' ? `مرحبا ${f.customer || ''}، عملنالك عرض خاص على ${f.product_name || 'المنتج'}: قطعتين بسعر مميز أو توصيل مجاني لأول طلب. بتحب أحجزلك؟`
  : `مرحبا ${f.customer || ''}، العرض على ${f.product_name || 'المنتج'} لسا شغال لنهاية اليوم${f.product_price ? ' بسعر ' + fmt(f.product_price) + ' دينار' : ''} والتوصيل لباب البيت. بتحب نثبتلك قطعة؟`;
const POST_TYPES = ['ريلز','صورة','كاروسيل','ستوري','لايف','عرض'];
V.page = async () => {
  const from7 = addDays(today(), -6);
  const [ts, posts, fus, rev, qr] = await Promise.all([
    can('team') ? db.rpc('team_stats', {d_from: from7, d_to: today()}) : [], db.q('posts', {gte: {day: from7}, lte: {day: addDays(today(), 7)}, isNull: ['client_id'], order: ['day', true]}),
    db.q('v_followups', {order: ['created_at', false], limit: 60}), db.q('v_orders', {eq: {status: 'مكتمل مسلم', review_asked: false}, gte: {day: from7}, select: 'id,no,customer,phone,items_txt', limit: 30}),
    db.q('quick_replies', {order: ['created_at', true]})]);
  const convs = sum(ts || [], r => r.convs), missed = sum(ts || [], r => r.missed), avg = convs ? sum(ts || [], r => N(r.avg_first_min) * N(r.replied)) / Math.max(1, sum(ts || [], r => r.replied)) : 0;
  const respRate = convs ? 1 - missed / convs : 1, nPosts = posts.filter(p => p.day >= from7 && p.day <= today() && p.status === 'منشور').length + posts.filter(p => p.day > today() && p.day <= addDays(today(), 6)).length;
  const pend = fus.filter(f => f.status === 'بانتظار'), fuDone = fus.length ? 1 - pend.length / fus.length : 1;
  const sc = {resp: clamp((respRate - .8) / .2, 0, 1) * 30, speed: clamp(1 - (avg - 2) / 13, 0, 1) * 25, posts: clamp(nPosts / rule('posts_week', 5), 0, 1) * 20, follow: fuDone * 15, rev: rev.length ? 5 : 10};
  const total = Math.round(sum(Object.values(sc), x => x)), col = total >= 75 ? 'var(--good)' : total >= 55 ? 'var(--accent)' : 'var(--bad)';
  const todo = [];
  if (avg > rule('sla', 5)) todo.push(['bad', `متوسط أول رد ${avg.toFixed(1)} دقيقة. فيسبوك بيعطي أولوية للصفحات اللي بترد بسرعة، والزبون اللي بيستنى بيروح لغيرك.`]);
  if (respRate < .97) todo.push(['bad', `${pct(1 - respRate)} من الرسائل ضاعت بدون رد آخر 7 أيام. كل رسالة ضايعة هي إعلان دفعت حقه.`]);
  if (nPosts < rule('posts_week', 5)) todo.push(['warn', `منشور ومخطط ${nPosts} من ${rule('posts_week', 5)} منشورات هالأسبوع. الصفحة الساكتة بيغلى إعلانها.`]);
  if (pend.length) todo.push(['warn', `${pend.length} زبون سأل وما طلب. رسالة متابعة وحدة بترجّع جزء منهم بدون صرف إعلان.`]);
  if (rev.length) todo.push(['info', `${rev.length} زبون استلم آخر 7 أيام وما انطلب منه تقييم. التقييمات بتقوّي الثقة وبترخّص الإعلان.`]);
  if (!todo.length) todo.push(['good', 'الصفحة بوضع ممتاز، كمّل على نفس الوتيرة.']);
  const week = [...Array(7)].map((_, i) => addDays(today(), i));
  return head('تقوية الصفحة', 'قوة الصفحة بتعتمد على سرعة الرد، والانتظام بالنشر، ومتابعة الزبائن، والتقييمات') +
    `<div class="cols"><div class="card"><div class="row" style="gap:20px;align-items:center"><div class="ring" style="--v:${total};--rc:${col}"><div>${total}<small>من 100</small></div></div>
      <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px"><h2>مؤشر قوة الصفحة</h2>
       <div class="kv"><span>نسبة الرد على الرسائل</span><b>${pct(respRate)}</b></div><div class="kv"><span>متوسط أول رد</span><b>${avg.toFixed(1)} د</b></div>
       <div class="kv"><span>منشورات الأسبوع</span><b>${nPosts} / ${rule('posts_week', 5)}</b></div><div class="kv"><span>متابعات بانتظار</span><b>${pend.length}</b></div><div class="kv"><span>تقييمات ما انطلبت</span><b>${rev.length}</b></div></div></div></div>
     <div class="card"><h2>شو لازم تعمل هالأسبوع</h2><ul class="todo">${todo.map(([l, t]) => `<li>${pill(l === 'bad' ? 'مهم' : l === 'warn' ? 'قريباً' : l === 'good' ? 'تمام' : 'فرصة', l)}<span>${esc(t)}</span></li>`).join('')}</ul></div></div>
    <div class="card"><h2>زبائن سألوا وما طلبوا</h2>${table([{h:'التاريخ', f:f => fmtDT(f.created_at)}, {h:'الزبون', f:f => esc(f.customer || '')}, {h:'المنتج', f:f => esc(f.product_name || '—')}, {h:'السبب', f:f => pill(f.reason, 'warn')}, {h:'رسالة مقترحة', f:f => esc(fuMsg(f)), c:'wrap'},
      {h:'', f:f => f.status === 'انبعتت' ? pill('انبعتت', 'good') : `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="fuCopy" data-id="${f.id}">انسخ</button>${f.conv_id ? `<button class="btn sm" data-act="openConv" data-id="${f.conv_id}">المحادثة</button>` : ''}<button class="btn sm pri" data-act="fuDone" data-id="${f.id}">انبعتت</button></div>`}],
      fus.sort((a, b) => (a.status === 'انبعتت') - (b.status === 'انبعتت')), 'لما محادثة تنسكّر بسبب "سأل عن السعر" أو "غالي" أو "بدو يفكر"، الزبون بينضاف هون لحاله')}</div>
    <div class="card"><div class="head" style="margin-bottom:12px"><h2>تقويم المحتوى لصفحتنا</h2><button class="btn sm pri" data-act="postForm">+ منشور</button></div>
     <div class="calw"><div class="cal">${week.map(d => `<div class="day ${d === today() ? 'today' : ''}"><b>${K.dayName(d)} ${+d.slice(8)}/${+d.slice(5, 7)}</b>${posts.filter(p => p.day === d).map(p => `<button class="post ${p.status === 'منشور' ? 'done' : ''}" data-act="postToggle" data-id="${p.id}" title="اضغط لتغيير الحالة"><b>${esc(p.type)}</b><span>${esc(p.title)}</span><small class="m">${esc(p.status)}</small></button>`).join('')}</div>`).join('')}</div></div></div>
    <div class="cols"><div class="card"><div class="head" style="margin-bottom:12px"><h2>الردود الجاهزة</h2><button class="btn sm pri" data-act="qrForm">+ رد</button></div>${table([{h:'العنوان', f:q => `<b>${esc(q.title)}</b>`}, {h:'النص', f:q => esc(q.text), c:'wrap'}, {h:'', f:q => `<button class="btn sm" data-act="qrForm" data-id="${q.id}">تعديل</button> <button class="btn sm ghost" data-act="qrDel" data-id="${q.id}">حذف</button>`}], qr)}<p class="note" style="margin-top:8px">{المنتج} و {السعر} بيتعبوا لحالهم حسب المحادثة.</p></div>
     <div class="card"><h2>اطلب تقييم من اللي استلموا</h2>${table([{h:'الطلب', f:o => '#' + o.no}, {h:'الزبون', f:o => esc(o.customer) + `<br><small class="m">${esc(o.phone)}</small>`}, {h:'المنتج', f:o => esc(o.items_txt || ''), c:'wrap'}, {h:'', f:o => `<button class="btn sm" data-act="askReview" data-id="${o.id}">انسخ الرسالة</button>`}], rev, 'ما في حدا')}</div></div>`;
};
Object.assign(A, {
  fuCopy: async id => { const [f] = await db.q('v_followups', {eq: {id: +id}}); copyText(fuMsg(f)); },
  fuDone: async id => { await db.rpc('followup_done', {fid: +id}); K.render(); },
  askReview: async id => { await db.rpc('mark_review_asked', {oid: id}); copyText('شكراً لثقتك فينا 🌷 إذا عجبك المنتج بتفرق معنا كتير صورة أو تقييم على الصفحة.'); K.render(); },
  postForm: () => openForm('منشور جديد', [{k:'day', l:'التاريخ', t:'date', def: today()}, {k:'type', l:'النوع', t:'select', opts: POST_TYPES}, {k:'title', l:'الفكرة', req: 1, wide: 1}], null,
    async v => { await db.ins('posts', {day: v.day, type: v.type, title: v.title}); toast('انضاف للتقويم'); K.render(); }),
  postToggle: async id => { const [p] = await db.q('posts', {eq: {id}}); await db.upd('posts', {id}, {status: p.status === 'منشور' ? 'مخطط' : 'منشور'}); K.render(); },
  qrForm: async id => { const q = id ? (await db.q('quick_replies', {eq: {id}}))[0] : null;
    openForm(q ? 'تعديل رد جاهز' : 'رد جاهز جديد', [{k:'title', l:'العنوان', req: 1, wide: 1}, {k:'text', l:'النص', t:'textarea'}], q, async v => { if (!v.text) return 'اكتب النص'; if (q) await db.upd('quick_replies', {id}, v); else await db.ins('quick_replies', v); toast('انحفظ'); K.render(); }); },
  qrDel: async (id, b) => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } await db.del('quick_replies', {id}); K.render(); }
});

/* ================= المحاسبة ================= */
V.accounting = async () => {
  const m = ui.month || monthOf(today());
  const x = await db.rpc('month_pnl', {m});
  const L = (l, v, c = '') => `<tr class="${c}"><td>${l}</td><td class="${N(v) < 0 ? 'neg' : ''}">${jd(v)}</td></tr>`, sec = t => `<tr class="sec"><td colspan="2">${t}</td></tr>`;
  const exp = Object.entries(x.expenses || {});
  return head('المحاسبة', 'أرباح وخسائر الشهر: المتجر لحال والوكالة لحال، وبعدين الصافي. المبيعات محسوبة من الجولات المسكّرة',
      `<label class="row" style="font-size:13px;color:var(--muted)" for="mpick">الشهر <input id="mpick" type="month" value="${m}" data-chg="month" class="inl"></label>`) +
    `<div class="kpis">${kpi('صافي الربح', jd(x.net), '', 'hl')}${kpi('ربح المتجر', jd(x.store_net))}${kpi('ربح الوكالة', jd(x.agency_net))}${kpi('ROAS الشهر', x.roas != null ? x.roas + 'x' : '—', 'صرف ' + jd(x.ads))}${kpi('نسبة المرتجع', pct(x.return_rate), x.returned + ' راجع من ' + (N(x.delivered) + N(x.returned)))}</div>
    <div class="cols"><div class="tw"><table class="pl">${sec('المتجر الأونلاين')}
      ${L('مبيعات الطلبات المسلّمة (' + x.delivered + ' طلب)', x.sales)}${L('رسوم توصيل محصّلة (ومرفوض برسوم)', x.fees)}${L('تكلفة البضاعة المسلّمة', -x.cogs)}${L('أجور التوصيل', -x.delivery)}
      ${L('مجمل الربح', x.gross, 'tot')}${L('الإعلانات', -x.ads)}${L('رواتب فريق المتجر' + (N(x.prorate) < 1 ? ' (' + Math.round(N(x.prorate) * 100) + '% من الشهر)' : ''), -x.sal_store)}${L('عمولات الطلبات المسلّمة', -x.commissions)}${L('ربح المتجر', x.store_net, 'tot')}
      ${sec('وكالة التسويق')}${L('فواتير مدفوعة', x.agency_paid)}${L('رواتب فريق الوكالة', -x.sal_agency)}${L('ربح الوكالة', x.agency_net, 'tot')}
      ${sec('مصاريف عامة')}${exp.map(([k, v]) => L(esc(k), -v)).join('') || '<tr><td>ما في</td><td>—</td></tr>'}${N(x.adjust) ? L('مكافآت وخصومات الرواتب', -x.adjust) : ''}
      ${L('صافي الربح', x.net, 'tot')}</table></div>
     <div class="card"><h2>أرقام لازم تعرفها</h2>
      <div class="kv"><span>قيمة الطلبات اللي لسا بالمسار</span><b>${jd(x.pending_value)}</b></div><div class="kv"><span>فواتير وكالة غير مدفوعة</span><b>${jd(x.agency_due)}</b></div>
      <div class="kv"><span>قيمة المخزون بالتكلفة</span><b>${jd(x.stock_value)}</b></div><div class="kv"><span>ذمم على السائقين هالشهر</span><b>${jd(x.courier_diff)}</b></div>
      <div class="kv"><span>متوسط قيمة الطلب المسلّم</span><b>${jd(N(x.delivered) ? N(x.sales) / N(x.delivered) : 0)}</b></div>
      <p class="note" style="margin-top:12px">ميزانيات إعلانات عملاء الوكالة مش مصروف عليك لأنها من فلوس العميل. رواتب الموظفين بتنقسم على المتجر والوكالة حسب نوع القسم.</p></div></div>`;
};

/* ================= الموظفين والرواتب ================= */
V.staff = async () => {
  const tab = ui.staffTab || 'emp', m = ui.pmonth || monthOf(today());
  await people();
  const deps = await db.q('departments', {order: ['name', true]}); ST.deps = deps;
  let body = '';
  if (tab === 'emp') {
    const list = await db.q('v_employees', {order: ['name', true]}); ui.empCache = list;
    const act = list.filter(e => e.active);
    body = `<div class="kpis">${kpi('موظفين فعّالين', act.length)}${kpi('من البيت', act.filter(e => e.remote).length)}${kpi('رواتب المتجر', jd(sum(act.filter(e => e.dept_kind !== 'الوكالة'), e => e.salary)))}${kpi('رواتب الوكالة', jd(sum(act.filter(e => e.dept_kind === 'الوكالة'), e => e.salary)))}${kpi('إجمالي الرواتب', jd(sum(act, e => e.salary)), 'شهرياً', 'hl')}</div>` +
      table([{h:'الاسم', f:e => `<b>${esc(e.name)}</b><br><small class="m">${esc(e.job_title || '')}</small>`}, {h:'القسم', f:e => e.department ? pill(e.department, e.dept_kind === 'الوكالة' ? 'info' : 'brand') : '—'}, {h:'الدوام', f:e => e.shift_from ? e.shift_from.slice(0, 5) + '–' + (e.shift_to || '').slice(0, 5) + (e.remote ? ' ' + pill('من البيت', 'warn') : '') : (e.remote ? pill('من البيت', 'warn') : '—')},
        {h:'الراتب', f:e => jd(e.salary)}, {h:'عمولة/طلب مسلّم', f:e => N(e.commission) ? jd(e.commission) : '—'}, {h:'حساب الدخول', f:e => e.email ? esc(e.email) : '<small class="m">ما إله حساب</small>'}, {h:'الحالة', f:e => pill(e.active ? 'على رأس عمله' : 'موقوف', e.active ? 'good' : '')},
        {h:'', f:e => `<button class="btn sm" data-act="empForm" data-id="${e.id}">تعديل</button>`}], list, 'أضف أول موظف');
  }
  if (tab === 'pay') {
    const rows = await db.rpc('payroll', {m}) || [];
    body = `<div class="row">${`<label class="row" style="font-size:13px;color:var(--muted)" for="pmpick">الشهر <input id="pmpick" type="month" value="${m}" data-chg="pmonth" class="inl"></label>`}<button class="btn" data-act="payAdj">+ مكافأة / خصم</button></div>
      <div class="kpis">${kpi('الرواتب الأساسية', jd(sum(rows, r => r.salary)))}${kpi('العمولات', jd(sum(rows, r => r.commission)))}${kpi('مكافآت وخصومات', jd(sum(rows, r => r.adjust)))}${kpi('المستحق', jd(sum(rows, r => r.total)), sum(rows.filter(r => r.paid), () => 1) + ' انصرف', 'hl')}</div>` +
      table([{h:'الموظف', f:r => `<b>${esc(r.name)}</b><br><small class="m">${esc(r.department || '')}</small>`}, {h:'الراتب', f:r => jd(r.salary)}, {h:'طلبات مسلّمة', f:r => r.delivered}, {h:'العمولة', f:r => jd(r.commission)}, {h:'مكافأة/خصم', f:r => `<span class="${N(r.adjust) < 0 ? 'neg' : ''}">${jd(r.adjust)}</span>`}, {h:'المستحق', f:r => `<b>${jd(r.total)}</b>`},
        {h:'', f:r => r.paid ? pill('انصرف ' + jd(r.paid_amount), 'good') : `<button class="btn sm pri" data-act="paySalary" data-id="${r.employee_id}" data-amt="${N(r.total)}">صرف</button>`}], rows, 'ما في موظفين');
  }
  if (tab === 'dep') body = table([{h:'القسم', f:d => `<b>${esc(d.name)}</b>`}, {h:'تابع لـ', f:d => pill(d.kind, d.kind === 'الوكالة' ? 'info' : 'brand')}, {h:'', f:d => `<button class="btn sm" data-act="depForm" data-id="${d.id}">تعديل</button>`}], deps) + '<div class="row"><button class="btn pri" data-act="depForm">+ قسم</button></div>';
  return head('الموظفين والرواتب', 'الأقسام الداخلية، بيانات كل موظف ودوامه وراتبه وعمولته، وكشف الرواتب الشهري', tab === 'emp' ? '<button class="btn pri" data-act="empForm">+ موظف</button>' : '') +
    chips([['emp','الموظفين'], ['pay','كشف الرواتب'], ['dep','الأقسام']], tab, 'staffTab') + body;
};
Object.assign(A, {
  staffTab: k => { ui.staffTab = k; K.render(); },
  empForm: async id => {
    const e = id ? (ui.empCache || []).find(x => x.id === id) : null;
    const linked = new Set((ui.empCache || []).filter(x => x.user_id && x.id !== id).map(x => x.user_id));
    openForm(e ? 'تعديل ' + e.name : 'موظف جديد', [{k:'name', l:'الاسم', req: 1}, {k:'job_title', l:'الوظيفة'}, {k:'department_id', l:'القسم', t:'select', opts: [['', '—'], ...(ST.deps || []).map(d => [d.id, d.name])]},
      {k:'user_id', l:'حساب الدخول (للمراقبة والعمولة)', t:'select', opts: [['', 'بدون'], ...(ST.people || []).filter(p => !linked.has(p.id)).map(p => [p.id, p.name + ' · ' + p.email])]},
      {k:'phone', l:'الهاتف'}, {k:'salary', l:'الراتب الشهري (د.أ)', t:'number', def: 0}, {k:'commission', l:'عمولة على كل طلب مسلّم (د.أ)', t:'number', def: 0},
      {k:'shift_from', l:'بداية الدوام', t:'time'}, {k:'shift_to', l:'نهاية الدوام', t:'time'}, {k:'remote', l:'مكان العمل', t:'select', opts: [['false','بالمكتب'], ['true','من البيت']]},
      {k:'start_date', l:'تاريخ البدء', t:'date', def: today()}, {k:'active', l:'الحالة', t:'select', opts: [['true','على رأس عمله'], ['false','موقوف']]}, {k:'notes', l:'ملاحظات', wide: 1}],
      e ? {...e, shift_from: e.shift_from?.slice(0, 5), shift_to: e.shift_to?.slice(0, 5), remote: String(e.remote), active: String(e.active)} : {remote: 'false', active: 'true'},
      async v => {
        const row = {name: v.name, job_title: v.job_title || null, department_id: v.department_id || null, user_id: v.user_id || null, phone: v.phone || null, salary: N(v.salary), commission: N(v.commission),
          shift_from: v.shift_from || null, shift_to: v.shift_to || null, remote: v.remote === 'true', start_date: v.start_date || today(), active: v.active === 'true', notes: v.notes || null};
        if (e) await db.upd('employees', {id}, row); else await db.ins('employees', row);
        toast('انحفظ'); K.render();
      });
  },
  depForm: id => { const d = id ? (ST.deps || []).find(x => x.id === id) : null;
    openForm(d ? 'تعديل قسم' : 'قسم جديد', [{k:'name', l:'اسم القسم', req: 1}, {k:'kind', l:'تابع لـ (للمحاسبة)', t:'select', opts: ['المتجر','الوكالة','الإدارة']}], d, async v => { if (d) await db.upd('departments', {id}, v); else await db.ins('departments', v); toast('انحفظ'); K.render(); }); },
  payAdj: async () => { const emps = await db.q('employees', {eq: {active: true}, order: ['name', true]});
    openForm('مكافأة أو خصم', [{k:'employee_id', l:'الموظف', t:'select', opts: emps.map(e => [e.id, e.name]), wide: 1}, {k:'amount', l:'المبلغ (موجب = مكافأة، سالب = خصم)', t:'number'}, {k:'note', l:'السبب', wide: 1}], null,
      async v => { if (!N(v.amount)) return 'اكتب المبلغ'; await db.ins('payroll_adjust', {employee_id: v.employee_id, month: ui.pmonth || monthOf(today()), amount: N(v.amount), note: v.note || null, by_name: me().name}); toast('انسجل'); K.render(); }); },
  paySalary: (id, b) => openForm('صرف راتب', [{k:'amt', l:'المبلغ المصروف (د.أ)', t:'number', def: N(b.dataset.amt)}], null,
    async v => { await db.rpc('pay_salary', {eid: id, m: ui.pmonth || monthOf(today()), amt: N(v.amt)}); toast('انسجل الصرف'); K.render(); }, 'صرف')
});

/* ================= الوكالة ================= */
const CL_TYPES = ['مطعم','كافيه','متجر أونلاين','عيادة','شركة','صفحة','أخرى'];
const DTYPES = ['صورة','فيديو','ريلز','بوست','تصميم','ستوري','أخرى'], DSTAT = ['قيد العمل','بانتظار موافقة العميل','معتمد','منشور'];
const QTYPES = ['صورة','فيديو','ريلز','بوست','تصميم','ستوري'];
V.agency = async () => {
  const tab = ui.agTab || 'clients'; let body = '', btn = '';
  if (tab === 'clients') {
    const cl = await db.q('v_clients', {order: ['name', true]}); const act = cl.filter(c => c.status === 'نشط');
    btn = '<button class="btn pri" data-act="clientForm">+ عميل</button>';
    body = `<div class="kpis">${kpi('دخل شهري ثابت', jd(sum(act, c => c.monthly_fee)), act.length + ' عميل نشط', 'hl')}${kpi('حملات شغالة', sum(cl, c => c.live_campaigns))}${kpi('تسليمات هالشهر', sum(cl, c => c.delivered_month))}${kpi('بانتظار موافقة العملاء', sum(cl, c => c.awaiting))}${kpi('فواتير غير مدفوعة', jd(sum(cl, c => c.due)), '', sum(cl, c => c.due) ? 'red' : '')}</div>` +
      table([{h:'العميل', f:c => `<button class="btn sm" data-act="openClient" data-id="${c.id}">${esc(c.name)}</button><br><small class="m">${esc(c.type)}${c.brought_by_name ? ' · جابه ' + esc(c.brought_by_name) : ''}</small>`}, {h:'الخدمات', f:c => esc(c.services_txt || '—'), c:'wrap'}, {h:'الاشتراك', f:c => jd(c.monthly_fee)},
        {h:'الحالة', f:c => pill(c.status, c.status === 'نشط' ? 'good' : c.status === 'عميل محتمل' ? 'info' : 'warn')}, {h:'حملات', f:c => c.live_campaigns}, {h:'تسليمات الشهر', f:c => c.delivered_month + (Object.keys(c.quota || {}).length ? ' / ' + sum(Object.values(c.quota), x => x) : '')}, {h:'غير مدفوع', f:c => N(c.due) ? `<b class="neg">${jd(c.due)}</b>` : '—'}], cl, 'أضف أول عميل، أو حوّل عميل محتمل من قسم العملاء المحتملين');
  }
  if (tab === 'deliv') {
    const m = ui.dmonth || monthOf(today()); const list = await db.q('v_deliverables', {eq: {month: m}, order: ['created_at', false], limit: 400});
    btn = '<button class="btn pri" data-act="delivForm">+ تسليم</button>';
    body = `<div class="row"><label class="row" style="font-size:13px;color:var(--muted)" for="dmpick">الشهر <input id="dmpick" type="month" value="${m}" data-chg="dmonth" class="inl"></label></div>
      <div class="kpis">${DTYPES.slice(0, 5).map(t => kpi(t, list.filter(x => x.type === t && ['معتمد','منشور'].includes(x.status)).length + ' / ' + list.filter(x => x.type === t).length, 'معتمد / الكل')).join('')}</div>` + delivTable(list, true);
  }
  if (tab === 'camps') {
    const list = await db.q('campaigns', {order: ['updated_at', false], limit: 200}); const cl = await db.q('agency_clients', {select: 'id,name'}); const cn = id => cl.find(c => c.id === id)?.name || '';
    btn = '<button class="btn pri" data-act="campForm">+ حملة</button>';
    body = table([{h:'العميل', f:x => esc(cn(x.client_id))}, {h:'الحملة', f:x => esc(x.name)}, {h:'المنصة / الهدف', f:x => esc(x.platform) + ' · ' + esc(x.goal)}, {h:'الميزانية', f:x => jd(x.budget)}, {h:'المصروف', f:x => jd(x.spend) + ` <small class="m">${N(x.budget) ? Math.round(N(x.spend) / N(x.budget) * 100) : 0}%</small>`}, {h:'النتائج', f:x => fmt(x.results)}, {h:'تكلفة النتيجة', f:x => N(x.results) ? jd(N(x.spend) / N(x.results)) : '—'}, {h:'الحالة', f:x => pill(x.status, x.status === 'شغالة' ? 'good' : '')}, {h:'', f:x => `<button class="btn sm" data-act="campForm" data-id="${x.id}">تحديث</button>`}], list, 'ما في حملات');
    ui.campCache = list;
  }
  if (tab === 'inv') {
    const list = await db.q('invoices', {order: ['day', false], limit: 300}); const cl = await db.q('agency_clients', {select: 'id,name'}); const cn = id => cl.find(c => c.id === id)?.name || '';
    btn = `<button class="btn" data-act="genInvoices">فواتير هالشهر للنشطين</button><button class="btn pri" data-act="invForm">+ فاتورة</button>`;
    body = `<div class="kpis">${kpi('غير مدفوعة', jd(sum(list.filter(i => i.status !== 'مدفوعة'), i => i.amount)), '', 'red')}${kpi('مدفوعة هالشهر', jd(sum(list.filter(i => i.status === 'مدفوعة' && monthOf(i.day) === monthOf(today())), i => i.amount)))}</div>` +
      table([{h:'التاريخ', f:i => i.day}, {h:'العميل', f:i => esc(cn(i.client_id))}, {h:'البيان', f:i => esc(i.note || '')}, {h:'المبلغ', f:i => `<b>${jd(i.amount)}</b>`}, {h:'الحالة', f:i => `<button class="btn sm" data-act="invToggle" data-id="${i.id}">${pill(i.status, i.status === 'مدفوعة' ? 'good' : 'bad')}</button>`}], list, 'ما في فواتير');
  }
  if (tab === 'srv') {
    const list = await db.q('services', {order: ['name', true]}); ui.srvCache = list; btn = '<button class="btn pri" data-act="srvForm">+ خدمة</button>';
    body = table([{h:'الخدمة', f:s => esc(s.name)}, {h:'السعر الشهري', f:s => jd(s.price)}, {h:'', f:s => `<button class="btn sm" data-act="srvForm" data-id="${s.id}">تعديل</button>`}], list);
  }
  return head('الوكالة وعملاءها', 'عملاء الوكالة، حملاتهم، والصور والفيديوهات اللي بنسلّمها، والفواتير. كل عميل إله بوابة بيشوف فيها شغله', btn) +
    chips([['clients','العملاء'], ['deliv','التسليمات'], ['camps','الحملات'], ['inv','الفواتير'], ['srv','الخدمات والأسعار']], tab, 'agTab') + body;
};
const delivTable = (list, showClient) => table([...(showClient ? [{h:'العميل', f:x => esc(x.client_name)}] : []), {h:'النوع', f:x => pill(x.type)}, {h:'العنوان', f:x => esc(x.title) + (x.client_note ? `<br><small class="m">ملاحظة العميل: ${esc(x.client_note)}</small>` : ''), c:'wrap'},
  {h:'المسؤول', f:x => esc(x.assignee_name || '—')}, {h:'الموعد', f:x => x.due || '—'}, {h:'الحالة', f:x => sel('ds_' + x.id, DSTAT.map(s => [s, s]), x.status, null, `data-chg="delivStatus" data-id="${x.id}" aria-label="الحالة" ${can('agency', 'edit') ? '' : 'disabled'}`)},
  {h:'', f:x => (x.link ? `<a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener">فتح</a> ` : '') + `<button class="btn sm" data-act="delivForm" data-id="${x.id}">تعديل</button>`}], list, 'ما في تسليمات بهالشهر');
V.client = async () => {
  const id = ui.clientId; if (!id) { ui.view = 'agency'; return V.agency(); }
  await people();
  const [[c], camps, delivs, stages, invs, upds, cs, srv, logins] = await Promise.all([db.q('v_clients', {eq: {id}}), db.q('campaigns', {eq: {client_id: id}, order: ['start_date', false]}),
    db.q('v_deliverables', {eq: {client_id: id}, order: ['created_at', false], limit: 200}), db.q('stages', {eq: {client_id: id}, order: ['sort', true]}), db.q('invoices', {eq: {client_id: id}, order: ['day', false]}),
    db.q('client_updates', {eq: {client_id: id}, order: ['at', false], limit: 30}), db.q('client_services', {eq: {client_id: id}}), db.q('services', {order: ['name', true]}), db.q('profiles', {eq: {client_id: id}, select: 'id,name,email,active'})]);
  if (!c) { ui.view = 'agency'; return V.agency(); }
  ui.clientCache = c; ui.campCache = camps; ui.delivCache = delivs; ui.stageCache = stages; ui.csCache = cs.map(x => x.service_id); ui.srvCache = srv;
  const m = monthOf(today()), q = c.quota || {}, done = t => delivs.filter(d => d.month === m && d.type === t && ['معتمد','منشور'].includes(d.status)).length;
  return head(esc(c.name), `${esc(c.type)} · من ${c.start_date} · ${pill(c.status, c.status === 'نشط' ? 'good' : 'warn')}`,
      `<button class="btn" data-act="go" data-id="agency">رجوع للعملاء</button><button class="btn" data-act="clientForm" data-id="${c.id}">تعديل</button>`) +
    `<div class="kpis">${kpi('الاشتراك الشهري', jd(c.monthly_fee), esc(c.services_txt || ''), 'hl')}${Object.keys(q).length ? Object.entries(q).map(([t, n]) => kpi(t + ' هالشهر', done(t) + ' / ' + n, done(t) >= N(n) ? 'خلصنا الكمية' : 'ضايل ' + (N(n) - done(t)))).join('') : kpi('الكمية الشهرية', '—', 'حدد كم صورة وفيديو بالتعديل')}${kpi('غير مدفوع', jd(c.due), '', N(c.due) ? 'red' : '')}</div>
    <div class="cols"><div class="card"><div class="head" style="margin-bottom:10px"><h2>مراحل الشغل</h2><button class="btn sm" data-act="stageForm" data-id="${c.id}">+ مرحلة</button></div>
      <ol class="tl">${stages.map(s => `<li><div class="row" style="justify-content:space-between"><b>${esc(s.title)}</b>${sel('st_' + s.id, ['لم يبدأ','قيد العمل','منتهي'].map(x => [x, x]), s.status, null, `data-chg="stageSet" data-id="${s.id}" aria-label="الحالة" ${can('agency', 'edit') ? '' : 'disabled'}`)}</div></li>`).join('') || '<p class="note">ما في مراحل.</p>'}</ol></div>
     <div class="card"><div class="head" style="margin-bottom:10px"><h2>آخر التحديثات للعميل</h2><button class="btn sm" data-act="updForm" data-id="${c.id}">+ تحديث</button></div>
      <div class="feed">${upds.map(u => `<div class="al"><span class="ic">i</span><div><div>${esc(u.text)}</div><time>${fmtDT(u.at)} · ${esc(u.by_name || '')}</time></div></div>`).join('') || '<p class="note">التحديثات اللي بتكتبها هون بيشوفها العميل ببوابته.</p>'}</div></div></div>
    <div class="card"><div class="head" style="margin-bottom:10px"><h2>الحملات</h2><button class="btn sm pri" data-act="campForm" data-cid="${c.id}">+ حملة</button></div>${table([{h:'الحملة', f:x => esc(x.name)}, {h:'المنصة / الهدف', f:x => esc(x.platform) + ' · ' + esc(x.goal)}, {h:'الميزانية', f:x => jd(x.budget)}, {h:'المصروف', f:x => `<div class="bar" style="grid-template-columns:1fr 70px"><span class="tr"><i style="width:${clamp(N(x.budget) ? N(x.spend) / N(x.budget) * 100 : 0, 0, 100)}%"></i></span><b>${jd(x.spend)}</b></div>`}, {h:'النتائج', f:x => fmt(x.results)}, {h:'الحالة', f:x => pill(x.status, x.status === 'شغالة' ? 'good' : '')}, {h:'', f:x => `<button class="btn sm" data-act="campForm" data-id="${x.id}">تحديث</button>`}], camps, 'ما في حملات')}</div>
    <div class="card"><div class="head" style="margin-bottom:10px"><h2>التسليمات (صور، فيديو، تصاميم)</h2><button class="btn sm pri" data-act="delivForm" data-cid="${c.id}">+ تسليم</button></div>${delivTable(delivs, false)}</div>
    <div class="cols"><div class="card"><div class="head" style="margin-bottom:10px"><h2>الفواتير</h2><button class="btn sm" data-act="invForm" data-cid="${c.id}">+ فاتورة</button></div>${table([{h:'التاريخ', f:i => i.day}, {h:'البيان', f:i => esc(i.note || '')}, {h:'المبلغ', f:i => jd(i.amount)}, {h:'الحالة', f:i => `<button class="btn sm" data-act="invToggle" data-id="${i.id}">${pill(i.status, i.status === 'مدفوعة' ? 'good' : 'bad')}</button>`}], invs, 'ما في فواتير')}</div>
     <div class="card"><h2>دخول العميل لبوابته</h2>${logins.length ? table([{h:'الاسم', f:u => esc(u.name)}, {h:'الإيميل', f:u => esc(u.email)}, {h:'', f:u => pill(u.active ? 'فعّال' : 'موقوف', u.active ? 'good' : '')}], logins) : '<p class="note">العميل لسا ما إله دخول.</p>'}
      <p class="note" style="margin-top:10px">العميل بيدخل من نفس رابط النظام، وبيشوف بس: الحملات وكم انصرف من ميزانيته، والصور والفيديوهات اللي انعملتله، ومراحل الشغل، والفواتير. وبيقدر يعتمد التصاميم أو يطلب تعديل.</p>
      <div class="row" style="margin-top:10px"><button class="btn pri" data-act="portalLogin" data-id="${c.id}">+ إنشاء دخول للعميل</button></div></div></div>`;
};
Object.assign(A, {
  agTab: k => { ui.agTab = k; K.render(); },
  openClient: id => { ui.clientId = id; ui.view = 'client'; K.render(); window.scrollTo?.(0, 0); },
  clientForm: async id => {
    await people(); const srv = await db.q('services', {order: ['name', true]}); const c = id ? (ui.clientCache?.id === id ? ui.clientCache : (await db.q('v_clients', {eq: {id}}))[0]) : null;
    const cs = id ? (await db.q('client_services', {eq: {client_id: id}})).map(x => x.service_id) : [];
    const q = c?.quota || {};
    K.openForm(c ? 'تعديل ' + c.name : 'عميل جديد', [{k:'name', l:'اسم العميل', req: 1}, {k:'type', l:'النوع', t:'select', opts: CL_TYPES}, {k:'contact_name', l:'اسم المسؤول'}, {k:'phone', l:'الهاتف'}, {k:'email', l:'الإيميل'},
      {k:'status', l:'الحالة', t:'select', opts: ['نشط','عميل محتمل','متوقف']}, {k:'monthly_fee', l:'الاشتراك الشهري (د.أ)', t:'number', def: 0}, {k:'start_date', l:'تاريخ البدء', t:'date', def: today()},
      {k:'brought_by', l:'مين جابه', t:'select', opts: [['', '—'], ...(ST.people || []).map(p => [p.id, p.name])]},
      ...QTYPES.map(t => ({k:'q_' + t, l:'كمية ' + t + ' بالشهر', t:'number', def: q[t] ?? ''})), {k:'notes', l:'ملاحظات داخلية', t:'textarea'}], c ? {...c, ...Object.fromEntries(QTYPES.map(t => ['q_' + t, q[t] ?? '']))} : null,
      async v => {
        const quota = {}; QTYPES.forEach(t => { if (N(v['q_' + t]) > 0) quota[t] = N(v['q_' + t]); });
        const row = {name: v.name, type: v.type, contact_name: v.contact_name || null, phone: v.phone || null, email: v.email || null, status: v.status, monthly_fee: N(v.monthly_fee), start_date: v.start_date || today(), brought_by: v.brought_by || null, quota, notes: v.notes || null};
        let cid = id; if (c) await db.upd('agency_clients', {id}, row); else {
          cid = (await db.ins('agency_clients', row))[0].id;
          for (const [i, t] of ['اجتماع البداية وجمع المعلومات','الهوية والتصاميم الأساسية','تجهيز الصفحات','إطلاق الحملات','التقرير الشهري الأول'].entries()) await db.ins('stages', {client_id: cid, title: t, sort: i + 1});
        }
        const chosen = $$('#mform [name=srv]:checked').map(x => x.value);
        await db.del('client_services', {client_id: cid}, true); for (const s of chosen) await db.ins('client_services', {client_id: cid, service_id: s});
        toast('انحفظ العميل'); K.render();
      });
    const grid = $('#mform .fgrid'); grid.insertAdjacentHTML('beforeend', `<div class="fld wide"><span>الخدمات</span><div class="checks">${srv.map(s => `<label><input type="checkbox" name="srv" id="srv_${s.id}" value="${s.id}" ${cs.includes(s.id) ? 'checked' : ''}>${esc(s.name)} (${fmt(s.price)})</label>`).join('')}</div></div>`);
  },
  campForm: async (id, b) => {
    const x = id ? (ui.campCache || []).find(c => c.id === id) : null; const cl = await db.q('agency_clients', {select: 'id,name', order: ['name', true]});
    openForm(x ? 'تحديث حملة' : 'حملة جديدة', [{k:'client_id', l:'العميل', t:'select', opts: cl.map(c => [c.id, c.name]), def: b?.dataset.cid}, {k:'name', l:'اسم الحملة', req: 1}, {k:'platform', l:'المنصة', t:'select', opts: ['فيسبوك','إنستغرام','فيسبوك وإنستغرام','تيك توك','سناب شات','جوجل']},
      {k:'goal', l:'الهدف', t:'select', opts: ['رسائل','مبيعات','حجوزات','تفاعل','زيارات','مشاهدات','متابعين']}, {k:'budget', l:'الميزانية (د.أ)', t:'number'}, {k:'spend', l:'المصروف لحد الآن', t:'number', def: 0}, {k:'results', l:'النتائج', t:'number', def: 0},
      {k:'start_date', l:'البداية', t:'date', def: today()}, {k:'end_date', l:'النهاية', t:'date'}, {k:'status', l:'الحالة', t:'select', opts: ['شغالة','متوقفة','منتهية']}, {k:'notes', l:'ملاحظات', wide: 1}], x,
      async v => { const row = {...v, budget: N(v.budget), spend: N(v.spend), results: Math.round(N(v.results)), end_date: v.end_date || null, notes: v.notes || null, updated_at: new Date().toISOString()}; if (x) await db.upd('campaigns', {id}, row); else await db.ins('campaigns', row); toast('انحفظت الحملة'); K.render(); });
  },
  delivForm: async (id, b) => {
    await people(); const x = id ? ((ui.delivCache || []).find(d => d.id === id) || (await db.q('deliverables', {eq: {id}}))[0]) : null; const cl = await db.q('agency_clients', {select: 'id,name', order: ['name', true]});
    openForm(x ? 'تعديل تسليم' : 'تسليم جديد', [{k:'client_id', l:'العميل', t:'select', opts: cl.map(c => [c.id, c.name]), def: b?.dataset.cid}, {k:'type', l:'النوع', t:'select', opts: DTYPES}, {k:'title', l:'العنوان', req: 1, wide: 1},
      {k:'month', l:'الشهر (YYYY-MM)', def: monthOf(today())}, {k:'assignee', l:'المسؤول', t:'select', opts: [['', '—'], ...(ST.people || []).map(p => [p.id, p.name])]}, {k:'due', l:'الموعد', t:'date'},
      {k:'status', l:'الحالة', t:'select', opts: DSTAT}, {k:'link', l:'رابط الملف (Drive أو غيره)', wide: 1}], x,
      async v => { if (!/^\d{4}-\d{2}$/.test(v.month)) return 'الشهر لازم يكون بالشكل 2026-10'; const row = {...v, assignee: v.assignee || null, due: v.due || null, link: v.link || null}; if (x) await db.upd('deliverables', {id}, row); else await db.ins('deliverables', row); toast('انحفظ'); K.render(); });
  },
  stageForm: id => openForm('مرحلة جديدة', [{k:'title', l:'المرحلة', req: 1, wide: 1}, {k:'sort', l:'الترتيب', t:'number', def: (ui.stageCache || []).length + 1}], null,
    async v => { await db.ins('stages', {client_id: id, title: v.title, sort: Math.round(N(v.sort))}); K.render(); }),
  invForm: async (id, b) => { const cl = await db.q('agency_clients', {select: 'id,name', order: ['name', true]});
    openForm('فاتورة جديدة', [{k:'client_id', l:'العميل', t:'select', opts: cl.map(c => [c.id, c.name]), def: b?.dataset.cid, wide: 1}, {k:'amount', l:'المبلغ (د.أ)', t:'number'}, {k:'day', l:'التاريخ', t:'date', def: today()}, {k:'note', l:'البيان', def: 'اشتراك شهري'}, {k:'status', l:'الحالة', t:'select', opts: ['غير مدفوعة','مدفوعة']}], null,
      async v => { if (!(N(v.amount) > 0)) return 'اكتب المبلغ'; await db.ins('invoices', {...v, amount: N(v.amount), paid_at: v.status === 'مدفوعة' ? new Date().toISOString() : null}); toast('انضافت الفاتورة'); K.render(); }); },
  invToggle: async id => { const [i] = await db.q('invoices', {eq: {id}}); const paid = i.status !== 'مدفوعة'; await db.upd('invoices', {id}, {status: paid ? 'مدفوعة' : 'غير مدفوعة', paid_at: paid ? new Date().toISOString() : null}); toast(paid ? 'تسجلت مدفوعة' : 'رجعت غير مدفوعة'); K.render(); },
  genInvoices: async () => { const n = await db.rpc('gen_invoices', {m: monthOf(today())}); toast(n ? `انعملت ${n} فاتورة` : 'كل العملاء النشطين إلهم فاتورة هالشهر'); K.render(); },
  updForm: id => openForm('تحديث للعميل', [{k:'text', l:'شو صار؟ (العميل بيشوفه ببوابته)', t:'textarea'}], null, async v => { if (!v.text) return 'اكتب التحديث'; await db.ins('client_updates', {client_id: id, text: v.text, by_name: me().name}); toast('انضاف'); K.render(); }),
  srvForm: id => { const s = id ? (ui.srvCache || []).find(x => x.id === id) : null; openForm(s ? 'تعديل خدمة' : 'خدمة جديدة', [{k:'name', l:'اسم الخدمة', req: 1, wide: 1}, {k:'price', l:'السعر الشهري (د.أ)', t:'number'}], s, async v => { const row = {name: v.name, price: N(v.price)}; if (s) await db.upd('services', {id}, row); else await db.ins('services', row); toast('انحفظ'); K.render(); }); },
  portalLogin: id => openForm('دخول العميل للبوابة', [{k:'name', l:'الاسم', def: ui.clientCache?.contact_name || ui.clientCache?.name}, {k:'email', l:'الإيميل', t:'email', req: 1, def: ui.clientCache?.email || ''}, {k:'pw', l:'كلمة السر (6 أحرف على الأقل)', req: 1}], null,
    async v => { if (v.pw.length < 6) return 'كلمة السر لازم 6 أحرف على الأقل'; const uid = await db.createUser(v.email.toLowerCase(), v.pw, v.name); await db.rpc('link_client_user', {uid, cid: id}); copyText(`رابط متابعة الشغل: ${siteBase()}\nالإيميل: ${v.email}\nكلمة السر: ${v.pw}`); toast('انعمل الدخول وانسخت بيانات الدخول، ابعتها للعميل'); K.render(); }, 'إنشاء')
});
document.addEventListener('change', e => { if (e.target.dataset?.chg === 'dmonth') { ui.dmonth = e.target.value || monthOf(today()); K.render(); } });

/* ================= العملاء المحتملين ================= */
const LSTAGES = ['جديد','تواصلنا','اجتماع','عرض سعر','تم التعاقد','خسرناه'];
V.leads = async () => {
  await people();
  const mine = ui.leadsMine; const o = {order: ['updated_at', false], limit: 500}; if (mine) o.eq = {owner: me().id};
  const list = await db.q('v_leads', o); ui.leadCache = list;
  const by = {}; list.forEach(l => { const k = l.owner_name || '—'; const x = by[k] = by[k] || {n: 0, won: 0, fee: 0}; x.n++; if (l.stage === 'تم التعاقد') { x.won++; x.fee += N(l.expected_fee); } });
  return head('العملاء المحتملين', 'فريق التسويق بيجيب شركات ومطاعم وصفحات، وبيتابعهم مرحلة مرحلة لحد ما يصيروا عملاء للوكالة', '<button class="btn pri" data-act="leadForm">+ عميل محتمل</button>') +
    `<div class="row">${chips([['', 'الكل'], ['1', 'تبعي بس']], mine ? '1' : '', 'leadsMine')}</div>
    <div class="kpis">${kpi('بالمتابعة', list.filter(l => !['تم التعاقد','خسرناه'].includes(l.stage)).length)}${kpi('قيمة متوقعة', jd(sum(list.filter(l => !['تم التعاقد','خسرناه'].includes(l.stage)), l => l.expected_fee)), 'شهرياً')}${kpi('تعاقدنا', list.filter(l => l.stage === 'تم التعاقد').length, '', 'hl')}${kpi('متابعة اليوم أو متأخرة', list.filter(l => l.next_followup && l.next_followup <= today() && !['تم التعاقد','خسرناه'].includes(l.stage)).length, '', list.some(l => l.next_followup && l.next_followup < today() && !['تم التعاقد','خسرناه'].includes(l.stage)) ? 'red' : '')}</div>
    <div class="board">${LSTAGES.map(s => `<div class="col"><h3>${s} <small class="m">${list.filter(l => l.stage === s).length}</small></h3>${list.filter(l => l.stage === s).map(l => `<div class="tcard ${l.next_followup && l.next_followup < today() && !['تم التعاقد','خسرناه'].includes(s) ? 'late' : ''}">
      <b>${esc(l.company)}</b><small class="m">${esc(l.type)} · ${esc(l.contact_name || '')} ${esc(l.phone || '')}</small><small class="m">${esc(l.owner_name || '')}${N(l.expected_fee) ? ' · ' + jd(l.expected_fee) + '/شهر' : ''}${l.next_followup ? ' · متابعة ' + l.next_followup : ''}</small>
      <div class="row">${sel('ls_' + l.id, LSTAGES.map(x => [x, x]), l.stage, null, `data-chg="leadStage" data-id="${l.id}" aria-label="المرحلة"`)}<button class="btn sm" data-act="leadForm" data-id="${l.id}">تعديل</button>${l.client_id ? `<button class="btn sm" data-act="openClient" data-id="${l.client_id}">ملف العميل</button>` : s === 'تم التعاقد' || s === 'عرض سعر' ? `<button class="btn sm pri" data-act="leadConvert" data-id="${l.id}">حوّله لعميل</button>` : ''}</div></div>`).join('') || '<p class="m empty">—</p>'}</div>`).join('')}</div>
    <div class="card"><h2>أداء الفريق</h2>${table([{h:'الموظف', f:([k]) => esc(k)}, {h:'عملاء محتملين', f:([, x]) => x.n}, {h:'تعاقد', f:([, x]) => x.won}, {h:'نسبة النجاح', f:([, x]) => x.n ? pct(x.won / x.n) : '—'}, {h:'دخل شهري جابوه', f:([, x]) => jd(x.fee)}], Object.entries(by))}</div>`;
};
Object.assign(A, {
  leadsMine: k => { ui.leadsMine = !!k; K.render(); },
  leadForm: async id => { await people(); const l = id ? (ui.leadCache || []).find(x => x.id === id) : null;
    openForm(l ? 'تعديل ' + l.company : 'عميل محتمل جديد', [{k:'company', l:'اسم الشركة / المطعم', req: 1}, {k:'type', l:'النوع', t:'select', opts: CL_TYPES}, {k:'contact_name', l:'اسم المسؤول'}, {k:'phone', l:'الهاتف'}, {k:'source', l:'من وين وصلنا', t:'select', opts: ['زيارة ميدانية','اتصال','سوشال ميديا','توصية','إعلان','أخرى']},
      {k:'stage', l:'المرحلة', t:'select', opts: LSTAGES}, {k:'owner', l:'المسؤول عنه', t:'select', opts: (ST.people || []).map(p => [p.id, p.name]), def: me().id}, {k:'expected_fee', l:'الاشتراك المتوقع (د.أ/شهر)', t:'number', def: 0},
      {k:'next_followup', l:'موعد المتابعة الجاية', t:'date'}, {k:'notes', l:'ملاحظات', t:'textarea'}], l,
      async v => { const row = {...v, expected_fee: N(v.expected_fee), next_followup: v.next_followup || null, owner: v.owner || me().id, updated_at: new Date().toISOString()}; if (l) await db.upd('leads', {id}, row); else await db.ins('leads', row); toast('انحفظ'); K.render(); }); },
  leadConvert: async id => { const cid = await db.rpc('lead_to_client', {lid: id}); toast('صار عميل للوكالة، وانعملتله مراحل البداية'); A.openClient(cid); }
});

/* ================= المساعد الذكي ================= */
V.ai = async () => head('المساعد الذكي', 'بيقرأ أرقامك الحقيقية (المبيعات، الهامش، المرتجع، الإعلانات، الفريق) وبيعطيك اقتراحات. القرار بالآخر إلك') +
  `<div class="cols"><div class="card"><h2>اختيار المنتجات</h2><p class="m">شو أركّز عليه، شو أوقّف، شو أطلب من جديد، وأفكار منتجات جديدة تجربها.</p>
     <label class="fld wide" for="ai_p"><span>شي بدك تحكيه للمساعد (اختياري)</span><textarea id="ai_p" rows="3" placeholder="مثلاً: ميزانيتي للإعلانات 300 دينار بالأسبوع، وبدي منتجات للشتاء"></textarea></label>
     <div class="row" style="margin-top:10px"><button class="btn pri" data-act="aiProducts">حلّل منتجاتي</button></div></div>
   <div class="card"><h2>توزيع المهام</h2><p class="m">بيقترح مهام لكل موظف حسب قسمه وشغله المفتوح وتسليمات عملاء الوكالة. بتراجعها قبل ما تنضاف.</p>
     <label class="fld wide" for="ai_t"><span>الهدف</span><textarea id="ai_t" rows="3" placeholder="مثلاً: خطة محتوى الأسبوع الجاي لصفحتنا ولعملاء الوكالة، ومتابعة الزبائن اللي ما طلبوا"></textarea></label>
     <div class="row" style="margin-top:10px"><button class="btn pri" data-act="aiTasks">اقترح مهام</button></div></div></div>
  <div class="card"><h2>اسأل المساعد</h2><label class="fld wide" for="ai_q"><span>سؤالك عن الشغل</span><textarea id="ai_q" rows="2" placeholder="مثلاً: ليش ربحي نازل هالشهر؟"></textarea></label><div class="row" style="margin-top:10px"><button class="btn pri" data-act="aiAsk">اسأل</button></div></div>
  <div id="aiOut"></div>`;
const aiShow = (title, html) => { const o = $('#aiOut'); if (o) o.innerHTML = `<div class="card"><h2>${title}</h2>${html}</div>`; o?.scrollIntoView?.({behavior: 'smooth'}); };
const aiText = t => `<div class="aitext">${esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</div>`;
async function bizContext() {
  const [ps, ads] = await Promise.all([db.q('v_products', {eq: {active: true}}), can('ads') ? db.rpc('ad_perf', {d_from: addDays(today(), -29), d_to: today()}) : []]);
  const adBy = {}; (ads || []).forEach(a => { if (!a.product_id) return; const x = adBy[a.product_id] = adBy[a.product_id] || {spend: 0, revenue: 0, orders: 0, messages: 0}; x.spend += N(a.spend); x.revenue += N(a.revenue); x.orders += N(a.orders); x.messages += N(a.messages); });
  return ps.map(p => ({name: p.name, category: p.category, price: N(p.price), cost: N(p.cost), margin_pct: N(p.price) ? Math.round((N(p.price) - N(p.cost)) / N(p.price) * 100) : 0, stock: N(p.stock),
    sold_7d: N(p.sold7), sold_30d: N(p.sold30), delivered_30d: N(p.del30), returned_30d: N(p.ret30), ads_30d: adBy[p.id] || null}));
}
Object.assign(A, {
  aiProducts: async () => { aiShow('تحليل المنتجات', '<p class="note">المساعد بيقرأ الأرقام…</p>'); const r = await db.fn('ai', {mode: 'products', prompt: $('#ai_p')?.value || '', context: {products: await bizContext(), rules: ST.settings?.rules}}); aiShow('تحليل المنتجات', aiText(r.text || '')); },
  aiAsk: async () => { const q = $('#ai_q')?.value.trim(); if (!q) { toast('اكتب سؤالك', true); return; } aiShow('جواب المساعد', '<p class="note">بفكر…</p>');
    const ctx = {products: await bizContext()}; if (can('accounting')) ctx.month = await db.rpc('month_pnl', {m: monthOf(today())}); if (can('team')) ctx.team_7d = await db.rpc('team_stats', {d_from: addDays(today(), -6), d_to: today()});
    const r = await db.fn('ai', {mode: 'ask', prompt: q, context: ctx}); aiShow('جواب المساعد', aiText(r.text || '')); },
  aiTasks: async () => {
    aiShow('مهام مقترحة', '<p class="note">المساعد بيوزّع الشغل…</p>');
    const [emps, open, clients] = await Promise.all([db.q('v_employees', {eq: {active: true}}).catch(() => []), db.q('v_tasks', {in: {status: ['جديدة','قيد العمل']}, select: 'assignee,title'}), can('agency') ? db.q('v_clients', {eq: {status: 'نشط'}}) : []]);
    await people();
    const team = (ST.people || []).filter(p => p.role !== 'مدير عام').map(p => { const e = emps.find(x => x.user_id === p.id); return {id: p.id, name: p.name, role: p.role, department: e?.department || null, job: e?.job_title || null, open_tasks: open.filter(t => t.assignee === p.id).map(t => t.title)}; });
    const r = await db.fn('ai', {mode: 'tasks', prompt: $('#ai_t')?.value || '', context: {today: today(), team, clients: clients.map(c => ({id: c.id, name: c.name, type: c.type, quota: c.quota, delivered_this_month: c.delivered_month, awaiting_approval: c.awaiting}))}});
    const tasks = Array.isArray(r.tasks) ? r.tasks : []; ui.aiTasks = tasks;
    if (!tasks.length) { aiShow('مهام مقترحة', aiText(r.text || 'ما طلع مهام. جرّب توضّح الهدف أكثر.')); return; }
    aiShow('مهام مقترحة', `${r.text ? aiText(r.text) : ''}<div class="tw"><table><thead><tr><th></th><th>المهمة</th><th>الموظف</th><th>الموعد</th><th>الأولوية</th></tr></thead><tbody>${tasks.map((t, i) => `<tr><td><input type="checkbox" id="ait_${i}" checked aria-label="اختيار"></td><td class="wrap"><b>${esc(t.title)}</b><br><small class="m">${esc(t.details || '')}</small></td>
      <td>${sel('aia_' + i, (ST.people || []).map(p => [p.id, p.name]), t.assignee_id, '—')}</td><td><input type="date" class="inl" id="aid_${i}" value="${esc(addDays(today(), Math.max(0, Math.round(N(t.due_in_days ?? 2)))))}"></td><td>${sel('aip_' + i, PRIO.map(x => [x, x]), PRIO.includes(t.priority) ? t.priority : 'عادية')}</td></tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn pri" data-act="aiCreate">أضف المهام المختارة</button></div>`);
  },
  aiCreate: async () => { let n = 0; for (const [i, t] of (ui.aiTasks || []).entries()) { if (!$('#ait_' + i)?.checked) continue;
      await db.ins('tasks', {title: t.title, details: t.details || null, assignee: $('#aia_' + i).value || null, due: $('#aid_' + i).value || null, priority: $('#aip_' + i).value, client_id: t.client_id || null, ai: true, created_by_name: me().name + ' (المساعد)'}); n++; }
    toast(`انضافت ${n} مهمة`); ui.view = 'tasks'; K.render(); }
});

/* ================= بوابة عميل الوكالة ================= */
V.portal = async () => {
  const d = await db.rpc('portal_data'); ui.portal = d;
  const c = d.client, q = c.quota || {}, mc = d.month_counts || {};
  const waiting = d.deliverables.filter(x => x.status === 'بانتظار موافقة العميل');
  const stagesDone = d.stages.filter(s => s.status === 'منتهي').length;
  return `<div class="head"><div><h1>أهلين ${esc(c.name)}</h1><p class="sub">هون بتتابع شغلنا معك: الحملات وكم انصرف من الميزانية، والصور والفيديوهات اللي انعملتلك، ومراحل الشغل.</p></div></div>
    <div class="kpis">${Object.keys(q).length ? Object.entries(q).map(([t, n]) => kpi(t + ' هالشهر', N(mc[t]) + ' من ' + n, N(mc[t]) >= N(n) ? 'خلصت الكمية' : 'ضايل ' + (N(n) - N(mc[t])), 'hl')).join('') : Object.entries(mc).map(([t, n]) => kpi(t + ' هالشهر', n)).join('')}
     ${kpi('الحملات الشغالة', d.campaigns.filter(x => x.status === 'شغالة').length, 'صرف ' + jd(sum(d.campaigns.filter(x => x.status === 'شغالة'), x => x.spend)) + ' من ' + jd(sum(d.campaigns.filter(x => x.status === 'شغالة'), x => x.budget)))}
     ${kpi('مراحل الشغل', stagesDone + ' من ' + d.stages.length)}</div>
    ${waiting.length ? `<div class="card"><h2>بانتظار موافقتك (${waiting.length})</h2>${table([{h:'النوع', f:x => pill(x.type)}, {h:'العنوان', f:x => esc(x.title), c:'wrap'}, {h:'', f:x => (x.link ? `<a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener">شوف</a> ` : '') + `<button class="btn sm pri" data-act="pApprove" data-id="${x.id}">اعتماد</button> <button class="btn sm" data-act="pChange" data-id="${x.id}">بدي تعديل</button>`}], waiting)}</div>` : ''}
    <div class="card"><h2>الحملات الإعلانية</h2>${table([{h:'الحملة', f:x => esc(x.name)}, {h:'المنصة / الهدف', f:x => esc(x.platform) + ' · ' + esc(x.goal)}, {h:'الميزانية', f:x => jd(x.budget)}, {h:'انصرف', f:x => `<div class="bar" style="grid-template-columns:1fr 80px"><span class="tr"><i style="width:${clamp(N(x.budget) ? N(x.spend) / N(x.budget) * 100 : 0, 0, 100)}%"></i></span><b>${jd(x.spend)}</b></div>`},
      {h:'النتائج', f:x => fmt(x.results) + ' ' + esc(x.goal)}, {h:'تكلفة النتيجة', f:x => N(x.results) ? jd(N(x.spend) / N(x.results)) : '—'}, {h:'الحالة', f:x => pill(x.status, x.status === 'شغالة' ? 'good' : '')}], d.campaigns, 'ما في حملات لسا')}</div>
    <div class="cols"><div class="card"><h2>مراحل الشغل</h2><ol class="tl">${d.stages.map(s => `<li><b>${esc(s.title)}</b> ${pill(s.status, s.status === 'منتهي' ? 'good' : s.status === 'قيد العمل' ? 'warn' : '')}</li>`).join('') || '<p class="note">—</p>'}</ol></div>
     <div class="card"><h2>آخر التحديثات</h2><div class="feed">${d.updates.map(u => `<div class="al"><span class="ic">i</span><div><div>${esc(u.text)}</div><time>${fmtDT(u.at)}</time></div></div>`).join('') || '<p class="note">—</p>'}</div></div></div>
    <div class="card"><h2>الشغل اللي انعملك</h2>${table([{h:'الشهر', f:x => x.month}, {h:'النوع', f:x => pill(x.type)}, {h:'العنوان', f:x => esc(x.title), c:'wrap'}, {h:'الحالة', f:x => pill(x.status, ['معتمد','منشور'].includes(x.status) ? 'good' : 'warn')}, {h:'', f:x => x.link ? `<a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener">فتح</a>` : ''}], d.deliverables, 'لسا ما في')}</div>
    <div class="cols"><div class="card"><h2>الخدمات</h2><p>${d.services.map(esc).join('، ') || '—'}</p><div class="kv"><span>الاشتراك الشهري</span><b>${jd(c.monthly_fee)}</b></div><div class="kv"><span>من تاريخ</span><b>${c.start_date}</b></div></div>
     <div class="card"><h2>الفواتير</h2>${table([{h:'التاريخ', f:i => i.day}, {h:'البيان', f:i => esc(i.note || '')}, {h:'المبلغ', f:i => jd(i.amount)}, {h:'الحالة', f:i => pill(i.status, i.status === 'مدفوعة' ? 'good' : 'bad')}], d.invoices, '—')}</div></div>`;
};
Object.assign(A, {
  pApprove: async id => { await db.rpc('portal_review', {did: id, ok: true, note: null}); toast('شكراً، انعتمد'); K.render(); },
  pChange: id => openForm('شو التعديل اللي بدك إياه؟', [{k:'note', l:'اكتب ملاحظتك', t:'textarea'}], null, async v => { if (!v.note) return 'اكتب الملاحظة'; await db.rpc('portal_review', {did: id, ok: false, note: v.note}); toast('وصلتنا ملاحظتك، رح نعدّل'); K.render(); }, 'إرسال')
});

/* ================= لوحة التحكم: إضافات ================= */
const baseDash = V.dash;
V.dash = async () => {
  const html = await baseDash();
  const extra = [];
  try {
    if (can('control') || can('inbox')) { const w = await db.q('v_conversations', {eq: {waiting: true}, select: 'id,last_in'}); extra.push(kpi('زبائن مستنيين رد', w.length, w.filter(c => minsAgo(c.last_in) > rule('sla', 5)).length + ' متأخرين', w.some(c => minsAgo(c.last_in) > rule('escalate', 15)) ? 'red' : '')); }
    if (can('control')) { const t = await db.q('v_attendance_today', {select: 'user_id,check_in,check_out,state,last_ping,break_since,state_since'}); const s = t.map(liveState); extra.push(kpi('الموظفين بالدوام', s.filter(x => x[0] !== 'offline').length, s.filter(x => ['away','idle'].includes(x[0])).length + ' برا الصفحة أو خاملين', s.some(x => ['away','idle'].includes(x[0])) ? 'red' : '')); }
    if (can('ads')) { const r = (await db.rpc('ad_perf', {d_from: addDays(today(), -6), d_to: today()}) || []).map(adCalc); const sp = sum(r, g => g.spend); extra.push(kpi('صرف إعلانات 7 أيام', jd(sp), 'ROAS متوقع ' + (sp ? (sum(r, g => g.revenue + g.pending_rev * .8) / sp).toFixed(2) + 'x' : '—'))); }
    const tk = await db.q('v_tasks', {in: {status: ['جديدة','قيد العمل']}, select: 'id,due,assignee'}); const late = tk.filter(t => t.due && t.due < today());
    if (tk.length) extra.push(kpi(can('tasks') ? 'مهام مفتوحة' : 'مهامي', tk.length, late.length + ' متأخرة', late.length ? 'red' : ''));
  } catch (e) {}
  return extra.length ? html.replace('<div class="kpis">', `<div class="kpis">${extra.join('')}`) : html;
};

/* ================= الإعدادات: إضافات ================= */
const baseSettings = V.settings;
V.settings = async () => {
  const html = await baseSettings(); const r = ST.settings?.rules || {};
  const pages = isAdmin() ? await db.q('meta_pages', {order: ['name', true]}) : [];
  const ri = (k, l, u, d) => `<label class="fld" for="r_${k}"><span>${l}</span><div class="row"><input id="r_${k}" class="inl" type="number" step="any" value="${esc(r[k] ?? d)}" style="width:90px;font-size:14px;padding:6px 8px"> <small class="m">${u}</small></div></label>`;
  return html + `<div class="cols"><div class="card"><h2>قواعد المراقبة والإعلانات</h2><div class="fgrid">${ri('sla', 'تنبيه إذا ما في رد خلال', 'دقائق', 5)}${ri('escalate', 'تصعيد للإدارة بعد', 'دقيقة', 15)}${ri('idle', '"ترك الصفحة" بعد', 'دقائق', 10)}${ri('break_max', 'أقصى استراحة', 'دقيقة', 20)}${ri('late', 'تأخير الدخول المسموح', 'دقائق', 10)}
      ${ri('roas_min', 'أقل ROAS مقبول', 'x', 2.5)}${ri('cpm_max', 'أعلى CPM مقبول', 'د.أ', 3)}${ri('freq_max', 'أعلى تكرار', 'مرة', 3.5)}${ri('posts_week', 'منشورات بالأسبوع', 'منشور', 5)}</div><div class="row" style="margin-top:12px"><button class="btn pri" data-act="saveRules">حفظ القواعد</button></div></div>
    ${isAdmin() ? `<div class="card"><h2>صفحات Meta المربوطة</h2>${table([{h:'الصفحة', f:p => esc(p.name)}, {h:'المنصة', f:p => pill(p.platform)}, {h:'رقم الصفحة', f:p => esc(p.page_id)}, {h:'', f:p => `<button class="btn sm" data-act="metaPageForm" data-id="${esc(p.page_id)}">تحديث التوكن</button>`}], pages, 'ما في صفحات مربوطة لسا')}
      <div class="row" style="margin-top:10px"><button class="btn" data-act="metaPageForm">+ ربط صفحة</button></div><p class="note" style="margin-top:8px">التوكن بينحفظ بمكان مخفي بقاعدة البيانات، وما حدا بيقدر يقرأه من الواجهة. خطوات جلبه بدليل ربط Meta.</p></div>
    <div class="card"><h2>نسخة احتياطية</h2><p class="m">بتنزّل كل بيانات النظام بملف واحد (JSON) على جهازك. اعملها كل أسبوع على الأقل واحفظها بمكان آمن.</p><div class="row" style="margin-top:10px"><button class="btn pri" data-act="backup">تنزيل نسخة احتياطية</button></div></div>` : ''}</div>`;
};
Object.assign(A, {
  saveRules: async () => { const rules = {...(ST.settings?.rules || {})}; ['sla','escalate','idle','break_max','late','roas_min','cpm_max','freq_max','posts_week'].forEach(k => { const v = parseFloat($('#r_' + k)?.value); if (v > 0) rules[k] = v; });
    await db.upd('settings', {id: 1}, {rules}); ST.settings.rules = rules; toast('انحفظت القواعد'); },
  metaPageForm: id => openForm(id ? 'تحديث صفحة' : 'ربط صفحة Meta', [{k:'pid', l:'رقم الصفحة (Page ID)', req: 1, def: id || ''}, {k:'pname', l:'اسم الصفحة', req: 1}, {k:'platform', l:'المنصة', t:'select', opts: ['فيسبوك','إنستغرام','فيسبوك وإنستغرام']}, {k:'ig', l:'رقم حساب إنستغرام (إذا مربوط)'}, {k:'token', l:'Page Access Token', t:'textarea'}], null,
    async v => { await db.rpc('meta_save_page', {pid: v.pid.trim(), pname: v.pname, platform: v.platform, token: v.token.trim(), ig: v.ig.trim()}); toast('انحفظت الصفحة'); K.render(); }),
  backup: async () => {
    toast('جاري تجهيز النسخة…');
    const tables = ['settings','profiles','products','stock_moves','couriers','runs','orders','order_items','order_log','run_orders','courier_payments','purchases','expenses','fin_days','audit_log',
      'departments','employees','payroll_adjust','payroll_paid','attendance','alerts','warnings','ad_accounts','ads','ad_insights','meta_pages','conversations','messages','quick_replies','followups',
      'agency_clients','posts','tasks','services','client_services','campaigns','deliverables','stages','invoices','client_updates','leads'];
    const out = {app: 'saber-online', at: new Date().toISOString(), tables: {}};
    for (const t of tables) { try { out.tables[t] = await db.qAll(t); } catch (e) { out.tables[t] = {error: e.message}; } }
    const blob = new Blob([JSON.stringify(out)], {type: 'application/json'}); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `saber-online-backup-${today()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('نزلت النسخة الاحتياطية');
  }
});
})();
