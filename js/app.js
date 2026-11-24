/* NIDSS weekly viewer — mobile-first card. */
const statusEl = document.getElementById("status");
const cardEl = document.getElementById("card");
const extrasEl = document.getElementById("extras");

const TEAL = "#2a8784";
const TEAL_BAR = "#439794";
const TERRACOTTA = "#b64d36";
const TERRACOTTA_BAR = "#c2715d";
const MA_LINE = "#1f2927";
const PLOT_BG = "#f6f5f0";
const HATCH = "#e2e0d7";

let weeks = [];
let current = "";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtInt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n)).toLocaleString("en-US");
}

function badgeText(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return "";
  const rounded = Math.round(Number(pct) * 10) / 10;
  if (rounded > 0) return `↑ ${rounded.toFixed(1)}%`;
  if (rounded < 0) return `↓ ${Math.abs(rounded).toFixed(1)}%`;
  return "→ 0.0%";
}

function weekYear(week) { return parseInt(String(week).slice(0, 4), 10); }
function weekNum(week) { return parseInt(String(week).slice(4), 10); }

function weekOptionLabel(week) {
  return `${weekYear(week)} ・ 第 ${weekNum(week)} 週`;
}

function dateShort(start, end) {
  if (!start || !end) return "";
  const a = String(start).slice(0, 10);
  const b = String(end).slice(0, 10);
  const fmt = (iso) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[2]}/${m[3]}`;
  };
  return `${fmt(a)}–${fmt(b)}`;
}

function wowWord(latest, prev) {
  if (latest == null || prev == null) return null;
  if (prev === 0) return latest === 0 ? "持平" : "上升";
  const pct = ((latest - prev) / prev) * 100;
  if (Math.abs(pct) < 5) return "持平";
  return pct > 0 ? "上升" : "下降";
}

/** Header subtitle: never include「檢出」. */
function buildSubtitle(fluWord, covidWord) {
  const fluP = fluWord === "持平" ? "流感本週持平" : fluWord ? `流感${fluWord}` : "";
  const covP = covidWord === "持平" ? "COVID 本週持平" : covidWord ? `COVID ${covidWord}` : "";
  if (fluP && covP) return `${fluP}；${covP}。`;
  return fluP || covP ? `${fluP || covP}。` : "";
}

function subtitleFromData(d) {
  if (d.subtitle && !String(d.subtitle).includes("檢出")) return d.subtitle;
  if (d.mobile && d.mobile.subtitle && !String(d.mobile.subtitle).includes("檢出")) {
    return d.mobile.subtitle;
  }
  // Fall back to week-over-week from last5 / previous LARS.
  const last5 = d.influenza && d.influenza.last5;
  const fluLatest = (d.mobile && d.mobile.flu && d.mobile.flu.latest) ?? d.influenza?.latest ?? last5?.[last5.length - 1];
  const fluPrev = last5 && last5.length >= 2 ? last5[last5.length - 2] : null;
  const covidLatest = (d.mobile && d.mobile.covid && d.mobile.covid.latest) ?? d.covid?.lars;
  const covidPrev = d.mobile?.covid?.prev_week_covid ?? null;
  const fw = wowWord(fluLatest, fluPrev);
  let cw = wowWord(covidLatest, covidPrev);
  // Older week JSON has no prior-week COVID count; use the stored LARS arrow.
  if (!cw && d.covid && d.covid.lars_arrow) {
    const a = d.covid.lars_arrow;
    cw = a === "↑" ? "上升" : a === "↓" ? "下降" : a === "→" ? "持平" : null;
  }
  return buildSubtitle(fw, cw);
}

function weekFromUrl() {
  const q = new URLSearchParams(location.search).get("week");
  return q ? String(q) : "";
}

function setUrlWeek(id, { replace = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.set("week", id);
  const next = url.pathname + url.search + url.hash;
  if (replace) history.replaceState({ week: id }, "", next);
  else history.pushState({ week: id }, "", next);
}

function hasLiveSeries(d) {
  const m = d.mobile;
  return !!(
    m &&
    m.history &&
    Array.isArray(m.history.weeks) &&
    m.history.weeks.length >= 8 &&
    Array.isArray(m.history.flu) &&
    Array.isArray(m.history.covid) &&
    m.forecast &&
    Array.isArray(m.forecast.target_weeks) &&
    m.forecast.target_weeks.length
  );
}

/* ---------- SVG charts (mirrors nidss_mobile_card.py) ---------- */

function niceTicks(dataMax, nIntervals = 4) {
  if (dataMax <= 0) return { ticks: [0, 1, 2, 3, 4], ymax: 4 };
  const padded = dataMax * 1.08;
  const rough = padded / nIntervals;
  const exp = Math.floor(Math.log10(rough));
  const frac = rough / 10 ** exp;
  let step = null;
  for (const m of [1, 2, 2.5, 5, 7.5, 10]) {
    if (m >= frac * 0.98) { step = m * 10 ** exp; break; }
  }
  if (step == null) step = 10 * 10 ** exp;
  let ymax = step * nIntervals;
  while (ymax < padded - 1e-9) {
    const mag = 10 ** Math.floor(Math.log10(step));
    const mult = step / mag;
    const map = { 1: 2, 2: 2.5, 2.5: 5, 5: 7.5, 7.5: 10 };
    const nxt = map[mult];
    if (nxt == null) step *= 2;
    else step = nxt * mag;
    ymax = step * nIntervals;
  }
  const ticks = [];
  for (let i = 0; i <= nIntervals; i++) {
    const v = step * i;
    ticks.push(Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);
  }
  return { ticks, ymax };
}

function pickXlabelIndices(nHist, nFcst) {
  const nAll = nHist + nFcst;
  const lastHist = nHist - 1;
  const idxs = [];
  for (let i = 0; i < nHist; i += 8) {
    if (i < lastHist - 2) idxs.push(i);
  }
  idxs.push(lastHist);
  if (nFcst) {
    const mid = nHist + Math.min(3, nFcst - 1);
    if (mid < nAll - 1) idxs.push(mid);
    idxs.push(nAll - 1);
  }
  return [...new Set(idxs.filter((i) => i >= 0 && i < nAll))];
}

function weekLabel(week, reportYear) {
  const y = weekYear(week);
  const w = weekNum(week);
  if (y === reportYear) return `W${w}`;
  return `${y % 100}W${String(w).padStart(2, "0")}`;
}

function pathPolyline(points) {
  if (!points.length) return "";
  const d = [`M ${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`];
  for (let i = 1; i < points.length; i++) {
    d.push(`L ${points[i][0].toFixed(2)},${points[i][1].toFixed(2)}`);
  }
  return d.join(" ");
}

function chartSvg({
  histWeeks, histVals, fcstWeeks, fcstPoint, fcstQ20, fcstQ80,
  barColor, bandRgba, labelColor, reportYear, svgId, maVals,
}) {
  const vbW = 352, vbH = 214;
  const left = 58, right = 16, top = 18, bottom = 24;
  const plotW = vbW - left - right;
  const plotH = vbH - top - bottom;
  const nHist = histVals.length;
  const nFcst = fcstPoint.length;
  const nAll = nHist + nFcst;
  const slot = plotW / nAll;
  const barW = slot * 0.62;
  const dataMax = Math.max(
    ...histVals,
    ...(fcstQ80.length ? fcstQ80 : [0]),
    ...(fcstPoint.length ? fcstPoint : [0]),
  );
  const { ticks, ymax } = niceTicks(dataMax);
  const xCenter = (i) => left + (i + 0.5) * slot;
  const yOf = (v) => top + plotH * (1 - v / ymax);
  const sepX = left + nHist * slot;
  const plotRight = left + plotW;

  const grid = ticks.map((t) => {
    const y = yOf(t);
    return `<line x1="${left.toFixed(2)}" y1="${y.toFixed(2)}" x2="${plotRight.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e6e4dc" stroke-width="1"/>`;
  }).join("");
  const ylabels = ticks.map((t) => {
    const y = yOf(t);
    const label = Number.isInteger(t) ? String(t) : String(t);
    return `<text x="${(left - 7).toFixed(2)}" y="${(y + 3.2).toFixed(2)}" text-anchor="end" class="tick">${esc(label)}</text>`;
  }).join("");

  const hatch = `<rect x="${sepX.toFixed(2)}" y="${top.toFixed(2)}" width="${(plotRight - sepX).toFixed(2)}" height="${plotH.toFixed(2)}" fill="url(#${svgId}-hatch)"/>`;

  const bandPtsHi = fcstQ80.map((q, i) => [xCenter(nHist + i), yOf(q)]);
  const bandPtsLo = fcstQ20.map((q, i) => [xCenter(nHist + i), yOf(q)]).reverse();
  let bandD = pathPolyline(bandPtsHi.concat(bandPtsLo));
  if (bandD) bandD += " Z";
  const band = bandD ? `<path d="${bandD}" fill="${bandRgba}" stroke="none"/>` : "";

  const bars = histVals.map((v, i) => {
    const cx = xCenter(i);
    const x = cx - barW / 2;
    const y = yOf(v);
    const h = Math.max(0, yOf(0) - y);
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="${barColor}" rx="0.6"/>`;
  }).join("");

  const ma = (maVals && maVals.length)
    ? maVals
      .map((v, i) => (v == null ? null : [xCenter(i), yOf(v)]))
      .filter(Boolean)
    : [];
  const maPath = pathPolyline(ma);
  const maEl = maPath
    ? `<path d="${maPath}" fill="none" stroke="${MA_LINE}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`
    : "";

  const sep = `<line x1="${sepX.toFixed(2)}" y1="${top.toFixed(2)}" x2="${sepX.toFixed(2)}" y2="${(top + plotH).toFixed(2)}" stroke="${MA_LINE}" stroke-width="1" stroke-dasharray="1.5 2.5" opacity="0.45"/>`;

  const fcstPts = fcstPoint.map((v, i) => [xCenter(nHist + i), yOf(v)]);
  const fcstPath = pathPolyline(fcstPts);
  const fcstLine = fcstPath
    ? `<path d="${fcstPath}" fill="none" stroke="${MA_LINE}" stroke-width="1.6" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/>`
    : "";

  const lastV = histVals[nHist - 1];
  const lastX = xCenter(nHist - 1);
  const lastY = Math.max(top + 8, yOf(lastV) - 11);
  const latestLbl = `<text x="${lastX.toFixed(2)}" y="${lastY.toFixed(2)}" text-anchor="middle" class="latest" fill="${labelColor}">${esc(fmtInt(lastV))}</text>`;

  const allWeeks = histWeeks.concat(fcstWeeks);
  const xlabels = pickXlabelIndices(nHist, nFcst).map((i) => {
    const lab = weekLabel(allWeeks[i], reportYear);
    let x = xCenter(i);
    let anchor = "middle";
    if (i === nAll - 1 && x + 22 > vbW - 2) { anchor = "end"; x = vbW - 2; }
    return `<text x="${x.toFixed(2)}" y="${(top + plotH + 14).toFixed(2)}" text-anchor="${anchor}" class="tick">${esc(lab)}</text>`;
  }).join("");

  const unitX = 12, unitY = top + plotH / 2;
  const unit = `<text x="${unitX.toFixed(2)}" y="${unitY.toFixed(2)}" text-anchor="middle" class="tick" transform="rotate(-90 ${unitX.toFixed(2)} ${unitY.toFixed(2)})">件</text>`;

  return `<svg viewBox="0 0 ${vbW} ${vbH}" width="100%" height="100%" role="img" aria-label="檢出趨勢圖">
  <defs>
    <pattern id="${svgId}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${HATCH}" stroke-width="1.1"/>
    </pattern>
    <clipPath id="${svgId}-clip">
      <rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${plotW.toFixed(2)}" height="${plotH.toFixed(2)}" rx="8" ry="8"/>
    </clipPath>
  </defs>
  <rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${plotW.toFixed(2)}" height="${plotH.toFixed(2)}" rx="8" ry="8" fill="${PLOT_BG}"/>
  <g clip-path="url(#${svgId}-clip)">
    ${hatch}${grid}${band}${bars}${sep}${maEl}${fcstLine}
  </g>
  ${ylabels}${unit}${latestLbl}${xlabels}
</svg>`;
}

