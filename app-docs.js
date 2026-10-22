/* صابر أونلاين ERP — العروض والعقود
   أرشيف عروض الأسعار والعقود، محرر العقد (بنود قابلة للتعديل وتوقيع الشركة)، إرسال واتساب وتنزيل PDF،
   وإعدادات العقد (البيانات الرسمية، البنود الافتراضية، الهدايا الافتراضية، التوقيع). */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmt, jd, toast, head, kpi, pill, chips, copyText, can, today, addDays, fmtDT, V, A, ST, ui, ACT_SEC} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});

const Q_ST = ['مسودة عرض', 'عرض مرسل', 'مقبول', 'مرفوض', 'منتهي'];
const C_ST = ['مسودة', 'مرسل', 'موقّع', 'منتهي', 'ملغي'];
const CLS = {'مسودة عرض': '', 'مسودة': '', 'عرض مرسل': 'info', 'مرسل': 'info', 'مقبول': 'good', 'موقّع': 'good', 'مرفوض': 'bad', 'ملغي': 'bad', 'منتهي': 'warn'};
const VAT = [['excl', 'غير شاملة الضريبة'], ['incl', 'شاملة الضريبة'], ['exempt', 'معفي من الضريبة'], ['none', 'بدون ذكر الضريبة']];
const site = () => ST.oSite?.config || {};
const loadSite = async () => { try { ST.oSite = (await db.q('oops_site', {eq: {id: 1}}))[0] || {config: {}}; } catch (e) { ST.oSite = {config: {}}; } return ST.oSite; };
const qUrl = tok => (K.quoteUrl ? K.quoteUrl(tok) : location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'o.html?q=' + tok);
const cUrl = tok => qUrl('x').replace(/[^/]*\?q=x$/, 'c.html?c=') + tok;
const waNum = p => { const d = String(p || '').replace(/\D/g, ''); return /^07[789]\d{7}$/.test(d) ? '962' + d.slice(1) : /^7[789]\d{7}$/.test(d) ? '962' + d : d.replace(/^00/, ''); };
const brand = () => ST.settings?.agency_name || 'OOPSIDE';
const net = r => N(r.fees_monthly) - N(r.discount);

function inRange(d) {
  const t = today(), m = ui.dMode || 'all', x = String(d || '').slice(0, 10);
  if (m === 'today') return x === t;
  if (m === '7') return x >= addDays(t, -6);
  if (m === 'month') return x >= t.slice(0, 8) + '01';
  if (m === 'custom' && ui.dFrom && ui.dTo) return x >= ui.dFrom && x <= ui.dTo;
  return true;
}
const openWa = (phone, msg) => { const n = waNum(phone); const url = 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg); const w = window.open(url, '_blank'); if (!w) location.href = url; };


/* ================= تحديد أكثر من وحدة: أرشفة / حذف ================= */
const KIND_NAME = {request: 'طلب', lead: 'عميل محتمل', contract: 'عقد'};
const selSet = k => { ui.sel = ui.sel || {}; return ui.sel[k] = ui.sel[k] || new Set(); };
K.selBox = (kind, id) => can('leads', 'edit') ? `<input type="checkbox" class="selck" data-selk="${kind}" data-id="${id}" aria-label="تحديد" ${selSet(kind).has(id) ? 'checked' : ''}>` : '';
K.bulkBar = (kind, ids, archivedView) => {
  if (!can('leads', 'edit') || !ids.length) return '';
  const S = selSet(kind); [...S].forEach(id => { if (!ids.includes(id)) S.delete(id); });
  ui.selIds = ui.selIds || {}; ui.selIds[kind] = ids;
  const n = S.size, all = n && n === ids.length;
  return `<div class="bulk ${n ? 'on' : ''}" data-bulk="${kind}" data-arch="${archivedView ? 1 : 0}"><label class="ck"><input type="checkbox" data-selall="${kind}" ${all ? 'checked' : ''} aria-label="حدد الكل"> <span>${n ? 'حددت ' + n : 'حدد الكل'}</span></label>
    ${n ? `${archivedView ? `<button class="btn sm" data-act="bulkDo" data-id="${kind}|unarchive">رجّعهم من الأرشيف</button>` : `<button class="btn sm" data-act="bulkDo" data-id="${kind}|archive">أرشفة</button>`}${K.isAdmin() ? `<button class="btn sm danger" data-act="bulkDo" data-id="${kind}|delete">حذف نهائي</button>` : ''}<button class="btn sm ghost" data-act="bulkClear" data-id="${kind}">إلغاء التحديد</button>` : '<span class="m">حدد اللي ما إله داعي، وأرشفه أو احذفه</span>'}</div>`;
};
const paintBulk = kind => { $$(`[data-bulk="${kind}"]`).forEach(b => { const tmp = document.createElement('div'); tmp.innerHTML = K.bulkBar(kind, ui.selIds?.[kind] || [], b.dataset.arch === '1'); if (tmp.firstElementChild) b.replaceWith(tmp.firstElementChild); }); };
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList?.contains('selck')) { const S = selSet(t.dataset.selk); t.checked ? S.add(t.dataset.id) : S.delete(t.dataset.id); paintBulk(t.dataset.selk); return; }
  if (t.dataset?.selall) { const k = t.dataset.selall, S = selSet(k), ids = ui.selIds?.[k] || []; if (t.checked) ids.forEach(i => S.add(i)); else S.clear(); $$(`.selck[data-selk="${k}"]`).forEach(c => { c.checked = S.has(c.dataset.id); }); paintBulk(k); }
});
Object.assign(ACT_SEC, {bulkDo: 'leads', bulkClear: 'leads'});
Object.assign(A, {
  bulkClear: k => { selSet(k).clear(); K.render(); },
  bulkDo: async v => {
    const [kind, act] = v.split('|'), ids = [...selSet(kind)]; if (!ids.length) return;
    const nm = KIND_NAME[kind] || '';
    if (act === 'delete' && !confirm(`أكيد بدك تحذف ${ids.length} ${nm} نهائياً؟ ما برجعوا.${kind === 'lead' ? '\nسجل التواصل تبعهم بينحذف كمان.' : ''}\nإذا مش متأكد، أرشفهم أحسن.`)) return;
    const r = await db.rpc('docs_bulk', {kind, ids, act});
    selSet(kind).clear();
    toast(`${act === 'delete' ? 'انحذف' : act === 'archive' ? 'انأرشف' : 'رجع'} ${N(r?.n)} ${nm}${N(r?.skipped) ? ` · ${N(r.skipped)} ما انحذفوا لأنهم مربوطين بعقد موقّع (أرشفهم)` : ''}`, N(r?.skipped) > 0);
    K.render();
  }
});

