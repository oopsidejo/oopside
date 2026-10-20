/* صابر أونلاين ERP — موقع الوكالة (OOPSIDE)
   طلبات الموقع وعروض الأسعار، من الإعلان للإيراد، الخدمات والأسعار، الهوية والشعار والبكسل. */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmt, jd, pct, sum, today, addDays, fmtDT, pill, kpi, head, table, chips, toast, openForm, closeM, copyText, can, isAdmin, isClient, V, A, ST, ui, ACT_SEC, wsName} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});
const me = () => K.me;
const PT = {monthly: 'شهري ثابت', unit: 'بالقطعة', one_time: 'مرة وحدة', pct_spend: 'نسبة من صرف الإعلانات', team: 'فريق الرد (بالساعات)', quote: 'بعد جلسة (عرض مخصص)'};
const RS_CLS = {'جديد': 'warn', 'مسودة عرض': 'info', 'عرض مرسل': 'brand', 'مقبول': 'good', 'مرفوض': 'bad', 'منتهي': ''};
const ASK = [['', 'بدون سؤال إضافي'], ['sales', 'يسأل عن المبيعات'], ['msgs', 'يسأل عن الرسائل'], ['text', 'يطلب وصف']];
const siteUrl = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'o.html';
const quoteUrl = tok => siteUrl() + '?q=' + tok;
const margin = (rev, cost) => rev > 0 ? (rev - cost) / rev : null;
const sel = (id, list, cur, attrs = '') => `<select id="${id}" class="inl" ${attrs}>${list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

Object.assign(ACT_SEC, {qSave: 'leads', qSend: 'leads', qAdd: 'leads', qDel: 'leads', qMark: 'leads', svcForm: 'oops', svcPub: 'oops', siteSave: 'oops', siteLive: 'oops',
  probAdd: 'oops', probDel: 'oops', benchForm: 'oops', benchUse: 'oops', logoDel: 'settings', trackSave: 'settings'});

async function loadSite() { try { ST.oSite = (await db.q('oops_site', {eq: {id: 1}}))[0] || {config: {}}; } catch (e) { ST.oSite = {config: {}}; } return ST.oSite; }
const probLabel = k => (ST.oSite?.config?.problems || []).find(p => p.k === k)?.l || k;

/* ---------- شارة الطلبات الجديدة ---------- */
async function oBadge() {
  if (!K.me || isClient() || !can('leads')) return;
  try { const n = (await db.q('oops_requests', {eq: {status: 'جديد'}, select: 'id'})).length; K.badges.oreq = n || ''; K.badgeRed.oreq = false;
    const b = document.querySelector('#nav [data-act=go][data-id="oreq"]'); if (b) { let em = b.querySelector('em'); if (!n) em?.remove(); else { if (!em) { em = document.createElement('em'); b.appendChild(em); } em.textContent = n; em.className = ''; } } } catch (e) {}
}
K.onEnter.push(() => { oBadge(); loadSite(); });
K.liveIgnore.add('oops_requests');
Object.assign(K.liveViews, {oreq: ['oops_requests'], oreqd: ['oops_requests'], agdash: ['oops_requests']});
K.onLive.push((t, p) => {
  if (t !== 'oops_requests') return;
  if (p?.eventType === 'INSERT' && can('leads')) toast('وصل طلب جديد من موقع الوكالة #' + (p.new?.no || ''));
  if (p?.eventType === 'UPDATE' && can('leads') && ['مقبول','مرفوض'].includes(p.new?.status) && p.old?.status !== p.new?.status) toast((p.new.company || 'عميل') + (p.new.status === 'مقبول' ? ' وافق على العرض' : ' رد على العرض'));
  clearTimeout(oBadge.t); oBadge.t = setTimeout(oBadge, 1200);
});

/* ================= طلبات الموقع ================= */
V.oreq = async () => {
  const f = ui.oreqF || 'مفتوحة', o = {order: ['created_at', false], limit: 300};
  if (f === 'مفتوحة') o.in = {status: ['جديد','مسودة عرض','عرض مرسل']}; else if (f !== 'الكل') o.eq = {status: f};
  const [list, site, all] = await Promise.all([db.q('oops_requests', o), loadSite(), db.q('oops_requests', {select: 'status,created_at,fees_monthly,discount', limit: 2000})]);
  const mm = N(site.config?.min_margin ?? 30) / 100, m0 = today().slice(0, 7);
  const rev = r => N(r.fees_monthly) - N(r.discount) + N(r.one_time);
  return head('طلبات الموقع', 'الشركات اللي بنت باقتها من موقع الوكالة. افتح الطلب، عدّل العرض، وابعتله الرابط',
      `<a class="btn" href="${esc(siteUrl())}" target="_blank" rel="noopener">افتح موقع الوكالة</a><button class="btn" data-act="oCopySite">انسخ رابط الموقع</button>`) +
    (site.live === false ? `<div class="warnbar">الموقع لسا <b>مطفي</b>، والزباين ما بيقدروا يبعتوا طلبات. راجع الأسعار من <button class="lnk" data-act="go" data-id="oops">موقع الوكالة والأسعار</button> وبعدين شغّله.</div>` : '') +
    `<div class="kpis">${kpi('طلبات جديدة', all.filter(r => r.status === 'جديد').length, 'لازم تتراجع', all.some(r => r.status === 'جديد') ? 'red' : '')}${kpi('عروض بانتظار الرد', all.filter(r => r.status === 'عرض مرسل').length)}
      ${kpi('وافقوا هالشهر', all.filter(r => r.status === 'مقبول' && String(r.created_at).slice(0, 7) === m0).length, '', 'hl')}${kpi('قيمة العروض المفتوحة', jd(sum(all.filter(r => ['جديد','مسودة عرض','عرض مرسل'].includes(r.status)), r => N(r.fees_monthly) - N(r.discount))), 'شهرياً')}</div>` +
    chips([['مفتوحة','المفتوحة'], ['جديد','جديدة'], ['عرض مرسل','بانتظار الرد'], ['مقبول','مقبولة'], ['مرفوض','مرفوضة'], ['الكل','الكل']], f, 'oreqF') +
    table([{h:'رقم', f:r => `<button class="btn sm" data-act="oreqOpen" data-id="${r.id}">#${r.no}</button>`}, {h:'التاريخ', f:r => fmtDT(r.created_at)},
      {h:'الشركة', f:r => `<b>${esc(r.company)}</b><br><small class="m">${esc(r.contact || '')} ${esc(r.phone)}</small>`}, {h:'القطاع', f:r => esc(r.sector || '—')},
      {h:'المشاكل', f:r => esc((r.data?.problems || []).slice(0, 2).map(probLabel).join('، ') + ((r.data?.problems || []).length > 2 ? ' +' + ((r.data.problems.length) - 2) : '')), c: 'wrap'},
      {h:'أتعاب شهرية', f:r => `<b>${jd(N(r.fees_monthly) - N(r.discount))}</b>${N(r.one_time) ? `<br><small class="m">+ ${jd(r.one_time)} مرة وحدة</small>` : ''}`}, {h:'إعلانات', f:r => jd(r.ad_budget)},
      {h:'الهامش', f:r => { const g = margin(rev(r), N(r.cost_total)); return g == null ? '—' : `<span class="${g < mm ? 'margin-bad' : ''}">${pct(g)}</span>`; }},
      {h:'المصدر', f:r => esc(r.utm?.utm_source || r.utm?.ref || 'مباشر') + (r.utm?.utm_campaign ? `<br><small class="m">${esc(r.utm.utm_campaign)}</small>` : '')},
      {h:'الحالة', f:r => pill(r.status, RS_CLS[r.status]) + (r.status === 'عرض مرسل' ? `<br><small class="m">${r.viewed_at ? 'شافه ' + fmtDT(r.viewed_at) : 'لسا ما فتحه'}</small>` : '')}], list, 'ما في طلبات هون. شارك رابط الموقع بإعلاناتك عشان تبلش توصل');
};

