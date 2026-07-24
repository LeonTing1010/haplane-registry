## 投稿清单(全勾再提)

- [ ] `.hap` 已放 `haps/`,命名 `<应用id>-<版本>[-变体]-unsigned.hap`(>50MB 的走 Release 附件,`hap` 字段填附件直链)
- [ ] `index.json` 已加条目,字段齐:id / name / packageName / version / developer / license / source / description / deviceTypes / hap / sha256 / sizeBytes
- [ ] 本地跑过 `node scripts/registry.mjs validate`,全绿
- [ ] **声明(必填,二选一)**:
  - [ ] 这是我自己的作品
  - [ ] license 允许再分发(写明哪个 license):____
- [ ] 不是破解 / 魔改 / 去广告包,不侵权

> 小抄:`node scripts/registry.mjs entry haps/你的.hap` 会自动读包名/设备类型/算 sha256,生成条目模板。
