/* صابر أونلاين ERP — المرحلة 1
   الواجهة كلها هون. البيانات والحسابات والصلاحيات بقاعدة البيانات (supabase/schema.sql). */
(() => {
'use strict';

/* ================= أدوات ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = n => (Math.round(N(n) * 1000) / 1000).toLocaleString('en-US', {maximumFractionDigits: 3});
const jd = n => fmt(n) + ' د.أ';
const pct = n => (N(n) * 100).toFixed(1) + '%';
const sum = (a, f) => a.reduce((s, x) => s + N(f(x)), 0);
const today = () => new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Amman'});
const addDays = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const monthOf = d => d.slice(0, 7);
const monthEnd = m => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10); };
const fmtDT = t => t ? new Date(t).toLocaleString('en-GB', {timeZone: 'Asia/Amman', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '—';
const dayName = d => new Date(d + 'T12:00:00Z').toLocaleDateString('ar-JO', {weekday: 'long', timeZone: 'UTC'});
const cleanPhone = p => String(p || '').replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const PHONE_RE = /^(\+?962|0)?7[789]\d{7}$/;

const STATUSES = ['في الانتظار','قيد التجهيز','قيد التوصيل','تم التوصيل','مؤجل','ملغي','مرفوض برسوم','مرفوض بدون رسوم','مكتمل مسلم','مكتمل راجع'];
const ST_CLS = {'في الانتظار':'info','قيد التجهيز':'brand','قيد التوصيل':'warn','تم التوصيل':'good','مؤجل':'warn','ملغي':'','مرفوض برسوم':'bad','مرفوض بدون رسوم':'bad','مكتمل مسلم':'good','مكتمل راجع':''};
const OUTCOMES = ['تم التوصيل','مؤجل','ملغي','مرفوض برسوم','مرفوض بدون رسوم'];
const ACTIVE_ST = ['في الانتظار','قيد التجهيز','قيد التوصيل','تم التوصيل','مؤجل','مرفوض برسوم','مرفوض بدون رسوم'];
const SOURCES = ['ماسنجر','إنستغرام','تعليقات','لاندنج بيج','تيك توك','اتصال','زبون قديم'];
const AG_CATS = ['إيجار المكتب','برامج واشتراكات','تصوير وإنتاج','معدات','إعلانات للوكالة نفسها','مواصلات','رواتب ومكافآت','نثريات','أخرى'];
const EXP_CATS = ['إيجار مكتب ومستودع','كهرباء وماء','إنترنت واتصالات','تغليف','برامج واشتراكات','مواصلات','رواتب ومكافآت','نثريات','أخرى'];
const COLORS = ['#0f4c45','#8a3b12','#2c5f8f','#6b3f8a','#a0611a','#3e6b2a','#9b2d4a','#334155'];
const SECTIONS = [['dash','لوحة التحكم'],['orders','الطلبات والشحنات'],['delivery','التوصيل والجولات'],
  ['inbox','صندوق الرسائل'],['control','غرفة التحكم'],['team','مراقبة الموظفين'],['tasks','المهام'],
  ['ads','الحسابات الإعلانية'],['landing','صفحات الهبوط'],['page','تقوية الصفحة'],
  ['products','المنتجات'],['inventory','المستودع'],['purchases','المشتريات'],
  ['agency','الوكالة وعملاءها'],['leads','العملاء المحتملين'],
  ['accounting','المحاسبة'],['expenses','المصاريف'],['staff','الموظفين والرواتب'],
  ['oops','موقع الوكالة والأسعار'],['ai','المساعد الذكي'],['users','المستخدمين والصلاحيات'],['settings','الإعدادات']];
const SEC_NAME = Object.fromEntries(SECTIONS.concat([['myday','دوامي'],['mytasks','مهامي'],['portal','متابعة الشغل'],['client','ملف العميل'],['agdash','لوحة الوكالة'],['pagesrep','أداء صفحات البيع'],['oreq','طلبات الموقع'],['oreqd','طلب من الموقع'],['funnel','من الإعلان للإيراد'],['agent','الوكيل الذكي'],['olive','زوار الموقع الآن'],['hunt','صيد العملاء']]));
const PERSONAL = new Set(['myday','mytasks']);
/* مساحتين شغل منفصلات: المتجر الأونلاين ووكالة التسويق. كل وحدة إلها قوائمها وحساباتها */
const NAVS = {
  store: [['اليومي', ['dash','orders','delivery']], ['شغلي', ['myday','mytasks']], ['الرسائل والفريق', ['inbox','agent','control','team','tasks']],
    ['التسويق', ['ads','pagesrep','landing','page']], ['المخزون', ['products','inventory','purchases']],
    ['المالية', ['accounting','expenses','staff']], ['الإدارة', ['ai','users','settings']]],
  agency: [['الوكالة', ['agdash','oreq','leads','hunt','agency']], ['النمو', ['olive','funnel','oops']], ['شغلي', ['myday','mytasks']], ['الفريق', ['tasks','team']],
    ['المالية', ['accounting','expenses','staff']], ['الإدارة', ['ai','users','settings']]]
};
const NAV = NAVS.store;
const WS = {store: {name: 'المتجر الأونلاين', mark: 'م', sub: 'الطلبات والتوصيل والمستودع والرسائل والإعلانات'},
  agency: {name: 'وكالة التسويق', mark: 'و', sub: 'العملاء والحملات والتسليمات والعملاء المحتملين'}};
const STORE_ONLY = ['dash','orders','delivery','inbox','control','ads','landing','page','products','inventory','purchases'];
const ALIAS = {agent: 'ai', olive: 'leads', hunt: 'leads', agdash: 'agency', pagesrep: 'dash', oreq: 'leads', oreqd: 'leads', funnel: 'leads'};
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const TEMPLATES = {
  'مدير عام': null,
  'موظفة رسائل': {inbox:'edit', orders:'edit', products:'view'},
  'مشرفة فريق': {dash:'view', control:'edit', team:'view', inbox:'edit', orders:'edit', tasks:'edit', page:'edit', products:'view'},
  'مدخل طلبات': {dash:'view', orders:'edit', products:'view'},
  'مستودع وتوصيل': {dash:'view', orders:'edit', delivery:'edit', products:'view', inventory:'edit', purchases:'edit'},
  'محاسب': {dash:'view', orders:'view', delivery:'view', inventory:'view', purchases:'view', expenses:'edit', accounting:'view', staff:'view'},
  'ميديا باير': {dash:'view', ads:'edit', landing:'edit', page:'edit', products:'view', ai:'edit'},
  'تسويق ومبيعات للشركات': {leads:'edit', agency:'view'},
  'مدير الوكالة': {agency:'edit', leads:'edit', oops:'edit', tasks:'edit', team:'view', ai:'edit'},
  'فريق إنتاج وتصميم': {},
  'مخصص': {}
};
const TPL_DESC = {
  'مدير عام': 'كل الأقسام، تعديل كامل، وإدارة المستخدمين',
  'موظفة رسائل': 'بوابة خاصة: رسائلها، والطلبات، ودوامها ومهامها. تحت المراقبة',
  'مشرفة فريق': 'غرفة التحكم ومراقبة الموظفين والرسائل والمهام',
  'مدخل طلبات': 'بيدخل طلبات وبيجهزها، وبيشوف المنتجات',
  'مستودع وتوصيل': 'الطلبات والجولات والسائقين والمستودع والمشتريات',
  'محاسب': 'المصاريف تعديل، والمحاسبة والرواتب والطلبات عرض فقط',
  'ميديا باير': 'الحسابات الإعلانية وصفحات الهبوط وتقوية الصفحة والمساعد الذكي',
  'تسويق ومبيعات للشركات': 'بيجيب شركات ومطاعم للوكالة وبيتابعهم لحد التعاقد',
  'مدير الوكالة': 'عملاء الوكالة، وطلبات الموقع وعروض الأسعار، والخدمات والأسعار، والمهام',
  'فريق إنتاج وتصميم': 'مهامه وتسليماته (صور، فيديو، تصاميم) بس',
  'مخصص': 'إنت بتحدد كل قسم لحال'
};

let db = null, me = null;
const ST = {settings: null, products: [], couriers: []};
const K = {onEnter: [], onLogout: [], onLive: [], liveIgnore: new Set(), liveViews: {}, badges: {}, badgeRed: {}, statusLine: '', adsList: []};
const ui = {view: 'dash', ofilter: 'نشط', search: '', delTab: 'today', month: monthOf(today()), invTab: 'stock', ws: '', opage: ''};

/* ================= طبقة البيانات (Supabase) ================= */
function arabicErr(e) {
  const m = String(e?.message || e || '');
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return 'ما عندك صلاحية لهالعملية';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'في مشكلة بالاتصال بالإنترنت. جرّب مرة ثانية';
  if (/JWT|token/i.test(m)) return 'انتهت الجلسة. سجّل دخول من جديد';
  return m;
}
function authErr(e) {
  const m = String(e?.message || e || '');
  if (/Invalid login credentials/i.test(m)) return 'الإيميل أو كلمة السر غلط';
  if (/Email not confirmed/i.test(m)) return 'الإيميل مش مؤكد. اطفي "Confirm email" من إعدادات Supabase';
  if (/already registered|already been registered|exists/i.test(m)) return 'الإيميل مستخدم من قبل';
  if (/Password should be|at least 6/i.test(m)) return 'كلمة السر لازم 6 أحرف على الأقل';
  if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة. استنى شوي وجرّب';
  if (/not authorized|Email address not authorized/i.test(m)) return 'إرسال الإيميلات مش مفعّل. لازم تربط SMTP بإعدادات Supabase (شوف دليل التشغيل)';
  if (/Error sending|sending recovery|SMTP/i.test(m)) return 'صار خطأ بإرسال الإيميل. تأكد من إعدادات SMTP بـ Supabase';
  if (/same as the old|different from the old/i.test(m)) return 'كلمة السر الجديدة لازم تكون مختلفة عن القديمة';
  if (/Signups not allowed/i.test(m)) return 'إنشاء الحسابات مسكّر من إعدادات Supabase. فعّل Allow new users to sign up';
  return arabicErr(e);
}
function supaDb(cfg) {
  const sb = window.supabase.createClient(cfg.url, cfg.key, {auth: {flowType: 'implicit', detectSessionInUrl: true, persistSession: true}});
  const chk = ({data, error}) => { if (error) throw new Error(arabicErr(error)); return data; };
  const apply = (r, o) => {
    for (const [k, v] of Object.entries(o.eq || {})) r = r.eq(k, v);
    for (const [k, v] of Object.entries(o.in || {})) r = r.in(k, v);
    for (const [k, v] of Object.entries(o.gte || {})) r = r.gte(k, v);
    for (const [k, v] of Object.entries(o.lte || {})) r = r.lte(k, v);
    if (o.ilike) r = r.ilike(o.ilike[0], o.ilike[1]);
    for (const k of o.isNull || []) r = r.is(k, null);
    return r;
  };
  return {
    async user() { const {data} = await sb.auth.getSession(); return data.session?.user || null; },
    async signIn(email, password) { const {data, error} = await sb.auth.signInWithPassword({email, password}); if (error) throw new Error(authErr(error)); return data.user; },
    async signOut() { try { sb.removeAllChannels(); } catch (e) {} await sb.auth.signOut(); },
    async signUpSelf(email, password, name) {
      const {data, error} = await sb.auth.signUp({email, password, options: {data: {name}}});
      if (error) throw new Error(authErr(error)); return data;
    },
    async createUser(email, password, name) {
      const tmp = window.supabase.createClient(cfg.url, cfg.key, {auth: {persistSession: false, autoRefreshToken: false, storageKey: 'saber-tmp-signup'}});
      const {data, error} = await tmp.auth.signUp({email, password, options: {data: {name}}});
      if (error) throw new Error(authErr(error));
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('الإيميل مستخدم من قبل');
      return data.user.id;
    },
    async resetPassword(email) {
      const redirectTo = location.origin + location.pathname;
      const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo});
      if (error) throw new Error(authErr(error));
    },
    async changeMyPassword(pw) { const {error} = await sb.auth.updateUser({password: pw}); if (error) throw new Error(authErr(error)); },
    async q(t, o = {}) {
      let r = apply(sb.from(t).select(o.select || '*'), o);
      for (const [c, asc] of o.order ? [o.order].concat(o.order2 ? [o.order2] : []) : []) r = r.order(c, {ascending: !!asc});
      if (o.limit) r = r.limit(o.limit);
      return chk(await r);
    },
    async rpc(fn, args) { return chk(await sb.rpc(fn, args || {})); },
    async ins(t, row) { return chk(await sb.from(t).insert(row).select()); },
    async upd(t, match, patch) {
      const rows = chk(await apply(sb.from(t).update(patch), {eq: match}).select());
      if (!rows.length) throw new Error('ما عندك صلاحية لهالعملية'); return rows;
    },
    async del(t, match, allowEmpty) { const rows = chk(await apply(sb.from(t).delete(), {eq: match}).select()); if (!rows.length && !allowEmpty) throw new Error('ما عندك صلاحية لهالعملية'); },
    live(cb) { sb.channel('saber-live').on('postgres_changes', {event: '*', schema: 'public'}, p => cb(p.table, p)).subscribe(); },
    async qAll(t, o = {}) {
      const out = []; for (let from = 0; ; from += 1000) {
        let r = apply(sb.from(t).select(o.select || '*'), o).range(from, from + 999);
        const rows = chk(await r); out.push(...rows); if (rows.length < 1000) break;
      } return out;
    },
    async fn(name, body) {
      const {data, error} = await sb.functions.invoke(name, {body});
      if (error) {
        let msg = error.message || '';
        const st = error.context?.status;
        try { const t = await error.context?.text?.(); let j = null; try { j = JSON.parse(t); } catch (e) {}
          if (j?.error || j?.message || j?.msg) msg = j.error || j.message || j.msg;
          else if (st === 504 || st === 546 || /timeout|WORKER|wall clock/i.test(t || '')) msg = 'الدالة "' + name + '" طوّلت أكثر من اللازم أو وقفت (' + st + '). جرّب طلب أصغر أو بعد دقيقة';
          else if (st) msg = 'الدالة "' + name + '" رجّعت خطأ ' + st + (t ? ': ' + String(t).slice(0, 200) : ''); } catch (e) {}
        if (/not found|404|Failed to send/i.test(msg)) msg = 'الدالة "' + name + '" مش منشورة على Supabase لسا. شوف دليل الربط';
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    }
  };
}

/* ================= الصلاحيات ================= */
const isAdmin = () => me?.role === 'مدير عام';
const perm = sec => !me ? 'none' : isAdmin() ? 'edit' : (me.perms?.[sec] || 'none');
const isClient = () => me?.role === 'عميل';
const can = (sec, lvl = 'view') => (sec = ALIAS[sec] || sec, PERSONAL.has(sec)) ? !!me && !isClient() : lvl === 'edit' ? perm(sec) === 'edit' : perm(sec) !== 'none';
const ACT_SEC = {
  orderForm:'orders', setPage:'orders', toPrep:'orders', toWaiting:'orders', cancelOrd:'orders', allPrep:'orders', editInfo:'orders',
  dispatchOne:'delivery', dispatchSel:'delivery', outcomeForm:'delivery', closeRunForm:'delivery', closeDay:'delivery', kForm:'delivery', kPay:'delivery',
  prodForm:'products', prodToggle:'products', adjForm:'inventory', purForm:'purchases', expForm:'expenses', expDel:'expenses',
  userForm:'users', saveSettings:'settings', addCity:'settings'
};
const canAct = act => act === 'reopenDay' ? isAdmin() : !ACT_SEC[act] || can(ACT_SEC[act], 'edit');
function applyPerms(root) {
  root.querySelectorAll('[data-act]').forEach(b => { if (!canAct(b.dataset.act)) b.hidden = true; });
  if (!can('delivery', 'edit')) root.querySelectorAll('[data-chg="outcome"]').forEach(x => x.disabled = true);
}

/* ================= عناصر الواجهة ================= */
function toast(t, bad) { const el = $('#toast'); el.textContent = t; el.className = bad ? 'bad' : ''; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3400); }
const pill = (t, c) => `<span class="pill ${c || ''}">${esc(t)}</span>`;
const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ''}"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
const head = (t, sub, btns = '') => `<div class="head"><div><h1>${t}${me && !isAdmin() && perm(ui.view) === 'view' ? '<span class="demo ro">عرض فقط</span>' : ''}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="row">${btns}</div></div>`;
function table(cols, rows, empty = 'ما في بيانات لسا', rowCls) {
  if (!rows.length) return `<div class="tw"><div class="empty">${empty}</div></div>`;
  return `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr class="${rowCls ? rowCls(r) : ''}">${cols.map(c => `<td class="${c.c || ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const chips = (items, cur, act) => `<div class="chips">${items.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="${act}" data-id="${esc(k)}">${l}</button>`).join('')}</div>`;
function copyText(t) {
  const fallback = () => { openInfo('انسخ النص', `<textarea id="cpy" rows="10" class="inl" style="width:100%;font-size:13px;padding:8px">${esc(t)}</textarea>`); setTimeout(() => $('#cpy')?.select(), 30); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(() => toast('انسخ النص')).catch(fallback); else fallback();
}
let modalCancel = null;
function closeM(saved) { const c = modalCancel; modalCancel = null; $('#modal').hidden = true; $('#mform').oninput = null; if (saved !== true && typeof c === 'function') c(); else if (pendingRefresh) { pendingRefresh = false; render(); } }
function openInfo(title, html) {
  $('#mtitle').textContent = title;
  $('#mform').innerHTML = html + '<div class="fact"><button class="btn" type="button" data-act="closeM">إغلاق</button></div>';
  $('#mform').onsubmit = e => e.preventDefault(); $('#mform').oninput = null;
  applyPerms($('#mform')); $('#modal').hidden = false;
}
/* نموذج عام: الحقول {k,l,t,opts,req,def,wide} */
function openForm(title, fields, init, onSave, submitLabel = 'حفظ') {
  modalCancel = null; $('#mtitle').textContent = title;
  $('#mform').innerHTML = `<div class="fgrid">${fields.map(f => fieldHtml(f, init?.[f.k])).join('')}</div><p class="lerr" id="ferr"></p><div class="fact"><button class="btn pri" type="submit" id="fsave">${submitLabel}</button><button class="btn" type="button" data-act="closeM">إلغاء</button></div>`;
  $('#mform').oninput = null;
  $('#mform').onsubmit = async e => {
    e.preventDefault(); const v = {};
    for (const f of fields) {
      if (f.t === 'image') { v[f.k] = formImg; continue; }
      if (f.t === 'color') { v[f.k] = $(`input[name="${f.k}"]:checked`)?.value || COLORS[0]; continue; }
      if (f.t === 'checks') { v[f.k] = $$(`input[name="${f.k}"]:checked`).map(x => x.value); continue; }
      const el = $('#f_' + f.k); v[f.k] = f.t === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
    }
    const btn = $('#fsave'); btn.disabled = true; $('#ferr').textContent = '';
    try { const err = await onSave(v); if (err) { $('#ferr').textContent = err; btn.disabled = false; return; } closeM(true); }
    catch (x) { $('#ferr').textContent = arabicErr(x); btn.disabled = false; }
  };
  formImg = init?.image || null;
  $('#modal').hidden = false; setTimeout(() => $('#mform input:not([type=hidden]):not([type=radio]),#mform select,#mform textarea')?.focus(), 30);
}
let formImg = null;
function fieldHtml(f, v) {
  const id = 'f_' + f.k; let inp; const val = v ?? f.def ?? '';
  if (f.t === 'select') inp = `<select id="${id}">${f.opts.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  else if (f.t === 'checks') inp = `<div class="checks">${f.opts.map((o, i) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<label class="ck"><input type="checkbox" id="${id}-${i}" name="${f.k}" value="${esc(ov)}" ${(v || []).includes(ov) ? 'checked' : ''}><span>${esc(ol)}</span></label>`; }).join('')}</div>`;
  else if (f.t === 'textarea') inp = `<textarea id="${id}" rows="${f.rows || 3}">${esc(val)}</textarea>`;
  else if (f.t === 'image') inp = `<input id="${id}" type="file" accept="image/*" data-img="1">${v ? `<img src="${esc(v)}" alt="" style="max-height:70px;border-radius:6px;margin-top:6px">` : ''}`;
  else if (f.t === 'color') inp = `<div class="checks">${COLORS.map((c, i) => `<label><input type="radio" id="${id}-${i}" name="${f.k}" value="${c}" ${c === (v || COLORS[0]) ? 'checked' : ''}><span class="sw" style="background:${c}"></span></label>`).join('')}</div>`;
  else inp = `<input id="${id}" type="${f.t || 'text'}" ${f.t === 'number' ? 'step="any" inputmode="decimal"' : ''} ${f.min != null ? `min="${f.min}"` : ''} value="${esc(val)}" ${f.req ? 'required' : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`;
  return `<label class="fld ${f.wide || f.t === 'textarea' || f.t === 'checks' ? 'wide' : ''}" ${f.t === 'checks' ? '' : `for="${id}"`}><span>${f.l}</span>${inp}${f.hint ? `<small class="m">${f.hint}</small>` : ''}</label>`;
}
function shrink(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const k = Math.min(1, 480 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}

/* ================= تحميل البيانات الأساسية ================= */
async function loadBase() {
  const [s, p, k] = await Promise.all([db.q('settings', {eq: {id: 1}}), db.q('products', {order: ['name', true]}), db.q('couriers', {order: ['name', true]})]);
  ST.settings = s[0] || {company: 'صابر أونلاين', city_fees: {}, areas: {}};
  ST.products = p; ST.couriers = k;
  ST.pages = await db.q('sales_pages', {order: ['name', true]}).catch(() => []);
}
const pageName = id => (ST.pages || []).find(p => p.id === id)?.name || '';
const P = id => ST.products.find(p => p.id === id);
const cities = () => Object.keys(ST.settings?.city_fees || {}).sort((a, b) => (b === 'عمان') - (a === 'عمان') || a.localeCompare(b, 'ar'));
const feeFor = c => N(ST.settings?.city_fees?.[c] ?? 3);
const areasFor = c => ST.settings?.areas?.[c] || [];

/* ================= الدخول ================= */
async function showLogin(msg) {
  $('.app').hidden = true; const el = $('#login'); el.hidden = false;
  let setup = false; try { setup = await db.rpc('needs_setup'); } catch (e) {}
  let company = 'صابر أونلاين', logo = ''; try { const st = (await db.q('settings', {eq: {id: 1}, select: 'company,logo'}))[0]; company = st?.company || company; logo = st?.logo || ''; } catch (e) { try { company = (await db.q('settings', {eq: {id: 1}}))[0]?.company || company; } catch (e2) {} }
  el.innerHTML = `<div class="lwrap"><div class="lside">${(setIcon(logo), '')}<div class="logo" style="padding:0"><i class="${logo ? 'img' : ''}">${logo ? `<img src="${esc(logo)}" alt="">` : 'ص'}</i><div>${esc(company)}<small>نظام إدارة الشركة</small></div></div>
    <h1>${setup ? 'أهلين، خلينا نجهز حساب المدير' : 'أهلين، سجّل دخولك'}</h1>
    <p>${setup ? 'هاد أول تشغيل للنظام. اعمل حساب المدير العام بنفس الإيميل اللي كتبته بملف قاعدة البيانات.' : 'كل موظف إله حساب خاص، وبيشوف بس الأقسام اللي إله صلاحية عليها.'}</p>
    <ul><li>كل عملية بتنسجل باسم اللي عملها</li><li>الصلاحيات محمية من قاعدة البيانات نفسها</li><li>بيشتغل على الجوال والكمبيوتر</li></ul></div>
   <form class="lform" id="lform"><h2>${setup ? 'إنشاء حساب المدير العام' : 'تسجيل الدخول'}</h2>
    ${setup ? `<label class="fld" for="lname"><span>الاسم</span><input id="lname" required autocomplete="name"></label>` : ''}
    <label class="fld" for="lemail"><span>الإيميل</span><input id="lemail" type="email" autocomplete="username" required></label>
    <label class="fld" for="lpass"><span>كلمة السر${setup ? ' (6 أحرف على الأقل)' : ''}</span><input id="lpass" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 6 : 1}"></label>
    <p class="lerr" id="lerr">${esc(msg || '')}</p><button class="btn pri" type="submit" id="lbtn">${setup ? 'إنشاء الحساب والدخول' : 'دخول'}</button>
    ${setup ? '' : '<button class="btn ghost" type="button" id="lforgot">نسيت كلمة السر؟</button>'}</form></div>`;
  $('#lforgot')?.addEventListener('click', () => showForgot($('#lemail').value.trim()));
  $('#lform').onsubmit = async e => {
    e.preventDefault(); const btn = $('#lbtn'); btn.disabled = true; $('#lerr').textContent = '';
    const email = $('#lemail').value.trim().toLowerCase(), pw = $('#lpass').value;
    try {
      let user;
      if (setup) {
        const r = await db.signUpSelf(email, pw, $('#lname').value.trim());
        if (!r.session) throw new Error('انعمل الحساب بس لازم تأكيد الإيميل. اطفي "Confirm email" من Supabase ← Authentication ← Providers ← Email، أو أكّد من رسالة الإيميل وارجع سجّل دخول');
        user = r.user;
      } else user = await db.signIn(email, pw);
      await enter(user, true);
    } catch (x) { $('#lerr').textContent = authErr(x); btn.disabled = false; }
  };
  setTimeout(() => $(setup ? '#lname' : '#lemail')?.focus(), 30);
}
function loginShell(title, sub, formHtml) {
  $('.app').hidden = true; const el = $('#login'); el.hidden = false;
  el.innerHTML = `<div class="lwrap"><div class="lside"><div class="logo" style="padding:0"><i>ص</i><div>${esc(ST.settings?.company || 'صابر أونلاين')}<small>نظام إدارة الشركة</small></div></div><h1>${title}</h1><p>${sub}</p></div><form class="lform" id="lform">${formHtml}</form></div>`;
}
function showForgot(email) {
  loginShell('نسيت كلمة السر؟', 'اكتب إيميلك وبنبعتلك رابط تعمل فيه كلمة سر جديدة. الرابط بيشتغل مرة وحدة ولفترة محدودة.',
    `<h2>استرجاع كلمة السر</h2><label class="fld" for="femail"><span>الإيميل</span><input id="femail" type="email" autocomplete="username" required value="${esc(email || '')}"></label>
     <p class="lerr" id="lerr"></p><p class="note" id="fok" hidden></p><button class="btn pri" type="submit" id="lbtn">ابعتلي رابط</button><button class="btn ghost" type="button" id="lback">رجوع لتسجيل الدخول</button>`);
  $('#lback').onclick = () => showLogin();
  $('#lform').onsubmit = async e => {
    e.preventDefault(); const btn = $('#lbtn'); btn.disabled = true; $('#lerr').textContent = '';
    try {
      await db.resetPassword($('#femail').value.trim().toLowerCase());
      const ok = $('#fok'); ok.hidden = false; ok.textContent = 'إذا الإيميل مسجّل عندنا، رح توصلك رسالة خلال دقيقة. افتح الرابط اللي فيها من نفس الجهاز. إذا ما وصلت، شيّك على الـ Spam.';
      btn.textContent = 'ابعت مرة ثانية'; setTimeout(() => btn.disabled = false, 60000);
    } catch (x) { $('#lerr').textContent = authErr(x); btn.disabled = false; }
  };
  setTimeout(() => $('#femail')?.focus(), 30);
}
function showSetNewPassword(user) {
  loginShell('كلمة سر جديدة', 'اكتب كلمة السر الجديدة، وبعدها بتدخل على النظام مباشرة.',
    `<h2>تعيين كلمة سر جديدة</h2><p class="note">${esc(user.email || '')}</p>
     <label class="fld" for="np1"><span>كلمة السر الجديدة (6 أحرف على الأقل)</span><input id="np1" type="password" autocomplete="new-password" required minlength="6"></label>
     <label class="fld" for="np2"><span>أعد كتابتها</span><input id="np2" type="password" autocomplete="new-password" required minlength="6"></label>
     <p class="lerr" id="lerr"></p><button class="btn pri" type="submit" id="lbtn">حفظ والدخول</button>`);
  $('#lform').onsubmit = async e => {
    e.preventDefault(); const a = $('#np1').value, b = $('#np2').value;
    if (a.length < 6) { $('#lerr').textContent = 'كلمة السر لازم 6 أحرف على الأقل'; return; }
    if (a !== b) { $('#lerr').textContent = 'الكلمتين مش متطابقات'; return; }
    const btn = $('#lbtn'); btn.disabled = true;
    try { await db.changeMyPassword(a); toast('تغيّرت كلمة السر'); await enter(user, true); }
    catch (x) { $('#lerr').textContent = authErr(x); btn.disabled = false; }
  };
  setTimeout(() => $('#np1')?.focus(), 30);
}
async function enter(user, fresh) {
  const p = await db.q('profiles', {eq: {id: user.id}});
  me = p[0] || null;
  if (!me || !me.active) {
    const setupFail = me && !me.active && me.role === 'بدون';
    await db.signOut(); me = null;
    return showLogin(setupFail ? 'حسابك انعمل بس لسا مش مفعّل. اطلب من المدير يفعّله ويعطيك صلاحيات' : 'الحساب مش موجود أو موقوف');
  }
  if (fresh) db.rpc('touch_login').catch(() => {});
  await loadBase();
  try { db.live(onLive); } catch (e) {}
  for (const f of K.onEnter) { try { f(); } catch (e) {} }
  if (isClient()) { ui.view = 'portal'; $('#login').hidden = true; $('.app').hidden = false; return render(); }
  const wl = wsList();
  ui.ws = lsGet('saber-ws-' + me.id); if (!wl.includes(ui.ws)) ui.ws = '';
  if (wl.length > 1 && (fresh || !ui.ws)) return showWsChooser(wl);
  goWs(ui.ws || wl[0] || 'store', true);
}
/* ---------- اختيار مساحة الشغل ---------- */
const wsList = () => isClient() ? [] : [...(STORE_ONLY.some(k => can(k)) ? ['store'] : []), ...(can('agency') || can('leads') || can('oops') ? ['agency'] : [])];
const logoOf = w => (w === 'agency' ? ST.settings?.agency_logo : ST.settings?.logo) || '';
const markHtml = (w, letter) => logoOf(w) ? `<img src="${esc(logoOf(w))}" alt="">` : esc(letter);
const setIcon = url => { let l = document.querySelector('link[rel=icon]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } const v = url || 'favicon.png'; if (l.getAttribute('href') !== v) l.setAttribute('href', v); };
const wsName = w => w === 'agency' ? (ST.settings?.agency_name || WS.agency.name) : (ST.settings?.company || WS.store.name);
function showWsChooser(wl) {
  $('.app').hidden = true; const el = $('#login'); el.hidden = false;
  el.innerHTML = `<div class="wspick"><h1>أهلين ${esc(me?.name || '')}، وين بدك تشتغل هلأ؟</h1><p class="m">كل قسم إله شاشاته وحساباته لحال. بتقدر تبدّل بأي وقت من الزر اللي فوق.</p>
    <div class="wscards">${wl.map(w => `<button class="wscard" data-ws="${w}" type="button"><i class="${logoOf(w) ? 'img' : ''}">${markHtml(w, WS[w].mark)}</i><b>${esc(wsName(w))}</b><span>${WS[w].sub}</span></button>`).join('')}</div>
    <button class="btn ghost" type="button" id="wsout">خروج</button></div>`;
  el.querySelectorAll('.wscard').forEach(b => b.onclick = () => goWs(b.dataset.ws));
  $('#wsout').onclick = logout;
  setTimeout(() => el.querySelector('.wscard')?.focus(), 30);
}
function goWs(w, keep) {
  ui.ws = w; lsSet('saber-ws-' + me.id, w); document.body.dataset.ws = w;
  $('#login').hidden = true; $('.app').hidden = false;
  const allowed = NAVS[w].flatMap(g => g[1]).filter(k => can(k));
  if (!keep || !allowed.includes(ui.view)) ui.view = w === 'agency' ? (allowed.find(k => !PERSONAL.has(k)) || allowed[0] || 'mytasks')
    : can('inbox', 'edit') && !can('dash') ? 'inbox' : (allowed.find(k => !PERSONAL.has(k)) || allowed[0] || 'dash');
  render(); window.scrollTo?.(0, 0);
}
async function logout() { for (const f of K.onLogout) { try { f(); } catch (e) {} } await db.signOut(); me = null; ui.view = 'dash'; ui.opage = ''; closeM(); showLogin(); }

/* ================= العرض ================= */
let renderSeq = 0, pendingRefresh = false, liveT = 0;
function onLive(table, payload) {
  for (const f of K.onLive) { try { f(table, payload); } catch (e) {} }
  if (K.liveIgnore.has(table) && !K.liveViews[ui.view]?.includes(table)) return;
  clearTimeout(liveT);
  liveT = setTimeout(async () => {
    if (table === 'products') { try { ST.products = await db.q('products', {order: ['name', true]}); } catch (e) {} }
    softRender();
  }, 700);
}
function softRender() {
  const a = document.activeElement;
  if (!$('#modal').hidden || (a && a.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { pendingRefresh = true; return; }
  render(true);
}
// التحديث التلقائي ما بيحرّك الشاشة: إذا ما تغيّر شي ما منلمس الصفحة، وإذا تغيّر منرجّع مكان التمرير والكتابة
const sameKey = h => h.replace(/(data-since="[^"]*"[^>]*>)[^<]*/g, '$1');
let lastPaint = {view: '', key: ''};
function paintMain(html, soft) {
  const main = $('#main'), key = sameKey(html);
  if (soft && lastPaint.view === ui.view && lastPaint.key === key) return;
  const keep = soft && lastPaint.view === ui.view, sc = {}, val = {}, wy = window.scrollY;
  if (keep) {
    main.querySelectorAll('[id]').forEach(el => {
      if (el.scrollTop > 0 || el.scrollHeight > el.clientHeight) sc[el.id] = {t: el.scrollTop, end: el.scrollHeight - el.scrollTop - el.clientHeight < 30};
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) && el.type !== 'file') val[el.id] = el.value;
    });
  }
  main.innerHTML = html; lastPaint = {view: ui.view, key};
  if (!keep) return;
  for (const id in val) { const el = document.getElementById(id); if (el && el.value !== val[id]) el.value = val[id]; }
  for (const id in sc) { const el = document.getElementById(id); if (el) el.scrollTop = sc[id].end && id === 'msgs' ? el.scrollHeight : sc[id].t; }
  window.scrollTo(0, wy);
}
async function render(soft) {
  if (!me) return;
  const seq = ++renderSeq;
  const ws = ui.ws || 'store', wl = wsList();
  $('#coName').textContent = isClient() ? (ST.settings?.agency_name || ST.settings?.company || 'صابر أونلاين') : wsName(ws);
  const lw = isClient() ? 'agency' : ws, li = $('.app .logo i'); if (li) { li.className = logoOf(lw) ? 'img' : ''; li.innerHTML = markHtml(lw, lw === 'agency' ? 'و' : 'ص'); }
  document.title = (isClient() ? (ST.settings?.agency_name || '') : wsName(ws)) || 'صابر أونلاين';
  setIcon(logoOf(lw));
  const bar = $('#wsbar');
  if (bar) { bar.hidden = isClient(); const other = wl.find(w => w !== ws);
    bar.innerHTML = `<div class="wsin"><i class="${logoOf(ws) ? 'img' : ''}">${markHtml(ws, WS[ws].mark)}</i><div><small>إنت هلأ بـ</small><b>${esc(wsName(ws))}</b></div></div>${other ? `<button class="btn sm wsbtn" data-act="switchWs" type="button"><span aria-hidden="true">⇄</span> روح لـ${esc(wsName(other))}</button>` : ''}`; }
  $('#me').innerHTML = `<div><b>${esc(me.name || me.email)}</b><small>${esc(me.role)}${K.statusLine ? ' · ' + K.statusLine : ''}</small></div><div class="row" style="gap:4px"><button data-act="myPw">كلمة السر</button><button data-act="logout">خروج</button></div>`;
  const nav = isClient() ? [['', ['portal']]] : NAVS[ws].map(([g, ks]) => [g, ks.filter(k => can(k))]).filter(g => g[1].length);
  $('#nav').innerHTML = nav.map(([g, ks]) => `<div class="grp">${g}</div>` + ks.map(k => `<button class="${ui.view === k || (k === 'agency' && ui.view === 'client') || (k === 'oreq' && ui.view === 'oreqd') ? 'on' : ''}" data-act="go" data-id="${k}"><span>${SEC_NAME[k]}</span>${K.badges[k] ? `<em class="${K.badgeRed[k] ? 'red' : ''}">${K.badges[k]}</em>` : ''}</button>`).join('')).join('');
  if (!nav.length) { $('#main').innerHTML = '<p class="note">ما إلك صلاحية على أي قسم. راجع المدير.</p>'; return; }
  const slow = soft ? 0 : setTimeout(() => { if (seq === renderSeq) $('#main').classList.add('loading'); }, 180);
  try {
    const html = await V[ui.view]();
    if (seq !== renderSeq) return;
    paintMain(html, soft); applyPerms($('#main'));
  } catch (e) {
    if (seq === renderSeq) $('#main').innerHTML = `<div class="head"><h1>${SEC_NAME[ui.view] || ''}</h1></div><p class="note">${esc(arabicErr(e))}</p><div class="row"><button class="btn" data-act="go" data-id="${ui.view}">جرّب مرة ثانية</button></div>`;
  } finally { clearTimeout(slow); $('#main').classList.remove('loading'); }
  pendingRefresh = false;
}
const V = {};

/* ---------- لوحة التحكم ---------- */
V.dash = async () => {
  const t = today(), m0 = monthOf(t) + '-01';
  const [counts, runsToday, monthRuns, todayOrders, dayRow] = await Promise.all([
    db.q('v_status_counts'), db.q('v_runs', {eq: {day: t}}), db.q('v_runs', {gte: {day: m0}, eq: {status: 'مسكّرة'}}),
    db.q('v_orders', {eq: {day: t}, select: 'id,value,status'}), db.q('fin_days', {eq: {day: t}})]);
  const c = s => N(counts.find(x => x.status === s)?.n);
  const low = ST.products.filter(p => p.active && N(p.stock) <= N(p.min_stock));
  const open = runsToday.filter(r => r.status === 'مفتوحة');
  const mDel = sum(monthRuns, r => r.delivered), mRet = sum(monthRuns, r => N(r.rej_fee) + N(r.rej_free) + N(r.cancelled));
  return head('لوحة التحكم', `${dayName(t)} ${t}`) +
  `<div class="kpis">
    ${kpi('طلبات اليوم', todayOrders.length, jd(sum(todayOrders, o => o.value)), 'hl')}
    ${kpi('في الانتظار', c('في الانتظار'), 'لازم تتأكد وتتجهز')}
    ${kpi('قيد التجهيز', c('قيد التجهيز'), 'جاهزة تطلع مع السائق')}
    ${kpi('مع السائقين الآن', c('قيد التوصيل'), open.length + ' جولة مفتوحة')}
    ${kpi('تم توصيله اليوم', sum(runsToday, r => r.delivered), 'محصّل ' + jd(sum(runsToday, r => r.collect)))}
    ${kpi('مؤجل', c('مؤجل'), 'بيرجع للإرسال')}
  </div>
  <div class="cols">
   <div class="card"><h2>هذا الشهر (جولات مسكّرة)</h2>
    <div class="kv"><span>طلبات انسلّمت</span><b>${mDel}</b></div>
    <div class="kv"><span>قيمة البضاعة المسلّمة</span><b>${jd(sum(monthRuns, r => r.goods_del))}</b></div>
    <div class="kv"><span>المحصّل من الزبائن</span><b>${jd(sum(monthRuns, r => r.collect))}</b></div>
    <div class="kv"><span>أجور التوصيل</span><b>${jd(sum(monthRuns, r => r.charge))}</b></div>
    <div class="kv"><span>ربح الجولات</span><b class="pos">${jd(sum(monthRuns, r => r.profit))}</b></div>
    <div class="kv"><span>نسبة المرتجع</span><b>${mDel + mRet ? pct(mRet / (mDel + mRet)) : '—'}</b></div>
    <div class="kv"><span>ذمم على السائقين</span><b>${jd(sum(monthRuns, r => r.diff))}</b></div></div>
   <div class="card"><h2>اليوم المالي</h2>${dayRow.length ? `<p class="note">اليوم مسكّر. صافي اليوم <b>${jd(dayRow[0].report.net)}</b>.</p>` : open.length ? `<p class="note">في ${open.length} جولة مفتوحة لازم تتسكّر قبل إغلاق اليوم.</p>` : '<p class="note">ما في جولات مفتوحة. لما تخلص، سكّر اليوم من قسم التوصيل.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="go" data-id="delivery">افتح التوصيل والجولات</button></div></div>
  </div>
  <div class="card"><h2>تنبيهات المستودع</h2>${low.length ? table([{h:'المنتج', f:p => esc(p.name)}, {h:'الكمية', f:p => `<b class="${N(p.stock) <= 0 ? 'neg' : ''}">${p.stock}</b>`}, {h:'الحد الأدنى', f:p => p.min_stock}, {h:'', f:p => pill(N(p.stock) <= 0 ? 'نفد' : 'منخفض', N(p.stock) <= 0 ? 'bad' : 'warn')}], low) : '<p class="note">كل المنتجات فوق الحد الأدنى.</p>'}</div>`;
};

/* ---------- الطلبات ---------- */
function nextBtns(o) {
  const b = (act, l, cls) => `<button class="btn sm ${cls || ''}" data-act="${act}" data-id="${o.id}">${l}</button>`;
  const inOpenRun = o.run_id && o.run_status === 'مفتوحة';
  switch (o.status) {
    case 'في الانتظار': return b('toPrep', 'للتجهيز', 'pri') + b('cancelOrd', 'إلغاء', 'ghost');
    case 'قيد التجهيز': return b('dispatchOne', 'تعيين سائق', 'pri') + b('cancelOrd', 'إلغاء', 'ghost');
    case 'قيد التوصيل': return b('outcomeForm', 'النتيجة', 'pri');
    case 'مؤجل': return inOpenRun ? b('outcomeForm', 'تعديل النتيجة') : b('dispatchOne', 'إرسال من جديد', 'pri') + b('cancelOrd', 'إلغاء', 'ghost');
    case 'تم التوصيل': case 'مرفوض برسوم': case 'مرفوض بدون رسوم': case 'ملغي':
      return inOpenRun ? `<small class="m">بانتظار تسكير الجولة</small> ` + b('outcomeForm', 'تعديل') : '';
    default: return '';
  }
}
function ordersTable(list, actions = true) {
  return table([
    {h:'رقم', f:o => `<button class="btn sm" data-act="orderInfo" data-id="${o.id}">#${o.no}</button>`},
    {h:'التاريخ', f:o => `${o.day}<br><small class="m">${esc(o.created_by_name || '')}</small>`},
    {h:'الزبون', f:o => esc(o.customer) + `<br><small class="m">${esc(o.phone)} · ${esc(o.city)}${o.area ? ' - ' + esc(o.area) : ''}</small>`},
    {h:'الصفحة', f:o => o.page_name ? `<span class="pgtag">${esc(o.page_name)}</span>` + (o.source ? `<br><small class="m">${esc(o.source)}</small>` : '') : `<small class="m">${esc(o.source || '—')}</small>`},
    {h:'المنتجات', f:o => esc(o.items_txt || ''), c:'wrap'},
    {h:'على الزبون', f:o => `<b>${jd(o.cod)}</b><br><small class="m">منها توصيل ${fmt(o.delivery_fee)}</small>`},
    {h:'التوصيل', f:o => o.courier_name ? esc(o.courier_name) + (o.run_no ? `<br><small class="m">جولة #${o.run_no}</small>` : '') : '—'},
    {h:'الحالة', f:o => pill(o.status, ST_CLS[o.status]) + (o.status === 'مؤجل' && o.postpone_to ? `<br><small class="m">لـ ${o.postpone_to}</small>` : '')},
    ...(actions ? [{h:'الخطوة الجاية', f:o => `<div class="row" style="flex-wrap:nowrap">${nextBtns(o)}</div>`}] : [])
  ], list, 'ما في طلبات هون');
}
V.orders = async () => {
  const counts = await db.q('v_status_counts');
  const cnt = s => N(counts.find(x => x.status === s)?.n);
  const f = ui.ofilter, o = {order: ['created_at', false], limit: 200};
  if (f === 'نشط') o.in = {status: ACTIVE_ST}; else if (f !== 'الكل') o.eq = {status: f};
  if (ui.search) o.ilike = ['search', '%' + ui.search + '%'];
  if (ui.opage === 'none') o.isNull = ['sales_page_id']; else if (ui.opage) o.eq = {...(o.eq || {}), sales_page_id: ui.opage};
  const list = await db.q('v_orders', o);
  const pages = ST.pages || [];
  const step = (s, n) => `<button class="fstep ${f === s ? 'on' : ''}" data-act="ofilter" data-id="${s}"><small>${n}</small><span>${s}</span><b>${cnt(s)}</b></button><i class="farr">←</i>`;
  return head('الطلبات والشحنات', 'كل طلب بيمشي: في الانتظار ← قيد التجهيز ← قيد التوصيل مع سائق أو شركة ← النتيجة ← مكتمل بعد تسكير الجولة',
      `<button class="btn" data-act="allPrep">كل الانتظار للتجهيز</button><button class="btn pri" data-act="orderForm">+ طلب جديد</button>`) +
  `<div class="flow">${step('في الانتظار', 1)}${step('قيد التجهيز', 2)}${step('قيد التوصيل', 3)}
    <div class="fgroup"><small>4 · نتيجة التوصيل</small><div class="row">${OUTCOMES.map(s => `<button class="chip ${f === s ? 'on' : ''}" data-act="ofilter" data-id="${s}">${s} ${cnt(s)}</button>`).join('')}</div></div><i class="farr">←</i>
    <div class="fgroup"><small>5 · بعد تسكير الجولة</small><div class="row">${['مكتمل مسلم','مكتمل راجع'].map(s => `<button class="chip ${f === s ? 'on' : ''}" data-act="ofilter" data-id="${s}">${s} ${cnt(s)}</button>`).join('')}</div></div></div>
  <div class="row" style="justify-content:space-between">${chips([['نشط','الطلبات النشطة'], ['الكل','كل الطلبات']], f, 'ofilter')}
   ${pages.length ? `<select class="inl" data-chg="opage" aria-label="الصفحة"><option value="">كل الصفحات</option>${pages.map(p => `<option value="${p.id}" ${ui.opage === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="none" ${ui.opage === 'none' ? 'selected' : ''}>بدون صفحة</option></select>` : ''}
   <form class="row" id="sform"><input id="osearch" class="inl srch" type="search" placeholder="ابحث برقم الطلب أو الاسم أو الهاتف" value="${esc(ui.search)}"><button class="btn sm" type="submit">بحث</button>${ui.search ? '<button class="btn sm ghost" type="button" data-act="clearSearch">مسح</button>' : ''}</form></div>` +
  ordersTable(list) + (list.length >= 200 ? '<p class="note">معروض أحدث 200 طلب. استخدم البحث أو الفلاتر للوصول لطلب أقدم.</p>' : '');
};
async function orderInfo(id) {
  const [[o], items, log] = await Promise.all([db.q('v_orders', {eq: {id}}), db.q('v_order_items', {eq: {order_id: id}, order: ['id', true]}), db.q('order_log', {eq: {order_id: id}, order: ['at', true]})]);
  if (!o) return toast('الطلب مش موجود', true);
  const editable = ['في الانتظار','قيد التجهيز'].includes(o.status) || (o.status === 'مؤجل' && !o.run_id);
  openInfo('الطلب #' + o.no, `<div class="row" style="justify-content:space-between">${pill(o.status, ST_CLS[o.status])}<small class="m">${o.day} · ${esc(o.source || '')}${o.page_name ? ' · صفحة ' + esc(o.page_name) : ''} · أدخله ${esc(o.created_by_name || '')}</small></div>
   <div class="cols" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
    <div><h3 style="margin-bottom:6px">الزبون</h3><div class="kv"><span>الاسم</span><b>${esc(o.customer)}</b></div><div class="kv"><span>الهاتف</span><b>${esc(o.phone)}${o.phone2 ? ' / ' + esc(o.phone2) : ''}</b></div><div class="kv"><span>المدينة</span><b>${esc(o.city)}${o.area ? ' - ' + esc(o.area) : ''}</b></div><div class="kv"><span>العنوان</span><b>${esc(o.address || '—')}</b></div>${o.notes ? `<div class="kv"><span>ملاحظات</span><b>${esc(o.notes)}</b></div>` : ''}</div>
    <div><h3 style="margin-bottom:6px">الحساب</h3>${items.map(i => `<div class="kv"><span>${esc(i.product_name)} × ${i.qty}</span><b>${jd(N(i.qty) * N(i.price))}</b></div>`).join('')}${N(o.discount) ? `<div class="kv"><span>خصم</span><b>−${jd(o.discount)}</b></div>` : ''}<div class="kv"><span>توصيل</span><b>${jd(o.delivery_fee)}</b></div><div class="kv"><span><b>المطلوب من الزبون</b></span><b>${jd(o.cod)}</b></div>${o.courier_name ? `<div class="kv"><span>${esc(o.courier_name)}${o.run_no ? ' · جولة #' + o.run_no : ''}</span><b>أجرة ${jd(o.courier_cost)}</b></div>` : ''}${can('products') ? `<div class="kv"><span>تكلفة البضاعة</span><b>${jd(o.cogs)}</b></div>` : ''}</div></div>
   <h3 style="margin:14px 0 8px">مسار الطلب</h3><ol class="tl">${log.map(l => `<li><b>${esc(l.status)}</b> <small class="m">${fmtDT(l.at)}${l.by_name ? ' · ' + esc(l.by_name) : ''}${l.note ? ' · ' + esc(l.note) : ''}</small></li>`).join('')}</ol>
   <div class="row" style="margin-top:12px">${nextBtns(o)}${editable ? `<button class="btn sm" data-act="editInfo" data-id="${o.id}">تعديل البيانات</button>` : ''}<button class="btn sm" data-act="copyOrder" data-id="${o.id}">انسخ للسائق</button>${(ST.pages || []).length ? `<button class="btn sm ghost" data-act="setPage" data-id="${o.id}">${o.page_name ? 'تغيير الصفحة' : 'حدد الصفحة'}</button>` : ''}</div>`);
  orderInfo.last = o;
}
function orderText(o) { return [`طلب #${o.no}`, `${o.customer} - ${o.phone}${o.phone2 ? ' / ' + o.phone2 : ''}`, `${o.city}${o.area ? ' - ' + o.area : ''}${o.address ? '، ' + o.address : ''}`, o.items_txt || '', `المطلوب: ${fmt(o.cod)} د.أ`, o.notes ? 'ملاحظة: ' + o.notes : ''].filter(Boolean).join('\n'); }

function ofRow(i) {
  i = i || {}; const list = ST.products.filter(p => p.active); const p = P(i.product_id) || list[0];
  return `<div class="ofrow"><select class="of-p" aria-label="المنتج">${list.map(x => `<option value="${x.id}" ${x.id === p?.id ? 'selected' : ''}>${esc(x.name)} (${x.stock} بالمستودع)</option>`).join('')}</select><input class="of-q" type="number" min="1" value="${i.qty || 1}" aria-label="الكمية"><input class="of-pr" type="number" step="any" value="${i.price ?? p?.price ?? 0}" aria-label="سعر القطعة"><button type="button" class="btn sm ghost" data-act="ofDel" aria-label="حذف السطر">✕</button></div>`;
}
function openOrderForm(init = {}) {
  if (!ST.products.some(p => p.active)) { toast('أضف منتج أول من قسم المنتجات', true); return; }
  const cs = cities(); const city = init.city && cs.includes(init.city) ? init.city : cs.includes('عمان') ? 'عمان' : (cs[0] || 'عمان');
  const ads = (K.adsList || []);
  const pages = (ST.pages || []).filter(p => p.active || p.id === init.sales_page_id);
  const pg0 = init.sales_page_id || (init.conv_id ? '' : lsGet('saber-page'));
  const fld = (id, l, inner, wide) => `<label class="fld ${wide ? 'wide' : ''}" for="${id}"><span>${l}</span>${inner}</label>`;
  $('#mtitle').textContent = init.customer ? 'طلب جديد لـ ' + init.customer : 'طلب جديد';
  $('#mform').innerHTML = `<div class="fgrid">
    ${fld('of_name', 'اسم الزبون', `<input id="of_name" required autocomplete="off" value="${esc(init.customer || '')}">`)}${fld('of_phone', 'الهاتف', `<input id="of_phone" required inputmode="tel" placeholder="07xxxxxxxx" autocomplete="off" value="${esc(init.phone || '')}">`)}
    ${fld('of_phone2', 'هاتف ثاني (اختياري)', '<input id="of_phone2" inputmode="tel" autocomplete="off">')}${fld('of_src', 'المصدر', `<select id="of_src">${SOURCES.map(s => `<option ${s === init.source ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
    ${pages.length ? fld('of_page', 'الصفحة اللي إجا منها الطلب', `<select id="of_page" required><option value="">اختار الصفحة</option>${pages.map(p => `<option value="${p.id}" ${p.id === pg0 ? 'selected' : ''}>${esc(p.name)}${p.platform ? ' · ' + esc(p.platform) : ''}</option>`).join('')}</select>`, 1) : ''}
    ${fld('of_city', 'المدينة', `<select id="of_city">${cs.map(c => `<option ${c === city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
    ${fld('of_area', 'المنطقة / الحي', `<input id="of_area" list="of_areas" required autocomplete="off"><datalist id="of_areas">${areasFor(city).map(a => `<option value="${esc(a)}">`).join('')}</datalist>`)}
    ${fld('of_addr', 'العنوان بالتفصيل', '<input id="of_addr" required placeholder="الشارع، البناية، الطابق، علامة مميزة" autocomplete="off">', 1)}
    ${fld('of_notes', 'ملاحظات للسائق', '<input id="of_notes" placeholder="مثلاً: يتصل قبل بنص ساعة" autocomplete="off">', 1)}
    ${!init.conv_id && ads.length ? fld('of_ad', 'الإعلان اللي جاب الزبون (إذا معروف)', `<select id="of_ad"><option value="">ما بعرف / بدون إعلان</option>${ads.map(a => `<option value="${esc(a.ad_id)}" ${a.ad_id === init.ad_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`, 1) : ''}</div>
   <h3 style="margin:16px 0 8px">المنتجات <small class="m">المنتج · الكمية · سعر القطعة</small></h3><div id="ofItems" class="ofitems">${(init.items && init.items.length ? init.items : [null]).map(ofRow).join('')}</div>
   <button type="button" class="btn sm" data-act="ofAdd" style="margin-top:8px">+ منتج ثاني</button>
   <div class="fgrid" style="margin-top:14px">${fld('of_fee', 'سعر التوصيل على الزبون (د.أ)', `<input id="of_fee" type="number" step="any" inputmode="decimal" value="${feeFor(city)}">`)}${fld('of_disc', 'خصم (د.أ)', '<input id="of_disc" type="number" step="any" inputmode="decimal" value="0">')}</div>
   <div class="ofsum" id="ofSum"></div><p class="lerr" id="ferr"></p>
   <div class="fact"><button class="btn pri" type="submit" id="fsave">حفظ الطلب</button><button class="btn" type="button" data-act="closeM">إلغاء</button></div>`;
  const rows = () => $$('.ofrow').map(r => ({product_id: r.querySelector('.of-p').value, qty: N(r.querySelector('.of-q').value), price: N(r.querySelector('.of-pr').value)}));
  const recalc = () => {
    const rs = rows(), g = sum(rs, x => x.qty * x.price), fee = N($('#of_fee').value), disc = N($('#of_disc').value);
    const cogs = sum(rs, x => x.qty * N(P(x.product_id)?.cost));
    const k = ST.couriers.find(x => x.active); const kc = k ? ($('#of_city').value === 'عمان' ? N(k.cost_amman) : N(k.cost_other)) : fee;
    $('#ofSum').innerHTML = `<div><span>المنتجات</span><b>${jd(g)}</b></div><div><span>التوصيل</span><b>${jd(fee)}</b></div>${disc ? `<div><span>الخصم</span><b>−${jd(disc)}</b></div>` : ''}<div class="tot"><span>المطلوب من الزبون</span><b>${jd(g - disc + fee)}</b></div>${can('products') ? `<div><span>ربحك المتوقع</span><b>${jd(g - disc - cogs + fee - kc)}</b></div>` : ''}`;
  };
  $('#mform').oninput = e => {
    const t = e.target;
    if (t.classList.contains('of-p')) t.closest('.ofrow').querySelector('.of-pr').value = N(P(t.value)?.price);
    if (t.id === 'of_city') { $('#of_fee').value = feeFor(t.value); $('#of_areas').innerHTML = areasFor(t.value).map(a => `<option value="${esc(a)}">`).join(''); }
    recalc();
  };
  $('#mform').onsubmit = async e => {
    e.preventDefault(); const err = m => { $('#ferr').textContent = m; };
    const items = rows().filter(r => r.qty > 0); if (!items.length) return err('اختار منتج واحد على الأقل');
    const phone = cleanPhone($('#of_phone').value); if (!PHONE_RE.test(phone)) return err('رقم الهاتف لازم يكون أردني مثل 0791234567');
    const page = $('#of_page')?.value || null; if (pages.length && !page) return err('اختار الصفحة اللي إجا منها الطلب');
    const btn = $('#fsave'); btn.disabled = true;
    try {
      const r = await db.rpc('create_order', {p: {customer: $('#of_name').value.trim(), phone, phone2: cleanPhone($('#of_phone2').value), source: $('#of_src').value, city: $('#of_city').value,
        area: $('#of_area').value.trim(), address: $('#of_addr').value.trim(), notes: $('#of_notes').value.trim(), delivery_fee: N($('#of_fee').value), discount: N($('#of_disc').value), items,
        conv_id: init.conv_id || null, ad_id: init.conv_id ? null : ($('#of_ad')?.value || null), sales_page_id: page}});
      if (page && !init.conv_id) lsSet('saber-page', page);
      if (init.onDone) { try { await init.onDone(r); } catch (e) {} }
      const low = items.filter(i => N(P(i.product_id)?.stock) < i.qty).map(i => P(i.product_id)?.name);
      closeM(true); ST.products = await db.q('products', {order: ['name', true]});
      toast('انضاف الطلب #' + r.no + (low.length ? ' · انتبه: ' + low.join('، ') + ' الكمية بالمستودع ما بتكفي' : ''), !!low.length); render();
    } catch (x) { err(arabicErr(x)); btn.disabled = false; }
  };
  $('#modal').hidden = false; recalc(); setTimeout(() => $('#of_name')?.focus(), 30);
}

/* ---------- التوصيل والجولات ---------- */
async function runLines(ids) { return ids.length ? db.q('v_run_lines', {in: {run_id: ids}, order: ['no', true]}) : []; }
function runText(r, lines) {
  return [`كشف جولة #${r.no} - ${r.courier_name} - ${r.day}`, `الطلبات: ${r.orders_count} | تم التوصيل: ${r.delivered} | مؤجل: ${r.postponed} | مرفوض برسوم: ${r.rej_fee} | مرفوض بدون رسوم: ${r.rej_free} | ملغي: ${r.cancelled}`, '-----',
    ...lines.map(l => `#${l.no} ${l.customer} - ${l.phone} - ${l.city}${l.area ? ' ' + l.area : ''} - ${l.result} - محصّل ${fmt(l.collect)} - أجرة ${fmt(l.charge)}`), '-----',
    `المحصّل من الزبائن: ${fmt(r.collect)} د.أ`, `أجرة التوصيل: ${fmt(r.charge)} د.أ`, `المطلوب تسليمه: ${fmt(r.net)} د.أ`,
    r.status === 'مسكّرة' ? `المستلم فعلياً: ${fmt(r.received)} د.أ | الفرق: ${fmt(r.diff)} د.أ` : '', `قطع راجعة للمستودع: ${r.ret_qty}`].filter(Boolean).join('\n');
}
function runCard(r, lines) {
  const ls = lines.filter(l => l.run_id === r.id);
  return `<div class="card"><div class="head" style="margin-bottom:10px"><div><h2>جولة #${r.no} · ${esc(r.courier_name)} ${pill(r.courier_type)}</h2><p class="sub">${r.day} · ${r.orders_count} طلب · ${N(r.pending) ? `<b class="neg">${r.pending} لسا بدون نتيجة</b>` : 'كل الطلبات إلها نتيجة'}</p></div>
    <div class="row"><button class="btn" data-act="copyRun" data-id="${r.id}">انسخ الكشف</button><button class="btn pri" data-act="closeRunForm" data-id="${r.id}" ${N(r.pending) || !N(r.orders_count) ? 'disabled' : ''}>تسكير الجولة</button></div></div>
   ${table([{h:'رقم', f:l => `<button class="btn sm" data-act="orderInfo" data-id="${l.order_id}">#${l.no}</button>`}, {h:'الزبون', f:l => esc(l.customer) + `<br><small class="m">${esc(l.phone)}</small>`}, {h:'العنوان', f:l => esc(l.city) + (l.area ? ' - ' + esc(l.area) : '') + (l.address ? `<br><small class="m">${esc(l.address)}</small>` : ''), c:'wrap'}, {h:'على الزبون', f:l => jd(l.cod)},
     {h:'النتيجة', f:l => `<select class="inl" id="oc-${l.order_id}" data-chg="outcome" data-id="${l.order_id}" data-was="${esc(l.result)}" data-fee="${N(l.delivery_fee)}">${['قيد التوصيل', ...OUTCOMES].map(s => `<option ${s === l.result ? 'selected' : ''}>${s}</option>`).join('')}</select>`},
     {h:'محصّل', f:l => jd(l.collect)}, {h:'أجرة', f:l => jd(l.charge)}, {h:'صافي', f:l => `<b>${jd(N(l.collect) - N(l.charge))}</b>`}], ls, 'الجولة فاضية')}
   <div class="stmt"><div><span>المحصّل من الزبائن</span><b>${jd(r.collect)}</b></div><div><span>أجرة ${r.courier_type === 'شركة توصيل' ? 'الشركة' : 'السائق'}</span><b>−${jd(r.charge)}</b></div><div class="tot"><span>المطلوب تسليمه</span><b>${jd(r.net)}</b></div><div><span>قطع راجعة</span><b>${r.ret_qty}</b></div>${can('products') ? `<div><span>ربح الجولة</span><b class="${N(r.profit) < 0 ? 'neg' : 'pos'}">${jd(r.profit)}</b></div>` : ''}</div></div>`;
}
const runsTable = list => table([{h:'جولة', f:r => `<button class="btn sm" data-act="viewRun" data-id="${r.id}">#${r.no}</button>`}, {h:'التاريخ', f:r => r.day}, {h:'السائق / الشركة', f:r => esc(r.courier_name)}, {h:'طلبات', f:r => r.orders_count}, {h:'تم', f:r => r.delivered}, {h:'راجع', f:r => N(r.rej_fee) + N(r.rej_free) + N(r.cancelled)}, {h:'مؤجل', f:r => r.postponed}, {h:'محصّل', f:r => jd(r.collect)}, {h:'أجرة', f:r => jd(r.charge)}, {h:'المطلوب', f:r => jd(r.expected ?? r.net)}, {h:'المستلم', f:r => r.status === 'مسكّرة' ? jd(r.received) : '—'}, {h:'الفرق', f:r => N(r.diff) ? `<b class="neg">${jd(r.diff)}</b>` : '—'}], list, 'ما في جولات');
function dayHtml(d, rep) {
  const L = (l, v, c = '') => `<tr class="${c}"><td>${l}</td><td class="${typeof v === 'number' && v < 0 ? 'neg' : ''}">${typeof v === 'number' ? jd(v) : esc(v)}</td></tr>`, sec = t => `<tr class="sec"><td colspan="2">${t}</td></tr>`, x = k => N(rep[k]);
  return `<div class="tw"><table class="pl">${sec('الحركة')}${L('طلبات انعملت', x('created') + ' طلب بقيمة ' + jd(x('created_value')))}${L('جولات', String(x('runs')))}${L('شحنات طلعت', String(x('shipped')))}${L('تم التوصيل', String(x('delivered')))}${L('مرفوض برسوم / بدون رسوم', x('rej_fee') + ' / ' + x('rej_free'))}${L('ملغي عند الزبون', String(x('cancelled')))}${L('مؤجل', String(x('postponed')))}${L('قطع رجعت للمستودع', String(x('ret_qty')))}
   ${sec('الكاش')}${L('قيمة البضاعة المسلّمة', x('goods'))}${L('رسوم توصيل محصّلة', x('fees'))}${L('إجمالي المحصّل من الزبائن', x('collect'), 'tot')}${L('أجور التوصيل', -x('charge'))}${L('المفروض يتسلم من السائقين', x('expected'), 'tot')}${L('المستلم فعلياً', x('received'))}${L('الفرق (ذمة على السائقين)', x('diff'), x('diff') ? 'flag' : '')}
   ${sec('الربح')}${L('تكلفة البضاعة المسلّمة', -x('cogs'))}${L('ربح الجولات (بعد البضاعة والتوصيل)', x('profit'))}${L('مصاريف اليوم', -x('expenses'))}${L('صافي اليوم', x('net'), 'tot')}</table></div>
   <p class="note" style="margin-top:10px">الرواتب والإعلانات بتنحسب بالمحاسبة الشهرية (المرحلة الجاية). سكّره ${esc(d.closed_by_name || '')} ${fmtDT(d.closed_at)}.</p>`;
}
function dayText(d) { const r = d.report, x = k => fmt(r[k]); return [`كشف اليوم المالي ${d.day}`, `جولات: ${r.runs} | شحنات: ${r.shipped} | تم التوصيل: ${r.delivered} | مرفوض: ${N(r.rej_fee) + N(r.rej_free)} | ملغي: ${r.cancelled} | مؤجل: ${r.postponed}`, `المحصّل: ${x('collect')} د.أ | أجور التوصيل: ${x('charge')} د.أ`, `المفروض يتسلم: ${x('expected')} | المستلم: ${x('received')} | الفرق: ${x('diff')}`, `ربح الجولات: ${x('profit')} | مصاريف: ${x('expenses')}`, `صافي اليوم: ${x('net')} د.أ`].join('\n'); }

V.delivery = async () => {
  const t = ui.delTab, tabs = [['today','اليوم'], ['couriers','السائقين وشركات التوصيل'], ['history','الكشوفات والأيام المالية']];
  let body = '';
  if (t === 'today') {
    const td = today();
    const [ready, open, closedToday, dayRow] = await Promise.all([
      db.q('v_orders', {in: {status: ['قيد التجهيز','مؤجل']}, isNull: ['run_id'], order: ['created_at', true], limit: 300}),
      db.q('v_runs', {eq: {status: 'مفتوحة'}, order: ['no', true]}), db.q('v_runs', {eq: {status: 'مسكّرة', day: td}, order: ['no', false]}), db.q('fin_days', {eq: {day: td}})]);
    const lines = await runLines(open.map(r => r.id));
    const all = [...open, ...closedToday];
    const kOpts = ST.couriers.filter(k => k.active);
    body = `<div class="kpis">${kpi('جاهز للإرسال', ready.length, 'قيد التجهيز + مؤجل')}${kpi('جولات مفتوحة', open.length, sum(open, r => r.orders_count) + ' طلب مع السائقين')}${kpi('تم توصيله اليوم', sum(all, r => r.delivered))}${kpi('محصّل اليوم', jd(sum(all, r => r.collect)))}${kpi('المطلوب من السائقين', jd(sum(all, r => r.net)), '', 'hl')}</div>
    <div class="card"><div class="head" style="margin-bottom:10px"><h2>جاهز للتوصيل (${ready.length})</h2>
      <div class="row">${kOpts.length ? `<label for="dispK" class="row" style="font-size:13px;color:var(--muted)">أرسل مع <select id="dispK" class="inl">${kOpts.map(k => `<option value="${k.id}">${esc(k.name)} (${esc(k.type)})</option>`).join('')}</select></label><label class="row" style="font-size:13px" for="dispNew"><input type="checkbox" id="dispNew"> بجولة جديدة</label><button class="btn pri" data-act="dispatchSel">إرسال المحدد</button>` : '<button class="btn pri" data-act="kForm">+ أضف سائق أو شركة توصيل</button>'}</div></div>
     ${ready.length ? table([{h:`<input type="checkbox" id="dispAll" data-chg="dispAll" aria-label="تحديد الكل">`, f:o => `<input type="checkbox" id="ds-${o.id}" data-dsel="${o.id}" aria-label="تحديد #${o.no}">`}, {h:'رقم', f:o => `<button class="btn sm" data-act="orderInfo" data-id="${o.id}">#${o.no}</button>`}, {h:'الزبون', f:o => esc(o.customer) + `<br><small class="m">${esc(o.phone)}</small>`}, {h:'المنطقة', f:o => esc(o.city) + (o.area ? ' - ' + esc(o.area) : '')}, {h:'المنتجات', f:o => esc(o.items_txt || ''), c:'wrap'}, {h:'على الزبون', f:o => jd(o.cod)}, {h:'الحالة', f:o => pill(o.status, ST_CLS[o.status]) + (o.postpone_to ? ` <small class="m">لـ ${o.postpone_to}</small>` : '')}], ready)
       : '<p class="note">ما في طلبات جاهزة. حوّل الطلبات من "في الانتظار" لـ "قيد التجهيز" من صفحة الطلبات.</p>'}</div>
    ${open.map(r => runCard(r, lines)).join('')}
    ${closedToday.length ? `<div class="card"><h2>جولات اليوم المسكّرة</h2>${runsTable(closedToday)}</div>` : ''}
    <div class="card dayclose"><div class="head"><div><h2>إغلاق اليوم المالي · ${td}</h2><p class="sub">${dayRow.length ? 'اليوم مسكّر وكشفه محفوظ.' : open.length ? `لازم تسكّر ${open.length} جولة مفتوحة قبل ما تسكّر اليوم.` : 'كل الجولات مسكّرة. الكشف بيحسب الطلبات والكاش وأجور التوصيل والمصاريف.'}</p></div>
     <div class="row">${dayRow.length ? `<button class="btn pri" data-act="viewDay" data-id="${td}">عرض كشف اليوم</button><button class="btn ghost" data-act="reopenDay" data-id="${td}">إعادة فتح</button>` : `<button class="btn pri" data-act="closeDay" ${open.length ? 'disabled' : ''}>سكّر اليوم المالي</button>`}</div></div></div>`;
  }
  if (t === 'couriers') {
    const ks = await db.q('v_couriers', {order: ['name', true]});
    body = table([{h:'الاسم', f:k => `<b>${esc(k.name)}</b>${k.active ? '' : ' ' + pill('موقوف')}`}, {h:'النوع', f:k => pill(k.type, k.type === 'شركة توصيل' ? 'info' : 'brand')}, {h:'الهاتف', f:k => esc(k.phone || '—')}, {h:'أجرة عمان', f:k => jd(k.cost_amman)}, {h:'أجرة المحافظات', f:k => jd(k.cost_other)}, {h:'أجرة المرتجع', f:k => jd(k.return_cost)}, {h:'معه الآن', f:k => k.with_now},
      {h:'نسبة التسليم (30 يوم)', f:k => k.rate30 == null ? '—' : pill(pct(k.rate30), N(k.rate30) >= .85 ? 'good' : N(k.rate30) >= .75 ? 'warn' : 'bad')},
      {h:'ذمة عليه', f:k => N(k.balance) ? `<b class="${N(k.balance) > 0 ? 'neg' : ''}">${jd(k.balance)}</b>` : '—'},
      {h:'', f:k => `<button class="btn sm" data-act="kForm" data-id="${k.id}">تعديل</button>${N(k.balance) ? ` <button class="btn sm" data-act="kPay" data-id="${k.id}" data-bal="${N(k.balance)}">تسوية</button>` : ''}`}], ks, 'أضف سائق أو شركة توصيل') +
      `<p class="note">"ذمة عليه" هي مجموع الفروقات بين المطلوب والمستلم فعلياً بكل الجولات المسكّرة، ناقص التسويات.</p>`;
  }
  if (t === 'history') {
    const [days, runs] = await Promise.all([db.q('fin_days', {order: ['day', false], limit: 60}), db.q('v_runs', {eq: {status: 'مسكّرة'}, order: ['closed_at', false], limit: 50})]);
    body = `<div class="card"><h2>الأيام المالية المسكّرة</h2>${table([{h:'اليوم', f:d => `<button class="btn sm" data-act="viewDay" data-id="${d.day}">${d.day}</button>`}, {h:'جولات', f:d => d.report.runs}, {h:'شحنات', f:d => d.report.shipped}, {h:'تم', f:d => d.report.delivered}, {h:'راجع', f:d => N(d.report.rej_fee) + N(d.report.rej_free) + N(d.report.cancelled)}, {h:'محصّل', f:d => jd(d.report.collect)}, {h:'أجور توصيل', f:d => jd(d.report.charge)}, {h:'المستلم', f:d => jd(d.report.received)}, {h:'الفرق', f:d => N(d.report.diff) ? `<b class="neg">${jd(d.report.diff)}</b>` : '—'}, {h:'ربح الجولات', f:d => jd(d.report.profit)}, {h:'مصاريف', f:d => jd(d.report.expenses)}, {h:'صافي اليوم', f:d => `<b class="${N(d.report.net) < 0 ? 'neg' : 'pos'}">${jd(d.report.net)}</b>`}], days, 'ما في أيام مسكّرة لسا')}</div>
     <div class="card"><h2>آخر الجولات المسكّرة</h2>${runsTable(runs)}</div>`;
  }
  return head('التوصيل والجولات', 'عيّن الطلبات لسائق أو شركة توصيل، سجّل نتيجة كل طلب، سكّر الجولة بكشف حساب، وبآخر اليوم سكّر اليوم المالي', '<button class="btn" data-act="kForm">+ سائق / شركة توصيل</button>') +
    chips(tabs, t, 'delTab') + body;
};
function askOutcome(oid, out, fee) {
  const done = async extra => { await db.rpc('set_outcome', {oid, outc: out, extra: extra || {}}); toast('انسجلت النتيجة: ' + out); render(); };
  const reasons = ['غيّر رأيه','ما رد على التلفون','العنوان غلط أو ناقص','ما عجبه المنتج','السعر غالي','طلب بالغلط','أخرى'];
  if (out === 'مؤجل') openForm('تأجيل الطلب', [{k:'date', l:'لتاريخ', t:'date', def: addDays(today(), 1)}, {k:'note', l:'السبب', t:'select', opts:['الزبون طلب يوم ثاني','ما رد على التلفون','مش موجود بالعنوان','العنوان غلط أو ناقص','أخرى']}], null, v => done(v));
  else if (out === 'مرفوض برسوم') openForm('مرفوض برسوم', [{k:'fee', l:'المبلغ اللي دفعه الزبون (د.أ)', t:'number', def: fee ?? ''}, {k:'note', l:'سبب الرفض', t:'select', opts: reasons}], null, v => v.fee == null ? 'اكتب المبلغ' : done(v));
  else if (out === 'مرفوض بدون رسوم' || out === 'ملغي') openForm(out, [{k:'note', l:'السبب', t:'select', opts: reasons}], null, v => done(v));
  else { done({}).catch(e => { toast(arabicErr(e), true); render(); }); return; }
  modalCancel = () => render();
}

/* ---------- المنتجات والمستودع والمشتريات ---------- */
V.products = async () => {
  ST.products = await db.q('products', {order: ['name', true]});
  const showCost = can('products', 'edit') || can('inventory');
  const list = ST.products;
  return head('المنتجات', `${list.filter(p => p.active).length} منتج فعّال${showCost ? ' · قيمة البضاعة بالتكلفة ' + jd(sum(list, p => Math.max(0, N(p.stock)) * N(p.cost))) : ''}`, '<button class="btn pri" data-act="prodForm">+ منتج جديد</button>') +
  (list.length ? `<div class="pgrid">${list.map(p => { const mg = N(p.price) ? (N(p.price) - N(p.cost)) / N(p.price) * 100 : 0; return `<div class="prod ${p.active ? '' : 'off'}">
    <div class="thumb" style="${p.image ? `background-image:url('${esc(p.image)}')` : `background:${esc(p.color || COLORS[0])}`}">${p.image ? '' : esc((p.name || '؟').trim()[0])}</div>
    <div class="bd"><h3>${esc(p.name)}</h3><div class="kv"><span>${esc(p.category || '')}${p.sku ? ' · ' + esc(p.sku) : ''}</span>${p.active ? pill(N(p.stock) <= 0 ? 'نفد' : N(p.stock) <= N(p.min_stock) ? 'منخفض' : 'متوفر', N(p.stock) <= 0 ? 'bad' : N(p.stock) <= N(p.min_stock) ? 'warn' : 'good') : pill('مؤرشف')}</div>
     <div class="kv"><span>سعر البيع</span><b>${jd(p.price)}</b></div>${showCost ? `<div class="kv"><span>التكلفة</span><b>${jd(p.cost)}</b></div><div class="kv"><span>هامش الربح</span><b>${mg.toFixed(0)}%</b></div>` : ''}<div class="kv"><span>بالمستودع</span><b>${p.stock}</b></div>
     <div class="row"><button class="btn sm" data-act="prodForm" data-id="${p.id}">تعديل</button><button class="btn sm ghost" data-act="prodToggle" data-id="${p.id}">${p.active ? 'أرشفة' : 'إرجاع'}</button></div></div></div>`; }).join('')}</div>` : '<div class="tw"><div class="empty">ما في منتجات لسا. ابدأ بإضافة أول منتج.</div></div>');
};
V.inventory = async () => {
  const tab = ui.invTab;
  const [ps, moves] = await Promise.all([db.q('v_products', {eq: {active: true}, order: ['name', true]}), tab === 'moves' ? db.q('v_moves', {order: ['at', false], limit: 150}) : []]);
  const body = tab === 'moves'
    ? table([{h:'الوقت', f:x => fmtDT(x.at)}, {h:'المنتج', f:x => esc(x.product_name)}, {h:'الكمية', f:x => `<b class="${x.qty < 0 ? 'neg' : 'pos'}">${x.qty > 0 ? '+' : ''}${x.qty}</b>`}, {h:'النوع', f:x => pill(x.type)}, {h:'ملاحظة', f:x => esc(x.note || ''), c:'wrap'}, {h:'بواسطة', f:x => esc(x.by_name || '')}], moves, 'ما في حركات لسا')
    : table([{h:'المنتج', f:p => esc(p.name)}, {h:'SKU', f:p => esc(p.sku || '')}, {h:'الكمية', f:p => `<b class="${N(p.stock) < 0 ? 'neg' : ''}">${p.stock}</b>`}, {h:'الحد الأدنى', f:p => p.min_stock}, {h:'القيمة بالتكلفة', f:p => jd(Math.max(0, N(p.stock)) * N(p.cost))}, {h:'مبيع آخر 7 أيام', f:p => p.sold7}, {h:'بيكفي', f:p => N(p.sold7) ? Math.max(0, Math.floor(N(p.stock) / (N(p.sold7) / 7))) + ' يوم' : '—'}, {h:'الحالة', f:p => pill(N(p.stock) <= 0 ? 'نفد' : N(p.stock) <= N(p.min_stock) ? 'اطلب بضاعة' : 'تمام', N(p.stock) <= 0 ? 'bad' : N(p.stock) <= N(p.min_stock) ? 'warn' : 'good')}], ps, 'ما في منتجات');
  return head('المستودع', 'الكميات بتنقص مع كل طلب، وبترجع لما الطلب يصير "مكتمل راجع" أو ينلغى قبل الشحن، وبتزيد مع المشتريات', '<button class="btn pri" data-act="adjForm">تعديل كمية / جرد</button>') +
    `<div class="kpis">${kpi('قيمة المخزون (تكلفة)', jd(sum(ps, p => Math.max(0, N(p.stock)) * N(p.cost))))}${kpi('قيمة المخزون (بيع)', jd(sum(ps, p => Math.max(0, N(p.stock)) * N(p.price))))}${kpi('قطع بالمستودع', fmt(sum(ps, p => Math.max(0, N(p.stock)))))}${kpi('منتجات تحت الحد', ps.filter(p => N(p.stock) <= N(p.min_stock)).length)}</div>` +
    chips([['stock','الكميات'], ['moves','حركة المخزون']], tab, 'invTab') + body;
};
V.purchases = async () => {
  const list = await db.q('v_purchases', {order: ['at', false], limit: 150});
  const m = monthOf(today());
  return head('المشتريات', 'كل شراء بيزيد المخزون وبيحدّث متوسط تكلفة القطعة', '<button class="btn pri" data-act="purForm">+ فاتورة شراء</button>') +
    `<div class="kpis">${kpi('مشتريات هذا الشهر', jd(sum(list.filter(x => monthOf(x.day) === m), x => N(x.qty) * N(x.unit_cost))))}${kpi('عدد الموردين', new Set(list.map(x => x.supplier)).size)}</div>` +
    table([{h:'التاريخ', f:x => x.day}, {h:'المورد', f:x => esc(x.supplier)}, {h:'المنتج', f:x => esc(x.product_name)}, {h:'الكمية', f:x => x.qty}, {h:'سعر القطعة', f:x => jd(x.unit_cost)}, {h:'الإجمالي', f:x => `<b>${jd(N(x.qty) * N(x.unit_cost))}</b>`}, {h:'ملاحظة', f:x => esc(x.note || ''), c:'wrap'}, {h:'بواسطة', f:x => esc(x.by_name || '')}], list, 'ما في مشتريات لسا');
};

/* ---------- المصاريف ---------- */
V.expenses = async () => {
  const m = ui.month, ws = ui.ws || 'store', list = await db.q('expenses', {eq: {ws}, gte: {day: m + '-01'}, lte: {day: monthEnd(m)}, order: ['day', false], order2: ['id', false]});
  const by = {}; list.forEach(x => by[x.category] = (by[x.category] || 0) + N(x.amount));
  const mx = Math.max(1, ...Object.values(by));
  return head('المصاريف · ' + esc(wsName(ws)), ws === 'agency' ? 'مصاريف الوكالة بس. مصاريف المتجر بتنسجل من شاشة المتجر' : 'مصاريف المتجر بس. مصاريف اليوم بتدخل بكشف اليوم المالي لما تسكّره', `<label class="row" style="font-size:13px;color:var(--muted)" for="mpick">الشهر <input id="mpick" type="month" value="${m}" data-chg="month" class="inl"></label><button class="btn pri" data-act="expForm">+ مصروف</button>`) +
    `<div class="cols"><div class="card"><h2>المجموع: ${jd(sum(list, x => x.amount))}</h2>${Object.keys(by).length ? `<div class="bars">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([l, v]) => `<div class="bar"><span>${esc(l)}</span><span class="tr"><i style="width:${v / mx * 100}%"></i></span><b>${jd(v)}</b></div>`).join('')}</div>` : '<p class="note">ما في مصاريف بهالشهر.</p>'}</div>
    <div style="min-width:0">${table([{h:'التاريخ', f:x => x.day}, {h:'البند', f:x => esc(x.category)}, {h:'المبلغ', f:x => `<b>${jd(x.amount)}</b>`}, {h:'ملاحظة', f:x => esc(x.note || ''), c:'wrap'}, {h:'بواسطة', f:x => esc(x.by_name || '')}, {h:'', f:x => `<button class="btn sm ghost" data-act="expDel" data-id="${x.id}">حذف</button>`}], list, 'ما في مصاريف بهالشهر')}</div></div>`;
};

/* ---------- المستخدمين ---------- */
V.users = async () => {
  const [users, audit] = await Promise.all([db.q('profiles', {order: ['created_at', true]}), db.q('audit_log', {order: ['at', false], limit: 150})]);
  V.users.cache = users;
  return head('المستخدمين والصلاحيات', 'كل موظف إله إيميل وكلمة سر وصلاحيات محددة على كل قسم: بدون، عرض فقط، أو تعديل', '<button class="btn pri" data-act="userForm">+ مستخدم جديد</button>') +
    table([{h:'الاسم', f:u => `<b>${esc(u.name || '—')}</b><br><small class="m">${esc(u.email)}</small>`}, {h:'الدور', f:u => pill(u.role, u.role === 'مدير عام' ? 'brand' : u.role === 'بدون' ? '' : 'info')},
      {h:'الأقسام', f:u => u.role === 'مدير عام' ? 'الكل' : Object.entries(u.perms || {}).filter(([, v]) => v !== 'none').map(([k, v]) => esc(SEC_NAME[k] || k) + (v === 'view' ? ' (عرض)' : '')).join('، ') || '—', c:'wrap'},
      {h:'آخر دخول', f:u => fmtDT(u.last_login)}, {h:'الحالة', f:u => pill(u.active ? 'فعّال' : 'موقوف', u.active ? 'good' : 'bad')},
      {h:'', f:u => `<button class="btn sm" data-act="userForm" data-id="${u.id}">تعديل</button>`}], users) +
    `<div class="cols"><div class="card"><h2>الأدوار الجاهزة</h2>${table([{h:'الدور', f:([k]) => `<b>${esc(k)}</b>`}, {h:'شو بيشوف', f:([k]) => esc(TPL_DESC[k] || ''), c:'wrap'}], Object.entries(TEMPLATES))}<p class="note" style="margin-top:10px">الدور بيعبّي الصلاحيات تلقائياً، وبعدها بتقدر تعدّل أي قسم لحاله. أي حدا بيعمل حساب لحاله بيضل موقوف لحد ما تفعّله.</p></div>
     <div class="card"><h2>سجل العمليات</h2><div class="tw" style="max-height:440px;overflow-y:auto"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th></tr></thead><tbody>${audit.map(a => `<tr><td>${fmtDT(a.at)}</td><td>${esc(a.user_name || '')}</td><td class="wrap">${esc(a.action)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">ما في عمليات لسا</td></tr>'}</tbody></table></div></div></div>`;
};
function openUserForm(u) {
  const isNew = !u; u = u || {name: '', email: '', role: 'مدخل طلبات', perms: TEMPLATES['مدخل طلبات'], active: true};
  const grid = perms => SECTIONS.map(([k, l]) => `<label for="pm_${k}"><span>${l}</span><select id="pm_${k}">${[['none','بدون'], ['view','عرض'], ['edit','تعديل']].map(([v, t]) => `<option value="${v}" ${(perms?.[k] || 'none') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`).join('');
  const roles = Object.keys(TEMPLATES).filter(r => r !== 'مدير عام' || isAdmin());
  if (!roles.includes(u.role)) roles.push(u.role);
  $('#mtitle').textContent = isNew ? 'مستخدم جديد' : 'تعديل ' + (u.name || u.email);
  $('#mform').innerHTML = `<div class="fgrid">
    <label class="fld" for="uf_name"><span>الاسم</span><input id="uf_name" required value="${esc(u.name)}"></label>
    <label class="fld" for="uf_email"><span>الإيميل (اسم الدخول)</span><input id="uf_email" type="email" ${isNew ? 'required' : 'disabled'} value="${esc(u.email)}"></label>
    <label class="fld" for="uf_pw"><span>${isNew ? 'كلمة السر (6 أحرف على الأقل)' : 'كلمة سر جديدة (فاضي = بدون تغيير)'}</span><input id="uf_pw" type="text" ${isNew ? 'required' : ''} minlength="6" autocomplete="new-password"></label>
    <label class="fld" for="uf_role"><span>الدور</span><select id="uf_role">${roles.map(r => `<option ${r === u.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
    <label class="fld" for="uf_act"><span>الحالة</span><select id="uf_act"><option value="1" ${u.active ? 'selected' : ''}>فعّال</option><option value="0" ${u.active ? '' : 'selected'}>موقوف</option></select></label></div>
   <p class="note" id="uf_desc" style="margin-top:12px">${esc(TPL_DESC[u.role] || '')}</p>
   <div id="uf_permsWrap" ${u.role === 'مدير عام' ? 'hidden' : ''}><h3 style="margin:14px 0 8px">الصلاحيات على كل قسم</h3><div class="pgridp" id="uf_perms">${grid(u.perms)}</div></div>
   <p class="lerr" id="ferr"></p><div class="fact"><button class="btn pri" type="submit" id="fsave">حفظ</button><button class="btn" type="button" data-act="closeM">إلغاء</button></div>`;
  $('#mform').oninput = e => { if (e.target.id === 'uf_role') { const r = e.target.value; $('#uf_desc').textContent = TPL_DESC[r] || ''; $('#uf_permsWrap').hidden = r === 'مدير عام'; if (TEMPLATES[r] && r !== 'مخصص') $('#uf_perms').innerHTML = grid(TEMPLATES[r]); } };
  $('#mform').onsubmit = async e => {
    e.preventDefault(); const err = m => { $('#ferr').textContent = m; btn.disabled = false; }; const btn = $('#fsave'); btn.disabled = true;
    const name = $('#uf_name').value.trim(), pw = $('#uf_pw').value, role = $('#uf_role').value;
    if (pw && pw.length < 6) return err('كلمة السر لازم 6 أحرف على الأقل');
    const perms = role === 'مدير عام' ? {} : Object.fromEntries(SECTIONS.map(([k]) => [k, $('#pm_' + k)?.value || 'none']).filter(([, v]) => v !== 'none'));
    try {
      let id = u.id;
      if (isNew) id = await db.createUser($('#uf_email').value.trim().toLowerCase(), pw, name);
      await db.rpc('admin_save_user', {uid: id, p: {name, role, perms, active: $('#uf_act').value === '1'}});
      if (!isNew && pw) await db.rpc('admin_set_password', {uid: id, pw});
      closeM(true); toast(isNew ? 'انضاف المستخدم ' + name : 'انحفظ'); render();
    } catch (x) { err(arabicErr(x)); }
  };
  $('#modal').hidden = false; setTimeout(() => $('#uf_name')?.focus(), 30);
}

/* ---------- الإعدادات ---------- */
V.settings = async () => {
  const [s] = await db.q('settings', {eq: {id: 1}}); ST.settings = s;
  const cs = cities();
  return head('الإعدادات', 'اسم الشركة، وأسعار التوصيل على الزبون لكل مدينة، ومناطق كل مدينة (بتطلع اقتراحات بفورم الطلب)') +
    `<div class="card"><h2>اسم الشركة</h2><input id="set_co" class="inl" style="width:100%;max-width:420px;font-size:15px;padding:8px 10px" value="${esc(s.company)}"></div>
    <div class="card"><div class="head" style="margin-bottom:10px"><h2>المدن وأسعار التوصيل</h2><button class="btn sm" data-act="addCity">+ مدينة</button></div>
     <div class="tw"><table><thead><tr><th>المدينة</th><th>سعر التوصيل على الزبون</th><th>المناطق (افصل بفاصلة)</th></tr></thead><tbody id="cityRows">${cs.map((c, i) => cityRow(c, s.city_fees[c], (s.areas?.[c] || []).join('، '), i)).join('')}</tbody></table></div>
     <div class="row" style="margin-top:12px"><button class="btn pri" data-act="saveSettings">حفظ الإعدادات</button></div></div>`;
};
const cityRow = (c, fee, areas, i) => `<tr><td><input class="inl" id="cn_${i}" value="${esc(c)}" aria-label="المدينة"></td><td><input class="inl" id="cf_${i}" type="number" step="any" value="${esc(fee)}" style="width:90px" aria-label="سعر التوصيل"></td><td class="wrap"><input class="inl" id="ca_${i}" value="${esc(areas)}" style="width:100%;min-width:220px" aria-label="المناطق"></td></tr>`;

/* ================= الأفعال ================= */
const A = {
  go: k => { ui.view = k; render(); window.scrollTo?.(0, 0); },
  closeM, logout,
  myPw: () => openForm('تغيير كلمة السر', [{k:'pw', l:'كلمة السر الجديدة (6 أحرف على الأقل)', t:'password', req: 1}, {k:'pw2', l:'أعد كتابتها', t:'password', req: 1}], null, async v => { if (v.pw.length < 6) return 'كلمة السر لازم 6 أحرف على الأقل'; if (v.pw !== v.pw2) return 'الكلمتين مش متطابقات'; await db.changeMyPassword(v.pw); toast('تغيّرت كلمة السر'); }),
  ofilter: s => { ui.ofilter = s; render(); }, clearSearch: () => { ui.search = ''; render(); },
  delTab: k => { ui.delTab = k; render(); }, invTab: k => { ui.invTab = k; render(); },
  orderForm: () => openOrderForm(),
  switchWs: () => { const o = wsList().find(w => w !== ui.ws); if (o) { closeM(); goWs(o); toast('إنت هلأ بـ' + wsName(o)); } },
  setPage: async id => {
    const [o] = await db.q('v_orders', {eq: {id}});
    openForm('صفحة الطلب #' + o.no, [{k:'pg', l:'الصفحة', t:'select', opts: [['', 'بدون صفحة'], ...(ST.pages || []).map(p => [p.id, p.name])], wide: 1}], {pg: o.sales_page_id || ''},
      async v => { await db.rpc('order_set_page', {oid: id, pg: v.pg || null}); toast('انحفظت الصفحة'); render(); });
  },
  orderInfo: id => orderInfo(id).catch(e => toast(arabicErr(e), true)),
  copyOrder: async id => { const [o] = await db.q('v_orders', {eq: {id}}); copyText(orderText(o)); },
  editInfo: async id => {
    const [o] = await db.q('v_orders', {eq: {id}});
    openForm('تعديل الطلب #' + o.no, [{k:'customer', l:'اسم الزبون', req: 1}, {k:'phone', l:'الهاتف', req: 1}, {k:'phone2', l:'هاتف ثاني'}, {k:'city', l:'المدينة', t:'select', opts: cities().includes(o.city) ? cities() : [o.city, ...cities()]}, {k:'area', l:'المنطقة'}, {k:'address', l:'العنوان', wide: 1}, {k:'notes', l:'ملاحظات', wide: 1}, {k:'delivery_fee', l:'سعر التوصيل', t:'number'}, {k:'discount', l:'خصم', t:'number'}], o,
      async v => { v.phone = cleanPhone(v.phone); v.phone2 = cleanPhone(v.phone2); if (!PHONE_RE.test(v.phone)) return 'رقم الهاتف لازم يكون أردني مثل 0791234567'; await db.rpc('update_order_info', {oid: id, p: v}); toast('انحفظت التعديلات'); render(); });
  },
  toPrep: async id => { closeM(); await db.rpc('order_set_status', {oid: id, st: 'قيد التجهيز'}); toast('الطلب صار قيد التجهيز'); render(); },
  allPrep: async () => { const n = await db.rpc('prep_all'); toast(n ? `${n} طلب صاروا قيد التجهيز` : 'ما في طلبات بالانتظار'); render(); },
  cancelOrd: id => openForm('إلغاء الطلب', [{k:'note', l:'السبب', t:'select', opts:['الزبون لغى قبل الشحن','رقم غلط / ما رد','طلب مكرر','المنتج مش متوفر','أخرى']}], null, async v => { await db.rpc('order_set_status', {oid: id, st: 'ملغي', note: v.note}); ST.products = await db.q('products', {order: ['name', true]}); toast('انلغى الطلب ورجعت الكمية للمستودع'); render(); }),
  dispatchOne: id => {
    const ks = ST.couriers.filter(k => k.active); if (!ks.length) { toast('أضف سائق أو شركة توصيل أول من قسم التوصيل', true); return; }
    openForm('تعيين سائق', [{k:'k', l:'السائق / شركة التوصيل', t:'select', opts: ks.map(k => [k.id, k.name + ' (' + k.type + ')']), wide: 1}], null, async v => { const r = await db.rpc('dispatch_orders', {ids: [id], kid: v.k, fresh: false}); toast(`انضاف لجولة #${r.run_no} مع ${r.courier}`); render(); }, 'إرسال');
  },
  dispatchSel: async () => {
    const ids = $$('[data-dsel]:checked').map(c => c.dataset.dsel); if (!ids.length) { toast('حدد طلب واحد على الأقل', true); return; }
    const r = await db.rpc('dispatch_orders', {ids, kid: $('#dispK').value, fresh: !!$('#dispNew')?.checked});
    toast(`انبعت ${r.count} طلب بجولة #${r.run_no} مع ${r.courier}`); render();
  },
  outcomeForm: async id => { const [o] = await db.q('v_orders', {eq: {id}, select: 'id,delivery_fee'}); openForm('نتيجة التوصيل', [{k:'out', l:'النتيجة', t:'select', opts: [...OUTCOMES, 'قيد التوصيل'], wide: 1}], null, v => { setTimeout(() => askOutcome(id, v.out, N(o?.delivery_fee)), 0); }, 'التالي'); },
  closeRunForm: async id => {
    const [r] = await db.q('v_runs', {eq: {id}});
    openForm(`تسكير جولة #${r.no} · ${r.courier_name}`, [{k:'received', l:`المبلغ المستلم فعلياً (المطلوب ${fmt(r.net)} د.أ)`, t:'number', def: N(r.net), wide: 1}, {k:'note', l:'ملاحظة', wide: 1}], null,
      async v => { const x = await db.rpc('close_run', {p_run: id, p_received: v.received ?? N(r.net), p_note: v.note}); ST.products = await db.q('products', {order: ['name', true]}); toast(N(x.diff) ? `انسكّرت الجولة. في فرق ${jd(x.diff)} انسجل ذمة` : 'انسكّرت الجولة والحساب مطابق'); render(); }, 'تسكير');
  },
  copyRun: async id => { const [[r], lines] = await Promise.all([db.q('v_runs', {eq: {id}}), runLines([id])]); copyText(runText(r, lines)); },
  viewRun: async id => { const [[r], lines] = await Promise.all([db.q('v_runs', {eq: {id}}), runLines([id])]); openInfo('كشف جولة #' + r.no, `<pre class="pre">${esc(runText(r, lines))}</pre><div class="row" style="margin-top:10px"><button class="btn" type="button" data-act="copyRun" data-id="${id}">انسخ</button></div>`); },
  closeDay: async () => { await db.rpc('close_day', {}); toast('انسكّر اليوم المالي'); await render(); A.viewDay(today()); },
  reopenDay: async d => { await db.rpc('reopen_day', {d}); toast('انفتح اليوم من جديد'); render(); },
  viewDay: async d => { const [x] = await db.q('fin_days', {eq: {day: d}}); if (!x) return; openInfo('كشف اليوم المالي ' + d, dayHtml(x, x.report) + `<div class="row" style="margin-top:10px"><button class="btn" type="button" data-act="copyDay" data-id="${d}">انسخ الملخص</button></div>`); A.viewDay.last = x; },
  copyDay: () => A.viewDay.last && copyText(dayText(A.viewDay.last)),
  kForm: async id => {
    const k = id ? (await db.q('couriers', {eq: {id}}))[0] : null;
    openForm(k ? 'تعديل ' + k.name : 'سائق / شركة توصيل جديدة', [{k:'name', l:'الاسم', req: 1}, {k:'type', l:'النوع', t:'select', opts:['سائق خاص','شركة توصيل']}, {k:'phone', l:'الهاتف'}, {k:'cost_amman', l:'أجرة التوصيل داخل عمان', t:'number', def: 1.5}, {k:'cost_other', l:'أجرة المحافظات', t:'number', def: 2.5}, {k:'return_cost', l:'أجرة المرتجع / الملغي', t:'number', def: 1}, {k:'active', l:'الحالة', t:'select', opts:[['true','فعّال'], ['false','موقوف']]}],
      k ? {...k, active: String(k.active)} : {active: 'true'}, async v => {
        const row = {name: v.name, type: v.type, phone: v.phone || null, cost_amman: N(v.cost_amman), cost_other: N(v.cost_other), return_cost: N(v.return_cost), active: v.active === 'true'};
        if (k) await db.upd('couriers', {id}, row); else await db.ins('couriers', row);
        ST.couriers = await db.q('couriers', {order: ['name', true]}); toast('انحفظ'); render();
      });
  },
  kPay: (id, b) => openForm('تسوية ذمة', [{k:'amount', l:`المبلغ (الذمة ${fmt(b.dataset.bal)} د.أ)`, t:'number', def: N(b.dataset.bal)}, {k:'note', l:'ملاحظة'}], null, async v => { if (!N(v.amount)) return 'اكتب المبلغ'; await db.rpc('pay_courier', {kid: id, amount: N(v.amount), note: v.note}); toast('انسجلت التسوية'); render(); }),
  prodForm: id => {
    const p = id ? P(id) : null;
    openForm(p ? 'تعديل منتج' : 'منتج جديد', [{k:'name', l:'اسم المنتج', req: 1, wide: 1}, {k:'sku', l:'الكود SKU'}, {k:'category', l:'التصنيف'}, {k:'cost', l:'تكلفة القطعة (د.أ)', t:'number'}, {k:'price', l:'سعر البيع (د.أ)', t:'number'}, ...(p ? [] : [{k:'stock', l:'الكمية الحالية (رصيد افتتاحي)', t:'number', def: 0}]), {k:'min_stock', l:'الحد الأدنى للتنبيه', t:'number', def: 5}, {k:'color', l:'لون البطاقة', t:'color', wide: 1}, {k:'image', l:'صورة المنتج', t:'image', wide: 1}], p,
      async v => {
        if (v.price == null || v.cost == null) return 'اكتب السعر والتكلفة';
        const row = {name: v.name, sku: v.sku || null, category: v.category || null, cost: N(v.cost), price: N(v.price), min_stock: Math.round(N(v.min_stock)), color: v.color, image: v.image || null};
        if (p) await db.upd('products', {id}, row); else await db.ins('products', {...row, stock: Math.round(N(v.stock))});
        ST.products = await db.q('products', {order: ['name', true]}); toast('انحفظ المنتج'); render();
      });
  },
  prodToggle: async id => { const p = P(id); await db.upd('products', {id}, {active: !p.active}); ST.products = await db.q('products', {order: ['name', true]}); toast(p.active ? 'انأرشف المنتج' : 'رجع المنتج'); render(); },
  adjForm: () => openForm('تعديل كمية / جرد', [{k:'pid', l:'المنتج', t:'select', opts: ST.products.filter(p => p.active).map(p => [p.id, p.name + ' (' + p.stock + ')']), wide: 1}, {k:'qty', l:'الكمية (+ زيادة / − نقص)', t:'number'}, {k:'note', l:'السبب', def:'جرد'}], null,
    async v => { if (!N(v.qty)) return 'اكتب الكمية'; await db.rpc('adjust_stock', {pid: v.pid, qty: Math.round(N(v.qty)), note: v.note}); ST.products = await db.q('products', {order: ['name', true]}); toast('تعدّل المخزون'); render(); }),
  purForm: () => openForm('فاتورة شراء', [{k:'supplier', l:'المورد', req: 1}, {k:'day', l:'التاريخ', t:'date', def: today()}, {k:'product_id', l:'المنتج', t:'select', opts: ST.products.filter(p => p.active).map(p => [p.id, p.name]), wide: 1}, {k:'qty', l:'الكمية', t:'number'}, {k:'unit_cost', l:'سعر القطعة (د.أ)', t:'number'}, {k:'note', l:'ملاحظة', wide: 1}], null,
    async v => { if (!N(v.qty)) return 'اكتب الكمية'; if (v.unit_cost == null) return 'اكتب سعر القطعة'; const c = await db.rpc('add_purchase', {p: {...v, qty: Math.round(N(v.qty))}}); ST.products = await db.q('products', {order: ['name', true]}); toast('انضافت المشتريات. تكلفة القطعة صارت ' + jd(c)); render(); }),
  expForm: () => openForm('مصروف جديد · ' + wsName(ui.ws || 'store'), [{k:'category', l:'البند', t:'select', opts: ui.ws === 'agency' ? AG_CATS : EXP_CATS}, {k:'amount', l:'المبلغ (د.أ)', t:'number'}, {k:'day', l:'التاريخ', t:'date', def: today()}, {k:'note', l:'ملاحظة'}], null,
    async v => { if (!(N(v.amount) > 0)) return 'اكتب المبلغ'; await db.ins('expenses', {category: v.category, amount: N(v.amount), day: v.day || today(), note: v.note || null, ws: ui.ws || 'store'}); toast('انضاف المصروف'); render(); }),
  expDel: async (id, b) => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'متأكد؟'; return; } await db.del('expenses', {id}); toast('انحذف'); render(); },
  userForm: id => openUserForm(id ? V.users.cache?.find(u => u.id === id) : null),
  addCity: () => { const tb = $('#cityRows'); const i = tb.children.length + Date.now() % 1000; tb.insertAdjacentHTML('beforeend', cityRow('', 3, '', 'n' + i)); },
  saveSettings: async () => {
    const fees = {}, areas = {};
    $$('#cityRows tr').forEach(tr => { const [n, f, a] = tr.querySelectorAll('input'); const c = n.value.trim(); if (!c) return; fees[c] = N(f.value); const ar = a.value.split(/[،,]/).map(x => x.trim()).filter(Boolean); if (ar.length) areas[c] = ar; });
    if (!Object.keys(fees).length) { toast('لازم مدينة وحدة على الأقل', true); return; }
    await db.upd('settings', {id: 1}, {company: $('#set_co').value.trim() || 'صابر أونلاين', city_fees: fees, areas, updated_at: new Date().toISOString()});
    toast('انحفظت الإعدادات'); render();
  },
  ofAdd: () => { $('#ofItems').insertAdjacentHTML('beforeend', ofRow()); $('#of_fee').dispatchEvent(new Event('input', {bubbles: true})); },
  ofDel: (_, b) => { if ($$('.ofrow').length > 1) b.closest('.ofrow').remove(); $('#of_fee').dispatchEvent(new Event('input', {bubbles: true})); }
};

/* ================= ربط الأحداث ================= */
function bind() {
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    e.preventDefault(); const act = b.dataset.act;
    if (!canAct(act)) { toast('ما عندك صلاحية لهالعملية', true); return; }
    const fn = A[act]; if (!fn) return;
    const busy = b.tagName === 'BUTTON' && !['closeM', 'go', 'ofAdd', 'ofDel'].includes(act);
    if (busy) b.disabled = true;
    try { await fn(b.dataset.id, b); } catch (x) { toast(arabicErr(x), true); }
    finally { if (busy && document.contains(b)) b.disabled = false; }
  });
  document.addEventListener('submit', e => { if (e.target.id === 'sform') { e.preventDefault(); ui.search = $('#osearch').value.trim(); render(); } });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.img && t.files?.[0]) { try { formImg = await shrink(t.files[0]); toast('الصورة جاهزة، اضغط حفظ'); } catch (x) { toast('ما قدرت أقرأ الصورة', true); } return; }
    if (t.dataset.chg === 'opage') { ui.opage = t.value; render(); return; }
    if (t.dataset.chg === 'month') { ui.month = t.value || monthOf(today()); render(); return; }
    if (t.dataset.chg === 'dispAll') { $$('[data-dsel]').forEach(c => c.checked = t.checked); return; }
    if (t.dataset.chg === 'outcome') { if (!can('delivery', 'edit')) { toast('ما عندك صلاحية لهالعملية', true); t.value = t.dataset.was; return; } askOutcome(t.dataset.id, t.value, N(t.dataset.fee)); }
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeM(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeM(); });
}

/* ================= التشغيل ================= */
let bound = false;
async function start(impl, opts = {}) {
  db = impl; if (!bound) { bind(); bound = true; }
  try {
    if (opts.linkError) return showLogin(opts.linkError);
    const u = await db.user();
    if (u && opts.recovery) return showSetNewPassword(u);
    if (u) await enter(u, false); else await showLogin();
  } catch (e) { await showLogin(arabicErr(e)); }
}
/* رابط استرجاع كلمة السر بيرجع على الموقع ومعه type=recovery */
function readAuthLink() {
  const h = new URLSearchParams(location.hash.replace(/^#/, '')), q = new URLSearchParams(location.search);
  const recovery = h.get('type') === 'recovery' || q.get('type') === 'recovery';
  const code = h.get('error_code') || q.get('error_code');
  const linkError = code ? (/expired/i.test(code) ? 'رابط استرجاع كلمة السر انتهى أو استُخدم قبل. اطلب رابط جديد من "نسيت كلمة السر؟"' : 'الرابط مش صالح. اطلب رابط جديد من "نسيت كلمة السر؟"') : '';
  return {recovery, linkError};
}
function boot() {
  const c = window.SABER_CONFIG || {};
  if (!c.url || /YOUR-PROJECT/.test(c.url) || !c.key || /YOUR-ANON/.test(c.key)) {
    const el = $('#login'); el.hidden = false;
    el.innerHTML = `<div class="lwrap" style="grid-template-columns:1fr"><div class="lform"><h2>خطوة أخيرة قبل التشغيل</h2><p class="note">افتح ملف <b>config.js</b> وحط فيه <b>Project URL</b> و<b>anon public key</b> من Supabase ← Project Settings ← API، وارفعه على GitHub.</p></div></div>`;
    return;
  }
  if (!window.supabase?.createClient) { toast('ما قدرت أحمّل مكتبة Supabase. تأكد من الإنترنت وحدّث الصفحة', true); return; }
  const link = readAuthLink();
  const impl = supaDb(c);
  start(impl, link).then(() => { if (location.hash || /type=|error_code=/.test(location.search)) history.replaceState(null, '', location.pathname); });
}
Object.assign(K, {$, $$, esc, N, fmt, jd, pct, sum, today, addDays, monthOf, monthEnd, fmtDT, dayName, cleanPhone, PHONE_RE,
  STATUSES, ST_CLS, SOURCES, COLORS, SECTIONS, SEC_NAME, NAV, NAVS, WS, wsList, wsName, logoOf, goWs, lsGet, lsSet, pageName, TEMPLATES, TPL_DESC, PERSONAL, ACT_SEC, V, A, ST, ui,
  pill, kpi, head, table, chips, toast, openForm, openInfo, closeM, copyText, can, perm, isAdmin, isClient, render, softRender,
  openOrderForm, arabicErr, P, cities, feeFor, shrink, applyPerms,
  setModalCancel: f => { modalCancel = f; } });
Object.defineProperty(K, 'db', {get: () => db});
Object.defineProperty(K, 'me', {get: () => me});
window.App = {boot, start, _: K};
})();