V.oreqd = async () => {
  const [[r], site, svcs] = await Promise.all([db.q('oops_requests', {eq: {id: ui.oreqId}}), loadSite(), db.q('services', {eq: {active: true}, order: ['sort', true]})]);
  if (!r) return head('طلب من الموقع', '') + '<p class="note">الطلب مش موجود.</p><div class="row"><button class="btn" data-act="go" data-id="oreq">رجوع للطلبات</button></div>';
  ST.oSvcs = svcs; ui.oreqCur = r;
  if (ui.qFor !== r.id || ui.qDirtyFor !== r.id) { ui.qFor = r.id; ui.qDirtyFor = r.id; ui.qL = (r.items || []).map(x => ({...x})); ui.qD = {discount: N(r.discount), valid_until: r.valid_until || addDays(today(), 14), terms: r.terms || site.config?.terms || '', notes: r.notes || '', ad_budget: N(r.ad_budget)}; }
  const d = r.data || {}, a = d.answers || {}, u = r.utm || {};
  const kv = (l, v) => v ? `<div class="kv"><span>${l}</span><b>${v}</b></div>` : '';
  const locked = ['مقبول','مرفوض'].includes(r.status);
  return head(`طلب #${r.no} · ${esc(r.company)}`, `وصل ${fmtDT(r.created_at)}. ${r.status === 'عرض مرسل' ? (r.viewed_at ? 'العميل فتح العرض ' + fmtDT(r.viewed_at) : 'العميل لسا ما فتح العرض') : ''}`,
      `<button class="btn" data-act="go" data-id="oreq">رجوع</button><button class="btn" data-act="oCopyQuote" data-id="${esc(r.token)}">انسخ رابط العميل</button><a class="btn" href="${esc(quoteUrl(r.token))}" target="_blank" rel="noopener">شوف اللي بيشوفه العميل</a>${r.lead_id ? '<button class="btn" data-act="go" data-id="leads">العملاء المحتملين</button>' : ''}`) +
    `<div class="row">${pill(r.status, RS_CLS[r.status])}${r.answer_note ? `<span class="note" style="margin:0">رد العميل: <b>${esc(r.answer_note)}</b></span>` : ''}</div>
    <div class="cols reqinfo"><div class="card"><h2>عن الشركة</h2>${kv('المسؤول', esc(r.contact || ''))}${kv('الهاتف', `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`)}${kv('الإيميل', r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '')}
      ${kv('القطاع', esc(r.sector || ''))}${kv('المدينة', esc(d.city || ''))}${kv('الشركة', esc(d.stage || ''))}${kv('شركة تسويق؟', esc(d.agency_now || ''))}${kv('الصفحة أو الموقع', d.website ? `<a href="${esc(/^https?:/.test(d.website) ? d.website : 'https://' + d.website)}" target="_blank" rel="noopener nofollow">${esc(d.website)}</a>` : '')}
      ${kv('موافق على عروض', d.marketing_ok ? 'نعم' : '')}${kv('المصدر', esc([u.utm_source || u.ref, u.utm_campaign, u.utm_content].filter(Boolean).join(' · ')))}</div>
     <div class="card"><h2>المشكلة والميزانية</h2><ul class="todo" style="margin:0 0 10px">${(d.problems || []).map(k => `<li><span>${esc(probLabel(k))}</span></li>`).join('')}${d.problem_other ? `<li><span>${esc(d.problem_other)}</span></li>` : ''}</ul>
      ${kv('طلبات بالشهر', esc(a.orders || ''))}${kv('متوسط الطلب', a.aov ? jd(a.aov) : '')}${kv('رسائل باليوم', esc(a.msgs || ''))}${kv('ساعات الرد', a.hours ? esc(a.hours) + ' ساعات' : '')}${kv('عن المنتج أو المشروع', esc(a.text || ''))}
      ${kv('الميزانية الشهرية', jd(d.budget_total) + (d.includes_ads ? ' (بتشمل الإعلانات)' : ' (أتعاب بس)'))}${kv('للإعلانات', jd(r.ad_budget))}</div></div>
    <div class="card"><div class="head" style="margin-bottom:10px"><h2>عرض السعر</h2>${locked ? '' : `<div class="row">${sel('qAddSel', [['', 'أضف خدمة من القائمة'], ...svcs.map(s => [s.id, s.name]), ['__free', 'سطر حر']], '')}<button class="btn sm" data-act="qAdd">أضف</button></div>`}</div>
      <div class="tw"><table class="qedit"><thead><tr><th>الخدمة</th><th>الكمية</th><th>شهري</th><th>مرة وحدة</th><th>تكلفتنا (داخلي)</th><th>ملاحظة للعميل</th><th></th></tr></thead><tbody>
      ${ui.qL.map((l, i) => `<tr><td><input class="inl" data-ql="${i}" data-k="name" value="${esc(l.name)}" aria-label="الخدمة" ${locked ? 'disabled' : ''}></td><td><input class="inl" style="width:64px" type="number" min="1" data-ql="${i}" data-k="qty" value="${N(l.qty) || 1}" aria-label="الكمية" ${locked ? 'disabled' : ''}></td>
        <td><input class="inl" style="width:90px" type="number" step="any" data-ql="${i}" data-k="monthly" value="${N(l.monthly)}" aria-label="شهري" ${locked ? 'disabled' : ''}>${l.quote ? '<br><small class="neg">لازم تسعير</small>' : ''}</td><td><input class="inl" style="width:90px" type="number" step="any" data-ql="${i}" data-k="one_time" value="${N(l.one_time)}" aria-label="مرة وحدة" ${locked ? 'disabled' : ''}></td>
        <td><input class="inl" style="width:90px" type="number" step="any" data-ql="${i}" data-k="cost" value="${N(l.cost)}" aria-label="التكلفة" ${locked ? 'disabled' : ''}></td><td><input class="inl" data-ql="${i}" data-k="note" value="${esc(l.note || '')}" aria-label="ملاحظة" ${locked ? 'disabled' : ''}></td>
        <td>${locked ? '' : `<button class="btn sm ghost" data-act="qDel" data-id="${i}" aria-label="حذف">✕</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">ما في بنود</td></tr>'}</tbody></table></div>
      <div class="fgrid" style="margin-top:12px"><label class="fld" for="qd_discount"><span>خصم شهري (د.أ)</span><input id="qd_discount" data-qd="discount" type="number" step="any" min="0" value="${ui.qD.discount}" ${locked ? 'disabled' : ''}></label>
        <label class="fld" for="qd_ad"><span>ميزانية الإعلانات المقترحة</span><input id="qd_ad" data-qd="ad_budget" type="number" step="any" min="0" value="${ui.qD.ad_budget}" ${locked ? 'disabled' : ''}></label>
        <label class="fld" for="qd_valid"><span>العرض صالح لـ</span><input id="qd_valid" data-qd="valid_until" type="date" value="${esc(ui.qD.valid_until || '')}" ${locked ? 'disabled' : ''}></label>
        <label class="fld wide" for="qd_notes"><span>رسالة للعميل فوق العرض</span><textarea id="qd_notes" data-qd="notes" rows="2" ${locked ? 'disabled' : ''}>${esc(ui.qD.notes)}</textarea></label>
        <label class="fld wide" for="qd_terms"><span>الشروط</span><textarea id="qd_terms" data-qd="terms" rows="3" ${locked ? 'disabled' : ''}>${esc(ui.qD.terms)}</textarea></label></div>
      <div id="qSum" style="margin-top:12px">${qSum()}</div>
      ${locked ? '' : `<div class="row" style="margin-top:12px"><button class="btn" data-act="qSave">حفظ مسودة</button><button class="btn pri" data-act="qSend">حفظ وإرسال للعميل</button>${r.status === 'عرض مرسل' ? '<button class="btn ghost" data-act="qMark" data-id="مقبول">وافق بالتلفون</button><button class="btn ghost" data-act="qMark" data-id="مرفوض">رفض</button>' : ''}</div>`}
      <p class="note" style="margin-top:10px">التكلفة الداخلية والهامش ما بيطلعوا للعميل. ميزانية الإعلانات مش من دخل الوكالة.</p></div>
    <details class="card"><summary><b>طلب العميل الأصلي (نسخة ثابتة وقت الإرسال)</b></summary>${table([{h:'الخدمة', f:x => esc(x.name)}, {h:'الكمية', f:x => x.ptype === 'team' ? x.qty + ' موظفة · ' + (x.opts?.hours || '') + ' س × ' + (x.opts?.days || '') + ' أيام · ' + esc((x.opts?.channels || []).join('، ')) : x.qty}, {h:'شهري', f:x => x.quote ? 'بعد جلسة' : jd(x.monthly)}, {h:'مرة وحدة', f:x => jd(x.one_time)}, {h:'تكلفتنا', f:x => jd(x.cost)}], r.request_items || [])}</details>`;
};
function qSum() {
  const fees = sum(ui.qL, l => l.monthly), one = sum(ui.qL, l => l.one_time), cost = sum(ui.qL, l => l.cost), disc = N(ui.qD.discount);
  const rev = fees - disc + one, g = margin(rev, cost), mm = N(ST.oSite?.config?.min_margin ?? 30) / 100;
  return `<div class="kpis">${kpi('أتعاب شهرية بعد الخصم', jd(fees - disc), disc ? 'قبل الخصم ' + jd(fees) : '', 'hl')}${kpi('رسوم لمرة وحدة', jd(one))}${kpi('تكلفتنا التقديرية', jd(cost))}
    ${kpi('الهامش', g == null ? '—' : pct(g), g != null && g < mm ? 'أقل من الحد (' + pct(mm) + ')' : 'الحد ' + pct(mm), g != null && g < mm ? 'red' : '')}${kpi('صرف العميل الشهري', jd(fees - disc + N(ui.qD.ad_budget)), 'مع الإعلانات')}</div>
    ${disc && g != null ? `<p class="note" style="margin-top:6px">الخصم بيقلل ربحك ${jd(disc)} بالشهر.</p>` : ''}${ui.qL.some(l => l.quote && !N(l.monthly) && !N(l.one_time)) ? '<p class="warnbar" style="margin-top:8px">في بند "بعد جلسة" لسا بدون سعر. حطله سعر قبل الإرسال.</p>' : ''}`;
}
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ql != null) { const l = ui.qL[N(t.dataset.ql)]; if (!l) return; const k = t.dataset.k; l[k] = ['qty','monthly','one_time','cost'].includes(k) ? N(t.value) : t.value; if (['monthly','one_time'].includes(k) && N(t.value)) l.quote = false; const s = $('#qSum'); if (s) s.innerHTML = qSum(); return; }
  if (t.dataset.qd) { ui.qD[t.dataset.qd] = ['discount','ad_budget'].includes(t.dataset.qd) ? N(t.value) : t.value; const s = $('#qSum'); if (s) s.innerHTML = qSum(); }
});
async function qPersist(status) {
  const r = ui.oreqCur;
  const saved = await db.rpc('oops_quote_save', {rid: r.id, p: {items: ui.qL, discount: N(ui.qD.discount), ad_budget: N(ui.qD.ad_budget), valid_until: ui.qD.valid_until || null, terms: ui.qD.terms, notes: ui.qD.notes, status}});
  ui.qFor = null; return saved;
}
Object.assign(A, {
  oreqF: k => { ui.oreqF = k; K.render(); },
  oreqOpen: id => { ui.oreqId = id; ui.qFor = null; ui.view = 'oreqd'; K.render(); window.scrollTo?.(0, 0); },
  oCopySite: () => copyText(siteUrl()),
  oCopyQuote: tok => copyText(quoteUrl(tok)),
  qAdd: () => {
    const v = $('#qAddSel')?.value; if (!v) return toast('اختار خدمة', true);
    if (v === '__free') { ui.qL.push({name: 'خدمة إضافية', qty: 1, monthly: 0, one_time: 0, cost: 0}); K.render(); return; }
    const s = ST.oSvcs.find(x => x.id === v); const pr = window.OopsPrice ? window.OopsPrice.price(s, null, N(ui.qD.ad_budget), {}) : {qty: 1, monthly: N(s.price), one_time: 0, cost: N(s.cost)};
    ui.qL.push({service_id: s.id, name: s.name, category: s.category, ptype: s.ptype, unit: s.unit, qty: pr.qty, monthly: pr.monthly, one_time: pr.one_time, cost: pr.cost, quote: pr.quote, includes: s.includes});
    K.render();
  },
  qDel: i => { ui.qL.splice(N(i), 1); K.render(); },
  qSave: async () => { await qPersist(ui.oreqCur.status === 'جديد' ? 'مسودة عرض' : ui.oreqCur.status); toast('انحفظ العرض'); K.render(); oBadge(); },
  qSend: async () => {
    if (!ui.qL.length) return toast('أضف بند واحد على الأقل', true);
    if (ui.qL.some(l => l.quote && !N(l.monthly) && !N(l.one_time))) return toast('في بند لسا بدون سعر', true);
    const r = await qPersist('عرض مرسل'); copyText(quoteUrl(r.token || ui.oreqCur.token)); toast('انبعت العرض وانسخ رابط العميل. ابعتله إياه'); K.render(); oBadge();
  },
  qMark: async st => { await qPersist(st); toast('انحفظت الحالة'); K.render(); }
});

