const statusEl = document.getElementById("status");
const app = document.getElementById("app");
const weekSelect = document.getElementById("weekSelect");
const prevBtn = document.getElementById("prevWeek");
const nextBtn = document.getElementById("nextWeek");

let weeks = [];
let current = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtLast5(last5, arrows) {
  return last5.map((n, i) => `${n}${arrows[i] || ""}`).join(" → ");
}

function hasTimesfm(tfm) {
  if (!tfm || typeof tfm !== "object") return false;
  return tfm.flu_mean8 != null || tfm.covid_mean8 != null || tfm.flu_latest != null;
}

function weekFromUrl() {
  const q = new URLSearchParams(location.search).get("week");
  return q ? String(q) : null;
}

function setUrlWeek(id, { replace = false } = {}) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("week", id);
  else url.searchParams.delete("week");
  const next = url.pathname + url.search + url.hash;
  if (replace) history.replaceState({ week: id }, "", next);
  else history.pushState({ week: id }, "", next);
}

function render(week) {
  const d = week;
  const tfm = d.timesfm || {};
  const flu = d.influenza || {};
  const covid = d.covid || {};
  const o = d.others || {};
  const showTfm = hasTimesfm(tfm);
  const fluCovidCaption = showTfm
    ? "流感／COVID：26 週長條＋3 週 MA＋TimesFM 8 週參照（正式週報圖）"
    : "流感／COVID：26 週長條＋3 週 MA（本週尚未納入 TimesFM）";

  const tfmCard = showTfm ? `
      <article class="card">
        <h2><span class="dot tfm"></span>3️⃣ TimesFM 參照｜僅流感／COVID</h2>
        <ul class="kv">
          <li>流感：${esc(tfm.flu_latest)} → 未來8週平均 ${esc(tfm.flu_mean8)}（末週~${esc(tfm.flu_last)}）</li>
          <li>COVID：${esc(tfm.covid_latest)} → 未來8週平均 ${esc(tfm.covid_mean8)}（末週~${esc(tfm.covid_last)}）</li>
        </ul>
        <p class="note">${esc(tfm.note || "未來8週平均＝未來8週 TimesFM point 均值，不是近8週實測平均")}（${esc(tfm.horizon_start)}–${esc(tfm.horizon_end)}）</p>
      </article>` : `
      <article class="card">
        <h2><span class="dot tfm"></span>3️⃣ TimesFM 參照</h2>
        <p class="note">本週尚未納入 TimesFM（自 202635 起正式加入流感／COVID 圖與週報）。</p>
      </article>`;

  app.innerHTML = `
    <section class="meta">
      <div class="range">📅 ${esc(d.week)}｜${esc(d.date_start)} ~ ${esc(d.date_end)}</div>
      <div>${esc(d.title || "疾管署｜呼吸道病毒週報")}</div>
      <div class="note" style="margin:0">📊 ${esc(d.sources || "")}</div>
    </section>

    <section class="grid two">
      <article class="card">
        <h2><span class="dot flu"></span>1️⃣ 流感</h2>
        <ul class="kv">
          <li>近5週：${esc(fmtLast5(flu.last5 || [], flu.arrows || []))}</li>
          <li>${esc(flu.judgement || "")}</li>
          <li>Flu A ${esc(flu.flu_a)}｜Flu B ${esc(flu.flu_b)}</li>
        </ul>
      </article>
      <article class="card">
        <h2><span class="dot covid"></span>2️⃣ SARS-CoV-2</h2>
        <ul class="kv">
          <li>LARS：${esc(covid.lars)}件（${esc(covid.lars_arrow)} vs 前2週平均 ${esc(covid.lars_vs_2wk_avg)}）</li>
          <li>重症完整週 ${esc(covid.severe_week)}：${esc(covid.severe)}例（${esc(covid.severe_arrow)} vs 前週 ${esc(covid.severe_prev)}）</li>
          <li>同週死亡：${esc(covid.deaths)}例</li>
          <li>本週 ${esc(covid.partial_week)} 尚未完整：重症 ${esc(covid.partial_severe)}、死亡 ${esc(covid.partial_deaths)}，不作趨勢判讀</li>
        </ul>
      </article>
    </section>

    <section class="grid" style="margin-top:1rem">
      ${tfmCard}
      <article class="card">
        <h2><span class="dot oth"></span>4️⃣ 其他病原體</h2>
        <ul class="kv">
          <li>S. pneumoniae ${esc(o.spn?.cur)}（${esc(o.spn?.arrow)} vs ${esc(o.spn?.prev)}）</li>
          <li>Adenovirus ${esc(o.adeno?.cur)}（${esc(o.adeno?.arrow)} vs ${esc(o.adeno?.prev)}）</li>
          <li>RSV ${esc(o.rsv?.cur)}（${esc(o.rsv?.arrow)} vs ${esc(o.rsv?.prev)}）</li>
          <li>Parainfluenza ${esc(o.para?.cur)}（${esc(o.para?.arrow)} vs ${esc(o.para?.prev)}）</li>
        </ul>
      </article>
      <article class="card">
        <h2><span class="dot cli"></span>5️⃣ 臨床提示</h2>
        <p class="clinical">${esc(d.clinical || "")}</p>
      </article>
    </section>

    <section class="charts">
      <figure>
        <img src="${esc(d.charts?.trend || "")}" alt="全病原體趨勢圖 ${esc(d.week)}" />
        <figcaption>全病原體 26 週趨勢（正式週報圖）</figcaption>
      </figure>
      <figure>
        <img src="${esc(d.charts?.flu_covid || "")}" alt="流感與 COVID 圖 ${esc(d.week)}" />
        <figcaption>${fluCovidCaption}</figcaption>
      </figure>
    </section>

    <div class="links">
      <a href="${esc(d.links?.lars || "#")}" target="_blank" rel="noopener">🔗 LARS</a>
      <a href="${esc(d.links?.severe || "#")}" target="_blank" rel="noopener">🔗 重症／死亡</a>
    </div>

    <section class="raw">
      <details>
        <summary>原始 compact 文字</summary>
        <pre>${esc(d.report_text || "")}</pre>
      </details>
    </section>
  `;
}