/* ---------- render ---------- */

function visitCard(label, metric, kind) {
  if (!metric || metric.latest == null) {
    return `<div class="card visit-card"><div class="v-label">${esc(label)}</div><div class="v-row"><span class="v-num num">暫缺</span></div></div>`;
  }
  return `<div class="card visit-card">
    <div class="v-label">${esc(label)}</div>
    <div class="v-row">
      <span class="v-num num">${esc(fmtInt(metric.latest))}</span>
      <span class="v-pct ${kind}">${esc(badgeText(metric.pct_vs_prev2))}</span>
    </div>
  </div>`;
}

function nhiaMetrics(d) {
  if (d.mobile && d.mobile.nhia && d.mobile.nhia.ili_tot) return d.mobile.nhia;
  const n = d.nhia;
  if (!n || n.status !== "ok") return null;
  const pack = (obj) => obj && obj.latest != null
    ? { latest: obj.latest, pct_vs_prev2: obj.pct_vs_prev2 }
    : null;
  return {
    status: n.status,
    week: n.latest_week,
    ili_tot: pack(n.ili && n.ili.tot),
    ili_er: pack(n.ili && n.ili.er),
    covid_tot: pack(n.covid && n.covid.tot),
    covid_er: pack(n.covid && n.covid.er),
  };
}

