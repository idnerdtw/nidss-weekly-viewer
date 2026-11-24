# NIDSS Weekly Viewer

靜態 GitHub Pages 站：手機優先瀏覽疾管署 NIDSS 呼吸道病毒週報。

- 預覽：https://idnerdtw.github.io/nidss-weekly-viewer/
- 週次深層連結：`?week=YYYYWW`
- 資料：`data/weeks/{week}.json`、`data/weeks/index.json`
- 圖：`charts/{week}_mobile.png`、`_trend.png`、`_flu_covid.png`、`_nhia_vs_lars.png`

主畫面是手機卡片（KPI、互動 SVG 檢出趨勢、門急診、其他病原）。完整圖表與臨床摘要收在「展開完整圖表與臨床摘要」。較早週次若尚未寫入 `mobile` 序列資料，趨勢圖會改顯示既有 PNG。

TimesFM 2.5「未來8週平均」= 未來 8 週 point forecast 平均，不是近 8 週實測平均。
