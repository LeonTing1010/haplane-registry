# HapLane Registry · 鸿蒙开源应用仓

给鸿蒙侧载/开发者一个**国内秒开、无登录闸**的开源 HAP 分发位。配合 [haplane CLI](https://gitee.com/LeonTing1010/haplane) 一条命令完成 搜索 → 下载 → 自动签名 → 装机 → 验签:

```bash
npx -y haplane search 浏览器            # 搜(本仓 + 其他源)
npx -y haplane deploy --app linysbrowser   # 下载 → 自动签名 → 装上你的设备
```

也可以不装任何工具,直接从 `haps/` 或 Release 下载 `.hap` 自己签。

## 只收三类(白名单,铁规)

1. **自有产物** —— HapLane 自己的工具与 demo
2. **开源可再分发** —— license 允许再分发的开源鸿蒙应用(原样收录上游产物,注明源仓与 license)
3. **开发者投稿自有作品** —— 你自己开发的应用,提 PR 挂上来(见下)

**不收**:破解/魔改/去广告包、任何未经授权的第三方应用搬运、闭源且未授权再分发的包。收录的未签名包装机需自行签名——本仓与工具都不破解、不绕过任何签名机制。

## 两个地址,分工

本仓在 GitHub 与 Gitee 双托管,内容一致:

- **投稿走 GitHub** [github.com/LeonTing1010/haplane-registry](https://github.com/LeonTing1010/haplane-registry) —— 提 PR 后 **GitHub Actions 自动跑格式验收**(sha256/license/包名/字段,零配置),维护者再审「该不该收」后合并
- **下载/CLI 读 Gitee** [gitee.com/LeonTing1010/haplane-registry](https://gitee.com/LeonTing1010/haplane-registry) —— 国内秒开,`index.json` 与 hap 附件都在这;合并后自动同步过来

## 参与贡献(按门槛挑一样)

- **求收录**:想一条命令装某个开源应用?开个 Issue([GitHub](https://github.com/LeonTing1010/haplane-registry/issues) / [Gitee](https://gitee.com/LeonTing1010/haplane-registry/issues),有模板),丢应用名和源仓链接就行
- **投稿但不会 git**:开 Issue 填「投稿」模板,维护者代收录,`developer` 署名归你
- **投稿(PR,最快)**:向 **GitHub** 提 PR:
  1. `.hap` 放进 `haps/`,命名 `<应用id>-<版本>[-变体]-unsigned.hap`(推荐传未签名包,用户装机时本地自动签)
  2. `node scripts/registry.mjs entry haps/你的.hap` 生成条目模板(自动算 sha256/读包名),补上 id/署名/license/源仓,填进 `index.json`
  3. `node scripts/registry.mjs validate` 本地全绿后提 PR;CI 会再验一遍,按模板勾声明(自己的作品 / license 允许再分发)
- **报错**:装不上开 Issue 贴完整报错文本

单文件 ≤ 50MB 走 `haps/` 目录;大包走 Release 附件,`hap` 字段填 Release 直链。连续高质量投稿会被邀请为仓库维护者。

## 已收录开发者

| 开发者 | 应用 | 来源 |
|--------|------|------|
| awaLiny2333 | Linys Browser NEXT ×3 / Dictionareow 词典 / Spaceow 空间分析 / Symbolu 符号浏览器 / Snake 贪吃蛇 | [GitHub](https://github.com/awaLiny2333) |
| harmoninux | Harmonix 终端(鸿蒙 PC 跑 Linux ELF) | [GitHub](https://github.com/harmoninux/Harmonix) |
| Chenlvin | CloudMusic 第三方网易云 | [GitHub](https://github.com/Chenlvin/CloudMusic-HarmonyOSNext) |
| hefengbao | 京墨(鸿蒙版)诗词文集 | [GitHub](https://github.com/hefengbao/jingmo-for-HarmonyOS) |
| wly5556 | S1-Orange(S1 论坛客户端) | [GitHub](https://github.com/wly5556/S1-Orange) |
| shanyan-wcx | Harmshelf(有声书) | [GitHub](https://github.com/shanyan-wcx/Audiobookshelf-HarmonyOS) |
| Predidit / ErBWs | Kazumi(番剧采集观看) | [GitHub](https://github.com/ErBWs/Kazumi) |
| cnctem | PiliPlusX(B 站第三方) | [GitHub](https://github.com/cnctem/PiliPlusX) |

被收录的项目欢迎(完全可选)在 README 贴徽章:

```markdown
[![haplane registry](https://gitee.com/LeonTing1010/haplane-registry/raw/main/badge.svg)](https://gitee.com/LeonTing1010/haplane-registry)
```

## index.json 契约(schema 1)

`haplane` CLI 与 MCP 工具 `search_hap` 读根目录 `index.json`(Gitee raw,无需鉴权)。字段见上;`sha256` 必填,CLI 下载后强校验。

**为了让 AI/agent 搜得到,强烈建议每条带**:`keywords`(别名+场景词数组,如 `["哔哩哔哩","B站","弹幕","视频"]`——用户不会都用官方名搜)+ `category`(工具/影音/阅读/游戏/开发)+ 两句话 `description`(功能+适用场景)。搜索按 id/名称/包名/描述/keywords/category 子串匹配;`search_hap` 传 `query:"*"` 可列出全仓供 agent 语义挑选。

## 边界与下架

- 侵权/违规内容:开 Issue 附权属说明,核实即删
- 本仓只做分发位,不对第三方应用的行为背书;装机自签,风险自担
- 上游发新版靠 PR/Issue 跟进 + `registry-watch` 每日自动对比上游 release,有新版自动开 issue

## License

仓库本身 MIT。各应用 license 见 `index.json` 对应条目,以上游为准。
