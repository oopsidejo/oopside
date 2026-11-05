// =====================================================================
//  Edge Function: page-audit — فحص صفحة عميل بالذكاء الاصطناعي (OOPSIDE)
//  النشر:  supabase functions deploy page-audit
//  Secrets المطلوبة (موجودة عندك من الوكيل الذكي):
//    ANTHROPIC_API_KEY
//  اختياري:
//    AUDIT_MODEL   (الافتراضي claude-sonnet-5-5 لأنه أقوى بقراءة الصور)
//  SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و SUPABASE_ANON_KEY موجودين تلقائياً.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SECTIONS = [
  ["identity", "الهوية والانطباع الأول", "اسم الصفحة، صورة البروفايل، الغلاف، البيو، التصنيف، وهل الزبون بيفهم شو بتقدّم الصفحة خلال 3 ثواني"],
  ["contact", "سهولة التواصل والطلب", "زر واتساب أو ماسنجر، رقم، عنوان، ساعات الدوام، رابط طلب، وهل الطريق للشراء واضح"],
  ["content", "جودة المحتوى", "جودة الصور والفيديو، الريلز، أول 3 ثواني، النصوص، تنوع المحتوى، الانتظام بالنشر"],
  ["engagement", "التفاعل والجمهور", "لايكات وتعليقات ومشاركات مقارنة بعدد المتابعين، والرد على التعليقات"],
  ["trust", "الثقة والإثبات", "تقييمات، آراء زباين، صور زباين حقيقيين، قبل وبعد، شهادات، ضمانات"],
  ["offer", "العروض والأسعار", "هل في عرض واضح وسبب يخلي الزبون يطلب هلأ، وهل الأسعار أو الباقات واضحة"],
  ["ads", "الجاهزية للإعلانات", "هل الصفحة بتعلن (مكتبة الإعلانات)، جودة الإعلانات، وهل الصفحة جاهزة تستقبل زباين من إعلان"],
] as const;

const TOOL = {
  name: "page_audit_report",
  description: "يرجّع تقرير فحص الصفحة كامل بشكل منظم",
  input_schema: {
    type: "object",
    required: ["score", "headline", "summary", "sections", "top_fixes", "quick_wins", "content_ideas", "strengths", "ad_plan"],
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100, description: "العلامة العامة للصفحة من 100" },
      headline: { type: "string", description: "جملة وحدة قوية بتلخّص وضع الصفحة، بلهجة أردنية محترمة" },
      summary: { type: "string", description: "فقرة 2-3 جمل: وين الصفحة هلأ وشو أكبر فرصة إلها" },
      strengths: { type: "array", maxItems: 4, items: { type: "string" }, description: "أشياء حلوة بالصفحة (لازم تكون صادقة)" },
      sections: {
        type: "array", minItems: SECTIONS.length, maxItems: SECTIONS.length,
        items: {
          type: "object", required: ["key", "score", "status", "found", "missing"],
          properties: {
            key: { type: "string", enum: SECTIONS.map((s) => s[0]) },
            score: { type: "integer", minimum: 0, maximum: 10 },
            status: { type: "string", enum: ["ممتاز", "جيد", "يحتاج شغل", "ضعيف", "مش واضح من الصور"] },
            found: { type: "array", maxItems: 4, items: { type: "string" }, description: "شو شفنا فعلاً بالصور" },
            missing: { type: "array", maxItems: 4, items: { type: "string" }, description: "شو ناقص أو غلط" },
          },
        },
      },
      top_fixes: {
        type: "array", minItems: 3, maxItems: 5,
        items: {
          type: "object", required: ["title", "why", "how", "impact"],
          properties: {
            title: { type: "string" }, why: { type: "string", description: "ليش مهم وكيف مأثّر على المبيعات" },
            how: { type: "string", description: "خطوات عملية للتصليح" }, impact: { type: "string", enum: ["عالي", "متوسط"] },
          },
        },
      },
      quick_wins: { type: "array", maxItems: 5, items: { type: "string" }, description: "تصليحات سريعة بتنعمل اليوم" },
      content_ideas: {
        type: "array", minItems: 3, maxItems: 3,
        items: { type: "object", required: ["title", "hook"], properties: { title: { type: "string" }, hook: { type: "string", description: "أول جملة بالفيديو" } } },
      },
      ad_plan: {
        type: "object", required: ["ready", "note", "angle"],
        properties: {
          ready: { type: "boolean", description: "هل الصفحة جاهزة تعلن هلأ" },
          note: { type: "string", description: "شو لازم يصير قبل الإعلان أو كيف نبلش" },
          angle: { type: "string", description: "أقوى زاوية إعلان لهالمشروع" },
        },
      },
    },
  },
};

