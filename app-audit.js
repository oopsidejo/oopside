/* صابر أونلاين ERP — فحص صفحات العملاء بالذكاء الاصطناعي (وكالة OOPSIDE)
   الموظف بيحط رابط الصفحة ورقم العميل وصور الصفحة ← النظام بيسجّل العميل كعميل محتمل لحاله
   ← الـAI بيفحص الصفحة من كل النواحي ← تقرير احترافي برابط بينبعت للعميل على واتساب. */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmtDT, pill, kpi, head, table, chips, toast, copyText, can, V, A, ST, ui, ACT_SEC, SEC_NAME, NAVS} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});

// القائمة: "فحص الصفحات" تحت الوكالة (بنفس صلاحية العملاء المحتملين)
SEC_NAME.audit = 'فحص الصفحات';
const g = NAVS.agency?.find(x => x[0] === 'الوكالة'); if (g && !g[1].includes('audit')) g[1].splice(g[1].indexOf('leads') + 1, 0, 'audit');
Object.assign(ACT_SEC, {auNew: 'leads', auRun: 'leads', auWa: 'leads', auCopy: 'leads', auDel: 'leads', auShotDel: 'leads', auBmSave: 'leads', auFilter: 'leads', auView: 'leads', auReset: 'leads'});

const COUNTRIES = [['962', 'الأردن +962'], ['970', 'فلسطين +970'], ['972', 'فلسطين +972'], ['966', 'السعودية +966'], ['971', 'الإمارات +971'], ['965', 'الكويت +965'], ['974', 'قطر +974'], ['973', 'البحرين +973'], ['968', 'عُمان +968'], ['964', 'العراق +964'], ['20', 'مصر +20']];
const GOALS = ['رسائل وطلبات أكثر', 'مبيعات أونلاين', 'زباين للمحل/الفرع', 'حجوزات ومواعيد', 'متابعين وانتشار', 'ما بيعرف، بده استشارة'];
const SHOTS = [
  ['top', 'أعلى الصفحة', 'الاسم، الصورة، الغلاف، البيو والأزرار'],
  ['posts', 'آخر البوستات', 'سكرول على آخر 6-9 بوستات'],
  ['reels', 'الريلز والفيديو', 'تبويب الريلز أو الفيديوهات'],
  ['reviews', 'التقييمات والتعليقات', 'تبويب التقييمات أو تعليقات على بوست'],
  ['adlib', 'مكتبة الإعلانات', 'facebook.com/ads/library ← اسم الصفحة'],
  ['insta', 'إنستغرام', 'بروفايل الإنستغرام (إذا موجود)'],
  ['extra1', 'صورة إضافية', 'عرض، أسعار، محادثة… أي إشي مهم'],
  ['extra2', 'صورة إضافية', '']];
const STC = {'جديد': '', 'عم يحلل': 'info', 'جاهز': 'good', 'خطأ': 'bad'};
const scoreCls = s => s == null ? '' : s >= 75 ? 'good' : s >= 50 ? 'warn' : 'bad';
const brand = () => ST.settings?.agency_name || 'OOPSIDE';
const repUrl = tok => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'audit.html?t=' + tok;
const shotsState = () => ui.auShots || (ui.auShots = {});

// تصغير الصورة لحد 1280px بجودة كافية لقراءة النص
function shrinkBig(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = rej;
    im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .82)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}
// الرقم بصيغة دولية لواتساب
function intlPhone(cc, raw) {
  let d = String(raw || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '').replace(/^00/, '');
  if (!d) return '';
  if (COUNTRIES.some(([k]) => d.startsWith(k) && d.length > k.length + 7)) return d;
  return cc + d.replace(/^0+/, '');
}