function fluPct(d) {
  if (d.mobile && d.mobile.flu && d.mobile.flu.pct_vs_prev2 != null) return d.mobile.flu.pct_vs_prev2;
  const last5 = d.influenza && d.influenza.last5;
  if (last5 && last5.length >= 3) {
    const latest = last5[last5.length - 1];
    const avg = (last5[last5.length - 2] + last5[last5.length - 3]) / 2;
    return avg ? ((latest - avg) / avg) * 100 : 0;
  }
  return null;
}

function covidPct(d) {
  if (d.mobile && d.mobile.covid && d.mobile.covid.pct_vs_prev2 != null) return d.mobile.covid.pct_vs_prev2;
  const latest = d.covid && d.covid.lars;
  const avg = d.covid && d.covid.lars_vs_2wk_avg;
  if (latest != null && avg) return ((latest - avg) / avg) * 100;
  return null;
}

function render(d) {
  const week = d.week;
  const reportYear = weekYear(week);
  const sub = subtitleFromData(d);
  const live = hasLiveSeries(d);
  const m = d.mobile || {};
  const fluLatest = m.flu?.latest ?? d.influenza?.latest ?? d.influenza?.last5?.slice(-1)[0];
  const covidLatest = m.covid?.latest ?? d.covid?.lars;
  const fluA = m.flu?.a ?? d.influenza?.flu_a;
  const fluB = m.flu?.b ?? d.influenza?.flu_b;
  const fluU = m.flu?.untyped;
  const fluSub = (fluA != null && fluB != null)
    ? (fluU != null
        ? `A 型 ${fmtInt(fluA)} · B 型 ${fmtInt(fluB)} · 未分型 ${fmtInt(fluU)}`
        : `A 型 ${fmtInt(fluA)} · B 型 ${fmtInt(fluB)}`)
    : "A／B 分型暫缺";
  const prevWeekNum = m.covid?.prev_week_num;
  const prevWeekCovid = m.covid?.prev_week_covid;
  const covidSub = (prevWeekNum != null && prevWeekCovid != null)
    ? `第 ${prevWeekNum} 週 ${fmtInt(prevWeekCovid)} 件`
    : "";

  const fPct = fluPct(d);
  const cPct = covidPct(d);
  const severe = m.covid?.severe ?? d.covid?.severe;
  const deaths = m.covid?.deaths ?? d.covid?.deaths;
  const others = d.others || {};
  const o = (key, fallbackCur) => (others[key] && (others[key].cur ?? others[key].latest)) ?? fallbackCur;

  let chartsHtml;
  if (live) {
    const h = m.history;
    const f = m.forecast;
    const h1Week = f.h1_week || f.target_weeks[0];
    const h1Year = weekYear(h1Week);
    const h1Num = weekNum(h1Week);
    const h1Prefix = h1Year === reportYear ? `第 ${h1Num} 週` : `${h1Year} 年第 ${h1Num} 週`;
    const fluSvg = chartSvg({
      histWeeks: h.weeks, histVals: h.flu,
      fcstWeeks: f.target_weeks, fcstPoint: f.flu_point, fcstQ20: f.flu_q20, fcstQ80: f.flu_q80,
      barColor: TEAL_BAR, bandRgba: "rgba(42,135,132,0.16)", labelColor: TEAL,
      reportYear, svgId: "flu", maVals: h.flu_ma3,
    });
    const covidSvg = chartSvg({
      histWeeks: h.weeks, histVals: h.covid,
      fcstWeeks: f.target_weeks, fcstPoint: f.covid_point, fcstQ20: f.covid_q20, fcstQ80: f.covid_q80,
      barColor: TERRACOTTA_BAR, bandRgba: "rgba(182,77,54,0.16)", labelColor: TERRACOTTA,
      reportYear, svgId: "covid", maVals: h.covid_ma3,
    });
    chartsHtml = `
      <div class="sec-head">
        <h2>檢出趨勢</h2>
        <div class="legend">
          <div class="row">
            <span class="item"><span class="swatches"><span class="swatch"></span><span class="swatch covid"></span></span>實測</span>
            <span class="item"><span class="leg-line"></span>三週平均</span>
          </div>
          <div class="row">
            <span class="item"><span class="leg-line dash"></span>預測虛線</span>
          </div>
        </div>
      </div>
      <div class="chart-stack">
        <div class="card chart-card">
          <div class="chart-head">
            <span class="name flu">流感</span>
            <span class="fcst flu">${esc(h1Prefix)}預測約 <b>${esc(fmtInt(f.flu_h1))}</b> 件</span>
          </div>
          <div class="chart-body">${fluSvg}</div>
        </div>
        <div class="card chart-card">
          <div class="chart-head">
            <span class="name covid">COVID</span>
            <span class="fcst covid">${esc(h1Prefix)}預測約 <b>${esc(fmtInt(f.covid_h1))}</b> 件</span>
          </div>
          <div class="chart-body">${covidSvg}</div>
        </div>
      </div>`;
  } else {
    const fallback = d.charts && (d.charts.flu_covid || d.charts.mobile || d.charts.trend);
    chartsHtml = `
      <div class="sec-head"><h2>檢出趨勢</h2></div>
      <div class="card chart-fallback">
        ${fallback ? `<img src="${esc(fallback)}" alt="流感與 COVID 趨勢 ${esc(week)}" />` : ""}
        <p class="note">此週尚無互動趨勢圖，改顯示完整圖表。</p>
      </div>`;
  }

  const nh = nhiaMetrics(d);
  let visitsRight = "人次 · 較前兩週平均";
  if (nh && nh.week && String(nh.week) !== String(week)) {
    visitsRight = `人次 · 較前兩週平均（健保最新 ${nh.week}）`;
  }
  const visitsHtml = nh
    ? `<div class="visit-grid">
        ${visitCard("類流感・門急診", nh.ili_tot, "ili")}
        ${visitCard("類流感・急診", nh.ili_er, "ili")}
        ${visitCard("COVID・門急診", nh.covid_tot, "cov")}
        ${visitCard("COVID・急診", nh.covid_er, "cov")}
      </div>`
    : `<div class="card visit-card"><div class="v-label">健保門急診</div><div class="v-row"><span class="v-num num">暫缺</span></div></div>`;

  const i = weeks.indexOf(week);
  const canPrev = i >= 0 && i < weeks.length - 1; // weeks are newest-first
  const canNext = i > 0;
  // UI: ‹ older, › newer. weeks[] is newest first, so older = i+1, newer = i-1.
  const options = weeks.map((w) =>
    `<option value="${esc(w)}"${w === week ? " selected" : ""}>${esc(weekOptionLabel(w))}</option>`
  ).join("");

  const capture = d.fetched_at_taipei || m.fetched_at_taipei;
  const captureLine = capture
    ? `資料擷取：${esc(capture)}（台北）。檢體件數、就診人次均非感染人數。`
    : "檢體件數、就診人次均非感染人數。";
  const links = d.links || {};

  cardEl.innerHTML = `
    <header class="banner">
      <div class="wm" aria-hidden="true">${esc(String(weekNum(week)).padStart(2, "0"))}</div>
      <div class="meta-row">
        <button type="button" class="week-nav" id="prevWeek" aria-label="較早一週" ${canPrev ? "" : "disabled"}>‹</button>
        <label class="week-pill">
          <select id="weekSelect" aria-label="選擇年週">${options}</select>
        </label>
        <span class="dates">${esc(dateShort(d.date_start, d.date_end))}</span>
        <button type="button" class="week-nav" id="nextWeek" aria-label="較新一週" ${canNext ? "" : "disabled"}>›</button>
      </div>
      <h1>呼吸道病毒週報</h1>
      <p class="sub">${esc(sub)}</p>
    </header>
    <div class="body">
      <div class="kpi-row">
        <div class="card kpi flu">
          <div class="accent"></div>
          <div class="kpi-inner">
            <div class="kpi-top">
              <span class="kpi-name">流感</span>
              ${fPct != null ? `<span class="badge flu">${esc(badgeText(fPct))}</span>` : ""}
            </div>
            <div class="kpi-metric">
              <span class="val num">${esc(fmtInt(fluLatest))}</span>
              <span class="unit">件陽性</span>
            </div>
            <div class="kpi-sub">${esc(fluSub)}</div>
          </div>
        </div>
        <div class="card kpi covid">
          <div class="accent"></div>
          <div class="kpi-inner">
            <div class="kpi-top">
              <span class="kpi-name">COVID</span>
              ${cPct != null ? `<span class="badge covid">${esc(badgeText(cPct))}</span>` : ""}
            </div>
            <div class="kpi-metric">
              <span class="val num">${esc(fmtInt(covidLatest))}</span>
              <span class="unit">件陽性</span>
            </div>
            <div class="kpi-sub">${esc(covidSub)}</div>
          </div>
        </div>
      </div>
      <p class="kpi-caption">百分比與前兩週平均相比</p>
      <section class="sec">${chartsHtml}</section>
      <section class="sec">
        <div class="sec-head">
          <h2>門急診就診</h2>
          <div class="right">${esc(visitsRight)}</div>
        </div>
        ${visitsHtml}
        <p class="callout">COVID 重症 <b>${esc(fmtInt(severe))}</b> 例 · 死亡 <b>${esc(fmtInt(deaths))}</b> 例</p>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>其他病原</h2></div>
        <div class="path-row">
          <div class="card path-card"><div class="p-label">RSV</div><div class="p-num num">${esc(fmtInt(o("rsv")))}</div></div>
          <div class="card path-card"><div class="p-label">腺病毒</div><div class="p-num num">${esc(fmtInt(o("adeno")))}</div></div>
          <div class="card path-card"><div class="p-label">肺炎鏈球菌</div><div class="p-num num">${esc(fmtInt(o("spn")))}</div></div>
          <div class="card path-card"><div class="p-label">副流感</div><div class="p-num num">${esc(fmtInt(o("para")))}</div></div>
        </div>
      </section>
    </div>
    <footer class="card-foot">
      <div class="links">
        ${links.lars ? `<a href="${esc(links.lars)}" target="_blank" rel="noopener">疾管署 LARS</a>` : ""}
        ${links.nhia ? `<a href="${esc(links.nhia)}" target="_blank" rel="noopener">健保就診</a>` : ""}
        ${links.severe ? `<a href="${esc(links.severe)}" target="_blank" rel="noopener">COVID 重症與死亡</a>` : ""}
      </div>
      <div class="notes">
        <p>${captureLine}</p>
        <p>TimesFM 2.5 為探索性預測，區間未校準。重症依發病週，死亡依死亡週。</p>
      </div>
    </footer>`;

  const figures = [];
  if (d.charts?.trend) {
    figures.push(`<figure><img src="${esc(d.charts.trend)}" alt="全病原體趨勢圖 ${esc(week)}" /><figcaption>全病原體趨勢（近 26 週）</figcaption></figure>`);
  }
  if (d.charts?.flu_covid) {
    figures.push(`<figure><img src="${esc(d.charts.flu_covid)}" alt="流感與 COVID 圖 ${esc(week)}" /><figcaption>流感／COVID 趨勢與 TimesFM 2.5 參照</figcaption></figure>`);
  }
  if (d.charts?.nhia_vs_lars) {
    figures.push(`<figure><img src="${esc(d.charts.nhia_vs_lars)}" alt="健保門急診 vs LARS ${esc(week)}" /><figcaption>COVID 健保門急診人次 vs LARS 陽性件數</figcaption></figure>`);
  }

  extrasEl.innerHTML = `
    <details class="more">
      <summary>展開完整圖表與臨床摘要</summary>
      ${d.clinical ? `<p class="clinical">${esc(d.clinical)}</p>` : ""}
      <div class="full-charts">${figures.join("")}</div>
    </details>
    <p class="site-foot">資料來源：疾管署 NIDSS。本站為靜態解讀瀏覽器，非正式疾管署網站。 <a href="https://github.com/idnerdtw/nidss-weekly-viewer">GitHub</a></p>`;

  extrasEl.hidden = false;
  cardEl.hidden = false;
  statusEl.hidden = true;
  document.title = `呼吸道病毒週報・${weekYear(week)} 年第 ${weekNum(week)} 週`;
}