/* ================= الأرشيف ================= */
V.docs = async () => {
  const tab = ui.dTab || 'contracts';
  if (tab === 'settings') return docsHead(tab) + await settingsView();
  const arch = tab === 'archive';
  const [quotes, cons] = await Promise.all([
    db.q('oops_requests', {in: {status: Q_ST}, eq: {archived: arch}, order: ['created_at', false], limit: 500, select: 'id,no,token,company,contact,phone,status,fees_monthly,discount,discount_pct,one_time,valid_until,sent_at,viewed_at,created_at,lead_id,data'}),
    db.q('contracts', {eq: {archived: arch}, order: ['created_at', false], limit: 500, select: 'id,no,token,status,title,party,fees_monthly,discount,one_time,sign_deadline,sent_at,viewed_at,signed_at,signer_name,created_at,lead_id,request_id'})]);
  const qq = (ui.dQ || '').trim().toLowerCase(), stf = ui.dSt || '';
  const qs = quotes.filter(r => inRange(r.created_at) && (!stf || r.status === stf) && (!qq || [r.company, r.contact, r.phone, '#' + r.no].some(x => String(x || '').toLowerCase().includes(qq))));
  const cs = cons.filter(c => inRange(c.created_at) && (!stf || c.status === stf) && (!qq || [c.party?.company, c.party?.contact, c.party?.phone, '#' + c.no].some(x => String(x || '').toLowerCase().includes(qq))));
  const filters = `<div class="card lfil"><div class="row">${chips([['all', 'كل الأوقات'], ['today', 'اليوم'], ['7', '7 أيام'], ['month', 'الشهر'], ['custom', 'مدة محددة']], ui.dMode || 'all', 'dMode')}
      ${ui.dMode === 'custom' ? `<label class="m">من <input type="date" id="ddf" class="inl" value="${esc(ui.dFrom || '')}" data-dchg="range"></label><label class="m">لـ <input type="date" id="ddt" class="inl" value="${esc(ui.dTo || '')}" data-dchg="range"></label>` : ''}</div>
    <div class="row"><select class="inl" data-dchg="st" aria-label="الحالة"><option value="">كل الحالات</option>${(tab === 'quotes' ? Q_ST : tab === 'contracts' ? C_ST : [...Q_ST, ...C_ST]).map(s => `<option ${s === stf ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input class="inl" type="search" data-dchg="q" placeholder="بحث بالاسم أو الرقم" value="${esc(ui.dQ || '')}" aria-label="بحث" style="flex:1;min-width:180px"></div></div>`;
  const kp = tab === 'contracts' ? `<div class="kpis">${kpi('عقود موقّعة', cons.filter(c => c.status === 'موقّع').length, jd(cons.filter(c => c.status === 'موقّع').reduce((a, c) => a + net(c), 0)) + ' شهرياً', 'hl')}${kpi('بانتظار التوقيع', cons.filter(c => c.status === 'مرسل').length, '', cons.some(c => c.status === 'مرسل' && c.sign_deadline && c.sign_deadline <= addDays(today(), 2)) ? 'red' : '')}${kpi('مسودات', cons.filter(c => c.status === 'مسودة').length)}</div>`
    : tab === 'quotes' ? `<div class="kpis">${kpi('عروض مرسلة', quotes.filter(r => r.status === 'عرض مرسل').length, quotes.filter(r => r.status === 'عرض مرسل' && !r.viewed_at).length + ' لسا ما فتحوه')}${kpi('مقبولة', quotes.filter(r => r.status === 'مقبول').length, '', 'hl')}${kpi('مسودات', quotes.filter(r => r.status === 'مسودة عرض').length)}</div>` : '';
  const qRows = qs.map(r => `<div class="drow"><div>${K.selBox('request', r.id)} <b>عرض #${r.no} · ${esc(r.company)}</b> ${pill(r.status, CLS[r.status])}
      <small class="m">${esc(r.contact || '')} ${r.phone ? '· <span dir="ltr">' + esc(r.phone) + '</span>' : ''} · ${fmtDT(r.created_at)}${r.status === 'عرض مرسل' ? ' · ' + (r.viewed_at ? 'فتحه ' + fmtDT(r.viewed_at) : 'لسا ما فتحه') + (r.valid_until ? ' · صالح لـ ' + r.valid_until : '') : ''}</small></div>
    <div class="dnum"><b>${jd(net(r))}</b><small class="m">شهرياً${N(r.discount_pct) ? ' · خصم ' + N(r.discount_pct) + '%' : ''}</small></div>
    <div class="lact"><button class="btn sm" data-act="oreqOpen" data-id="${r.id}">فتح</button>${r.phone ? `<button class="btn sm ghost" data-act="dWa" data-id="q|${r.id}">واتساب</button>` : ''}<button class="btn sm ghost" data-act="dCopy" data-id="q|${r.token}">نسخ الرابط</button><a class="btn sm ghost" href="${esc(qUrl(r.token))}&print=1" target="_blank" rel="noopener">تنزيل PDF</a>
      ${['عرض مرسل', 'مقبول'].includes(r.status) && can('leads', 'edit') ? `<button class="btn sm" data-act="ctFromQuote" data-id="${r.id}">عقد</button>` : ''}${can('leads', 'edit') ? `<button class="btn sm ghost" data-act="dArch" data-id="quote|${r.id}|${arch ? 0 : 1}">${arch ? 'رجّعه' : 'أرشفة'}</button>` : ''}</div></div>`).join('');
  const cRows = cs.map(c => `<div class="drow"><div>${K.selBox('contract', c.id)} <b>عقد #${c.no} · ${esc(c.party?.company || '')}</b> ${pill(c.status, CLS[c.status])}
      <small class="m">${esc(c.party?.contact || '')} · ${fmtDT(c.created_at)}${c.status === 'مرسل' ? ' · ' + (c.viewed_at ? 'فتحه ' + fmtDT(c.viewed_at) : 'لسا ما فتحه') + ' · آخر يوم للتوقيع ' + (c.sign_deadline || '') : ''}${c.status === 'موقّع' ? ' · وقّعه ' + esc(c.signer_name || '') + ' ' + fmtDT(c.signed_at) : ''}</small></div>
    <div class="dnum"><b>${jd(net(c))}</b><small class="m">شهرياً</small></div>
    <div class="lact"><button class="btn sm" data-act="ctOpen" data-id="${c.id}">فتح</button>${c.status !== 'مسودة' && c.party?.phone ? `<button class="btn sm ghost" data-act="dWa" data-id="c|${c.id}">واتساب</button>` : ''}<button class="btn sm ghost" data-act="dCopy" data-id="c|${c.token}">نسخ الرابط</button><a class="btn sm ghost" href="${esc(cUrl(c.token))}&print=1" target="_blank" rel="noopener">تنزيل PDF</a>
      ${can('leads', 'edit') ? `<button class="btn sm ghost" data-act="dArch" data-id="contract|${c.id}|${arch ? 0 : 1}">${arch ? 'رجّعه' : 'أرشفة'}</button>` : ''}</div></div>`).join('');
  ui.dCache = {quotes, cons};
  return docsHead(tab) + kp + filters +
    (tab === 'quotes' ? K.bulkBar('request', qs.map(r => r.id), false) + `<div class="llist">${qRows || '<p class="empty card">ما في عروض سعر هون. اعمل عرض من "العملاء المحتملين ← عرض سعر"</p>'}</div>`
      : tab === 'contracts' ? K.bulkBar('contract', cs.map(c => c.id), false) + `<div class="llist">${cRows || '<p class="empty card">ما في عقود. افتح عرض سعر مرسل أو مقبول واضغط "اعمل عقد"</p>'}</div>`
      : `<h2 style="margin:6px 0">العقود المؤرشفة</h2>${K.bulkBar('contract', cs.map(c => c.id), true)}<div class="llist">${cRows || '<p class="m">—</p>'}</div><h2 style="margin:14px 0 6px">العروض المؤرشفة</h2>${K.bulkBar('request', qs.map(r => r.id), true)}<div class="llist">${qRows || '<p class="m">—</p>'}</div>`);
};
const docsHead = tab => head('العروض والعقود', 'كل عروض الأسعار والعقود بمكان واحد: تنبعت واتساب، تتنزل PDF، وتتأرشف') +
  `<div class="ltabs" role="tablist">${[['contracts', 'العقود'], ['quotes', 'عروض الأسعار'], ['archive', 'الأرشيف'], ['settings', 'إعدادات العقد']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="ltab ${tab === k ? 'on' : ''}" data-act="dTab" data-id="${k}">${l}</button>`).join('')}</div>`;

document.addEventListener('change', e => {
  const t = e.target, k = t.dataset?.dchg; if (!k) return;
  if (k === 'st') { ui.dSt = t.value; K.render(); }
  if (k === 'q') { ui.dQ = t.value; K.render(); }
  if (k === 'range') { ui.dFrom = $('#ddf')?.value; ui.dTo = $('#ddt')?.value; if (ui.dFrom && ui.dTo) K.render(); }
});

/* ================= توقيع بالإصبع أو الماوس ================= */
function sigPad(cv) {
  if (!cv || !cv.getContext) return null; let ctx = null; try { ctx = cv.getContext('2d'); } catch (e) {} if (!ctx) return null;
  const fit = () => { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.max(300, r.width) * dpr; cv.height = Math.max(140, r.height) * dpr; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b2357'; };
  fit(); let down = false, last = null; cv.dataset.empty = '1';
  const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { down = true; last = pt(e); cv.setPointerCapture?.(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (!down) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; cv.dataset.empty = ''; e.preventDefault(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { down = false; }));
  return {clear: () => { ctx.clearRect(0, 0, cv.width, cv.height); cv.dataset.empty = '1'; }, empty: () => cv.dataset.empty === '1', data: () => cv.toDataURL('image/png')};
}

/* ================= محرر العقد ================= */
V.ctd = async () => {
  const [[c]] = await Promise.all([db.q('contracts', {eq: {id: ui.ctId}}), loadSite()]);
  if (!c) return head('عقد', '') + '<p class="note">العقد مش موجود.</p><div class="row"><button class="btn" data-act="go" data-id="docs">رجوع</button></div>';
  ui.ctCur = c;
  if (ui.ctFor !== c.id) { ui.ctFor = c.id; ui.ctD = {party: {...(c.party || {})}, clauses: (c.clauses || []).map(x => ({...x})), start_date: c.start_date || '', months: N(c.months) || 3, fees_monthly: N(c.fees_monthly), discount: N(c.discount), one_time: N(c.one_time), ad_budget: N(c.ad_budget), vat_mode: c.vat_mode, vat_rate: N(c.vat_rate), title: c.title, agency_signer: c.agency_signer || site().signer_name || '', agency_signer_title: c.agency_signer_title || site().signer_title || '', sig: undefined}; }
  const D = ui.ctD, lock = !['مسودة', 'مرسل'].includes(c.status) || !can('leads', 'edit'), dis = lock ? 'disabled' : '';
  const f = (k, l, v, t = 'text', w = '') => `<label class="fld ${w}"><span>${l}</span><input data-ct="${k}" type="${t}" ${t === 'number' ? 'step="any" min="0"' : ''} value="${esc(v ?? '')}" ${dis}></label>`;
  const p = D.party;
  return head(`عقد #${c.no} · ${esc(p.company || '')}`, c.status === 'مرسل' ? `انبعت ${fmtDT(c.sent_at)} · ${c.viewed_at ? 'العميل فتحه ' + fmtDT(c.viewed_at) : 'لسا ما فتحه'} · آخر يوم للتوقيع ${c.sign_deadline}` : c.status === 'موقّع' ? `وقّعه ${esc(c.signer_name)} ${fmtDT(c.signed_at)}` : 'مسودة: عدّل البنود والبيانات وبعدين ابعته للتوقيع',
      `<button class="btn" data-act="go" data-id="docs">رجوع</button>${c.request_id ? `<button class="btn" data-act="oreqOpen" data-id="${c.request_id}">عدّل عرض السعر</button>` : ''}<a class="btn" href="${esc(cUrl(c.token))}" target="_blank" rel="noopener">معاينة</a><a class="btn" href="${esc(cUrl(c.token))}&print=1" target="_blank" rel="noopener">تنزيل PDF</a>`) +
    `<div class="row">${pill(c.status, CLS[c.status])}${c.status === 'موقّع' ? `<span class="m">بصمة العقد: <code dir="ltr">${esc(String(c.sign_hash || '').slice(0, 16))}…</code>${c.sign_ip ? ' · الجهاز ' + esc(c.sign_ip) : ''}</span>` : ''}</div>
    ${c.status === 'موقّع' ? `<div class="card cdone"><h2>✅ العقد موقّع</h2><div class="sigs"><div><small class="m">الطرف الثاني</small>${c.signature ? `<img src="${esc(c.signature)}" alt="توقيع العميل">` : ''}<b>${esc(c.signer_name || '')}</b><small class="m">${esc(c.signer_title || '')} · ${fmtDT(c.signed_at)}${c.signer_phone ? ' · ' + esc(c.signer_phone) : ''}</small></div>
      <div><small class="m">الطرف الأول</small>${c.agency_signature ? `<img src="${esc(c.agency_signature)}" alt="توقيع الشركة">` : '<p class="m">بدون توقيع</p>'}<b>${esc(c.agency_signer || '')}</b><small class="m">${esc(c.agency_signer_title || '')}</small></div></div>
      <div class="row"><button class="btn pri" data-act="ctWa">ابعت نسخة واتساب</button><a class="btn" href="${esc(cUrl(c.token))}&print=1" target="_blank" rel="noopener">تنزيل PDF</a></div></div>` : ''}
    <div class="card"><h2>بيانات العقد</h2><div class="fgrid">${f('title', 'عنوان العقد', D.title, 'text', 'wide')}
      ${f('party.company', 'اسم العميل (الطرف الثاني)', p.company)}${f('party.contact', 'اسم المفوّض بالتوقيع', p.contact)}${f('party.signer_title', 'صفته', p.signer_title)}${f('party.phone', 'الهاتف (واتساب)', p.phone)}${f('party.email', 'الإيميل', p.email, 'email')}${f('party.cr_no', 'رقم السجل التجاري', p.cr_no)}${f('party.address', 'العنوان', p.address, 'text', 'wide')}
      ${f('start_date', 'تاريخ البدء', D.start_date, 'date')}${f('months', 'المدة (أشهر)', D.months, 'number')}${f('fees_monthly', 'الأتعاب الشهرية قبل الخصم', D.fees_monthly, 'number')}${f('discount', 'الخصم الشهري (د.أ)', D.discount, 'number')}${f('one_time', 'رسوم لمرة وحدة', D.one_time, 'number')}${f('ad_budget', 'ميزانية الإعلانات المقترحة', D.ad_budget, 'number')}
      <label class="fld"><span>الضريبة</span><select data-ct="vat_mode" ${dis}>${VAT.map(([v, l]) => `<option value="${v}" ${D.vat_mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${f('vat_rate', 'نسبة الضريبة %', D.vat_rate, 'number')}</div>
      <p class="m" style="margin-top:8px">الأتعاب بعد الخصم: <b>${jd(N(D.fees_monthly) - N(D.discount))}</b> شهرياً. إذا غيّرت الأرقام أو المدة اضغط "حدّث البنود بالأرقام الجديدة".</p></div>
    <div class="card"><div class="head" style="margin-bottom:8px"><h2>بنود العقد (${D.clauses.length})</h2>${lock ? '' : '<div class="row">' + (c.request_id ? '<button class="btn sm" data-act="ctSync">جيب الأسعار والخدمات من العرض</button>' : '') + '<button class="btn sm" data-act="ctReset">حدّث البنود بالأرقام الجديدة</button><button class="btn sm" data-act="ctClAdd">+ بند</button></div>'}</div>
      <div class="ccl">${D.clauses.map((x, i) => `<div class="ccli"><div class="row" style="margin:0;flex-wrap:nowrap"><b class="cnum">${i + 1}</b><input class="inl" style="flex:1;font-weight:700" data-cl="${i}" data-k="h" value="${esc(x.h)}" aria-label="عنوان البند ${i + 1}" ${dis}>${lock ? '' : `<button class="btn sm ghost" data-act="ctClMv" data-id="${i}|-1" aria-label="لفوق" ${i ? '' : 'disabled'}>↑</button><button class="btn sm ghost" data-act="ctClMv" data-id="${i}|1" aria-label="لتحت" ${i < D.clauses.length - 1 ? '' : 'disabled'}>↓</button><button class="btn sm ghost" data-act="ctClDel" data-id="${i}" aria-label="حذف">✕</button>`}</div>
        <textarea class="inl" rows="3" data-cl="${i}" data-k="t" aria-label="نص البند ${i + 1}" ${dis}>${esc(x.t)}</textarea></div>`).join('')}</div></div>
    ${c.status !== 'موقّع' ? `<div class="card"><h2>توقيع الشركة (الطرف الأول)</h2><div class="fgrid">${f('agency_signer', 'اسم الموقّع', D.agency_signer)}${f('agency_signer_title', 'صفته', D.agency_signer_title)}</div>
      ${(D.sig ?? c.agency_signature) ? `<div class="sigprev"><img src="${esc(D.sig ?? c.agency_signature)}" alt="توقيع الشركة">${lock ? '' : '<button class="btn sm ghost" data-act="ctSigClear">امسح التوقيع</button>'}</div>` : lock ? '<p class="m">بدون توقيع</p>' : `<canvas id="ctPad" class="sigpad" aria-label="ارسم التوقيع"></canvas><div class="row"><button class="btn sm ghost" data-act="ctPadClear">امسح</button>${site().agency_sign ? '<button class="btn sm" data-act="ctSigSaved">استعمل التوقيع المحفوظ</button>' : ''}<label class="ck"><input type="checkbox" id="ctSigDef"> <span>احفظه كتوقيع افتراضي للشركة</span></label></div>`}
      ${lock ? '' : `<div class="row" style="margin-top:14px"><button class="btn" data-act="ctSave">حفظ</button><button class="btn pri" data-act="ctSend" style="background:#1e8c63;border-color:#1e8c63">${c.status === 'مرسل' ? 'حفظ وإعادة الإرسال واتساب' : 'حفظ وإرسال للتوقيع واتساب'}</button><button class="btn ghost" data-act="ctCopy">نسخ رابط التوقيع</button>${c.status !== 'ملغي' ? '<button class="btn ghost" data-act="ctCancel">إلغاء العقد</button>' : ''}</div>
      <p class="note" style="margin-top:8px">العميل عنده 7 أيام من تاريخ الإرسال ليوقّع. بعدها الرابط بيوقف وبتقدر تبعته من جديد.</p>`}</div>` : ''}`;
};
document.addEventListener('input', e => {
  const t = e.target; if (!ui.ctD) return;
  if (t.dataset.ct) { const k = t.dataset.ct, v = t.type === 'number' ? N(t.value) : t.value; if (k.startsWith('party.')) ui.ctD.party[k.slice(6)] = v; else ui.ctD[k] = v; }
  if (t.dataset.cl != null) { const x = ui.ctD.clauses[N(t.dataset.cl)]; if (x) x[t.dataset.k] = t.value; }
});
document.addEventListener('change', e => { const t = e.target; if (ui.ctD && t.dataset?.ct === 'vat_mode') ui.ctD.vat_mode = t.value; });
// بعد ما يترسم المحرر، بنشغّل مربع التوقيع
const mo = new MutationObserver(() => { const cv = document.getElementById('ctPad'); if (cv && !cv._pad) cv._pad = sigPad(cv); });
if (document.body) mo.observe(document.body, {childList: true, subtree: true});

async function ctPersist(status) {
  const c = ui.ctCur, D = ui.ctD, pad = $('#ctPad')?._pad;
  let sig = D.sig; if (pad && !pad.empty()) sig = pad.data();
  if (sig && $('#ctSigDef')?.checked) { try { await db.upd('oops_site', {id: 1}, {config: {...site(), agency_sign: sig}}); ST.oSite.config.agency_sign = sig; } catch (e) { toast('ما انحفظ التوقيع الافتراضي (بدها صلاحية إعدادات الموقع)', true); } }
  const p = {title: D.title, party: D.party, start_date: D.start_date || null, months: N(D.months), fees_monthly: N(D.fees_monthly), discount: N(D.discount), one_time: N(D.one_time), ad_budget: N(D.ad_budget),
    vat_mode: D.vat_mode, vat_rate: N(D.vat_rate), clauses: D.clauses.filter(x => (x.h || '').trim() || (x.t || '').trim()), agency_signer: D.agency_signer, agency_signer_title: D.agency_signer_title};
  if (sig !== undefined) p.agency_signature = sig || '';
  if (status) p.status = status;
  const r = await db.rpc('contract_save', {cid: c.id, p}); ui.ctFor = null; return r;
}
const ctMsg = c => c.status === 'موقّع'
  ? `مرحبا ${c.party?.contact || c.party?.company || ''} 👋\nهاي نسخة العقد #${c.no} الموقّع مع ${brand()}. بتقدر تنزّلها PDF من هون:\n${cUrl(c.token)}\nأهلاً فيك معنا 🌟`
  : `مرحبا ${c.party?.contact || c.party?.company || ''} 👋\nهاد عقد الخدمات #${c.no} مع ${brand()} للتوقيع الإلكتروني:\n${cUrl(c.token)}\nبتقرأ البنود وبتوقّع من الموبايل بدقيقة. الرابط صالح لـ ${c.sign_deadline || '7 أيام'}.`;

Object.assign(ACT_SEC, {ctSync: 'leads', ctSave: 'leads', ctSend: 'leads', ctCancel: 'leads', ctReset: 'leads', ctClAdd: 'leads', ctClDel: 'leads', ctClMv: 'leads', ctSigClear: 'leads', ctSigSaved: 'leads', ctPadClear: 'leads', dArch: 'leads', dSetSave: 'oops', dTplReset: 'oops', dTplAdd: 'oops', dTplDel: 'oops', dGiftAdd: 'oops', dGiftDel: 'oops', dSigClear: 'oops'});
Object.assign(A, {
  dTab: k => { ui.dTab = k; ui.dSt = ''; K.render(); },
  dMode: k => { ui.dMode = k; K.render(); },
  dCopy: v => { const [k, tok] = v.split('|'); copyText(k === 'q' ? qUrl(tok) : cUrl(tok)); toast('انسخ الرابط'); },
  dArch: async v => { const [k, id, on] = v.split('|'); await db.rpc('doc_archive', {kind: k, did: id, v: on === '1'}); toast(on === '1' ? 'انأرشف' : 'رجع من الأرشيف'); K.render(); },
  dWa: v => { const [k, id] = v.split('|'), C = ui.dCache || {};
    if (k === 'q') { const r = (C.quotes || []).find(x => x.id === id); if (r) openWa(r.phone, `مرحبا ${r.contact || r.company} 👋\nهاد عرض السعر #${r.no} من ${brand()}:\n${qUrl(r.token)}`); }
    else { const c = (C.cons || []).find(x => x.id === id); if (c) openWa(c.party?.phone, ctMsg(c)); } },
  ctOpen: id => { ui.ctId = id; ui.ctFor = null; ui.view = 'ctd'; K.render(); window.scrollTo?.(0, 0); },
  ctSave: async () => { await ctPersist(); toast('انحفظ العقد'); K.render(); },
  ctSend: async () => {
    const D = ui.ctD; if (!(D.party.phone || '').trim()) return toast('حط رقم العميل أول', true);
    if (!(D.party.company || '').trim()) return toast('حط اسم العميل', true);
    const w = window.open('', '_blank');
    try { const r = await ctPersist('مرسل'), c = {...ui.ctCur, party: ui.ctD.party, status: 'مرسل', sign_deadline: addDays(today(), 7), ...(r && r.id ? r : {})}; const url = 'https://wa.me/' + waNum(c.party?.phone) + '?text=' + encodeURIComponent(ctMsg(c)); if (w) w.location.href = url; else location.href = url; toast('انبعت العقد للتوقيع. كمّل من واتساب'); K.render(); }
    catch (e) { w?.close?.(); throw e; }
  },
  ctWa: () => { const c = ui.ctCur; openWa(c.party?.phone, ctMsg(c)); },
  ctCopy: async () => { await ctPersist(); copyText(cUrl(ui.ctCur.token)); toast('انسخ رابط التوقيع. العقد لازم يكون "مرسل" عشان العميل يقدر يوقّع'); K.render(); },
  ctCancel: async () => { if (!confirm('أكيد بدك تلغي العقد؟')) return; await ctPersist('ملغي'); toast('انلغى العقد'); K.render(); },
  ctSync: async () => { await db.rpc('contract_sync_quote', {cid: ui.ctCur.id, reset_clauses: false}); ui.ctFor = null; toast('انجابت الأسعار والخدمات والهدايا والخطة من العرض. إذا بدك البنود بالأرقام الجديدة اضغط "حدّث البنود"'); K.render(); },
  ctReset: async () => { await ctPersist(); await db.rpc('contract_reset_clauses', {cid: ui.ctCur.id}); ui.ctFor = null; toast('انعملت البنود من جديد بالأرقام الحالية'); K.render(); },
  ctClAdd: () => { ui.ctD.clauses.push({h: 'بند جديد', t: ''}); K.render(); setTimeout(() => $(`[data-cl="${ui.ctD.clauses.length - 1}"][data-k=t]`)?.focus(), 30); },
  ctClDel: i => { ui.ctD.clauses.splice(N(i), 1); K.render(); },
  ctClMv: v => { const [i, d] = v.split('|').map(Number), L = ui.ctD.clauses, j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; K.render(); },
  ctSigClear: () => { ui.ctD.sig = ''; K.render(); },
  ctSigSaved: () => { ui.ctD.sig = site().agency_sign; K.render(); },
  ctPadClear: () => { $('#ctPad')?._pad?.clear(); }
});

/* ================= إعدادات العقد ================= */
async function settingsView() {
  const s = await loadSite(), c = s.config || {};
  if (ui.dSetFor !== s.updated_at) {
    ui.dSetFor = s.updated_at;
    let tpl = c.contract_clauses; if (!Array.isArray(tpl) || !tpl.length) { try { tpl = await db.rpc('contract_tpl_default', {}); } catch (e) { tpl = []; } }
    ui.dSet = {tpl: (tpl || []).map(x => ({...x})), gifts: (c.quote_gifts || []).map(g => ({...g})), sig: c.agency_sign || ''};
  }
  const S = ui.dSet, ed = can('oops', 'edit'), dis = ed ? '' : 'disabled';
  const f = (k, l, ph = '', w = '') => `<label class="fld ${w}" for="ds_${k}"><span>${l}</span><input id="ds_${k}" value="${esc(c[k] ?? '')}" placeholder="${esc(ph)}" ${dis}></label>`;
  return `${ed ? '' : '<p class="warnbar">بتقدر تشوف بس. التعديل بده صلاحية "موقع الوكالة".</p>'}
    <div class="card"><h2>البيانات الرسمية للورقة المروّسة</h2><p class="m">بتطلع فوق العقد وعرض السعر مع الشعار (الشعار من الإعدادات ← الشعارات).</p><div class="fgrid">
      ${f('legal_name', 'الاسم القانوني للشركة', 'مثلاً: شركة أوبسايد للتسويق ذ.م.م')}${f('cr', 'رقم السجل التجاري')}${f('tax_no', 'الرقم الضريبي')}${f('address', 'العنوان', 'عمّان، ...', 'wide')}${f('phone', 'الهاتف')}${f('email', 'الإيميل')}
      ${f('signer_name', 'اسم المفوّض بالتوقيع عن الشركة', 'وليد الصابر')}${f('signer_title', 'صفته', 'المدير العام')}<label class="fld" for="ds_contract_months"><span>مدة العقد الافتراضية (أشهر)</span><input id="ds_contract_months" type="number" min="1" value="${esc(c.contract_months ?? 3)}" ${dis}></label></div></div>
    <div class="card"><h2>توقيع الشركة الافتراضي</h2><p class="m">بينحط لحاله على كل عقد بتبعته (إذا ما وقّعت عليه بإيدك).</p>
      ${S.sig ? `<div class="sigprev"><img src="${esc(S.sig)}" alt="التوقيع">${ed ? '<button class="btn sm ghost" data-act="dSigClear">امسح وارسم من جديد</button>' : ''}</div>` : ed ? '<canvas id="dsPad" class="sigpad" aria-label="ارسم التوقيع"></canvas><div class="row"><button class="btn sm ghost" data-act="dPadClear">امسح</button></div>' : '<p class="m">ما في توقيع</p>'}</div>
    <div class="card"><div class="head" style="margin-bottom:8px"><h2>🎁 الهدايا الافتراضية بعروض الأسعار</h2>${ed ? '<button class="btn sm" data-act="dGiftAdd">+ هدية</button>' : ''}</div>
      ${S.gifts.map((g, i) => `<div class="row" style="margin:0 0 6px;flex-wrap:nowrap"><input class="inl" style="flex:1" data-dg="${i}" data-k="name" value="${esc(g.name)}" aria-label="الهدية" ${dis}><input class="inl" style="width:100px" type="number" min="0" step="any" data-dg="${i}" data-k="value" value="${N(g.value)}" aria-label="القيمة" ${dis}>${ed ? `<button class="btn sm ghost" data-act="dGiftDel" data-id="${i}" aria-label="حذف">✕</button>` : ''}</div>`).join('') || '<p class="m">ما في هدايا افتراضية.</p>'}</div>
    <div class="card"><div class="head" style="margin-bottom:8px"><h2>بنود العقد الافتراضية (${S.tpl.length})</h2>${ed ? '<div class="row"><button class="btn sm ghost" data-act="dTplReset">رجّع البنود الأصلية</button><button class="btn sm" data-act="dTplAdd">+ بند</button></div>' : ''}</div>
      <p class="m">بتقدر تستعمل: <code>{المدة}</code> <code>{تاريخ_البدء}</code> <code>{الأتعاب}</code> <code>{الضريبة}</code> <code>{رسوم_مرة}</code> <code>{ميزانية_الإعلانات}</code> <code>{العميل}</code> <code>{الوكالة}</code> <code>{رقم_العرض}</code>، وبتتعبى لحالها بكل عقد جديد. التعديل هون ما بيغيّر العقود القديمة.</p>
      <div class="ccl">${S.tpl.map((x, i) => `<div class="ccli"><div class="row" style="margin:0;flex-wrap:nowrap"><b class="cnum">${i + 1}</b><input class="inl" style="flex:1;font-weight:700" data-dt="${i}" data-k="h" value="${esc(x.h)}" aria-label="عنوان البند" ${dis}>${ed ? `<button class="btn sm ghost" data-act="dTplDel" data-id="${i}" aria-label="حذف">✕</button>` : ''}</div><textarea class="inl" rows="3" data-dt="${i}" data-k="t" aria-label="نص البند" ${dis}>${esc(x.t)}</textarea></div>`).join('')}</div></div>
    ${ed ? '<div class="row"><button class="btn pri" data-act="dSetSave">حفظ الإعدادات</button></div>' : ''}
    <p class="note">البنود مكتوبة على أساس عقود وكالات التسويق المعروفة وقانون المعاملات الإلكترونية الأردني. للعقود الكبيرة أو خارج الأردن، خلي محامي يراجعها مرة وحدة.</p>`;
}
document.addEventListener('input', e => {
  const t = e.target; if (!ui.dSet) return;
  if (t.dataset.dg != null) { const g = ui.dSet.gifts[N(t.dataset.dg)]; if (g) g[t.dataset.k] = t.dataset.k === 'value' ? N(t.value) : t.value; }
  if (t.dataset.dt != null) { const x = ui.dSet.tpl[N(t.dataset.dt)]; if (x) x[t.dataset.k] = t.value; }
});
const mo2 = new MutationObserver(() => { const cv = document.getElementById('dsPad'); if (cv && !cv._pad) cv._pad = sigPad(cv); });
if (document.body) mo2.observe(document.body, {childList: true, subtree: true});
Object.assign(A, {
  dGiftAdd: () => { ui.dSet.gifts.push({name: '', value: 0}); K.render(); },
  dGiftDel: i => { ui.dSet.gifts.splice(N(i), 1); K.render(); },
  dTplAdd: () => { ui.dSet.tpl.push({h: 'بند جديد', t: ''}); K.render(); },
  dTplDel: i => { ui.dSet.tpl.splice(N(i), 1); K.render(); },
  dTplReset: async () => { ui.dSet.tpl = (await db.rpc('contract_tpl_default', {})) || []; toast('رجعت البنود الأصلية. اضغط حفظ'); K.render(); },
  dSigClear: () => { ui.dSet.sig = ''; K.render(); },
  dPadClear: () => { $('#dsPad')?._pad?.clear(); },
  dSetSave: async () => {
    const s = await loadSite(), g = k => $('#ds_' + k)?.value.trim() ?? '', pad = $('#dsPad')?._pad;
    let sig = ui.dSet.sig; if (pad && !pad.empty()) sig = pad.data();
    const config = {...s.config, legal_name: g('legal_name'), cr: g('cr'), tax_no: g('tax_no'), address: g('address'), phone: g('phone'), email: g('email'),
      signer_name: g('signer_name'), signer_title: g('signer_title'), contract_months: Math.max(1, N(g('contract_months')) || 3), agency_sign: sig || '',
      quote_gifts: ui.dSet.gifts.filter(x => (x.name || '').trim()).map(x => ({name: x.name.trim(), value: N(x.value)})),
      contract_clauses: ui.dSet.tpl.filter(x => (x.h || '').trim() || (x.t || '').trim())};
    await db.upd('oops_site', {id: 1}, {config, updated_at: new Date().toISOString()}); ui.dSetFor = null; toast('انحفظت إعدادات العقد'); K.render();
  }
});
})();