V.audit = async () => {
  const [rows, bms] = await Promise.all([
    db.q('page_audits', {select: 'id,no,token,lead_id,company,contact_name,phone,page_url,sector,city,status,score,error,sent_at,views,last_view,created_at,tokens_in,tokens_out', order: ['created_at', false], limit: 200}).catch(() => null),
    db.q('audit_benchmarks', {order: ['sector', true]}).catch(() => [])]);
  if (!rows) return head('فحص الصفحات', '') + '<div class="card"><p class="note">لازم تشغّل ملف <b>40_page_audit.sql</b> مرة وحدة على Supabase (SQL Editor)، وتنشر الدالة <b>page-audit</b>.</p></div>';
  ST.auRows = rows; ST.auBm = bms;
  const f = ui.auF || 'all';
  const list = f === 'all' ? rows : f === 'unsent' ? rows.filter(r => r.status === 'جاهز' && !r.sent_at) : f === 'seen' ? rows.filter(r => N(r.views) > 0) : rows.filter(r => r.status === f);
  const mon = new Date().toISOString().slice(0, 7), thisM = rows.filter(r => String(r.created_at).slice(0, 7) === mon);
  const ready = rows.filter(r => r.score != null), avg = ready.length ? Math.round(ready.reduce((a, r) => a + N(r.score), 0) / ready.length) : 0;
  const ed = can('leads', 'edit');
  return head('فحص الصفحات', 'العميل بيبعت صفحته على واتساب ← حط الرابط والرقم والصور ← النظام بيسجّله عميل محتمل لحاله، والذكاء الاصطناعي بيطلع تقرير احترافي بتبعته إله') +
    `<div class="kpis">${kpi('فحوصات هالشهر', thisM.length, rows.length + ' من البداية')}${kpi('جاهزة وما انبعتت', rows.filter(r => r.status === 'جاهز' && !r.sent_at).length, 'ابعتها بسرعة وهو سخن', rows.some(r => r.status === 'جاهز' && !r.sent_at) ? 'red' : '')}
      ${kpi('انبعتت', rows.filter(r => r.sent_at).length, rows.filter(r => N(r.views) > 0).length + ' فتحوا التقرير', 'hl')}${kpi('متوسط علامة الصفحات', ready.length ? avg + '/100' : '—', 'كل ما قلّت، فرصتنا أكبر')}</div>
    ${ed ? formCard(bms) : ''}
    <div class="card"><div class="head" style="margin-bottom:8px"><h2>الفحوصات</h2>${chips([['all', 'الكل'], ['unsent', 'جاهزة وما انبعتت'], ['seen', 'فتحوا التقرير'], ['عم يحلل', 'عم يحلل'], ['خطأ', 'خطأ']], f, 'auFilter')}</div>
    ${table([
      {h: '#', f: r => `<small class="m">${r.no}</small>`},
      {h: 'الصفحة', f: r => `<b>${esc(r.company)}</b><br><small class="m">${esc(r.sector || '')}${r.city ? ' · ' + esc(r.city) : ''} · <a href="${esc(r.page_url)}" target="_blank" rel="noopener">الصفحة ↗</a></small>`},
      {h: 'العميل', f: r => `${esc(r.contact_name || '—')}<br><small dir="ltr" class="m">+${esc(r.phone || '')}</small>`},
      {h: 'العلامة', f: r => r.score != null ? `<span class="pill ${scoreCls(r.score)}" style="font-size:15px">${r.score}/100</span>` : '—'},
      {h: 'الحالة', f: r => pill(r.status, STC[r.status]) + (r.error ? `<br><small class="neg">${esc(r.error).slice(0, 120)}</small>` : '') + (r.sent_at ? `<br><small class="m">انبعت ${fmtDT(r.sent_at)}</small>` : '') + (N(r.views) ? `<br><small class="pos">👀 فتحه ${N(r.views)} مرة · آخر مرة ${fmtDT(r.last_view)}</small>` : '')},
      {h: '', f: r => `<div class="row" style="gap:4px;flex-wrap:wrap">${r.status === 'جاهز' ? `<a class="btn sm" href="${esc(repUrl(r.token))}" target="_blank" rel="noopener">التقرير</a><button class="btn sm pri" data-act="auWa" data-id="${r.id}">ابعته واتساب</button><button class="btn sm ghost" data-act="auCopy" data-id="${r.id}">نسخ الرابط</button>` : ''}
        ${r.status !== 'عم يحلل' || isStale(r) ? `<button class="btn sm ${r.status === 'جاهز' ? 'ghost' : ''}" data-act="auRun" data-id="${r.id}">${r.status === 'جاهز' ? 'أعد التحليل' : 'حلّل'}</button>` : '<small class="m">…عم يحلل</small>'}
        ${r.lead_id ? `<button class="btn sm ghost" data-act="go" data-id="leads">العميل المحتمل</button>` : ''}
        <button class="btn sm ghost" data-act="auDel" data-id="${r.id}" aria-label="حذف">🗑</button></div>`}], list, 'لسا ما في فحوصات. أول ما يبعتلك عميل صفحته، عبّي الفورم فوق')}</div>
    ${ed ? bmCard(bms) : ''}`;
};
const isStale = r => r.status === 'عم يحلل' && Date.now() - new Date(r.created_at).getTime() > 3 * 60 * 1000;