/* ================= من الإعلان للإيراد ================= */
V.funnel = async () => {
  const d = ui.fnDays || 90, from = addDays(today(), -(d - 1));
  const [rows, lost] = await Promise.all([db.rpc('lead_funnel', {d_from: from, d_to: today()}), db.q('leads', {eq: {stage: 'خسرناه'}, gte: {created_at: from}, select: 'lost_reason'})]);
  const R = (rows || []).map(r => ({...r, leads: N(r.leads), contacted: N(r.contacted), meetings: N(r.meetings), quotes: N(r.quotes), won: N(r.won), lost: N(r.lost), contract_value: N(r.contract_value), collected: N(r.collected), pipeline: N(r.pipeline)}));
  const T = k => sum(R, r => r[k]);
  const why = {}; lost.forEach(l => { const k = l.lost_reason || 'بدون سبب مسجّل'; why[k] = (why[k] || 0) + 1; });
  const mx = Math.max(1, ...Object.values(why));
  const rate = (a, b) => b ? pct(a / b) : '—';
  return head('من الإعلان للإيراد', 'كل عميل محتمل مربوط بالمصدر والحملة اللي جابته، لحد الاجتماع والعرض والعقد والفلوس اللي انقبضت فعلاً',
      `<div class="chips">${[[30, '30 يوم'], [90, '90 يوم'], [365, 'سنة']].map(([k, l]) => `<button class="chip ${d === k ? 'on' : ''}" data-act="fnDays" data-id="${k}">${l}</button>`).join('')}</div>`) +
    `<div class="kpis">${kpi('عملاء محتملين', T('leads'))}${kpi('وصلوا لاجتماع', T('meetings'), rate(T('meetings'), T('leads')))}${kpi('استلموا عرض', T('quotes'), rate(T('quotes'), T('leads')))}
      ${kpi('تعاقدنا', T('won'), 'نسبة التعاقد ' + rate(T('won'), T('leads')), 'hl')}${kpi('قيمة العقود الشهرية', jd(T('contract_value')))}${kpi('انقبض فعلاً', jd(T('collected')), 'فواتير مدفوعة')}</div>` +
    table([{h:'المصدر', f:r => `<b>${esc(r.source)}</b>`}, {h:'الحملة', f:r => esc(r.campaign)}, {h:'عملاء محتملين', f:r => r.leads}, {h:'تواصلنا', f:r => r.contacted}, {h:'اجتماع', f:r => r.meetings}, {h:'عرض سعر', f:r => r.quotes},
      {h:'تعاقد', f:r => `<b>${r.won}</b>`}, {h:'نسبة التعاقد', f:r => rate(r.won, r.leads)}, {h:'قيمة العقود/شهر', f:r => jd(r.contract_value)}, {h:'انقبض فعلاً', f:r => `<b class="${r.collected ? 'pos' : ''}">${jd(r.collected)}</b>`},
      {h:'بالمتابعة', f:r => jd(r.pipeline)}], R, 'ما في عملاء محتملين بهالفترة') +
    `<div class="cols"><div class="card"><h2>ليش خسرنا</h2>${Object.keys(why).length ? `<div class="bars">${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><span class="tr"><i style="width:${v / mx * 100}%"></i></span><b>${v}</b></div>`).join('')}</div>` : '<p class="note">ما في خسارات مسجّلة بهالفترة.</p>'}</div>
     <div class="card"><h2>كيف تعرف أي حملة جابت العقد</h2><ol class="todo"><li>${pill('1', 'info')}<span>بإعلاناتك على رابط الموقع زيد: <b dir="ltr">?utm_source=facebook&amp;utm_campaign=اسم-الحملة</b></span></li>
      <li>${pill('2', 'info')}<span>أي طلب من الموقع بيصير عميل محتمل ومعه المصدر والحملة لحاله.</span></li><li>${pill('3', 'info')}<span>حرّك العميل المحتمل بالمراحل. النظام بيتذكر أبعد مرحلة وصلها حتى لو خسرناه بعدين.</span></li>
      <li>${pill('4', 'good')}<span>لما يتعاقد ويدفع فواتيره، المبلغ بيطلع هون تحت الحملة اللي جابته.</span></li></ol></div></div>`;
};
A.fnDays = k => { ui.fnDays = N(k); K.render(); };

/* ================= موقع الوكالة والأسعار ================= */
const priceText = s => ({monthly: jd(s.price) + ' شهرياً', unit: jd(s.price) + ' / ' + (s.unit || 'وحدة') + ` (${s.min_qty}–${s.max_qty})`, one_time: jd(s.price) + ' مرة وحدة',
  pct_spend: N(s.pct) + '% من الإعلانات، أقل إشي ' + jd(s.min_fee) + (N(s.max_fee) ? '، أكثر إشي ' + jd(s.max_fee) : ''), team: jd(s.params?.hour_rate) + ' للساعة + ' + jd(s.params?.channel_fee) + ' لكل قناة إضافية، أقل إشي ' + jd(s.min_fee), quote: 'بعد جلسة'})[s.ptype] + (N(s.setup_fee) ? ' + إعداد ' + jd(s.setup_fee) + (s.ptype === 'team' ? ' للموظفة' : '') : '');
const svcMargin = s => ['monthly','unit','one_time'].includes(s.ptype) && N(s.price) ? (N(s.price) - N(s.cost)) / N(s.price) : s.ptype === 'team' && N(s.params?.hour_rate) ? (N(s.params.hour_rate) - N(s.cost)) / N(s.params.hour_rate) : null;
V.oops = async () => {
  const tab = ui.oTab || 'svc', site = await loadSite(), c = site.config || {};
  const top = `<div class="row"><a class="btn" href="${esc(siteUrl())}${site.live ? '' : '?preview=1'}" target="_blank" rel="noopener">${site.live ? 'افتح الموقع' : 'معاينة الموقع'}</a><button class="btn" data-act="oCopySite">انسخ الرابط</button>
    ${can('oops', 'edit') ? `<button class="btn ${site.live ? 'ghost' : 'pri'}" data-act="siteLive">${site.live ? 'إطفاء الموقع' : 'تشغيل الموقع'}</button>` : ''}</div>`;
  let body = '';
  if (tab === 'svc') {
    const list = await db.q('services', {order: ['sort', true], order2: ['name', true]}); ui.svcCache = list;
    const mm = N(c.min_margin ?? 30) / 100;
    body = `<div class="row" style="justify-content:space-between"><p class="note" style="margin:0">العميل بيشوف بس الخدمات اللي "ظاهرة بالموقع" و"فعّالة". السعر بينحسب من هون، وأي تعديل بيطلع عالموقع فوراً. العروض اللي انبعتت قبل ما بتتغير.</p>${can('oops', 'edit') ? '<button class="btn pri" data-act="svcForm">+ خدمة</button>' : ''}</div>` +
      table([{h:'الخدمة', f:s => `<b>${esc(s.name)}</b><br><small class="m">${esc(s.category)}</small>`}, {h:'طريقة التسعير', f:s => pill(PT[s.ptype] || s.ptype, 'info')}, {h:'السعر', f:s => esc(priceText(s)), c: 'wrap'},
        {h:'تكلفتنا', f:s => N(s.cost) ? jd(s.cost) + (s.ptype === 'team' ? '/ساعة' : s.ptype === 'unit' ? '/وحدة' : '') : '—'}, {h:'الهامش', f:s => { const g = svcMargin(s); return g == null ? '—' : `<span class="${g < mm ? 'margin-bad' : ''}">${pct(g)}</span>`; }},
        {h:'مقترحة لـ', f:s => { const n = (s.problems || []).length; return n === 0 ? '—' : n === 1 ? 'مشكلة وحدة' : n === 2 ? 'مشكلتين' : n + ' مشاكل'; }}, {h:'بالموقع', f:s => pill(s.public && s.active ? 'ظاهرة' : !s.active ? 'موقوفة' : 'مخفية', s.public && s.active ? 'good' : '')}, {h:'ترتيب', f:s => s.sort},
        {h:'', f:s => `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="svcForm" data-id="${s.id}">تعديل</button><button class="btn sm ghost" data-act="svcPub" data-id="${s.id}">${s.public ? 'إخفاء' : 'إظهار'}</button></div>`}], list);
  }
  if (tab === 'site') {
    ui.probs = ui.probsFor === site.updated_at ? ui.probs : (c.problems || []).map(p => ({...p})); ui.probsFor = site.updated_at;
    const fi = (k, l, v, t = 'text') => `<label class="fld" for="sc_${k}"><span>${l}</span><input id="sc_${k}" type="${t}" value="${esc(v ?? '')}"></label>`;
    const ta = (k, l, v, rows = 3, hint = '') => `<label class="fld wide" for="sc_${k}"><span>${l}</span><textarea id="sc_${k}" rows="${rows}">${esc(v ?? '')}</textarea>${hint ? `<small class="m">${hint}</small>` : ''}</label>`;
    body = `<div class="card"><h2>النصوص والتواصل</h2><div class="fgrid">${ta('headline', 'العنوان الرئيسي', c.headline, 2)}${ta('sub', 'السطر تحت العنوان', c.sub, 2)}${fi('phone', 'هاتف التواصل', c.phone)}${fi('email', 'الإيميل', c.email, 'email')}${fi('address', 'العنوان', c.address)}${fi('min_margin', 'أقل هامش مقبول (%)', c.min_margin ?? 30, 'number')}
      ${ta('privacy', 'سياسة الخصوصية', c.privacy, 4)}${ta('terms', 'الشروط الافتراضية للعروض', c.terms, 3)}${ta('sectors', 'أنواع النشاط (كل نوع بسطر)', (c.sectors || []).join('\n'), 6, 'نفس الأسماء بتنستخدم بأرقام التوقعات وبنوع العميل لما يتعاقد')}</div></div>
      <div class="card"><div class="head" style="margin-bottom:10px"><h2>المشاكل اللي بيختار منها العميل</h2><button class="btn sm" data-act="probAdd">+ مشكلة</button></div>
      <div class="tw"><table><thead><tr><th>النص اللي بيشوفه العميل</th><th>سؤال إضافي</th><th></th></tr></thead><tbody>${ui.probs.map((p, i) => `<tr><td><input class="inl" style="width:100%" data-pr="${i}" data-k="l" value="${esc(p.l)}" aria-label="المشكلة"></td><td>${sel('pa_' + i, ASK, p.ask || '', `data-pr="${i}" data-k="ask" aria-label="سؤال إضافي"`)}</td><td><button class="btn sm ghost" data-act="probDel" data-id="${i}">حذف</button></td></tr>`).join('')}</tbody></table></div>
      <p class="note" style="margin-top:8px">كل خدمة بتحدد هي مقترحة لأي مشاكل (من تعديل الخدمة). هيك محرك الاقتراح بيشتغل بقواعد إنت بتحددها.</p></div>
      ${can('oops', 'edit') ? '<div class="row"><button class="btn pri" data-act="siteSave">حفظ إعدادات الموقع</button></div>' : ''}`;
  }
  if (tab === 'bench') {
    const [bench, pub] = await Promise.all([db.q('oops_bench', {order: ['sector', true]}), db.rpc('oops_site_data').catch(() => null)]);
    const act = pub?.actual || []; ui.benchCache = bench; ui.actCache = act;
    const sectors = [...new Set([...(c.sectors || []), ...bench.map(b => b.sector)])];
    body = `<p class="note">هاي الأرقام بتظهر للعميل بحاسبة "شو بتجيب ميزانيتك". إذا عنا 3 حملات أو أكثر بنتائج لنفس القطاع، الحاسبة بتستخدم الأرقام الفعلية وبتكتب إنها فعلية. ما تحط أرقام إذا مش متأكد، العميل بيقدر يدخل أرقامه.</p>` +
      table([{h:'القطاع', f:x => `<b>${esc(x)}</b>`}, {h:'تكلفة الرسالة', f:x => { const b = bench.find(y => y.sector === x); return b?.cpl != null ? jd(b.cpl) : '—'; }}, {h:'نسبة الشراء', f:x => { const b = bench.find(y => y.sector === x); return b?.conv != null ? pct(b.conv) : '—'; }},
        {h:'متوسط البيع', f:x => { const b = bench.find(y => y.sector === x); return b?.aov != null ? jd(b.aov) : '—'; }}, {h:'النطاق', f:x => '±' + N(bench.find(y => y.sector === x)?.spread ?? 30) + '%'}, {h:'المصدر', f:x => esc(bench.find(y => y.sector === x)?.source || '—')},
        {h:'الفعلي من حملاتنا', f:x => { const a = act.find(y => y.sector === x); return a ? `<b>${jd(a.cpl)}</b> <small class="m">(${a.n} حملات)</small>` : '<small class="m">ما في بيانات كافية</small>'; }},
        {h:'', f:x => `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="benchForm" data-id="${esc(x)}">تعديل</button>${act.find(y => y.sector === x) ? `<button class="btn sm pri" data-act="benchUse" data-id="${esc(x)}">اعتمد الفعلي</button>` : ''}</div>`}], sectors, 'أضف أنواع نشاط من تبويب الموقع') +
      '<p class="note">الأرقام الفعلية جاية من حملات عملاء الوكالة (الصرف ÷ النتائج)، حسب نوع العميل. سجّل نتائج الحملات من ملف كل عميل عشان تتحسن.</p>';
  }
  return head('موقع الوكالة والأسعار', `الموقع اللي الشركات بتبني منه باقتها. ${site.live ? pill('شغّال', 'good') : pill('مطفي', 'bad')}`, top) +
    chips([['svc', 'الخدمات والأسعار'], ['site', 'نصوص الموقع والمشاكل'], ['bench', 'أرقام التوقعات']], tab, 'oTab') + body;
};
document.addEventListener('input', e => { const t = e.target; if (t.dataset.pr != null && ui.probs?.[N(t.dataset.pr)]) ui.probs[N(t.dataset.pr)][t.dataset.k] = t.value; });
document.addEventListener('change', e => { const t = e.target; if (t.dataset.pr != null && ui.probs?.[N(t.dataset.pr)]) ui.probs[N(t.dataset.pr)][t.dataset.k] = t.value; });
const parseTiers = t => String(t || '').split(/[,،\n]/).map(x => x.split('=').map(y => N(y.trim()))).filter(([a, b]) => a > 0 && b > 0).map(([from, off]) => ({from, off}));
const parseTasks = t => Object.fromEntries(String(t || '').split('\n').map(x => x.split('=')).filter(x => x[0]?.trim()).map(([k, v]) => [k.trim(), N(v)]));
Object.assign(A, {
  oTab: k => { ui.oTab = k; K.render(); },
  svcForm: id => {
    const s = id ? (ui.svcCache || []).find(x => x.id === id) : null, p = s?.params || {};
    const cats = [...new Set((ui.svcCache || []).map(x => x.category))].join('، ');
    const probs = (ST.oSite?.config?.problems || []).map(x => [x.k, x.l]);
    openForm(s ? 'تعديل ' + s.name : 'خدمة جديدة', [
      {k:'name', l:'اسم الخدمة', req: 1, wide: 1}, {k:'category', l:'التصنيف', req: 1, hint: 'الموجودة: ' + esc(cats)}, {k:'ptype', l:'طريقة التسعير', t:'select', opts: Object.entries(PT)},
      {k:'description', l:'وصف قصير للعميل', t:'textarea', rows: 2},
      {k:'price', l:'السعر (شهري، أو للقطعة، أو للمرة الوحدة)', t:'number'}, {k:'unit', l:'اسم الوحدة (للقطعة)', ph: 'تصميم، فيديو'}, {k:'setup_fee', l:'رسوم إعداد لمرة وحدة', t:'number'},
      {k:'min_qty', l:'أقل كمية', t:'number'}, {k:'max_qty', l:'أكثر كمية', t:'number'}, {k:'def_qty', l:'الكمية المقترحة', t:'number'},
      {k:'tiers', l:'خصم الكمية', ph: '12=10، 20=15', hint: 'من 12 قطعة خصم 10%، من 20 خصم 15%'},
      {k:'pct', l:'النسبة من صرف الإعلانات (%)', t:'number'}, {k:'min_fee', l:'أقل أتعاب شهرية', t:'number'}, {k:'max_fee', l:'أكثر أتعاب (0 = بدون سقف)', t:'number'},
      {k:'cost', l:'تكلفتنا الداخلية', t:'number', hint: 'للشهر، أو للقطعة، أو للساعة بفريق الرد. ما بتطلع للعميل'},
      {k:'hour_rate', l:'فريق الرد: سعر الساعة', t:'number'}, {k:'channel_fee', l:'فريق الرد: كل قناة إضافية', t:'number'}, {k:'msgs_per_hour', l:'فريق الرد: رسائل بالساعة للموظفة', t:'number'},
      {k:'max_agents', l:'فريق الرد: أكثر عدد موظفات', t:'number'}, {k:'max_hours', l:'فريق الرد: أكثر ساعات باليوم', t:'number'}, {k:'channels', l:'فريق الرد: القنوات', ph: 'فيسبوك، إنستغرام، واتساب'},
      {k:'tasks', l:'فريق الرد: مهام إضافية (مهمة=سعر للموظفة بالشهر)', t:'textarea', rows: 3},
      {k:'includes', l:'بتشمل', t:'textarea', rows: 2}, {k:'excludes', l:'ما بتشمل', t:'textarea', rows: 2},
      {k:'problems', l:'مقترحة لما العميل يختار', t:'checks', opts: probs},
      {k:'public', l:'بالموقع', t:'select', opts: [['true','ظاهرة'], ['false','مخفية']]}, {k:'active', l:'الحالة', t:'select', opts: [['true','فعّالة'], ['false','موقوفة']]}, {k:'sort', l:'الترتيب', t:'number'}],
      s ? {...s, tiers: (p.tiers || []).map(t => t.from + '=' + t.off).join('، '), hour_rate: p.hour_rate, channel_fee: p.channel_fee, msgs_per_hour: p.msgs_per_hour, max_agents: p.max_agents, max_hours: p.max_hours,
           channels: (p.channels || []).join('، '), tasks: Object.entries(p.tasks || {}).map(([k, v]) => k + '=' + v).join('\n'), public: String(s.public), active: String(s.active)}
        : {category: 'إدارة الإعلانات', ptype: 'monthly', min_qty: 1, max_qty: 1, def_qty: 1, price: 0, cost: 0, setup_fee: 0, pct: 0, min_fee: 0, max_fee: 0, public: 'true', active: 'true', sort: 100, problems: []},
      async v => {
        if (v.ptype === 'unit' && !(N(v.max_qty) >= N(v.min_qty) && N(v.min_qty) >= 1)) return 'أقل كمية لازم 1 أو أكثر، وأكثر كمية أكبر منها';
        if (v.ptype === 'team' && !N(v.hour_rate)) return 'حط سعر الساعة لفريق الرد';
        if (v.ptype === 'pct_spend' && !N(v.pct)) return 'حط النسبة من صرف الإعلانات';
        const params = {...p, tiers: parseTiers(v.tiers)};
        if (v.ptype === 'team') Object.assign(params, {hour_rate: N(v.hour_rate), channel_fee: N(v.channel_fee), msgs_per_hour: N(v.msgs_per_hour) || 12, max_agents: N(v.max_agents) || 6, max_hours: N(v.max_hours) || 16,
          channels: String(v.channels || '').split(/[,،]/).map(x => x.trim()).filter(Boolean), tasks: parseTasks(v.tasks)});
        const one = v.ptype === 'unit';
        const row = {name: v.name, category: v.category, ptype: v.ptype, description: v.description || null, price: N(v.price), unit: v.unit || null, setup_fee: N(v.setup_fee),
          min_qty: one ? Math.max(1, N(v.min_qty)) : 1, max_qty: one ? Math.max(1, N(v.max_qty)) : 1, def_qty: one ? Math.min(Math.max(N(v.def_qty), N(v.min_qty), 1), N(v.max_qty)) : 1,
          pct: N(v.pct), min_fee: N(v.min_fee), max_fee: N(v.max_fee), cost: N(v.cost), params, includes: v.includes || null, excludes: v.excludes || null, problems: v.problems || [],
          public: v.public === 'true', active: v.active === 'true', sort: N(v.sort)};
        try { if (s) await db.upd('services', {id}, row); else await db.ins('services', row); }
        catch (x) { if (/duplicate|unique/i.test(x.message)) return 'في خدمة بنفس الاسم'; throw x; }
        toast('انحفظت الخدمة'); K.render();
      });
  },
  svcPub: async id => { const s = (ui.svcCache || []).find(x => x.id === id); await db.upd('services', {id}, {public: !s.public}); toast(s.public ? 'انخفت عن الموقع' : 'صارت ظاهرة بالموقع'); K.render(); },
  siteLive: async () => { const s = await loadSite(); await db.upd('oops_site', {id: 1}, {live: !s.live, updated_at: new Date().toISOString()}); toast(s.live ? 'انطفى الموقع' : 'الموقع صار شغّال، والشركات بتقدر تبعت طلبات'); K.render(); },
  probAdd: () => { ui.probs.push({k: 'p' + Date.now().toString(36), l: ''}); K.render(); },
  probDel: i => { ui.probs.splice(N(i), 1); K.render(); },
  siteSave: async () => {
    const s = await loadSite(), g = k => $('#sc_' + k)?.value.trim() ?? '';
    const probs = ui.probs.filter(p => p.l.trim()).map(p => ({k: p.k, l: p.l.trim(), ...(p.ask ? {ask: p.ask} : {})}));
    const config = {...s.config, headline: g('headline'), sub: g('sub'), phone: g('phone'), email: g('email'), address: g('address'), min_margin: N(g('min_margin')) || 30,
      privacy: g('privacy'), terms: g('terms'), sectors: g('sectors').split('\n').map(x => x.trim()).filter(Boolean), problems: probs};
    await db.upd('oops_site', {id: 1}, {config, updated_at: new Date().toISOString()}); ui.probsFor = null; toast('انحفظت إعدادات الموقع'); K.render();
  },
  benchForm: sector => { const b = (ui.benchCache || []).find(x => x.sector === sector) || {};
    openForm('أرقام ' + sector, [{k:'cpl', l:'تكلفة الرسالة أو العميل المحتمل (د.أ)', t:'number'}, {k:'conv', l:'من كل 100 رسالة كم بيشتري (%)', t:'number'}, {k:'aov', l:'متوسط قيمة البيع (د.أ)', t:'number'},
      {k:'spread', l:'نطاق عدم اليقين (%)', t:'number', def: 30}, {k:'source', l:'مصدر الرقم', def: 'تقدير الإدارة'}], {...b, conv: b.conv != null ? Math.round(N(b.conv) * 10000) / 100 : null},
      async v => { const row = {cpl: v.cpl, conv: v.conv == null ? null : N(v.conv) / 100, aov: v.aov, spread: N(v.spread) || 30, source: v.source || 'تقدير الإدارة', updated_at: new Date().toISOString()};
        if (b.sector) await db.upd('oops_bench', {sector}, row); else await db.ins('oops_bench', {sector, ...row}); toast('انحفظ'); K.render(); }); },
  benchUse: async sector => { const a = (ui.actCache || []).find(x => x.sector === sector), b = (ui.benchCache || []).find(x => x.sector === sector);
    const row = {cpl: a.cpl, source: `فعلي من ${a.n} حملات`, updated_at: new Date().toISOString()};
    if (b) await db.upd('oops_bench', {sector}, row); else await db.ins('oops_bench', {sector, ...row}); toast('اعتمدنا الرقم الفعلي'); K.render(); }
});

/* ================= لوحة الوكالة: طلبات الموقع ================= */
const baseAg = V.agdash;
V.agdash = async () => {
  const html = await baseAg();
  if (!can('leads')) return html;
  try {
    const rq = await db.q('oops_requests', {in: {status: ['جديد','عرض مرسل','مقبول']}, select: 'status,fees_monthly,discount'});
    const n = rq.filter(r => r.status === 'جديد').length, acc = rq.filter(r => r.status === 'مقبول').length;
    return html.replace('<div class="kpis">', `<div class="kpis"><button class="kpi ${n ? 'red' : ''} kbtn" data-act="go" data-id="oreq"><span>طلبات جديدة من الموقع</span><b>${n}</b><small>${rq.filter(r => r.status === 'عرض مرسل').length} عرض بانتظار الرد · ${acc} وافقوا</small></button>`);
  } catch (e) { return html; }
};

/* ================= الإعدادات: الهوية والشعار والبكسل ================= */
function readLogo(file) {
  return new Promise((res, rej) => { if (!/^image\//.test(file.type)) return rej(new Error('اختار صورة')); if (file.size > 5e6) return rej(new Error('الصورة كبيرة، أقصى إشي 5 ميغا'));
    const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('ما قدرت أقرأ الصورة')); im.onload = () => {
      const k = Math.min(1, 320 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}
const baseSettings3 = V.settings;
V.settings = async () => {
  const html = await baseSettings3(), s = ST.settings || {}, tr = s.tracking || {}, ed = can('settings', 'edit');
  const logoBox = (k, l, name) => `<div class="fld"><span>${l}</span><div class="logoprev">${s[k] ? `<img src="${esc(s[k])}" alt="شعار ${esc(name)}">` : '<small class="m">ما في شعار، بيطلع الحرف الأول</small>'}
    ${ed ? `<label class="btn sm" for="lg_${k}">${s[k] ? 'تغيير' : 'ارفع شعار'}<input id="lg_${k}" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo="${k}" hidden></label>${s[k] ? `<button class="btn sm ghost" data-act="logoDel" data-id="${k}">شيل</button>` : ''}` : ''}</div></div>`;
  const ti = (k, l, ph, hint) => `<label class="fld" for="tr_${k}"><span>${l}</span><input id="tr_${k}" class="inl" dir="ltr" value="${esc(tr[k] || '')}" placeholder="${ph}" ${ed ? '' : 'disabled'}><small class="m">${hint}</small></label>`;
  return html + `<div class="cols"><div class="card"><h2>الهوية والشعار</h2><p class="m">الشعار بيطلع بالقائمة الجانبية، وشاشة الدخول، وشاشة اختيار القسم، وموقع الوكالة وعروض الأسعار. الأفضل PNG بخلفية شفافة.</p>
      ${logoBox('logo', 'شعار ' + (s.company || 'المتجر'), s.company || 'المتجر')}${logoBox('agency_logo', 'شعار ' + (s.agency_name || 'الوكالة'), s.agency_name || 'الوكالة')}
      <p class="note" style="margin-top:8px">اسم المتجر من "اسم الشركة" فوق، واسم الوكالة من خانة "اسم الوكالة".</p></div>
    <div class="card"><h2>البكسل والتتبع</h2><div class="fgrid">${ti('store_pixel', 'Meta Pixel للمتجر', '123456789012345', 'لصفحات الهبوط تبعت المنتجات (p.html)')}${ti('agency_pixel', 'Meta Pixel للوكالة', '123456789012345', 'لموقع الوكالة: زيارة، بدء بناء الباقة، طلب')}
      ${ti('agency_ga4', 'Google Analytics 4', 'G-XXXXXXX', 'لموقع الوكالة (اختياري)')}${ti('agency_gtm', 'Google Tag Manager', 'GTM-XXXXXXX', 'لموقع الوكالة (اختياري)')}</div>
      ${ed ? '<div class="row" style="margin-top:10px"><button class="btn pri" data-act="trackSave">حفظ التتبع</button></div>' : ''}
      <p class="note" style="margin-top:8px">ما منبعت لمنصات الإعلان أي اسم أو رقم هاتف أو تفاصيل مشاكل العميل. بس الحدث وقيمة الأتعاب.</p></div></div>`;
};
document.addEventListener('change', async e => {
  const t = e.target; if (!t.dataset?.logo || !t.files?.[0]) return;
  if (!can('settings', 'edit')) return toast('ما عندك صلاحية لهالعملية', true);
  try { const url = await readLogo(t.files[0]); await db.upd('settings', {id: 1}, {[t.dataset.logo]: url}); ST.settings[t.dataset.logo] = url; toast('انحفظ الشعار'); K.render(); }
  catch (x) { toast(x.message || 'ما قدرت أرفع الشعار', true); }
});
Object.assign(A, {
  logoDel: async k => { await db.upd('settings', {id: 1}, {[k]: null}); ST.settings[k] = null; toast('انشال الشعار'); K.render(); },
  trackSave: async () => {
    const clean = (k, re) => ($('#tr_' + k)?.value || '').trim().replace(re, '');
    const tracking = {...(ST.settings?.tracking || {}), store_pixel: clean('store_pixel', /\D/g), agency_pixel: clean('agency_pixel', /\D/g), agency_ga4: clean('agency_ga4', /[^A-Za-z0-9-]/g).toUpperCase(), agency_gtm: clean('agency_gtm', /[^A-Za-z0-9-]/g).toUpperCase()};
    if (tracking.agency_ga4 && !/^G-/.test(tracking.agency_ga4)) return toast('رقم Google Analytics بيبلش بـ G-', true);
    if (tracking.agency_gtm && !/^GTM-/.test(tracking.agency_gtm)) return toast('رقم Tag Manager بيبلش بـ GTM-', true);
    await db.upd('settings', {id: 1}, {tracking}); ST.settings.tracking = tracking; toast('انحفظ التتبع'); K.render();
  }
});
})();
