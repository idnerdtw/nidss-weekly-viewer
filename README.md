# NIDSS Weekly Viewer

靜態 GitHub Pages 站：瀏覽疾管署 NIDSS 呼吸道病毒週報解讀與正式圖表。

- 預覽（啟用 Pages 後）：https://idnerdtw.github.io/nidss-weekly-viewer/
- 資料：`data/weeks/{week}.json`、`data/weeks/index.json`
- 圖：`charts/{week}_trend.png`、`charts/{week}_flu_covid.png`（沿用週報 matplotlib 產物，非前端重畫）

## 新增一週

1. 放入 `data/weeks/YYYYWW.json`
2. 放入兩張圖到 `charts/`
3. 把 `YYYYWW` 加進 `data/weeks/index.json`
4. push `main`

TimesFM「8週均」= **未來** 8 週 point forecast 平均，不是近 8 週實測平均。