function systemPrompt(agency: string) {
  return `إنت خبير تسويق رقمي وميديا باير محترف بوكالة ${agency}، خبرة 12 سنة بإعلانات ميتا للمشاريع بالأردن والخليج وفلسطين.
مهمتك: تفحص صفحة فيسبوك/إنستغرام لمشروع من صور الشاشة اللي بعتها الموظف، وتكتب تقرير احترافي بينبعت لصاحب المشروع.

قواعد مهمة:
- اكتب بالعربي بلهجة أردنية محترمة وواضحة، موجّه لصاحب المشروع مباشرة (إنت/صفحتك).
- احكي بس عن اللي شايفه فعلاً بالصور. إذا جانب مش ظاهر بالصور، حط status "مش واضح من الصور" ولا تخترع.
- كن صريح ومفيد بدون تجريح. ابدأ بالإيجابي بصدق، وبعدين الناقص.
- النصائح لازم تكون عملية ومحددة (مش عامة زي "حسّن المحتوى").
- لا تذكر أرقام نتائج أو وعود مبيعات. الأرقام بيحسبها النظام لحاله.
- لا تحكي عن سياسات أو أسعار الوكالة.
- الجوانب: ${SECTIONS.map((s) => `${s[0]} = ${s[1]} (${s[2]})`).join(" | ")}.
- العلامة العامة: متوسط مرجّح منطقي للجوانب (الهوية والتواصل والثقة والعرض أهم إشي للمبيعات).
رجّع النتيجة فقط عن طريق أداة page_audit_report.`;
}

