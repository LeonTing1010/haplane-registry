## 投稿清单(全勾再提)

- [ ] **只改 `index.json`,没上传任何二进制**(本仓不托管 HAP)
- [ ] `hap` 填**上游权利人官方发布位直链**(非本仓、非转存/镜像/网盘);上游只有源码无直链的,删 `hap`、加 `"discoveryOnly": true`
- [ ] `index.json` 条目字段齐:id / name / packageName / version / developer / license / source / **upstreamRelease** / description / deviceTypes(可下载条目再加 hap / sha256 / sizeBytes)
- [ ] 本地跑过 `node scripts/registry.mjs validate`,全绿
- [ ] **声明(必填,三选一或多选)**:
  - [ ] 这是我自己的作品
  - [ ] license 允许再分发(写明哪个 license):____
  - [ ] `hap` 直链是上游权利人官方发布位
- [ ] 不是破解 / 魔改 / 去广告包,不侵权

> 小抄:`node scripts/registry.mjs entry 本地下载的.hap` 会读包名/设备类型/算 sha256 生成模板;把 `hap` 改成上游直链、补 `upstreamRelease` 再填进 `index.json`。
