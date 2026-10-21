/* صابر أونلاين ERP — الوكيل الذكي للرسائل
   لوحة خاصة فيه، الصفحات اللي بيرد عليها، البرومبتات، الإعدادات، وتجربة محادثة. كل شي من هون بدون SQL. */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmt, jd, sum, today, addDays, monthOf, fmtDT, pill, kpi, head, table, chips, toast, openForm, copyText, can, V, A, ST, ui, ACT_SEC} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});

const USD_JOD = 0.709;
const MODELS = [['claude-haiku-5-5', 'Claude Haiku 5.5 · الأرخص والأسرع (مقترح)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 · أذكى، أغلى بـ20 ضعف']];
const MODES = [['off', 'موقف', 'الوكيل ما بيعمل إشي على هالصفحة'], ['suggest', 'اقتراح للبنات', 'بيكتب الرد المقترح بصندوق الرسائل، والبنت بتنسخه وبتبعته'], ['auto', 'رد تلقائي', 'بيرد على الزبون لحاله وبيسجّل الطلب. بيحتاج موافقة Meta على pages_messaging']];
const ACT = {reply: ['رد', 'good'], order: ['سحب طلب', 'brand'], suggest: ['اقتراح', 'info'], handoff: ['حوّل لموظف', 'warn'], error: ['خطأ', 'bad']};
const TABS = [['dash', 'اللوحة'], ['pages', 'الصفحات'], ['prompts', 'البرومبتات'], ['learn', 'التعلّم'], ['settings', 'الإعدادات'], ['test', 'جرّب الوكيل']];
const usd = n => '$' + (Math.round(N(n) * 10000) / 10000).toFixed(N(n) < 1 ? 4 : 2);
const fnUrl = () => String(window.SABER_CONFIG?.url || '').replace(/\/$/, '') + '/functions/v1/ai-agent';

Object.assign(ACT_SEC, {agTab: 'ai', agSave: 'ai', agPageSave: 'ai', agPromptSave: 'ai', agDefaults: 'ai', agToggle: 'ai', agTestSend: 'ai', agTestReset: 'ai', agPeriod: 'ai', agLearn: 'ai', agLearnSave: 'ai', agLearnDrop: 'ai'});

async function loadAgent() {
  const [ag, pages, mpages] = await Promise.all([
    db.q('ai_agent', {eq: {id: 1}}).then(r => r[0]).catch(() => null),
    db.q('ai_pages').catch(() => []),
    db.q('meta_pages', {order: ['name', true]}).catch(() => [])]);
  ST.agent = ag; ST.aiPages = pages; ST.mpages = mpages;
  return ag;
}
const agRange = () => { const m = ui.agPer || '1'; if (m === 'month') return [monthOf(today()) + '-01', today()]; const d = +m || 1; return [addDays(today(), -(d - 1)), today()]; };