// تقدير النتائج من أرقام المجال الحقيقية (مش من الـAI)
function projection(b: any, spend: number | null, msgs: number | null) {
  if (!b) return null;
  const budgets = [100, 200, 400];
  const rows = budgets.map((m) => {
    const lo = Math.floor(m / Number(b.cpr_max)), hi = Math.floor(m / Number(b.cpr_min));
    return {
      budget: m, msgs_min: lo, msgs_max: hi,
      orders_min: Math.max(1, Math.floor(lo * Number(b.close_min) / 100)),
      orders_max: Math.max(1, Math.floor(hi * Number(b.close_max) / 100)),
    };
  });
  let current = null;
  if (spend && spend > 0 && msgs && msgs > 0) {
    const cpr = spend / msgs;
    current = { spend, msgs, cpr: Math.round(cpr * 100) / 100, target_cpr_max: Number(b.cpr_max), better: cpr > Number(b.cpr_max) };
  }
  return { sector: b.sector, cpr_min: Number(b.cpr_min), cpr_max: Number(b.cpr_max), close_min: Number(b.close_min), close_max: Number(b.close_max), real_data: !!b.real_data, proof: b.proof || null, rows, current };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") || "";
    const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // لازم يكون موظف عنده صلاحية تعديل على العملاء المحتملين
    const { data: ok } = await userDb.rpc("audit_can", { lvl: "edit" });
    if (!ok) return json({ error: "ما عندك صلاحية تشغّل فحص الصفحات" }, 403);

    const { id } = await req.json().catch(() => ({}));
    if (!id) return json({ error: "رقم الفحص ناقص" }, 400);
    const { data: a, error } = await admin.from("page_audits").select("*").eq("id", id).single();
    if (error || !a) return json({ error: "الفحص مش موجود" }, 404);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "لازم تضيف ANTHROPIC_API_KEY بـ Supabase ← Edge Functions ← Secrets" }, 500);
    const model = Deno.env.get("AUDIT_MODEL") || "claude-sonnet-5-5";

    const shots: { label?: string; data: string }[] = Array.isArray(a.shots) ? a.shots : [];
    if (!shots.length) return json({ error: "ارفع صور الصفحة أول (على الأقل صورتين)" }, 400);

    await admin.from("page_audits").update({ status: "عم يحلل", error: null, updated_at: new Date().toISOString() }).eq("id", id);

    const [{ data: st }, { data: bm }] = await Promise.all([
      admin.from("settings").select("agency_name").eq("id", 1).maybeSingle(),
      admin.from("audit_benchmarks").select("*").eq("sector", a.sector).maybeSingle(),
    ]);
    const agency = st?.agency_name || "OOPSIDE";

    const content: any[] = [];
    shots.slice(0, 8).forEach((s, i) => {
      const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(s.data || "");
      if (!m) return;
      content.push({ type: "text", text: `صورة ${i + 1}: ${s.label || "من الصفحة"}` });
      content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
    });
    content.push({
      type: "text",
      text: `معلومات المشروع:
- الاسم: ${a.company}
- المجال: ${a.sector}${a.city ? ` · المدينة: ${a.city}` : ""}
- رابط الصفحة: ${a.page_url}
${a.goal ? `- هدف صاحب المشروع: ${a.goal}\n` : ""}${a.monthly_spend ? `- بيصرف على الإعلانات حوالي ${a.monthly_spend}$ شهرياً\n` : ""}${a.monthly_msgs ? `- بيجيه حوالي ${a.monthly_msgs} رسالة/طلب شهرياً\n` : ""}${a.notes ? `- ملاحظات الموظف: ${a.notes}\n` : ""}
افحص الصفحة من كل النواحي واكتب التقرير.`,
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 4000, system: systemPrompt(agency),
        tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content }],
      }),
    });
    const out = await r.json();
    if (!r.ok) {
      const msg = out?.error?.message || `خطأ من الذكاء الاصطناعي (${r.status})`;
      await admin.from("page_audits").update({ status: "خطأ", error: msg, updated_at: new Date().toISOString() }).eq("id", id);
      return json({ error: msg }, 502);
    }
    const tool = (out.content || []).find((c: any) => c.type === "tool_use");
    if (!tool?.input) {
      await admin.from("page_audits").update({ status: "خطأ", error: "ما رجع تقرير", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ error: "الذكاء الاصطناعي ما رجّع تقرير، جرّب مرة ثانية" }, 502);
    }

    const rep = tool.input;
    // نضيف أسماء الجوانب بالعربي ونرتبها
    rep.sections = SECTIONS.map(([k, name]) => ({ name, ...(rep.sections || []).find((s: any) => s.key === k) || { key: k, score: 0, status: "مش واضح من الصور", found: [], missing: [] } }));
    rep.projection = projection(bm, a.monthly_spend ? Number(a.monthly_spend) : null, a.monthly_msgs ? Number(a.monthly_msgs) : null);
    rep.generated_at = new Date().toISOString();

    await admin.from("page_audits").update({
      status: "جاهز", result: rep, score: Math.round(Number(rep.score) || 0), model,
      tokens_in: out.usage?.input_tokens ?? null, tokens_out: out.usage?.output_tokens ?? null,
      error: null, updated_at: new Date().toISOString(),
    }).eq("id", id);

    return json({ ok: true, score: rep.score, token: a.token });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