async function loadWeek(id, { pushUrl = true } = {}) {
  statusEl.textContent = "載入中…";
  statusEl.hidden = false;
  statusEl.className = "loading";
  try {
    const res = await fetch(`data/weeks/${id}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    current = id;
    weekSelect.value = id;
    const idx = weeks.indexOf(id);
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx < 0 || idx >= weeks.length - 1;
    statusEl.hidden = true;
    render(data);
    if (pushUrl) setUrlWeek(id);
    else setUrlWeek(id, { replace: true });
  } catch (e) {
    statusEl.hidden = false;
    statusEl.className = "error";
    statusEl.textContent = `無法載入 ${id}：${e.message}`;
  }
}

function syncNav() {
  weekSelect.innerHTML = weeks.map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join("");
}

async function init() {
  try {
    const res = await fetch(`data/weeks/index.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`index HTTP ${res.status}`);
    weeks = await res.json();
    if (!Array.isArray(weeks) || !weeks.length) throw new Error("index 為空");
    // newest first for UX
    weeks = [...weeks].sort((a, b) => String(b).localeCompare(String(a)));
    syncNav();
    const wanted = weekFromUrl();
    const start = wanted && weeks.includes(wanted) ? wanted : weeks[0];
    // replace so the first paint doesn't leave a bogus history entry
    await loadWeek(start, { pushUrl: false });
    if (wanted && !weeks.includes(wanted)) {
      statusEl.hidden = false;
      statusEl.className = "error";
      statusEl.textContent = `找不到週次 ${wanted}，已改顯示最新 ${weeks[0]}`;
    }
  } catch (e) {
    statusEl.className = "error";
    statusEl.textContent = `初始化失敗：${e.message}`;
  }
}

weekSelect.addEventListener("change", () => loadWeek(weekSelect.value));
prevBtn.addEventListener("click", () => {
  const i = weeks.indexOf(current);
  if (i > 0) loadWeek(weeks[i - 1]);
});
nextBtn.addEventListener("click", () => {
  const i = weeks.indexOf(current);
  if (i >= 0 && i < weeks.length - 1) loadWeek(weeks[i + 1]);
});
window.addEventListener("popstate", () => {
  const w = weekFromUrl();
  if (w && weeks.includes(w) && w !== current) loadWeek(w, { pushUrl: false });
  else if (!w && weeks.length) loadWeek(weeks[0], { pushUrl: false });
});

init();