V.agent = async () => {
  const ag = await loadAgent();
  if (!ag) return head('الوكيل الذكي', '') + `<div class="card"><p class="note">لازم تشغّل ملف <b>16_ai_agent.sql</b> مرة وحدة على Supabase (SQL Editor) عشان تبلش.</p></div>`;
  const tab = ui.agTab || 'dash';
  const live = ST.aiPages.filter(p => p.mode !== 'off');
  const status = !ag.enabled ? pill('موقف', 'bad') : !live.length ? pill('شغّال بس ما في صفحات', 'warn') : `<span class="live"><i></i>شغّال على ${live.length} ${live.length === 1 ? 'صفحة' : 'صفحات'}</span>`;
  const body = await ({dash: agDash, pages: agPages, prompts: agPrompts, learn: agLearn, settings: agSettings, test: agTest}[tab] || agDash)(ag);
  return head('الوكيل الذكي', 'بيرد على الزباين، بيسحب الطلبات، وبيحوّل للبنات لما يلزم. كل شي بيتعدّل من هون',
      `${status}${can('ai', 'edit') ? `<button class="btn ${ag.enabled ? '' : 'pri'}" data-act="agToggle">${ag.enabled ? 'وقّف الوكيل' : 'شغّل الوكيل'}</button>` : ''}`) +
    `<div class="chips agtabs" role="tablist">${TABS.map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" role="tab" aria-selected="${tab === k}" data-act="agTab" data-id="${k}">${l}</button>`).join('')}</div>` + body;
};

/* ---------- اللوحة ---------- */
async function agDash(ag) {
  const [from, to] = agRange();
  const [d, runs] = await Promise.all([db.rpc('ai_dashboard', {d_from: from, d_to: to}).catch(() => null),
    db.q('ai_runs', {eq: {kind: 'live'}, gte: {at: from + 'T00:00:00+03:00'}, order: ['at', false], limit: 80}).catch(() => [])]);
  const x = d || {};
  const warn = [];
  if (!ag.enabled) warn.push('الوكيل موقف. شغّله من الزر فوق.');
  if (!ST.aiPages.some(p => p.mode !== 'off')) warn.push('ما في صفحة مفعّل عليها الوكيل. روح على "الصفحات" واختار.');
  if (ST.aiPages.some(p => p.mode === 'auto') && runs.some(r => r.error && /permission|pages_messaging|لا يمكن|cannot|outside/i.test(r.error))) warn.push('Meta لسا ما سمحت بالرد التلقائي على الزباين (لازم موافقة pages_messaging). الردود بتنحفظ اقتراحات للبنات لحد ما تنفتح.');
  return `${warn.length ? `<div class="card" style="border-color:var(--warn)">${warn.map(w => `<p class="note" style="margin:4px 0">⚠ ${esc(w)}</p>`).join('')}</div>` : ''}
    <div class="row" style="margin:8px 0">${chips([['1', 'اليوم'], ['7', '7 أيام'], ['month', 'هالشهر']], ui.agPer || '1', 'agPer')}<small class="m">${from === to ? from : from + ' ← ' + to}</small></div>
    <div class="kpis">${kpi('محادثات اشتغل عليها', N(x.convs), N(x.runs) + ' مرة')}${kpi('ردود انبعتت', N(x.replies), N(x.suggests) + ' اقتراح للبنات')}
     ${kpi('طلبات سحبها', N(x.orders), 'قيمتها ' + jd(x.orders_value), 'hl')}${kpi('حوّل لموظف', N(x.handoffs), N(x.errors) ? N(x.errors) + ' خطأ' : 'بدون أخطاء', N(x.errors) ? 'red' : '')}
     ${kpi('التكلفة', usd(x.cost), '≈ ' + jd(N(x.cost) * USD_JOD) + (N(x.orders) ? ' · ' + jd(N(x.cost) * USD_JOD / N(x.orders)) + ' للطلب' : ''))}</div>
    <div class="card"><h2>حسب الصفحة</h2>${table([{h: 'الصفحة', f: p => esc(p.page || '—')}, {h: 'محادثات', f: p => N(p.convs)}, {h: 'طلبات', f: p => N(p.orders)}, {h: 'تحويل لموظف', f: p => N(p.handoffs)}, {h: 'التكلفة', f: p => usd(p.cost)}], x.by_page || [], 'لسا ما اشتغل على ولا صفحة بهالفترة')}</div>
    <div class="card"><h2>آخر شغله</h2>${table([
      {h: 'الوقت', f: r => `<small>${fmtDT(r.at)}</small>`}, {h: 'الزبون', f: r => esc(r.customer || 'زبون') + (r.conv_id ? ` <button class="btn sm ghost" data-act="openConv" data-id="${r.conv_id}">افتح</button>` : '')},
      {h: 'شو عمل', f: r => pill(...(ACT[r.action] || [r.action, ''])) + (r.action !== 'suggest' && r.action !== 'error' ? (r.sent ? ' <small class="m">انبعت</small>' : ' <small class="m">ما انبعت</small>') : '')},
      {h: 'الرد', f: r => `<span class="agreply">${esc(r.reply || '')}</span>${r.error ? `<br><small class="neg">${esc(r.error)}</small>` : ''}`, c: 'wrap'},
      {h: 'التكلفة', f: r => `<small>${usd(r.cost)}</small>`}], runs, 'لسا ما في شغل')}</div>`;
}

/* ---------- الصفحات ---------- */
async function agPages() {
  const prods = ST.products.filter(p => p.active);
  if (!ST.mpages.length) return '<div class="card"><p class="note">ما في صفحات مربوطة. اربطها أول من الحسابات الإعلانية ← ربط حسابات Meta.</p></div>';
  return ST.mpages.map(m => {
    const p = ST.aiPages.find(x => x.page_id === m.page_id) || {mode: 'off', products: [], prompt: ''};
    const id = m.page_id.replace(/[^a-z0-9]/gi, '');
    return `<div class="card agpage" data-page="${esc(m.page_id)}"><div class="head" style="margin-bottom:8px"><h2>${esc(m.name || m.page_id)}</h2>${p.mode === 'off' ? pill('موقف') : p.mode === 'auto' ? pill('رد تلقائي', 'good') : pill('اقتراح للبنات', 'info')}</div>
      <fieldset class="agmodes"><legend class="m">شو يعمل الوكيل على هالصفحة؟</legend>${MODES.map(([k, l, d]) => `<label class="agmode ${p.mode === k ? 'on' : ''}"><input type="radio" name="am_${id}" value="${k}" ${p.mode === k ? 'checked' : ''}><b>${l}</b><small>${d}</small></label>`).join('')}</fieldset>
      <details ${p.products?.length ? 'open' : ''}><summary>المنتجات اللي بيبيعها (${p.products?.length ? p.products.length + ' منتج' : 'كل المنتجات'})</summary><p class="m" style="margin:6px 0">إذا ما اخترت إشي، بيعرف كل المنتجات الشغّالة. الأسعار والوصف بياخدهم من صفحة المنتج بالنظام.</p>
        <div class="agprods">${prods.map(x => `<label><input type="checkbox" value="${x.id}" ${(p.products || []).includes(x.id) ? 'checked' : ''}> ${esc(x.name)} <small class="m">${jd(x.price)}${N(x.stock) <= 0 ? ' · خالص' : ''}</small></label>`).join('')}</div></details>
      <label class="fld" style="margin-top:10px"><span>تعليمات خاصة بهالصفحة (اختياري)</span><textarea rows="4" class="agpp" placeholder="مثلاً: هالصفحة للتنحيف بس. العرض هالأسبوع: حبتين بـ25 دينار شامل التوصيل. لا تحكي عن أي منتج ثاني.">${esc(p.prompt || '')}</textarea></label>
      <div class="row" style="margin-top:8px"><button class="btn pri" data-act="agPageSave" data-id="${esc(m.page_id)}">حفظ الصفحة</button><button class="btn" data-act="agTab" data-id="test" data-page="${esc(m.page_id)}">جرّبها</button></div></div>`;
  }).join('');
}

/* ---------- البرومبتات ---------- */
async function agPrompts(ag) {
  const box = (k, l, hint) => `<label class="fld" style="margin-top:12px"><span>${l}</span><textarea id="agp_${k}" rows="7" placeholder="فاضي = التعليمات الافتراضية">${esc(ag['prompt_' + k] || '')}</textarea><small class="m">${hint}</small></label>`;
  return `<div class="card"><h2>تعليمات الوكيل لكل الصفحات</h2><p class="m">اكتب بلهجتك وبالتفصيل اللي بدك ياه. إذا الخانة فاضية بيستخدم الافتراضي. وكل صفحة إلها تعليمات زيادة من "الصفحات".</p>
    ${box('base', 'شخصيته وطريقة حكيه', 'مين هو، كيف يحكي، شو ممنوع يحكي')}
    ${box('orders', 'كيف يسحب الطلب', 'شو لازم يجمع قبل ما يسجّل الطلب، وكيف يأكد مع الزبون')}
    ${box('handoff', 'متى يحوّل لموظف', 'الحالات اللي بيوقف فيها وبينبّه البنات')}
    <div class="row" style="margin-top:12px"><button class="btn pri" data-act="agPromptSave">حفظ</button><button class="btn" data-act="agDefaults">عبّي الافتراضي عشان أعدّل عليه</button><button class="btn" data-act="agTab" data-id="test">جرّب</button></div></div>`;
}

/* ---------- التعلّم من المحادثات ---------- */
async function agLearn(ag) {
  if (!('learned' in ag)) return '<div class="card"><p class="note">التعلّم بيحتاج ملف <b>17_ai_learn.sql</b> على Supabase (SQL Editor) مرة وحدة.</p></div>';
  const sc = ui.agLScope ?? '';
  const cur = sc ? (ST.aiPages.find(p => p.page_id === sc) || {}) : ag;
  const draft = ui.agLDraft?.scope === sc ? ui.agLDraft : null;
  const opts = [['', 'كل الصفحات'], ...ST.mpages.map(m => [m.page_id, m.name || m.page_id])];
  return `<div class="card"><h2>تعلّم من محادثات البنات</h2>
    <p class="m">بيقرأ المحادثات اللي صار فيها طلب (آخر 90 يوم، والمسلّمة أول)، وشوية محادثات ضاعت. وبيطلّع منها: الأسئلة المتكررة وأحسن الردود، طريقة الإقناع، والرد على "غالي" و"بدي أفكر"، ومعلومات التوصيل والاستخدام. بتراجع النتيجة وبتعدّل عليها، وبعد الحفظ بيصير الوكيل يحكي زي البنات الشاطرات.</p>
    <div class="fgrid">
      <label class="fld"><span>من وين يتعلّم</span><select id="agl_scope">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === sc ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="fld"><span>كم محادثة</span><select id="agl_n">${[20, 40, 80, 120].map(x => `<option ${x === (ui.agLN || 40) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    </div>
    <label class="toggle" style="display:flex;gap:10px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="agl_smart" ${ui.agLSmart ? 'checked' : ''}><span><b>تعلّم بموديل أذكى (Sonnet)</b><br><small class="m">مرة وحدة، أدق بالتحليل. بيكلّف تقريباً 10 سنت بدل سنت. الردود اليومية بتضل على الموديل الرخيص.</small></span></label>
    <div class="row" style="margin-top:10px"><button class="btn pri" data-act="agLearn">${ui.agLBusy ? '…عم يقرأ المحادثات' : 'تعلّم هلأ'}</button>${cur.learned_at ? `<small class="m">آخر تعلّم: ${fmtDT(cur.learned_at)} من ${N(cur.learned_n)} محادثة</small>` : '<small class="m">لسا ما تعلّم</small>'}</div></div>
   <div class="card"><h2>${draft ? 'النتيجة الجديدة: راجعها قبل الحفظ' : 'الخبرة اللي بيستخدمها هلأ'}</h2>
    ${draft ? `<p class="m">قرأ ${draft.n} محادثة (${draft.won} فيها طلب، ${draft.lost} ضاعت) · التكلفة ${usd(draft.cost)}</p>` : ''}
    <textarea id="agl_text" rows="18" style="width:100%" placeholder="لسا فاضي. اضغط «تعلّم هلأ»، أو اكتب بإيدك أسئلة الزباين وأحسن الردود.">${esc(draft ? draft.text : cur.learned || '')}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn pri" data-act="agLearnSave">حفظ واستخدمها</button>${draft ? '<button class="btn" data-act="agLearnDrop">تجاهل النتيجة</button>' : ''}<button class="btn" data-act="agTab" data-id="test">جرّب الوكيل</button></div></div>`;
}

/* ---------- الإعدادات ---------- */
async function agSettings(ag) {
  const n = (id, l, v, u, step = 1) => `<label class="fld"><span>${l}</span><div class="row"><input id="${id}" type="number" step="${step}" min="0" value="${esc(v)}" style="width:110px"> <small class="m">${u}</small></div></label>`;
  const perConv = (2500 * N(ag.price_in) + 150 * N(ag.price_out)) / 1e6 * 6;
  return `<div class="card"><h2>الموديل والتكلفة</h2>
    <label class="fld"><span>الموديل</span><select id="ag_model">${MODELS.map(([v, l]) => `<option value="${v}" ${ag.model === v ? 'selected' : ''}>${l}</option>`).concat(MODELS.some(m => m[0] === ag.model) ? [] : [`<option value="${esc(ag.model)}" selected>${esc(ag.model)}</option>`]).join('')}</select></label>
    <div class="fgrid">${n('ag_pin', 'سعر المدخلات لكل مليون توكن', ag.price_in, 'دولار', '0.01')}${n('ag_pout', 'سعر المخرجات لكل مليون توكن', ag.price_out, 'دولار', '0.01')}</div>
    <p class="note">تقدير: محادثة فيها 6 ردود بتكلف تقريباً <b>${usd(perConv)}</b> (≈ ${jd(perConv * USD_JOD)}). يعني 1000 محادثة ≈ ${usd(perConv * 1000)}. ولو غيّرت الموديل، عدّل الأسعار حسب صفحة أسعار Anthropic.</p></div>
   <div class="card"><h2>طريقة الشغل</h2><div class="fgrid">
    ${n('ag_delay', 'يستنى قبل ما يرد', ag.delay_sec, 'ثانية (الزبون بيكتب كذا رسالة ورا بعض)')}
    ${n('ag_cap', 'أقصى عدد ردود باليوم', ag.daily_cap, 'رد (حماية من الصرف)')}
    <label class="fld"><span>أوقات الشغل</span><select id="ag_hours"><option value="always" ${ag.hours_mode === 'always' ? 'selected' : ''}>طول الوقت</option><option value="off_hours" ${ag.hours_mode === 'off_hours' ? 'selected' : ''}>بس برا دوام البنات</option><option value="hours" ${ag.hours_mode === 'hours' ? 'selected' : ''}>بس بين الساعتين</option></select></label>
    <label class="fld"><span>من الساعة</span><input id="ag_from" type="time" value="${esc(String(ag.hours_from || '09:00').slice(0, 5))}"></label>
    <label class="fld"><span>للساعة</span><input id="ag_to" type="time" value="${esc(String(ag.hours_to || '22:00').slice(0, 5))}"></label></div>
    <label class="toggle" style="display:flex;gap:10px;align-items:flex-start;margin-top:10px"><input type="checkbox" id="ag_human" ${ag.stop_on_human ? 'checked' : ''}><span><b>إذا ردّت بنت بنفسها، الوكيل بيوقف على هالمحادثة</b><br><small class="m">بالرد التلقائي بس. البنت بتقدر ترجّعه من صندوق الرسائل.</small></span></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" data-act="agSave">حفظ الإعدادات</button></div></div>
   <div class="card"><h2>التجهيز (مرة وحدة)</h2><ol class="m" style="line-height:2">
    <li>بـ Supabase ← Edge Functions ← Secrets: لازم يكون في <code>ANTHROPIC_API_KEY</code>.</li>
    <li>انشر دالة <code>ai-agent</code> مع إطفاء Enforce JWT verification.</li>
    <li>رابط الدالة بينحفظ لحاله لما تحفظ الإعدادات: <code dir="ltr">${esc(fnUrl())}</code> ${ag.fn_url ? pill('محفوظ', 'good') : pill('لسا', 'warn')}</li>
    <li>اختار الصفحات من "الصفحات"، وجرّب من "جرّب الوكيل"، وبعدين شغّله.</li></ol></div>`;
}

/* ---------- التجربة ---------- */
async function agTest() {
  ui.agChat = ui.agChat || [];
  const pid = ui.agTestPage || ST.mpages[0]?.page_id || '';
  const last = ui.agLast;
  return `<div class="cols agtest"><div class="card"><div class="head" style="margin-bottom:8px"><h2>محادثة تجربة</h2><div class="row"><select id="ag_tpage" class="inl" aria-label="الصفحة">${ST.mpages.map(m => `<option value="${esc(m.page_id)}" ${m.page_id === pid ? 'selected' : ''}>${esc(m.name || m.page_id)}</option>`).join('') || '<option value="">بدون صفحة</option>'}</select><button class="btn sm" data-act="agTestReset">من جديد</button></div></div>
      <p class="m">إنت الزبون. اكتب زي ما بيكتب الزبون الحقيقي. ما في إشي بينبعت لحدا وما بينعمل طلب حقيقي.</p>
      <div class="msgs agchat" id="agchat">${ui.agChat.map(m => `<div class="bub ${m.from === 'customer' ? 'c' : 'e'}">${esc(m.text)}${m.from === 'customer' ? '' : '<small>الوكيل</small>'}</div>`).join('') || '<div class="empty">ابعت أول رسالة، مثلاً: "مرحبا بكم المنجارو؟"</div>'}${ui.agBusy ? '<div class="bub e">…بيكتب</div>' : ''}</div>
      <div class="composer"><textarea id="ag_tmsg" rows="2" placeholder="اكتب كزبون… (Ctrl+Enter)"></textarea><div class="row"><button class="btn pri" data-act="agTestSend" ${ui.agBusy ? 'disabled' : ''}>ابعت</button></div></div></div>
    <div class="card"><h2>شو فهم الوكيل</h2>${last ? `
      <div class="kv"><span>تحويل لموظف</span><b>${last.handoff ? pill('أيوا: ' + esc(last.handoff_reason || ''), 'warn') : 'لأ'}</b></div>
      <div class="kv"><span>الطلب جاهز؟</span><b>${last.order?.ready ? pill('جاهز، كان رح ينسجل', 'good') : 'لسا'}</b></div>
      ${['product:المنتج', 'qty:الكمية', 'name:الاسم', 'phone:الرقم', 'city:المدينة', 'address:العنوان', 'total:السعر الخاص'].map(s => { const [k, l] = s.split(':'); return last.order?.[k] != null && last.order[k] !== '' ? `<div class="kv"><span>${l}</span><b>${esc(last.order[k])}</b></div>` : ''; }).join('')}
      <div class="kv"><span>تكلفة هالرد</span><b>${usd(last.cost)} <small class="m">(${fmt(last.tin)} + ${fmt(last.tout)} توكن)</small></b></div>
      <div class="kv"><span>الموديل</span><b dir="ltr">${esc(last.model || '')}</b></div>
      <div class="kv"><span>مجموع التجربة</span><b>${usd(sum(ui.agCosts || [], c => c))}</b></div>` : '<p class="note">بعد أول رد بتشوف هون شو جمع من بيانات الطلب، وإذا قرر يحوّل لموظف، وكم كلّف.</p>'}</div></div>`;
}

/* ---------- الأفعال ---------- */
Object.assign(A, {
  agTab: (k, el) => { ui.agTab = k; if (el?.dataset?.page) { ui.agTestPage = el.dataset.page; ui.agChat = []; ui.agLast = null; } K.render(); },
  agPer: k => { ui.agPer = k; K.render(); },
  agToggle: async () => { const on = !ST.agent?.enabled; await db.upd('ai_agent', {id: 1}, {enabled: on, fn_url: fnUrl(), updated_at: new Date().toISOString()}); toast(on ? 'الوكيل اشتغل' : 'الوكيل وقف'); K.render(); },
  agSave: async () => {
    const g = id => $('#' + id)?.value;
    await db.upd('ai_agent', {id: 1}, {model: g('ag_model'), price_in: N(g('ag_pin')), price_out: N(g('ag_pout')), delay_sec: Math.min(60, Math.round(N(g('ag_delay')))),
      daily_cap: Math.max(1, Math.round(N(g('ag_cap')))), hours_mode: g('ag_hours'), hours_from: g('ag_from') || '09:00', hours_to: g('ag_to') || '22:00',
      stop_on_human: !!$('#ag_human')?.checked, fn_url: fnUrl(), updated_at: new Date().toISOString()});
    toast('انحفظت الإعدادات'); K.render();
  },
  agPromptSave: async () => {
    await db.upd('ai_agent', {id: 1}, {prompt_base: $('#agp_base').value.trim(), prompt_orders: $('#agp_orders').value.trim(), prompt_handoff: $('#agp_handoff').value.trim(), fn_url: fnUrl(), updated_at: new Date().toISOString()});
    toast('انحفظت التعليمات'); K.render();
  },
  agDefaults: async () => {
    const d = await db.fn('ai-agent', {action: 'defaults'});
    [['base', d.base], ['orders', d.orders], ['handoff', d.handoff]].forEach(([k, v]) => { const t = $('#agp_' + k); if (t && !t.value.trim()) t.value = v; });
    toast('انعبّت الخانات الفاضية بالافتراضي. عدّل واضغط حفظ');
  },
  agPageSave: async pid => {
    const card = $$(".agpage").find(c => c.dataset.page === pid); if (!card) return;
    const mode = card.querySelector('.agmodes input:checked')?.value || 'off';
    const prods = [...card.querySelectorAll('.agprods input:checked')].map(i => i.value);
    const m = ST.mpages.find(x => x.page_id === pid);
    await db.rpc('ai_page_save', {pid, pname: m?.name || pid, pmode: mode, prods, pprompt: card.querySelector('.agpp').value.trim()});
    if (mode !== 'off' && ST.agent && !ST.agent.fn_url) await db.upd('ai_agent', {id: 1}, {fn_url: fnUrl()});
    toast(mode === 'off' ? 'انحفظت. الوكيل موقف على هالصفحة' : 'انحفظت الصفحة' + (ST.agent?.enabled ? '' : '. ما تنسى تشغّل الوكيل من فوق')); K.render();
  },
  agLearn: async () => {
    if (ui.agLBusy) return;
    ui.agLScope = $('#agl_scope')?.value ?? ''; ui.agLN = +($('#agl_n')?.value || 40); ui.agLSmart = !!$('#agl_smart')?.checked;
    ui.agLBusy = true; await K.render();
    try { const r = await db.fn('ai-agent', {action: 'learn', page_id: ui.agLScope, n: ui.agLN, smart: ui.agLSmart}); ui.agLDraft = {...r, scope: ui.agLScope}; toast('خلص. راجع النتيجة واضغط حفظ'); }
    catch (e) { toast(e.message, true); }
    ui.agLBusy = false; K.render();
  },
  agLearnSave: async () => {
    const sc = $('#agl_scope')?.value ?? ui.agLScope ?? '';
    await db.rpc('ai_learn_save', {pid: sc || null, txt: $('#agl_text').value.trim(), n: ui.agLDraft?.scope === sc ? N(ui.agLDraft.n) : 0});
    ui.agLDraft = null; toast('انحفظت. الوكيل صار يستخدم هالخبرة'); K.render();
  },
  agLearnDrop: () => { ui.agLDraft = null; K.render(); },
  agTestReset: () => { ui.agChat = []; ui.agLast = null; ui.agCosts = []; K.render(); },
  agTestSend: async () => {
    const t = $('#ag_tmsg'), txt = t?.value.trim(); if (!txt || ui.agBusy) return;
    ui.agTestPage = $('#ag_tpage')?.value || ui.agTestPage;
    ui.agChat = [...(ui.agChat || []), {from: 'customer', text: txt}]; ui.agBusy = true; await K.render(); scrollChat();
    try {
      const r = await db.fn('ai-agent', {action: 'test', page_id: ui.agTestPage || '', messages: ui.agChat});
      ui.agChat.push({from: 'page', text: r.reply || '(ما رد)'}); ui.agLast = r; ui.agCosts = [...(ui.agCosts || []), N(r.cost)];
    } catch (e) { toast(e.message, true); ui.agChat.pop(); }
    ui.agBusy = false; await K.render(); scrollChat(); $('#ag_tmsg')?.focus();
  },
  // صندوق الرسائل
  aiSuggestNow: async id => { toast('الوكيل بيكتب اقتراح…'); try { await db.fn('ai-agent', {action: 'suggest', conv_id: id}); K.render(); } catch (e) { toast(e.message, true); } },
  aiUse: () => { const c = ui.convData; const r = $('#reply'); if (c?.ai_suggest && r) { r.value = c.ai_suggest; r.focus(); } },
  aiCopy: () => { if (ui.convData?.ai_suggest) copyText(ui.convData.ai_suggest); },
  aiConvToggle: async id => { const c = ui.convData; await db.rpc('ai_conv_toggle', {cid: id, off: !c?.ai_off}); toast(c?.ai_off ? 'الوكيل رجع يشتغل على هالمحادثة' : 'الوكيل وقف على هالمحادثة'); K.render(); }
});
const scrollChat = () => { const c = $('#agchat'); if (c) c.scrollTop = c.scrollHeight; };
document.addEventListener('keydown', e => { if (e.target?.id === 'ag_tmsg' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); A.agTestSend(); } });
document.addEventListener('change', e => {
  if (e.target?.id === 'agl_scope') { ui.agLScope = e.target.value; K.render(); }
  if (e.target?.id === 'ag_tpage') { ui.agTestPage = e.target.value; ui.agChat = []; ui.agLast = null; K.render(); }
  if (e.target?.closest?.('.agmodes')) { e.target.closest('.agmodes').querySelectorAll('.agmode').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); }
});