function formCard(bms) {
  const s = shotsState(), n = Object.keys(s).length;
  const sectors = bms.length ? bms.map(b => b.sector) : ['أخرى'];
  const v = ui.auForm || {};
  const inp = (id, label, ph = '', type = 'text', req = false, wide = false) => `<label class="fld ${wide ? 'wide' : ''}" for="au_${id}"><span>${label}${req ? ' <b class="neg">*</b>' : ''}</span><input id="au_${id}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v[id] || '')}" placeholder="${esc(ph)}" ${req ? 'required' : ''}></label>`;
  return `<div class="card aunew"><h2>فحص جديد</h2>
    <p class="m" style="margin:0 0 10px">بتسجيل الفحص، العميل بينضاف لحاله على <b>العملاء المحتملين</b> بمرحلة "جديد" ومتابعة بكرة. إذا رقمه موجود من قبل، بينربط الفحص فيه.</p>
    <div class="fgrid">
      ${inp('company', 'اسم الصفحة / المشروع', 'مثلاً: مطعم السلطان', 'text', true)}
      ${inp('page_url', 'رابط الصفحة', 'https://facebook.com/...', 'url', true)}
      ${inp('contact_name', 'اسم صاحب الصفحة', 'اختياري')}
      <label class="fld" for="au_phone"><span>رقم العميل (واتساب) <b class="neg">*</b></span><div class="row" style="gap:6px;flex-wrap:nowrap">
        <select id="au_cc" class="inl" aria-label="رمز البلد" style="max-width:130px">${COUNTRIES.map(([k, l]) => `<option value="${k}" ${(v.cc || '962') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input id="au_phone" type="tel" dir="ltr" value="${esc(v.phone || '')}" placeholder="079xxxxxxx" required style="flex:1;min-width:0"></div></label>
      <label class="fld" for="au_sector"><span>المجال</span><select id="au_sector">${sectors.map(x => `<option ${v.sector === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      ${inp('city', 'المدينة', 'عمّان، إربد، نابلس…')}
      <label class="fld" for="au_goal"><span>شو بده صاحب المشروع؟</span><select id="au_goal"><option value="">—</option>${GOALS.map(x => `<option ${v.goal === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <div class="fgrid" style="gap:8px">${inp('monthly_spend', 'بيصرف إعلانات شهرياً ($)', 'اختياري', 'number')}${inp('monthly_msgs', 'كم رسالة/طلب بيجيه شهرياً', 'اختياري', 'number')}</div>
      <label class="fld wide" for="au_notes"><span>ملاحظات (شو حكالك العميل، مشاكله، عروضه…)</span><textarea id="au_notes" rows="2" placeholder="مثلاً: بيقول الإعلانات بتجيب لايكات بس ما في طلبات">${esc(v.notes || '')}</textarea></label>
    </div>
    <h3 style="margin:16px 0 6px">صور الصفحة <small class="m">(${n} من ${SHOTS.length} · على الأقل 2 · كل ما زادت الصور، صار التقرير أدق)</small></h3>
    <p class="m" style="margin:0 0 8px">افتح الصفحة على الموبايل أو الكمبيوتر وخذ سكرين شوت. بتقدر تسحب الصورة، أو تختارها، أو تعمل لصق (Ctrl+V) بعد ما تضغط على المربع.</p>
    <div class="aushots">${SHOTS.map(([k, l, d]) => `<div class="aushot ${s[k] ? 'has' : ''}" tabindex="0" data-shot="${k}" aria-label="${esc(l)}">
        ${s[k] ? `<img src="${s[k]}" alt="${esc(l)}"><button class="aux" data-act="auShotDel" data-id="${k}" aria-label="شيل الصورة">✕</button>` : `<label><input type="file" accept="image/*" data-aushot="${k}" hidden><b>+ ${esc(l)}</b><small>${esc(d)}</small></label>`}
        ${s[k] ? `<small class="aul">${esc(l)}</small>` : ''}</div>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn pri" data-act="auNew" ${ui.auBusy ? 'disabled' : ''}>${ui.auBusy ? '…عم يفحص الصفحة (حوالي دقيقة)' : 'سجّل العميل وافحص الصفحة'}</button><button class="btn ghost" data-act="auReset">فورم جديد</button></div></div>
    <style>.aushots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
    .aushot{position:relative;border:2px dashed var(--line);border-radius:12px;min-height:130px;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;background:var(--bg2,transparent)}
    .aushot:focus{outline:2px solid var(--brand,#2f3b82);outline-offset:2px}.aushot.drag{border-color:var(--brand,#2f3b82)}
    .aushot label{cursor:pointer;padding:10px;display:flex;flex-direction:column;gap:4px;width:100%;height:100%;justify-content:center}.aushot label small{color:var(--muted);font-size:12px}
    .aushot.has{border-style:solid}.aushot img{width:100%;height:150px;object-fit:cover;object-position:top}
    .aushot .aux{position:absolute;top:6px;inset-inline-start:6px;border:0;border-radius:50%;width:28px;height:28px;background:rgba(0,0,0,.65);color:#fff;cursor:pointer}
    .aushot .aul{position:absolute;bottom:0;inset-inline:0;background:rgba(0,0,0,.6);color:#fff;font-size:12px;padding:3px}</style>`;
}

function bmCard(bms) {
  const c = (b, k, step = '0.01') => `<input type="number" step="${step}" min="0" class="inl" style="width:80px" data-bm="${esc(b.sector)}" data-k="${k}" value="${N(b[k])}" aria-label="${k}">`;
  return `<details class="card"><summary><b>أرقام المجالات (لتقدير النتائج بالتقرير)</b> <small class="m">عدّلها حسب نتائج حملاتك الحقيقية، التقدير كله مبني عليها</small></summary>
    ${table([{h: 'المجال', f: b => `<b>${esc(b.sector)}</b>`}, {h: 'سعر المحادثة ($) من – لـ', f: b => `${c(b, 'cpr_min')} – ${c(b, 'cpr_max')}`},
      {h: 'نسبة المحادثات اللي بتصير طلب % من – لـ', f: b => `${c(b, 'close_min', '1')} – ${c(b, 'close_max', '1')}`},
      {h: 'من حملاتنا؟', f: b => `<input type="checkbox" data-bm="${esc(b.sector)}" data-k="real_data" ${b.real_data ? 'checked' : ''} aria-label="من حملات حقيقية">`},
      {h: 'مثال حقيقي بيطلع بالتقرير', f: b => `<input class="inl" style="min-width:220px" data-bm="${esc(b.sector)}" data-k="proof" value="${esc(b.proof || '')}" placeholder="مثلاً: مطعم بإربد 40 طلب بالأسبوع">`, c: 'wrap'}], bms)}
    <p class="m">⚠ المثال الحقيقي لازم يكون صحيح ومن حملة إنت أدرتها، لأنه بيطلع للعميل. اللي مش من حملاتنا بيطلع بالتقرير كـ "تقدير السوق".</p>
    <div class="row"><button class="btn pri" data-act="auBmSave">حفظ الأرقام</button></div></details>`;
}

// رفع الصور: اختيار، سحب وإفلات، لصق
document.addEventListener('change', async e => {
  const t = e.target; if (!t.dataset?.aushot || !t.files?.[0]) return;
  try { saveForm(); shotsState()[t.dataset.aushot] = await shrinkBig(t.files[0]); K.render(); } catch (x) { toast('ما قدرت أقرأ الصورة', true); }
});
document.addEventListener('dragover', e => { const b = e.target.closest?.('.aushot'); if (b) { e.preventDefault(); b.classList.add('drag'); } });
document.addEventListener('dragleave', e => { e.target.closest?.('.aushot')?.classList.remove('drag'); });
document.addEventListener('drop', async e => {
  const b = e.target.closest?.('.aushot'); if (!b) return; e.preventDefault();
  const fs = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (!fs.length) return;
  saveForm(); const s = shotsState(), keys = SHOTS.map(x => x[0]);
  const order = [b.dataset.shot, ...keys.filter(k => k !== b.dataset.shot && !s[k])];
  for (let i = 0; i < fs.length && i < order.length; i++) s[order[i]] = await shrinkBig(fs[i]);
  K.render();
});
document.addEventListener('paste', async e => {
  if (ui.view !== 'audit') return;
  const f = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith('image/'))?.getAsFile(); if (!f) return;
  const s = shotsState(); const box = document.activeElement?.closest?.('.aushot');
  const k = box?.dataset.shot || SHOTS.map(x => x[0]).find(x => !s[x]); if (!k) return toast('كل المربعات معبّاية', true);
  e.preventDefault(); saveForm(); s[k] = await shrinkBig(f); toast('انضافت الصورة'); K.render();
});
function saveForm() {
  const v = {}; ['company', 'page_url', 'contact_name', 'phone', 'cc', 'sector', 'city', 'goal', 'monthly_spend', 'monthly_msgs', 'notes'].forEach(k => { const el = $('#au_' + k); if (el) v[k] = el.value.trim(); });
  if (Object.keys(v).length) ui.auForm = v; return ui.auForm || {};
}

async function runAudit(id) {
  const r = await db.fn('page-audit', {id});
  return r;
}

Object.assign(A, {
  auFilter: k => { ui.auF = k; K.render(); },
  auReset: () => { ui.auForm = {}; ui.auShots = {}; K.render(); },
  auShotDel: k => { saveForm(); delete shotsState()[k]; K.render(); },
  auNew: async () => {
    const v = saveForm(), s = shotsState();
    if (!v.company) return toast('اكتب اسم الصفحة', true);
    if (!/^https?:\/\/\S+\.\S+/.test(v.page_url || '')) return toast('حط رابط الصفحة كامل (يبدأ بـ https://)', true);
    const phone = intlPhone(v.cc || '962', v.phone); if (phone.length < 10) return toast('اكتب رقم العميل صح', true);
    const shots = SHOTS.filter(([k]) => s[k]).map(([k, l]) => ({label: l, data: s[k]}));
    if (shots.length < 2) return toast('ارفع صورتين على الأقل من الصفحة', true);
    ui.auBusy = true; K.render();
    let id = null;
    try {
      id = await db.rpc('audit_create', {p: {company: v.company, page_url: v.page_url, contact_name: v.contact_name, phone, sector: v.sector, city: v.city, goal: v.goal,
        monthly_spend: v.monthly_spend, monthly_msgs: v.monthly_msgs, notes: v.notes, shots}});
      toast('✅ انسجّل ' + v.company + ' عميل محتمل. هلأ عم نفحص الصفحة…');
      ui.auForm = {}; ui.auShots = {};
      await runAudit(id);
      toast('🎉 التقرير جاهز. ابعته للعميل على واتساب');
    } catch (x) { toast(K.arabicErr(x), true); }
    finally { ui.auBusy = false; ui.auF = 'all'; K.render(); }
  },
  auRun: async id => {
    toast('عم يفحص الصفحة… حوالي دقيقة');
    try { await runAudit(id); toast('التقرير جاهز'); } catch (x) { toast(K.arabicErr(x), true); }
    K.render();
  },
  auCopy: async id => { const r = ST.auRows.find(x => x.id === id); if (r) { await copyText(repUrl(r.token)); toast('انسخ رابط التقرير'); } },
  auWa: async id => {
    const r = ST.auRows.find(x => x.id === id); if (!r) return;
    const hi = r.contact_name ? 'مرحبا ' + r.contact_name.split(' ')[0] : 'مرحبا';
    const msg = `${hi} 👋\nخلّصنا فحص صفحة *${r.company}* من كل النواحي، وجهّزنالك تقرير خاص فيه:\n✅ علامة صفحتك (${r.score}/100)\n✅ شو ناقصها بالزبط وكيف بتتصلّح\n✅ تقدير للنتائج المتوقعة لما نشتغل عليها\n\n📄 التقرير: ${repUrl(r.token)}\n\nإذا حابب نحكي عن الخطة، رد على هالرسالة 🙌\n— فريق ${brand()}`;
    window.open('https://wa.me/' + String(r.phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    try { await db.rpc('audit_mark_sent', {aid: id}); } catch (x) {}
    K.render();
  },
  auDel: async id => {
    const r = ST.auRows.find(x => x.id === id); if (!r || !confirm('تحذف فحص ' + r.company + '؟ (العميل المحتمل بيضل)')) return;
    await db.del('page_audits', {id}); toast('انحذف'); K.render();
  },
  auBmSave: async () => {
    const by = {};
    $$('[data-bm]').forEach(el => { const s = el.dataset.bm, k = el.dataset.k; (by[s] = by[s] || {})[k] = el.type === 'checkbox' ? el.checked : k === 'proof' ? (el.value.trim() || null) : N(el.value); });
    for (const [sector, p] of Object.entries(by)) {
      if (N(p.cpr_min) <= 0 || N(p.cpr_max) < N(p.cpr_min)) return toast('سعر المحادثة بـ ' + sector + ' مش منطقي', true);
      await db.upd('audit_benchmarks', {sector}, {...p, updated_at: new Date().toISOString()});
    }
    toast('انحفظت الأرقام'); K.render();
  }
});
})();
