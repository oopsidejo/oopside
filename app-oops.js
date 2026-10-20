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
const siteUrl = () => { const u = String(ST.oSite?.config?.site_url || '').trim(); return /^https?:\/\//.test(u) ? u.split(/[?#]/)[0] : location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'o.html'; };
const storeLandingBase = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'p.html';
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
      {h:'الشركة', f:r => `<b>${esc(r.company)}</b><br><small class="m">${esc(r.contact || '')} ${esc(r.phone)}</small>${r.verified_via ? ' ' + pill('مؤكد ' + r.verified_via, 'good') : ''}`}, {h:'القطاع', f:r => esc(r.sector || '—')},
      {h:'المشاكل', f:r => esc((r.data?.problems || []).slice(0, 2).map(probLabel).join('، ') + ((r.data?.problems || []).length > 2 ? ' +' + ((r.data.problems.length) - 2) : '')), c: 'wrap'},
      {h:'أتعاب شهرية', f:r => `<b>${jd(N(r.fees_monthly) - N(r.discount))}</b>${N(r.one_time) ? `<br><small class="m">+ ${jd(r.one_time)} مرة وحدة</small>` : ''}`}, {h:'ميزانية الإعلانات', f:r => jd(r.ad_budget) + (r.data?.ad_split && Object.keys(r.data.ad_split).length ? `<br><small class="m">${esc(Object.entries(r.data.ad_split).map(([k, v]) => ({meta:'فيسبوك وإنستغرام', tiktok:'تيك توك', google:'جوجل', snap:'سناب', other:'غيرها'})[k] + ' ' + fmt(v)).join(' · '))}</small>` : '') + (N(r.data?.budget_total) ? `<br><small class="m">كل الميزانية ${jd(r.data.budget_total)}</small>` : '')},
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
    <div class="cols reqinfo"><div class="card"><h2>عن الشركة</h2>${kv('المسؤول', esc(r.contact || ''))}${kv('الهاتف', `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a> <a href="https://wa.me/${esc(String(r.phone).replace(/\D/g, '').replace(/^0(7)/, '962$1'))}" target="_blank" rel="noopener">واتساب</a>${r.verified_via ? ' ' + pill('مؤكد ' + r.verified_via, 'good') : ''}`)}${kv('الإيميل', r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '')}
      ${kv('شو بيبيع', esc(d.about || ''))}${kv('القطاع', esc(r.sector || ''))}${kv('المدينة', esc(d.city || ''))}${kv('الشركة', esc(d.stage || ''))}${kv('شركة تسويق؟', esc(d.agency_now || ''))}${kv('الصفحة أو الموقع', d.website ? `<a href="${esc(/^https?:/.test(d.website) ? d.website : 'https://' + d.website)}" target="_blank" rel="noopener nofollow">${esc(d.website)}</a>` : '')}
      ${kv('موافق على عروض', d.marketing_ok ? 'نعم' : '')}${kv('المصدر', esc([u.utm_source || u.ref, u.utm_campaign, u.utm_content].filter(Boolean).join(' · ')))}</div>
     <div class="card"><h2>المشكلة والميزانية</h2><ul class="todo" style="margin:0 0 10px">${(d.problems || []).map(k => `<li><span>${esc(probLabel(k))}</span></li>`).join('')}${d.problem_other ? `<li><span>${esc(d.problem_other)}</span></li>` : ''}</ul>
      ${kv('طلبات بالشهر', esc(a.orders || ''))}${kv('متوسط الطلب', a.aov ? jd(a.aov) : '')}${kv('رسائل باليوم', esc(a.msgs || ''))}${kv('ساعات الرد', a.hours ? esc(a.hours) + ' ساعات' : '')}${kv('عن المنتج أو المشروع', esc(a.text || ''))}
      ${kv('الميزانية الشهرية كاملة', jd(d.budget_total) + (d.includes_ads ? ' (بتشمل الإعلانات)' : ' (أتعاب بس)'))}${kv('للخدمات (أتعاب)', jd(d.includes_ads ? Math.max(0, N(d.budget_total) - N(r.ad_budget)) : d.budget_total))}${Object.keys(d.ad_split || {}).length ? kv('توزيع الإعلانات', Object.entries(d.ad_split).map(([k, v]) => esc(({meta: 'فيسبوك وإنستغرام', tiktok: 'تيك توك', google: 'جوجل ويوتيوب', snap: 'سناب شات', other: 'غيرها'})[k] || k) + ' ' + jd(v)).join('، ')) : ''}${kv('للإعلانات', jd(r.ad_budget))}${Object.entries(d.ad_split || {}).map(([k, v]) => kv('— ' + ({meta:'فيسبوك وإنستغرام', tiktok:'تيك توك', google:'جوجل', snap:'سناب', other:'غيرها'})[k], jd(v))).join('')}${kv('لأتعابنا (تقريباً)', d.includes_ads ? jd(Math.max(0, N(d.budget_total) - N(r.ad_budget))) : jd(d.budget_total))}</div></div>
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
    ui.qL.push({service_id: s.id, name: s.name, category: s.category, ptype: s.ptype, unit: s.unit, qty: pr.qty, monthly: pr.monthly, one_time: pr.one_time, cost: pr.cost, quote: pr.quote, includes: s.includes, duration: s.duration});
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

/* قمع الموقع: الزوار لوين وصلوا */
const baseFunnel = V.funnel;
V.funnel = async () => {
  const html = await baseFunnel(), d = ui.fnDays || 90;
  let rows = []; try { rows = await db.rpc('oops_funnel', {d_from: addDays(today(), -(d - 1)), d_to: today()}) || []; } catch (e) { return html; }
  const K5 = ['visits','started','business','budget','services','contact','sent'], L5 = ['زاروا الموقع','بلّشوا الباقة','عرّفوا بشغلهم','حددوا الميزانية','اختاروا خدمات','وصلوا للتواصل','بعتوا الطلب'];
  const T = {}; K5.forEach(k => T[k] = sum(rows, r => N(r[k])));
  const mx = Math.max(1, T.visits);
  const card = `<div class="card"><h2>قمع موقع الوكالة (آخر ${d} يوم)</h2><p class="m">كل زائر لوين وصل بالخطوات. بيبيّنلك وين الناس بتطلع، وأي حملة بتجيب ناس بتكمّل.</p>
    <div class="bars" style="margin-top:10px">${K5.map((k, i) => `<div class="bar"><span>${L5[i]}</span><span class="tr"><i style="width:${T[k] / mx * 100}%"></i></span><b>${T[k]}${i ? ` <small class="m">${T[K5[i - 1]] ? pct(T[k] / T[K5[i - 1]]) : ''}</small>` : ''}</b></div>`).join('')}</div>
    ${rows.length ? table([{h:'المصدر', f:r => `<b>${esc(r.source)}</b>`}, {h:'الحملة', f:r => esc(r.campaign)}, ...K5.map((k, i) => ({h: L5[i], f:r => N(r[k])})), {h:'نسبة الإرسال', f:r => N(r.visits) ? pct(N(r.sent) / N(r.visits)) : '—'}], rows.slice(0, 15)) : ''}
    <p class="note" style="margin-top:8px">رابط كل خطوة بيتغيّر: <b dir="ltr">?step=1-problem</b> لحد <b dir="ltr">?step=5-contact</b>، وبعد الإرسال <b dir="ltr">?step=6-done</b>. بـ Events Manager اعمل Custom Conversion: "URL contains step=6-done" للي بعتوا، أو استخدم أحداث البكسل: OopsStep و InitiateCheckout و Lead.</p></div>`;
  return html.replace('<div class="kpis">', card + '<div class="kpis">');
};

/* ================= موقع الوكالة والأسعار ================= */
const PTS = [['monthly', 'اشتراك شهري', 'سعر ثابت كل شهر'], ['unit', 'بالعدد', 'سعر للقطعة، والعميل بيختار كم بدو'], ['one_time', 'مرة وحدة', 'بتندفع مرة وحدة بس'],
  ['pct_spend', 'نسبة من الإعلانات', 'نسبة من صرف إعلانات العميل'], ['team', 'فريق الرد', 'بالساعات والقنوات'], ['quote', 'بعد جلسة', 'بدون سعر، بتسعّرها بعد ما تحكي معه']];
const setupTxt = s => N(s.setup_fee) ? ' + ' + jd(s.setup_fee) + (s.ptype === 'team' ? ' إعداد لكل موظفة' : ' إعداد أول مرة') : '';
const priceText = s => ({monthly: jd(s.price) + ' بالشهر', unit: jd(s.price) + ' لكل ' + (s.unit || 'قطعة') + ` (من ${s.min_qty} لـ ${s.max_qty})`, one_time: jd(s.price) + ' مرة وحدة',
  pct_spend: N(s.pct) + '% من الإعلانات (أقل إشي ' + jd(s.min_fee) + ' بالشهر)', team: jd(s.params?.hour_rate) + ' للساعة (أقل إشي ' + jd(s.min_fee) + ' بالشهر)', quote: 'بيتسعّر بعد جلسة'})[s.ptype] + setupTxt(s);
const svcMargin = s => ['monthly','unit','one_time'].includes(s.ptype) && N(s.price) ? (N(s.price) - N(s.cost)) / N(s.price) : s.ptype === 'team' && N(s.params?.hour_rate) ? (N(s.params.hour_rate) - N(s.cost)) / N(s.params.hour_rate) : s.ptype === 'pct_spend' && N(s.min_fee) && N(s.cost) ? (N(s.min_fee) - N(s.cost)) / N(s.min_fee) : null;
V.oops = async () => {
  const tab = ui.oTab || 'svc', site = await loadSite(), c = site.config || {};
  const top = `<div class="row"><a class="btn" href="${esc(siteUrl())}${site.live ? '' : '?preview=1'}" target="_blank" rel="noopener">${site.live ? 'افتح الموقع' : 'معاينة الموقع'}</a><button class="btn" data-act="oCopySite">انسخ الرابط</button>
    ${can('oops', 'edit') ? `<button class="btn ${site.live ? 'ghost' : 'pri'}" data-act="siteLive">${site.live ? 'إطفاء الموقع' : 'تشغيل الموقع'}</button>` : ''}</div>`;
  let body = '';
  if (tab === 'svc') {
    const list = await db.q('services', {order: ['sort', true], order2: ['name', true]}); ui.svcCache = list;
    const mm = N(c.min_margin ?? 30) / 100;
    const cats = [...new Set(list.map(x => x.category))];
    body = `<div class="row" style="justify-content:space-between"><p class="note" style="margin:0">اللي عليها "ظاهرة" بتطلع للعميل بالموقع، وأي تعديل بيطلع فوراً. عروض الأسعار اللي انبعتت قبل ما بتتغيّر.</p>${can('oops', 'edit') ? '<button class="btn pri" data-act="svcForm">+ خدمة</button>' : ''}</div>` +
      cats.map(cat => `<div class="card"><h2 style="margin-bottom:10px">${esc(cat)}</h2>` + table([
        {h:'الخدمة', f:s => `<b>${esc(s.name)}</b>${s.duration ? `<br><small class="m">المدة: ${esc(s.duration)}</small>` : ''}`},
        {h:'السعر', f:s => esc(priceText(s)), c: 'wrap'},
        {h:'ربحك', f:s => { const g = svcMargin(s); return g == null ? '<small class="m">—</small>' : `<span class="${g < mm ? 'margin-bad' : 'pos'}">${pct(g)}</span>`; }},
        {h:'بالموقع', f:s => pill(s.public && s.active ? 'ظاهرة' : !s.active ? 'موقوفة' : 'مخفية', s.public && s.active ? 'good' : '')},
        {h:'', f:s => `<div class="row" style="flex-wrap:nowrap;justify-content:flex-end"><button class="btn sm" data-act="svcForm" data-id="${s.id}">تعديل</button><button class="btn sm ghost" data-act="svcPub" data-id="${s.id}">${s.public ? 'إخفاء' : 'إظهار'}</button></div>`}],
        list.filter(x => x.category === cat)) + '</div>').join('') +
      `<p class="note">"ربحك" = السعر ناقص تكلفتك عليها. حط تكلفتك من تعديل الخدمة عشان تشوفه، وبيطلع أحمر إذا أقل من ${pct(mm)}.</p>`;
  }
  if (tab === 'site') {
    ui.probs = ui.probsFor === site.updated_at ? ui.probs : (c.problems || []).map(p => ({...p})); ui.probsFor = site.updated_at;
    const fi = (k, l, v, t = 'text') => `<label class="fld" for="sc_${k}"><span>${l}</span><input id="sc_${k}" type="${t}" value="${esc(v ?? '')}"></label>`;
    const ta = (k, l, v, rows = 3, hint = '') => `<label class="fld wide" for="sc_${k}"><span>${l}</span><textarea id="sc_${k}" rows="${rows}">${esc(v ?? '')}</textarea>${hint ? `<small class="m">${hint}</small>` : ''}</label>`;
    const vs = `<label class="fld" for="sc_verify"><span>تأكيد الزبون قبل ما يبعت الطلب</span>${sel('sc_verify', [['off', 'بدون تأكيد'], ['whatsapp', 'كود على واتساب'], ['email', 'كود على الإيميل'], ['either', 'واتساب أو إيميل (الزبون بيختار)']], c.verify || 'off')}</label><label class="fld" for="sc_vreq"><span>الكود إجباري؟</span>${sel('sc_vreq', [['whatsapp', 'إجباري على واتساب، والإيميل اختياري'], ['none', 'اختياري دايماً (الزبون بيقدر يتخطاه)'], ['all', 'إجباري دايماً']], c.verify_required || 'whatsapp')}<small class="m">الطلب المؤكد بيطلع جنبه "مؤكد"، وغير المؤكد بيوصلك عادي.</small><small class="m">شغّله بس بعد ما تجهز إرسال الكود (دليل-تأكيد-الزبون.md)، وإلا الزبون ما رح يقدر يبعت.</small></label>`;
    body = `<div class="card"><h2>بيانات الشركة والتواصل</h2><p class="m">بتطلع بموقع الوكالة (قسم "تواصل معنا" وتحت الصفحة) وبعروض الأسعار.</p><div class="fgrid">
      ${fi('legal_name', 'الاسم الرسمي للشركة', c.legal_name)}${fi('cr', 'رقم السجل التجاري (اختياري)', c.cr)}${ta('about', 'سطر تعريفي تحت الشعار', c.about, 2)}
      ${fi('whatsapp', 'رقم واتساب (بيطلع زر واتساب عالموقع)', c.whatsapp)}${fi('whatsapp_msg', 'الرسالة الجاهزة لما يضغط الزر', c.whatsapp_msg || 'مرحبا، بدي أستفسر عن خدماتكم')}
      ${fi('phone', 'هاتف للاتصال', c.phone)}${fi('email', 'الإيميل', c.email, 'email')}${fi('address', 'العنوان', c.address)}${fi('maps_url', 'رابط الموقع على Google Maps', c.maps_url, 'url')}${fi('hours', 'ساعات الدوام', c.hours)}
      ${fi('instagram', 'رابط إنستغرام', c.instagram, 'url')}${fi('facebook', 'رابط فيسبوك', c.facebook, 'url')}${fi('tiktok', 'رابط تيك توك', c.tiktok, 'url')}${fi('linkedin', 'رابط لينكد إن', c.linkedin, 'url')}${fi('youtube', 'رابط يوتيوب', c.youtube, 'url')}
      ${vs}</div></div>
      <div class="card"><h2>النصوص والإعدادات</h2><div class="fgrid">${ta('headline', 'العنوان الرئيسي', c.headline, 2)}${ta('sub', 'السطر تحت العنوان', c.sub, 2)}${fi('site_url', 'رابط موقع الوكالة (إذا مرفوع على رابط ثاني)', c.site_url || '', 'url')}${fi('min_margin', 'أقل هامش مقبول (%)', c.min_margin ?? 30, 'number')}
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
function svcEditor(id) {
  const s = id ? (ui.svcCache || []).find(x => x.id === id) : null, p = s?.params || {};
  const v = s || {category: (ui.svcCache || [])[0]?.category || 'إدارة الإعلانات', ptype: 'monthly', price: 0, min_qty: 1, max_qty: 10, def_qty: 1, public: true, active: true, sort: 100, problems: []};
  const cats = [...new Set((ui.svcCache || []).map(x => x.category))];
  const probs = ST.oSite?.config?.problems || [];
  const f = (id, label, val, attrs = '', hint = '') => `<label class="fld" for="${id}"><span>${label}</span><input id="${id}" value="${esc(val ?? '')}" ${attrs}>${hint ? `<small class="m">${hint}</small>` : ''}</label>`;
  const n = (id, label, val, hint = '') => f(id, label, val === 0 || val ? val : '', 'type="number" step="any" min="0" inputmode="decimal"', hint);
  const box = (pt, html) => `<div class="svbox fgrid" data-pt="${pt}" ${v.ptype === pt ? '' : 'hidden'}>${html}</div>`;
  $('#mtitle').textContent = s ? 'تعديل الخدمة' : 'خدمة جديدة';
  $('#mform').innerHTML = `<div class="fgrid">
      ${f('sv_name', 'اسم الخدمة', v.name, 'required maxlength="120"')}
      <label class="fld" for="sv_cat"><span>التصنيف</span><select id="sv_cat">${cats.map(c => `<option ${c === v.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">+ تصنيف جديد</option></select><input id="sv_catnew" placeholder="اسم التصنيف الجديد" hidden style="margin-top:6px"></label>
      <label class="fld wide" for="sv_desc"><span>وصف قصير بيشوفه العميل</span><textarea id="sv_desc" rows="2" maxlength="300">${esc(v.description || '')}</textarea></label></div>
    <h3 style="margin:16px 0 8px">كيف بتنحسب؟</h3>
    <div class="ptpick">${PTS.map(([k, l, d]) => `<label class="ptc"><input type="radio" name="sv_pt" value="${k}" ${v.ptype === k ? 'checked' : ''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div>
    ${box('monthly', n('sv_price_m', 'السعر بالشهر (د.أ)', v.ptype === 'monthly' ? v.price : ''))}
    ${box('unit', n('sv_price_u', 'سعر القطعة (د.أ)', v.ptype === 'unit' ? v.price : '') + f('sv_unit', 'شو القطعة؟', v.unit, 'placeholder="تصميم، فيديو، بوست"') +
      n('sv_min', 'أقل عدد', v.min_qty) + n('sv_def', 'العدد المقترح', v.def_qty) + n('sv_max', 'أكثر عدد', v.max_qty))}
    ${box('one_time', n('sv_price_o', 'السعر (د.أ)', v.ptype === 'one_time' ? v.price : ''))}
    ${box('pct_spend', n('sv_pct', 'النسبة من صرف الإعلانات (%)', v.pct) + n('sv_minfee', 'أقل مبلغ بالشهر (د.أ)', v.ptype === 'pct_spend' ? v.min_fee : '', 'إذا الإعلانات قليلة، هاد أقل إشي بتاخذه'))}
    ${box('team', n('sv_hour', 'سعر الساعة (د.أ)', p.hour_rate) + n('sv_chfee', 'كل قناة زيادة (د.أ بالشهر)', p.channel_fee) + n('sv_minfee_t', 'أقل مبلغ بالشهر (د.أ)', v.ptype === 'team' ? v.min_fee : ''))}
    ${box('quote', '<p class="note wide">العميل بيشوف "بيتسعّر بعد جلسة"، وإنت بتحط السعر بعرض السعر.</p>')}
    <div class="fgrid" style="margin-top:6px">
      ${f('sv_dur', 'مدة الخدمة', v.duration, 'placeholder="مثلاً: شهر، 7 أيام تسليم، أسبوعين"', 'بتطلع للعميل جنب الخدمة')}
      ${n('sv_cost', 'تكلفتك عليها (اختياري)', v.cost, 'ما بتطلع للعميل. ' + 'للشهر، أو للقطعة، أو للساعة بفريق الرد')}
      <label class="fld wide" for="sv_inc"><span>شو بتشمل؟</span><textarea id="sv_inc" rows="2" maxlength="400" placeholder="مثلاً: 3 اقتراحات، تعديلين، تسليم الملفات">${esc(v.includes || '')}</textarea></label>
      <label class="toggle wide" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="sv_pub" ${v.public ? 'checked' : ''}><span><b>ظاهرة للعملاء بالموقع</b></span></label></div>
    <details class="adv"><summary>إعدادات زيادة (اختياري)</summary><div class="fgrid" style="margin-top:10px">
      ${n('sv_setup', v.ptype === 'team' ? 'رسوم إعداد لكل موظفة' : 'رسوم إعداد أول مرة (د.أ)', v.setup_fee)}
      ${f('sv_tiers', 'خصم إذا طلب عدد أكبر (للعدد بس)', (p.tiers || []).map(t => t.from + '=' + t.off).join('، '), 'placeholder="12=10، 20=15"', 'يعني من 12 قطعة خصم 10%، ومن 20 خصم 15%')}
      ${n('sv_maxfee', 'أكثر مبلغ بالشهر (للنسبة من الإعلانات، فاضي = بدون سقف)', N(v.max_fee) || '')}
      ${f('sv_ch', 'قنوات فريق الرد', (p.channels || []).join('، '), 'placeholder="فيسبوك، إنستغرام، واتساب"')}
      <label class="fld" for="sv_tasks"><span>مهام زيادة لفريق الرد</span><textarea id="sv_tasks" rows="3" placeholder="تأكيد الطلبات=15">${esc(Object.entries(p.tasks || {}).map(([k, x]) => k + '=' + x).join('\n'))}</textarea><small class="m">كل مهمة بسطر: اسمها=سعرها لكل موظفة بالشهر</small></label>
      ${n('sv_mph', 'رسائل بالساعة للموظفة', p.msgs_per_hour || 12)}${n('sv_maxag', 'أكثر عدد موظفات', p.max_agents || 6)}${n('sv_maxh', 'أكثر ساعات باليوم', p.max_hours || 16)}
      <label class="fld wide" for="sv_exc"><span>ما بتشمل</span><textarea id="sv_exc" rows="2">${esc(v.excludes || '')}</textarea></label>
      <div class="fld wide"><span>بتنقترح للعميل لما يختار</span><div class="checks">${probs.map(x => `<label class="ck"><input type="checkbox" name="sv_prob" value="${esc(x.k)}" ${(v.problems || []).includes(x.k) ? 'checked' : ''}><span>${esc(x.l)}</span></label>`).join('')}</div></div>
      ${n('sv_sort', 'ترتيبها بالقائمة (الأصغر أول)', v.sort)}
      <label class="toggle" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="sv_act" ${v.active !== false ? 'checked' : ''}><span>فعّالة</span></label></div></details>
    <p class="lerr" id="ferr"></p><div class="fact"><button class="btn pri" type="submit" id="fsave">حفظ</button><button class="btn" type="button" data-act="closeM">إلغاء</button></div>`;
  const form = $('#mform');
  form.oninput = form.onchange = e => {
    if (e.target.name === 'sv_pt') $$('.svbox').forEach(b => b.hidden = b.dataset.pt !== e.target.value);
    if (e.target.id === 'sv_cat') $('#sv_catnew').hidden = e.target.value !== '__new';
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const g = id => ($('#' + id)?.value || '').trim(), num = id => N(g(id)), err = m => { $('#ferr').textContent = m; $('#fsave').disabled = false; };
    const pt = $('input[name=sv_pt]:checked')?.value || 'monthly';
    const cat = g('sv_cat') === '__new' ? g('sv_catnew') : g('sv_cat');
    if (!g('sv_name')) return err('اكتب اسم الخدمة');
    if (!cat) return err('اكتب اسم التصنيف');
    const price = pt === 'monthly' ? num('sv_price_m') : pt === 'unit' ? num('sv_price_u') : pt === 'one_time' ? num('sv_price_o') : 0;
    if (['monthly','unit','one_time'].includes(pt) && !(price > 0)) return err('حط السعر');
    if (pt === 'unit' && !(num('sv_max') >= num('sv_min') && num('sv_min') >= 1)) return err('أقل عدد لازم 1 أو أكثر، وأكثر عدد أكبر منه');
    if (pt === 'pct_spend' && !(num('sv_pct') > 0)) return err('حط النسبة من صرف الإعلانات');
    if (pt === 'team' && !(num('sv_hour') > 0)) return err('حط سعر الساعة');
    $('#fsave').disabled = true;
    const params = {...p, tiers: parseTiers(g('sv_tiers'))};
    if (pt === 'team') Object.assign(params, {hour_rate: num('sv_hour'), channel_fee: num('sv_chfee'), msgs_per_hour: num('sv_mph') || 12, max_agents: num('sv_maxag') || 6, max_hours: num('sv_maxh') || 16,
      channels: g('sv_ch').split(/[,،]/).map(x => x.trim()).filter(Boolean), tasks: parseTasks($('#sv_tasks').value)});
    const unit = pt === 'unit';
    const row = {name: g('sv_name'), category: cat, ptype: pt, description: g('sv_desc') || null, price, unit: unit ? (g('sv_unit') || null) : s?.unit || null,
      min_qty: unit ? Math.max(1, num('sv_min')) : 1, max_qty: unit ? Math.max(1, num('sv_max')) : 1, def_qty: unit ? Math.min(Math.max(num('sv_def'), num('sv_min'), 1), num('sv_max')) : 1,
      pct: pt === 'pct_spend' ? num('sv_pct') : N(s?.pct), min_fee: pt === 'pct_spend' ? num('sv_minfee') : pt === 'team' ? num('sv_minfee_t') : 0, max_fee: num('sv_maxfee'),
      setup_fee: num('sv_setup'), cost: num('sv_cost'), duration: g('sv_dur') || null, params, includes: g('sv_inc') || null, excludes: g('sv_exc') || null,
      problems: $$('input[name=sv_prob]:checked').map(x => x.value), public: $('#sv_pub').checked, active: $('#sv_act').checked, sort: num('sv_sort')};
    try { if (s) await db.upd('services', {id}, row); else await db.ins('services', row); }
    catch (x) { if (/duplicate|unique/i.test(x.message)) return err('في خدمة بنفس الاسم'); if (/duration/i.test(x.message)) return err('شغّل ملف 08_services_simple.sql على Supabase أول'); return err(K.arabicErr(x)); }
    closeM(true); toast('انحفظت الخدمة'); K.render();
  };
  $('#modal').hidden = false; setTimeout(() => $('#sv_name')?.focus(), 30);
}
Object.assign(A, {
  oTab: k => { ui.oTab = k; K.render(); },
  svcForm: id => svcEditor(id),
  svcPub: async id => { const s = (ui.svcCache || []).find(x => x.id === id); await db.upd('services', {id}, {public: !s.public}); toast(s.public ? 'انخفت عن الموقع' : 'صارت ظاهرة بالموقع'); K.render(); },
  siteLive: async () => { const s = await loadSite(); await db.upd('oops_site', {id: 1}, {live: !s.live, updated_at: new Date().toISOString()}); toast(s.live ? 'انطفى الموقع' : 'الموقع صار شغّال، والشركات بتقدر تبعت طلبات'); K.render(); },
  probAdd: () => { ui.probs.push({k: 'p' + Date.now().toString(36), l: ''}); K.render(); },
  probDel: i => { ui.probs.splice(N(i), 1); K.render(); },
  siteSave: async () => {
    const s = await loadSite(), g = k => $('#sc_' + k)?.value.trim() ?? '';
    const probs = ui.probs.filter(p => p.l.trim()).map(p => ({k: p.k, l: p.l.trim(), ...(p.ask ? {ask: p.ask} : {})}));
    const su = g('site_url'); if (su && !/^https:\/\/[^\s]+$/.test(su)) return toast('رابط الموقع لازم يبلش بـ https://', true);
    const wa = g('whatsapp').replace(/[^\d+]/g, ''); if (wa && wa.replace(/\D/g, '').length < 9) return toast('رقم الواتساب مش صحيح', true);
    const ex = Object.fromEntries(['legal_name','cr','about','whatsapp_msg','maps_url','hours','instagram','facebook','tiktok','linkedin','youtube'].map(k => [k, g(k)]));
    const config = {...s.config, ...ex, whatsapp: wa, verify: $('#sc_verify')?.value || 'off', verify_required: $('#sc_vreq')?.value || 'whatsapp', site_url: su, headline: g('headline'), sub: g('sub'), phone: g('phone'), email: g('email'), address: g('address'), min_margin: N(g('min_margin')) || 30,
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
async function checkPixel(say) {
  try {
    const [st] = await db.q('settings', {eq: {id: 1}, select: 'tracking,tracking_seen'}); if (!st) return false;
    const tr = st.tracking || {}, seen = st.tracking_seen || {};
    const ok = k => !tr[k + (k === 'store' ? '_pixel' : '_pixel')] ? null : (seen[k]?.pid === tr[k + '_pixel']);
    const wasOk = {store: (ST.settings?.tracking_seen || {}).store?.pid === tr.store_pixel, agency: (ST.settings?.tracking_seen || {}).agency?.pid === tr.agency_pixel};
    ST.settings.tracking_seen = seen;
    let any = false;
    for (const k of ['agency', 'store']) if (ok(k) && !wasOk[k]) { toast('✓ تم ربط بكسل ' + (k === 'agency' ? 'الوكالة' : 'المتجر') + '، والصفحة بتبعت أحداث لفيسبوك'); any = true; }
    if (say && !any) { const pend = ['agency', 'store'].filter(k => ok(k) === false); toast(pend.length ? 'لسا ما وصلنا إنه اشتغل. افتح الصفحة وارجع اضغط تحقق' : 'البكسل شغّال'); }
    if (any || say) { if (K.ui.view === 'settings') K.render(); }
    return ['agency', 'store'].every(k => ok(k) !== false);
  } catch (e) { if (say) toast('ما قدرت أتحقق. تأكد إنك شغّلت 06_pixel_check.sql', true); return true; }
}
function watchPixel() {
  clearInterval(watchPixel.t); let n = 0;
  watchPixel.t = setInterval(async () => { if (++n > 60 || !K.me) return clearInterval(watchPixel.t); if (await checkPixel(false)) clearInterval(watchPixel.t); }, 5000);
}
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
  await loadSite();
  const pxStatus = k => { const kind = k === 'store_pixel' ? 'store' : k === 'agency_pixel' ? 'agency' : null; if (!kind || !tr[k]) return '';
    const seen = (s.tracking_seen || {})[kind], ok = seen && seen.pid === tr[k];
    const open = kind === 'agency' ? `<a class="btn sm" href="${esc(siteUrl())}" target="_blank" rel="noopener">افتح موقع الوكالة</a>` : '<button class="btn sm" type="button" data-act="go" data-id="landing">افتح صفحات الهبوط</button>';
    return ok ? `<div class="pxok">✓ تم الربط. البكسل اشتغل على الصفحة، آخر مرة ${fmtDT(seen.at)}</div>`
      : `<div class="pxwait">انحفظ الرقم، بس لسا ما تأكدنا إنه اشتغل. افتح الصفحة مرة وحدة، وبنحكيلك هون أول ما يشتغل. <span class="row" style="margin-top:6px">${open}<button class="btn sm ghost" type="button" data-act="pxCheck">تحقق هلأ</button></span></div>`; };
  const ti = (k, l, ph, hint) => `<label class="fld" for="tr_${k}"><span>${l}</span><input id="tr_${k}" class="inl" dir="ltr" value="${esc(tr[k] || '')}" placeholder="${ph}" ${ed ? '' : 'disabled'}><small class="m">${hint}</small>${pxStatus(k)}</label>`;
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
    // لو انلصق كود البكسل كامل، منطلع الرقم منه
    const pxOf = k => { const t = ($('#tr_' + k)?.value || '').trim(); if (!t) return ''; const m = t.match(/init['"]?\s*,\s*['"]?(\d{6,20})/) || t.match(/[?&]id=(\d{6,20})/); if (m) return m[1]; const d = t.replace(/\D/g, ''); return /^[\d\s-]+$/.test(t) ? d : null; };
    const sp = pxOf('store_pixel'), ap = pxOf('agency_pixel');
    if (sp === null || ap === null || (sp && sp.length < 10) || (ap && ap.length < 10)) return toast('حط رقم البكسل بس (15 أو 16 رقم)، أو الصق كود البكسل كامل', true);
    const tracking = {...(ST.settings?.tracking || {}), store_pixel: sp, agency_pixel: ap, agency_ga4: clean('agency_ga4', /[^A-Za-z0-9-]/g).toUpperCase(), agency_gtm: clean('agency_gtm', /[^A-Za-z0-9-]/g).toUpperCase()};
    if (tracking.agency_ga4 && !/^G-/.test(tracking.agency_ga4)) return toast('رقم Google Analytics بيبلش بـ G-', true);
    if (tracking.agency_gtm && !/^GTM-/.test(tracking.agency_gtm)) return toast('رقم Tag Manager بيبلش بـ GTM-', true);
    await db.upd('settings', {id: 1}, {tracking}); ST.settings.tracking = tracking; toast('انحفظ. افتح الصفحة مرة وحدة، وبنحكيلك أول ما البكسل يشتغل'); K.render(); watchPixel();
  },
  pxCheck: async () => { await checkPixel(true); }
});
})();
