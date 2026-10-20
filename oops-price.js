/* محرك تسعير موقع الوكالة — نفس قواعد app.oops_price بقاعدة البيانات.
   الواجهة بتستخدمه للعرض الفوري بس. السعر المعتمد بينحسب من جديد بالسيرفر وقت الإرسال. */
(function (g) {
  'use strict';
  const N = x => Number(x) || 0;
  const r3 = x => Math.round(x * 1000) / 1000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function price(s, qty, ad, o) {
    o = o || {};
    const p = s.params || {};
    let q = clamp(Math.round(qty == null ? N(s.def_qty) || 1 : N(qty)), N(s.min_qty) || 1, N(s.max_qty) || 1);
    let m = 0, one = 0, c = 0, off = 0;
    switch (s.ptype) {
      case 'monthly': m = N(s.price); c = N(s.cost); q = 1; break;
      case 'unit':
        (p.tiers || []).forEach(t => { if (N(t.from) <= q) off = Math.max(off, N(t.off)); });
        m = r3(N(s.price) * q * (1 - off / 100)); c = N(s.cost) * q; break;
      case 'one_time': one = N(s.price) * q; c = N(s.cost) * q; break;
      case 'pct_spend':
        m = Math.max(N(s.min_fee), r3(Math.max(N(ad), 0) * N(s.pct) / 100));
        if (N(s.max_fee) > 0) m = Math.min(m, N(s.max_fee)); c = N(s.cost); q = 1; break;
      case 'team': {
        const ag = clamp(Math.round(N(o.agents) || 1), 1, N(p.max_agents) || 6);
        const h = clamp(Math.round(N(o.hours) || 8), 1, N(p.max_hours) || 16);
        const d = clamp(Math.round(N(o.days) || 6), 1, 7);
        const ch = Math.max(1, (o.channels || []).length || 1);
        const hrs = ag * h * d * 4.33;
        m = hrs * N(p.hour_rate) + (ch - 1) * N(p.channel_fee);
        (o.tasks || []).forEach(t => { m += N((p.tasks || {})[t]) * ag; });
        m = Math.round(Math.max(m, N(s.min_fee)));
        const msgs = N(o.msgs);
        const need = msgs > 0 ? Math.ceil(msgs / (h * (N(p.msgs_per_hour) || 12))) : null;
        return {qty: ag, monthly: m, one_time: N(s.setup_fee) * ag, cost: r3(hrs * N(s.cost)), hours: Math.round(hrs), need_agents: need, quote: false};
      }
      case 'quote': return {qty: 1, monthly: 0, one_time: 0, cost: 0, quote: true};
    }
    one += N(s.setup_fee);
    return {qty: q, monthly: r3(m), one_time: r3(one), cost: r3(c), off, quote: false};
  }

  function totals(lines, ad) {
    const t = {fees: 0, one_time: 0, cost: 0, ad: Math.max(0, N(ad)), quotes: 0};
    lines.forEach(l => { t.fees += N(l.monthly); t.one_time += N(l.one_time); t.cost += N(l.cost); if (l.quote) t.quotes++; });
    t.fees = r3(t.fees); t.one_time = r3(t.one_time);
    t.monthly = r3(t.fees + t.ad);
    t.first = r3(t.monthly + t.one_time);
    return t;
  }

  /* الميزانية لخطة: بنختار الخدمات المقترحة لمشاكل العميل أول، وبنضيف لحد ما تخلص الميزانية */
  function plan(services, problems, budget, adBudget) {
    const probs = new Set(problems || []);
    const score = s => (s.problems || []).filter(k => probs.has(k)).length;
    const cands = services.filter(s => s.ptype !== 'quote')
      .map(s => ({s, sc: score(s)}))
      .filter(x => x.sc > 0 || !probs.size)
      .sort((a, b) => b.sc - a.sc || (a.s.sort || 0) - (b.s.sort || 0));
    const fees = Math.max(0, N(budget));
    const picked = [], skipped = [];
    let used = 0;
    const cats = new Set();
    for (const {s} of cands) {
      // خدمة وحدة من كل نوع إدارة إعلانات أول مرة، عشان ما تتكرر المنصات على ميزانية صغيرة
      if (s.ptype === 'pct_spend' && cats.has('ads') && fees < 600) { skipped.push({s, cost: price(s, null, adBudget).monthly}); continue; }
      let q = s.ptype === 'unit' ? N(s.min_qty) : null;
      let pr = price(s, q, adBudget);
      const val = pr.monthly + pr.one_time;
      if (used + val > fees) { skipped.push({s, cost: val}); continue; }
      if (s.ptype === 'unit') {
        while (q < N(s.def_qty)) {
          const nx = price(s, q + 1, adBudget);
          if (used + nx.monthly + nx.one_time > fees) break;
          q++; pr = nx;
        }
      }
      used += pr.monthly + pr.one_time;
      if (s.ptype === 'pct_spend') cats.add('ads');
      picked.push({id: s.id, qty: q, pr});
    }
    const nextAdd = skipped.sort((a, b) => a.cost - b.cost).slice(0, 3).map(x => ({id: x.s.id, name: x.s.name, extra: r3(x.cost - Math.max(0, fees - used))}));
    return {picked, used: r3(used), left: r3(fees - used), nextAdd};
  }

  g.OopsPrice = {price, totals, plan};
})(typeof window !== 'undefined' ? window : globalThis);