/* ---------- صندوق الرسائل: اقتراح الوكيل ---------- */
// بتنضاف فوق خانة الرد إذا الصفحة عليها الوكيل
K.inboxExtra = conv => {
  if (!conv || !(can('inbox', 'edit') || can('ai'))) return '';
  const pg = (ST.aiPages || []).find(p => p.page_id === (conv.fb_page_id || conv.page_id));
  if (!pg || pg.mode === 'off') return '';
  return `<div class="aibox"><div class="row" style="justify-content:space-between"><b>✨ الوكيل الذكي ${conv.ai_off ? pill('موقف على هالمحادثة', 'warn') : pg.mode === 'auto' ? pill('بيرد تلقائي', 'good') : pill('اقتراحات', 'info')}</b>
    <span class="row" style="gap:4px"><button class="btn sm" data-act="aiSuggestNow" data-id="${conv.id}">اقترح رد</button><button class="btn sm ghost" data-act="aiConvToggle" data-id="${conv.id}">${conv.ai_off ? 'رجّع الوكيل' : 'وقّفه هون'}</button></span></div>
    ${conv.ai_suggest ? `<p class="aitext">${esc(conv.ai_suggest)}</p><div class="row" style="gap:4px"><button class="btn sm pri" data-act="aiCopy">انسخ</button><button class="btn sm" data-act="aiUse">حطه بالرد</button><small class="m">${conv.ai_at ? fmtDT(conv.ai_at) : ''}</small></div>` : '<small class="m">ما في اقتراح لسا.</small>'}</div>`;
};
K.onEnter.push(() => { if (can('inbox') || can('ai')) loadAgent().catch(() => {}); });
})();