async function loadWeek(id, { pushUrl = true } = {}) {
  try {
    statusEl.hidden = false;
    statusEl.className = "boot";
    statusEl.textContent = "載入中…";
    const res = await fetch(`data/weeks/${id}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`無法載入 ${id}（${res.status}）`);
    const data = await res.json();
    current = id;
    if (pushUrl) setUrlWeek(id);
    render(data);
  } catch (e) {
    statusEl.hidden = false;
    statusEl.className = "boot error";
    statusEl.textContent = `載入失敗：${e.message}`;
  }
}

function syncNav() {
  // options are rebuilt on each render from `weeks`
}

async function init() {
  try {
    const res = await fetch(`data/weeks/index.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`index ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw) || !raw.length) throw new Error("index 為空");
    weeks = [...raw].sort((a, b) => String(b).localeCompare(String(a)));
    syncNav();
    const wanted = weekFromUrl();
    const start = wanted && weeks.includes(wanted) ? wanted : weeks[0];
    await loadWeek(start, { pushUrl: false });
    if (!weekFromUrl()) setUrlWeek(start, { replace: true });
    if (wanted && !weeks.includes(wanted)) {
      statusEl.hidden = false;
      statusEl.className = "boot error";
      statusEl.textContent = `找不到週次 ${wanted}，已改顯示最新 ${weeks[0]}`;
    }
  } catch (e) {
    statusEl.className = "boot error";
    statusEl.textContent = `初始化失敗：${e.message}`;
  }
}

cardEl.addEventListener("change", (e) => {
  if (e.target && e.target.id === "weekSelect") loadWeek(e.target.value);
});
cardEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = weeks.indexOf(current);
  if (btn.id === "prevWeek" && i >= 0 && i < weeks.length - 1) loadWeek(weeks[i + 1]);
  if (btn.id === "nextWeek" && i > 0) loadWeek(weeks[i - 1]);
});
window.addEventListener("popstate", () => {
  const w = weekFromUrl();
  if (w && weeks.includes(w) && w !== current) loadWeek(w, { pushUrl: false });
  else if (!w && weeks.length) loadWeek(weeks[0], { pushUrl: false });
});

init();
