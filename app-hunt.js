/* صابر أونلاين ERP — صيد العملاء للوكالة
   بحث شركات من خرائط جوجل أو OpenStreetMap، تقييم الفرصة، رسالة مخصصة، وإرسال من واتساب بكبسة. */
(() => {
'use strict';
const K = window.App._;
const {$, $$, esc, N, fmt, jd, toast, head, kpi, pill, chips, copyText, can, V, A, ST, ui, ACT_SEC} = K;
const db = new Proxy({}, {get: (_, k) => { const d = K.db; const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; }});

const STATUSES = ['جديد', 'انبعتت', 'رد', 'مهتم', 'اجتماع', 'عميل', 'مش مهتم', 'رقم غلط'];
const ST_CLS = {'جديد': '', 'انبعتت': 'info', 'رد': 'brand', 'مهتم': 'good', 'اجتماع': 'good', 'عميل': 'good', 'مش مهتم': 'bad', 'رقم غلط': 'bad'};
const IDEAS = ['عيادات أسنان', 'عيادات تجميل', 'مطاعم', 'كافيهات', 'صالونات تجميل', 'جيم', 'مراكز تعليمية', 'محلات ملابس', 'مكاتب عقارات', 'معارض سيارات', 'صيدليات', 'فنادق'];
const AREAS = ['عمّان', 'عبدون', 'الصويفية', 'خلدا', 'تلاع العلي', 'الشميساني', 'جبل عمّان', 'مرج الحمام', 'الزرقاء', 'إربد', 'العقبة', 'السلط', 'مادبا', 'المفرق', 'جرش'];
const scoreCls = s => s >= 60 ? 'good' : s >= 35 ? 'warn' : '';

Object.assign(ACT_SEC, {hSearch: 'leads', hMsgs: 'leads', hMsgOne: 'leads', hWa: 'leads', hImg: 'leads', hLead: 'leads', hCfgSave: 'leads', hImgDel: 'leads', hSelAll: 'leads', hFilter: 'leads', hShow: 'leads'});

V.hunt = async () => {
  const f = ui.hFilter || 'جديد';
  const o = {order: ['score', false], order2: ['created_at', false], limit: 300};
  if (f !== 'all' && f !== 'wa') o.eq = {status: f};
  if (ui.hSid) { o.eq = {search_id: ui.hSid}; }
  const [rows, stats, cfg, hist] = await Promise.all([
    db.q('prospects', f === 'wa' && !ui.hSid ? {...o, eq: {status: 'جديد'}} : o).catch(() => null),
    db.rpc('prospect_stats').catch(() => null),
    db.q('prospect_cfg', {eq: {id: 1}}).then(r => r[0]).catch(() => null),
    db.q('prospect_searches', {order: ['at', false], limit: 40}).catch(() => [])]);
  ST.hHist = hist || [];
  if (!rows) return head('صيد العملاء', '') + '<div class="card"><p class="note">هالشاشة بتحتاج ملف <b>20_prospects.sql</b> على Supabase، ودالة <b>prospects</b>.</p></div>';
  ST.hCfg = cfg || {};
  const list = f === 'wa' && !ui.hSid ? rows.filter(r => r.wa) : rows;
  const curS = ui.hSid && ST.hHist.find(h => h.id === ui.hSid);
  ui.hRows = list;
  const s = stats || {};
  const sel = ui.hSel || (ui.hSel = new Set());
  return head('صيد العملاء', 'دوّر على شركات بمنطقة، شوف مين بحاجة تسويق، وابعتلهم رسالة مخصصة من واتساب. موظف حقيقي بيبعت، عشان الرقم ما يتسكّر') +
    `<div class="kpis">${kpi('بالقائمة', N(s.total), N(s.new) + ' لسا ما انبعتلهم')}${kpi('انبعتلهم', N(s.sent), 'إنت اليوم ' + N(s.today_me) + ' من ' + N(s.daily_limit), N(s.today_me) >= N(s.daily_limit) ? 'red' : '')}
     ${kpi('ردّوا', N(s.replied), N(s.sent) ? 'نسبة الرد ' + Math.round(N(s.replied) / N(s.sent) * 100) + '%' : '')}${kpi('مهتمين', N(s.interested), N(s.clients) + ' صاروا عملاء', 'hl')}
     ${kpi('بحث جوجل هالشهر', N(s.google_used) + ' / ' + N(s.google_limit), 'كل بحث لحد 20 شركة · مجاني')}</div>
    <div class="card"><h2>دوّر على شركات</h2>
      <div class="fgrid">
        <label class="fld"><span>نوع الشغل</span><input id="h_q" list="h_ideas" value="${esc(ui.hQ || '')}" placeholder="مثلاً: عيادات أسنان"><datalist id="h_ideas">${IDEAS.map(x => `<option value="${x}">`).join('')}</datalist></label>
        <label class="fld"><span>المنطقة أو المدينة</span><input id="h_area" list="h_areas" value="${esc(ui.hArea || 'عمّان')}"><datalist id="h_areas">${AREAS.map(x => `<option value="${x}">`).join('')}</datalist></label>
        <label class="fld"><span>من وين</span><select id="h_src"><option value="google" ${ui.hSrc !== 'osm' ? 'selected' : ''}>خرائط جوجل (أدق، فيها أرقام وتقييمات)</option><option value="osm" ${ui.hSrc === 'osm' ? 'selected' : ''}>OpenStreetMap (مجاني بالكامل، أرقام أقل)</option></select></label>
        <label class="fld"><span>كم شركة بدك (لحد 2000)</span><input id="h_target" type="number" min="20" max="2000" step="10" list="h_targets" value="${N(ui.hTarget) || 60}"><datalist id="h_targets">${[60, 100, 200, 500, 1000, 2000].map(x => `<option value="${x}">`).join('')}</datalist></label>
      </div>
      <div class="row" style="margin-top:8px"><button class="btn pri" data-act="hSearch">${ui.hBusy ? '…عم يدوّر' + (N(ui.hTarget) > 60 ? ' (ممكن ياخد دقيقة)' : '') : 'دوّر'}</button><small class="m">كل 20 نتيجة من جوجل تقريباً = بحث واحد من الـ${N(s.google_limit) || 950} المجانية بالشهر (باقيلك ${Math.max(0, N(s.google_limit) - N(s.google_used))}). أكثر من 60 بيقسم المنطقة مربعات لحاله.</small></div></div>
    <details class="card" ${cfg && !cfg.offer ? 'open' : ''}><summary><b>العرض والصورة والرسالة</b> ${cfg?.offer ? '' : pill('عبّيهم أول', 'warn')}</summary>
      <div class="fgrid" style="margin-top:8px">
        <label class="fld" style="grid-column:1/-1"><span>العرض اللي بتقدمه</span><textarea id="h_offer" rows="2" placeholder="مثلاً: تدقيق مجاني لصفحتكم وإعلاناتكم، وأول شهر إدارة إعلانات بخصم 30%">${esc(cfg?.offer || '')}</textarea></label>
        <label class="fld" style="grid-column:1/-1"><span>تعليمات للرسالة (اختياري)</span><textarea id="h_prompt" rows="2" placeholder="مثلاً: احكي إنه عنا شغل مع عيادات بعمّان، وخليها رسمية شوي">${esc(cfg?.prompt || '')}</textarea></label>
        <label class="fld"><span>التوقيع</span><input id="h_sig" value="${esc(cfg?.signature || '')}" placeholder="وليد · OOPSIDE"></label>
        <label class="fld"><span>حد الرسائل لكل موظف باليوم</span><input id="h_lim" type="number" min="1" value="${N(cfg?.daily_limit) || 30}"></label>
        <label class="fld"><span>صورة العرض</span><input type="file" accept="image/*" id="h_img"></label>
        <div>${cfg?.image ? `<img src="${esc(cfg.image)}" alt="صورة العرض" style="max-width:160px;border-radius:10px;border:1px solid var(--line)"><br><button class="btn sm ghost" data-act="hImgDel">شيل الصورة</button>` : '<small class="m">ما في صورة</small>'}</div>
      </div><div class="row" style="margin-top:8px"><button class="btn pri" data-act="hCfgSave">حفظ</button></div></details>
    ${ST.hHist.length ? `<details class="card" ${ui.hHistOpen ? 'open' : ''}><summary><b>سجل البحث</b> <small class="m">(${ST.hHist.length})</small></summary>${K.table([
      {h: 'البحث', f: h => `<b>${esc(h.query)}</b> <small class="m">${esc(h.area || '')}</small>`}, {h: 'من وين', f: h => h.source === 'osm' ? 'OSM' : 'جوجل'},
      {h: 'إمتى', f: h => `<small>${K.fmtDT(h.at)}${h.by_name ? ' · ' + esc(h.by_name) : ''}</small>`}, {h: 'لقى', f: h => N(h.found) + ` <small class="m">(${N(h.new_count)} جديدة)</small>`},
      {h: '', f: h => `<button class="btn sm" data-act="hShow" data-id="${h.id}">اعرض نتائجه</button>`}], ST.hHist)}</details>` : ''}
    ${curS ? `<div class="card" style="border-color:var(--info)"><div class="row" style="justify-content:space-between"><span>عم تشوف نتائج: <b>${esc(curS.query)}</b> ${esc(curS.area || '')} · ${K.fmtDT(curS.at)}</span><button class="btn sm" data-act="hShow" data-id="">رجوع للكل</button></div></div>` : ''}
    <div class="row" style="margin:12px 0 6px;justify-content:space-between">${chips([['جديد', 'جديد'], ['wa', 'جديد وعليه واتساب'], ['انبعتت', 'انبعتت'], ['رد', 'رد'], ['مهتم', 'مهتم'], ['اجتماع', 'اجتماع'], ['عميل', 'عميل'], ['مش مهتم', 'مش مهتم'], ['all', 'الكل']], f, 'hFilter')}
      <span class="row" style="gap:6px"><button class="btn sm" data-act="hSelAll">${sel.size ? 'ألغِ التحديد (' + sel.size + ')' : 'حدد أول 20'}</button><button class="btn sm pri" data-act="hMsgs" ${sel.size ? '' : 'disabled'}>✨ اكتب رسائل للمحدد</button></span></div>
    ${list.length ? `<div class="hgrid">${list.map(card).join('')}</div>` : '<div class="card"><p class="note">ما في شركات هون. دوّر من فوق.</p></div>'}`;
};

function card(p) {
  const sel = ui.hSel?.has(p.id);
  return `<div class="card hcard" data-id="${p.id}"><div class="head" style="margin-bottom:4px"><label class="row" style="gap:6px;align-items:flex-start"><input type="checkbox" class="hsel" value="${p.id}" ${sel ? 'checked' : ''} aria-label="حدد"><b>${esc(p.name)}</b></label>${pill(p.score + '%', scoreCls(p.score))}</div>
    <div class="m">${esc(p.address || p.area || '')}</div>
    <div class="row" style="gap:6px;margin:6px 0">${p.rating ? pill('★ ' + p.rating + ' (' + N(p.reviews) + ')', '') : ''}${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener" class="m">الموقع</a>` : pill('بدون موقع', 'warn')}${p.maps_url ? `<a href="${esc(p.maps_url)}" target="_blank" rel="noopener" class="m">الخريطة</a>` : ''}${p.source === 'osm' ? pill('OSM') : ''}</div>
    ${(p.reasons || []).length ? `<small class="m">ليش فرصة: ${p.reasons.map(esc).join('، ')}</small>` : ''}
    <div class="row" style="gap:6px;margin:6px 0">${p.wa ? `<b dir="ltr">+${esc(p.wa)}</b>` : p.phone ? `<span dir="ltr">${esc(p.phone)}</span> <small class="m">أرضي</small>` : '<small class="m">ما في رقم</small>'}
      <select class="inl hstatus" data-id="${p.id}" aria-label="الحالة">${STATUSES.map(x => `<option ${x === p.status ? 'selected' : ''}>${x}</option>`).join('')}</select>${p.sent_at ? `<small class="m">${esc(p.sent_by_name || '')}</small>` : ''}</div>
    <textarea class="hmsg" rows="5" style="width:100%" placeholder="اضغط ✨ عشان يكتب رسالة مخصصة، أو اكتبها بإيدك">${esc(p.msg || '')}</textarea>
    <div class="row" style="gap:4px;margin-top:6px"><button class="btn sm" data-act="hMsgOne" data-id="${p.id}">✨ اكتب</button>
      ${p.wa ? `<button class="btn sm pri" data-act="hWa" data-id="${p.id}">واتساب</button>` : ''}${ST.hCfg?.image ? `<button class="btn sm" data-act="hImg">انسخ الصورة</button>` : ''}
      ${p.phone ? `<a class="btn sm ghost" href="tel:${esc(p.phone.replace(/\s/g, ''))}">اتصل</a>` : ''}${p.lead_id ? pill('بالعملاء المحتملين', 'good') : `<button class="btn sm ghost" data-act="hLead" data-id="${p.id}">← عميل محتمل</button>`}</div></div>`;
}

async function shrinkImg(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const m = Math.min(1, 1080 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * m); c.height = Math.round(img.height * m); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85);
}
const msgOf = id => $$('.hcard').find(c => c.dataset.id === id)?.querySelector('.hmsg')?.value.trim() || '';

Object.assign(A, {
  hFilter: k => { ui.hFilter = k; ui.hSid = null; ui.hSel = new Set(); K.render(); },
  hSearch: async () => {
    if (ui.hBusy) return;
    ui.hQ = $('#h_q').value.trim(); ui.hArea = $('#h_area').value.trim(); ui.hSrc = $('#h_src').value; ui.hTarget = Math.min(2000, Math.max(20, +$('#h_target').value || 60));
    if (!ui.hQ) { toast('اكتب نوع الشغل', true); return; }
    const norm = x => String(x || '').replace(/[أإآ]/g, 'ا').replace(/ّ/g, '').trim();
    const dup = (ST.hHist || []).find(h => norm(h.query) === norm(ui.hQ) && norm(h.area) === norm(ui.hArea) && (h.source || 'google') === ui.hSrc);
    if (dup && ui.hConfirm !== dup.id) { ui.hConfirm = dup.id; toast(`دوّرت على "${dup.query}" بـ${dup.area || ''} قبل (${K.fmtDT(dup.at)}) ولقيت ${N(dup.found)}. غالباً رح يطلع نفس الشركات. جرّب منطقة أصغر، أو اضغط دوّر مرة ثانية إذا متأكد`, true); return; }
    ui.hConfirm = null;
    ui.hBusy = true; await K.render();
    try { const r = await db.fn('prospects', {action: 'search', query: ui.hQ, area: ui.hArea, source: ui.hSrc, target: ui.hTarget});
      toast(N(r.found) ? `لقيت ${N(r.found)} شركة: ${N(r.new)} جديدة، والباقي كانت عندك من قبل${N(r.calls) ? ' · استخدم ' + N(r.calls) + ' بحث من المجاني' : ''}` : 'ما لقيت شركات. جرّب كلمة ثانية أو منطقة أكبر', !N(r.new)); ui.hFilter = 'جديد'; ui.hSid = r.search_id || null; ui.hHistOpen = false; }
    catch (e) { toast(e.message, true); }
    ui.hBusy = false; K.render();
  },
  hShow: id => { ui.hSid = id || null; ui.hSel = new Set(); K.render(); window.scrollTo(0, 0); },
  hSelAll: () => { if (ui.hSel?.size) ui.hSel = new Set(); else ui.hSel = new Set((ui.hRows || []).slice(0, 20).map(r => r.id)); K.render(); },
  hMsgs: async () => {
    const ids = [...(ui.hSel || [])]; if (!ids.length) return;
    if (!ST.hCfg?.offer) { toast('اكتب العرض أول (العرض والصورة والرسالة)', true); return; }
    toast('عم يكتب ' + ids.length + ' رسالة…');
    for (let i = 0; i < ids.length; i += 20) await db.fn('prospects', {action: 'messages', ids: ids.slice(i, i + 20)});
    ui.hSel = new Set(); toast('جهزت الرسائل. راجعها وابعت'); K.render();
  },
  hMsgOne: async id => { if (!ST.hCfg?.offer) { toast('اكتب العرض أول (العرض والصورة والرسالة)', true); return; } toast('عم يكتب…'); await db.fn('prospects', {action: 'messages', ids: [id]}); K.render(); },
  hWa: async id => {
    const p = (ui.hRows || []).find(r => r.id === id); if (!p?.wa) return;
    const txt = msgOf(id); if (!txt) { toast('اكتب الرسالة أول، أو اضغط ✨', true); return; }
    window.open('https://wa.me/' + p.wa + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    const r = await db.rpc('prospect_sent', {pid: id, txt});
    if (N(r?.today) >= N(r?.limit)) toast(`وصلت ${N(r.today)} رسالة اليوم (الحد ${N(r.limit)}). وقّف لبكرة عشان الرقم ما يتسكّر`, true);
    else toast(ST.hCfg?.image ? 'انفتح واتساب. الصق الصورة (Ctrl+V) وابعت' : 'انفتح واتساب. ابعت الرسالة');
    if (ST.hCfg?.image) A.hImg(true);
    setTimeout(() => K.render(), 600);
  },
  hImg: async quiet => {
    const src = ST.hCfg?.image; if (!src) return;
    try {
      const b = await (await fetch(src)).blob();
      const png = await new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0); c.toBlob(res, 'image/png'); }; i.src = URL.createObjectURL(b); });
      await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
      if (quiet !== true) toast('انسخت الصورة. الصقها بواتساب (Ctrl+V)');
    } catch (e) { const a = document.createElement('a'); a.href = src; a.download = 'offer.jpg'; a.click(); if (quiet !== true) toast('ما قدرت أنسخها، نزّلتها بدالها'); }
  },
  hLead: async id => { await db.rpc('prospect_to_lead', {pid: id}); toast('انضافت للعملاء المحتملين'); K.render(); },
  hCfgSave: async () => {
    const patch = {offer: $('#h_offer').value.trim(), prompt: $('#h_prompt').value.trim(), signature: $('#h_sig').value.trim(), daily_limit: Math.max(1, +$('#h_lim').value || 30)};
    const f = $('#h_img')?.files?.[0]; if (f) patch.image = await shrinkImg(f);
    await db.upd('prospect_cfg', {id: 1}, patch); toast('انحفظ'); K.render();
  },
  hImgDel: async () => { await db.upd('prospect_cfg', {id: 1}, {image: null}); K.render(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.classList?.contains('hsel')) { ui.hSel = ui.hSel || new Set(); t.checked ? ui.hSel.add(t.value) : ui.hSel.delete(t.value); const b = $('[data-act=hMsgs]'); if (b) b.disabled = !ui.hSel.size; const s = $('[data-act=hSelAll]'); if (s) s.textContent = ui.hSel.size ? 'ألغِ التحديد (' + ui.hSel.size + ')' : 'حدد أول 20'; }
  if (t.classList?.contains('hstatus')) { try { await db.upd('prospects', {id: t.dataset.id}, {status: t.value, updated_at: new Date().toISOString()}); toast('انحفظت الحالة'); } catch (x) { toast(x.message, true); } }
});
// حفظ الرسالة لما الموظف يعدّلها
document.addEventListener('focusout', async e => {
  const t = e.target; if (!t.classList?.contains('hmsg')) return;
  const id = t.closest('.hcard')?.dataset.id, p = (ui.hRows || []).find(r => r.id === id);
  if (p && (p.msg || '') !== t.value.trim()) { p.msg = t.value.trim(); try { await db.upd('prospects', {id}, {msg: p.msg}); } catch (x) {} }
});
})();
