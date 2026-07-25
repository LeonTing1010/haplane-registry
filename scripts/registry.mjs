#!/usr/bin/env node
// HapLane Registry 工具脚本(零依赖,Node ≥18)。
//   node scripts/registry.mjs validate            校验 index.json(PR 机器验收,CI 可跑)
//   node scripts/registry.mjs entry <hap路径>      读 hap 生成 index.json 条目模板(投稿小抄)
// 验收标准即代码:字段齐全/ id 唯一/ license 在白名单/ upstreamRelease 必填/
//   **本仓不托管二进制**:hap 必须是上游权利人官方发布位直链,禁指向本仓(自托管/转存)。

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"
import { resolve, basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
// 每条必备(与是否可自动下载无关):upstreamRelease 是溯源+发现的落点,永远必填。
const REQUIRED = ["id", "name", "packageName", "version", "developer", "license", "source", "description", "deviceTypes", "upstreamRelease"]
// 本仓自身的托管位——hap 直链禁止指向这里(否则=自托管/转存,踩分发平台义务)。
const SELF_HOST = /(?:gitee|github)\.com\/LeonTing1010\/haplane-registry/i
const isSelfHosted = (u) => SELF_HOST.test(String(u || ""))
// 允许再分发的 license 白名单 + 「作者自有」(开发者投稿自己的作品,license 任意)
const LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "MPL-2.0", "GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0", "AGPL-3.0", "EPL-2.0", "ISC", "Unlicense", "CC0-1.0", "MulanPSL-2.0", "作者自有"])

// 读 zip/HAP 内某条目(中央目录扫描,免 unzip 依赖)
function readZipEntry(file, entryName) {
  const buf = readFileSync(file)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error("非法 zip/HAP(找不到 EOCD)")
  let p = buf.readUInt32LE(eocd + 16)
  const count = buf.readUInt16LE(eocd + 10)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    const lho = buf.readUInt32LE(p + 42), name = buf.toString("utf8", p + 46, p + 46 + nameLen)
    if (name === entryName) {
      const lNameLen = buf.readUInt16LE(lho + 26), lExtraLen = buf.readUInt16LE(lho + 28)
      const raw = buf.subarray(lho + 30 + lNameLen + lExtraLen, lho + 30 + lNameLen + lExtraLen + compSize)
      return method === 0 ? Buffer.from(raw) : inflateRawSync(raw)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}
const readModule = (hap) => JSON.parse(readZipEntry(hap, "module.json").toString("utf8"))
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex")

function validate() {
  const problems = []
  const idx = JSON.parse(readFileSync(join(ROOT, "index.json"), "utf8"))
  if (idx.schema !== 1) problems.push("index.json schema ≠ 1")
  const ids = new Set()
  let selfHostHits = 0
  for (const a of idx.apps || []) {
    const tag = `[${a.id || "(无id)"}]`
    for (const f of REQUIRED) if (a[f] === undefined || a[f] === "") problems.push(`${tag} 缺字段 ${f}`)
    if (ids.has(a.id)) problems.push(`${tag} id 重复`)
    ids.add(a.id)
    if (a.license && !LICENSES.has(a.license)) problems.push(`${tag} license「${a.license}」不在白名单(自有作品写「作者自有」)`)
    // 铁规:hap 直链绝不能指向本仓(自托管/转存)——本仓只索引不托管
    if (isSelfHosted(a.hap)) { problems.push(`${tag} hap 指向本仓=自托管,违反「只索引不托管」铁规,须换上游官方直链或置 null`); selfHostHits++ }
    if (isSelfHosted(a.upstreamRelease)) problems.push(`${tag} upstreamRelease 不能指向本仓,须为上游权利人官方发布位`)
    // 两种合法形态:① discoveryOnly(仅索引)hap 必须为 null ② 可自动装 hap=上游直链 + sha256/大小齐全
    if (a.discoveryOnly === true) {
      if (a.hap != null) problems.push(`${tag} discoveryOnly 条目 hap 必须为 null(仅索引,去 upstreamRelease 自取)`)
    } else if (a.hap == null) {
      problems.push(`${tag} 非 discoveryOnly 却无 hap 直链——要么补上游直链,要么标 discoveryOnly:true`)
    } else {
      if (!/^https?:\/\//.test(a.hap)) problems.push(`${tag} hap 须是 http(s) 上游直链`)
      if (!a.sha256 || !/^[0-9a-f]{64}$/.test(a.sha256)) problems.push(`${tag} 可下载条目 sha256 缺失或格式不对(下载后强校验用)`)
      if (typeof a.sizeBytes !== "number" || a.sizeBytes <= 0) problems.push(`${tag} 可下载条目 sizeBytes 缺失`)
    }
  }
  if (problems.length) { console.error(`✗ ${problems.length} 个问题:`); for (const p of problems) console.error("  - " + p); process.exit(1) }
  const apps = idx.apps || []
  const dl = apps.filter((a) => a.hap && a.discoveryOnly !== true).length
  console.log(`✓ index.json 全绿(${apps.length} 条:${dl} 条上游直链可自动装,${apps.length - dl} 条仅索引)｜自托管直链 0`)
}

function entry(hapPath) {
  const f = resolve(hapPath)
  if (!existsSync(f)) { console.error(`✗ 文件不存在: ${f}`); process.exit(1) }
  const mod = readModule(f)
  const tpl = {
    id: "<改成短横线小写 id>",
    name: mod?.app?.label || "<应用名>",
    packageName: mod?.app?.bundleName || "<包名>",
    version: mod?.app?.versionName || "<版本>",
    developer: "<你的署名>",
    license: "<license 或「作者自有」>",
    source: "<源码仓库地址>",
    description: "<一句话说明;标注适用系统(minAPI " + (mod?.app?.minAPIVersion || "?") + ")>",
    deviceTypes: mod?.module?.deviceTypes || ["phone"],
    signed: false,
    upstreamRelease: "<上游权利人官方 release 页,如 https://github.com/owner/repo/releases/tag/vX>",
    hap: "<上游官方 .hap 直链;上游只有源码/无直链则删本行并加 discoveryOnly:true>",
    sha256: sha256(f),
    sizeBytes: statSync(f).size,
  }
  console.log(JSON.stringify(tpl, null, 2))
  console.error("\n注意:hap 必须填上游官方直链(本仓不托管二进制)。仅索引的条目删 hap、加 \"discoveryOnly\": true。")
}

// ---- 投稿 intake：解析 issue 表单 → 建条目 → 落 index.json（半自动，产出供人工过审的 PR）----
// issue 表单 ### 标题 → 内部字段（标题须与 .github/ISSUE_TEMPLATE/投稿.yml 的 label 逐字一致）
const ISSUE_FIELDS = {
  "应用 ID": "id", "License": "license", "源码仓库": "source",
  "署名（开发者）": "developer", "一句话描述": "description",
  "分类": "category", "关键词": "keywords", "应用名": "name", "HAP 直链": "hapUrl",
}
// GitHub issue form 渲染成 "### 标题\n\n值\n\n### 标题2\n\n值2"
function parseIssue(body) {
  const out = {}
  for (const b of body.split(/^###\s+/m).slice(1)) {
    const nl = b.indexOf("\n")
    const label = (nl < 0 ? b : b.slice(0, nl)).trim()
    let val = (nl < 0 ? "" : b.slice(nl + 1)).trim()
    if (val === "_No response_" || val === "_无回应_") val = ""
    out[label] = val
  }
  return out
}
function fieldCmd(bodyFile, label) {
  process.stdout.write(parseIssue(readFileSync(bodyFile, "utf8"))[label] || "")
}
function intake(hapPath, bodyFile) {
  const raw = parseIssue(readFileSync(bodyFile, "utf8"))
  const F = {}
  for (const [label, key] of Object.entries(ISSUE_FIELDS)) F[key] = raw[label] || ""
  const fail = (m) => { console.error("✗ " + m); process.exit(1) }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(F.id)) fail(`应用 ID「${F.id}」非法：只能小写字母/数字/短横线`)
  if (!LICENSES.has(F.license)) fail(`license「${F.license}」不在白名单（自有作品填「作者自有」）`)
  if (!/^https?:\/\//.test(F.source)) fail("源码仓库需是 http(s) 链接")
  if (!F.developer) fail("缺署名（开发者）")
  if (!F.description) fail("缺一句话描述")
  // 本仓不托管二进制:HAP 直链必须是上游官方位,禁指向本仓
  if (!/^https?:\/\//.test(F.hapUrl)) fail("HAP 直链需是 http(s) 上游官方直链（本仓不托管二进制）")
  if (isSelfHosted(F.hapUrl)) fail("HAP 直链不能指向本仓（自托管/转存）——填上游权利人官方发布位直链")
  const idxPath = join(ROOT, "index.json")
  const idx = JSON.parse(readFileSync(idxPath, "utf8"))
  if ((idx.apps || []).some(a => a.id === F.id)) fail(`id「${F.id}」已存在，换个 id 或加版本后缀`)
  const f = resolve(hapPath)
  if (!existsSync(f)) fail(`HAP 未下载到: ${f}`)
  let mod
  try { mod = readModule(f) } catch (e) { fail(`不是合法 HAP（读不到 module.json）: ${e.message}`) }
  const bn = mod?.app?.bundleName
  if (!bn) fail("HAP 内读不到 bundleName")
  // HAP 的 label 常是资源引用（$string:app_name），解析不出真名 → 要求投稿人填「应用名」
  const name = F.name || mod?.app?.label || ""
  if (!name || name.startsWith("$")) fail("读不到应用名（HAP label 是资源引用 $string:…），请在表单『应用名』里填真实名称")
  const e = {
    id: F.id, name, packageName: bn,
    version: mod?.app?.versionName || "", developer: F.developer, license: F.license,
    source: F.source, description: F.description,
    deviceTypes: mod?.module?.deviceTypes || ["phone"], signed: false,
    // upstreamRelease 尽量由 source+release 页给出;直链取投稿人填的上游官方位。sha256/大小按下载到本地的包实算(仅用于下载后强校验,不落盘托管)。
    upstreamRelease: F.upstreamRelease || F.source,
    hap: F.hapUrl,
    sha256: sha256(f), sizeBytes: statSync(f).size,
  }
  if (F.keywords) e.keywords = F.keywords.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  if (F.category) e.category = F.category
  idx.apps.push(e)
  idx.updated = new Date().toISOString().slice(0, 10)
  writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n")
  console.log(`✓ 已追加 [${e.id}] ${e.name} @ ${e.version}（${e.packageName}） license=${e.license} ${e.sizeBytes}B`)
  validate()  // 整体复验（会强校验刚下载进 haps/ 的文件：sha256/大小/包名）
}

const args = process.argv.slice(2)
const cmd = args[0]
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
if (cmd === "validate") validate()
else if (cmd === "entry" && args[1]) entry(args[1])
else if (cmd === "field" && args[1] && args[2]) fieldCmd(args[1], args[2])
else if (cmd === "intake") {
  const hap = flag("--hap"), body = flag("--from-issue")
  if (!hap || !body) { console.error("用法: intake --hap <path> --from-issue <bodyfile>"); process.exit(1) }
  intake(hap, body)
}
else { console.log("用法:\n  validate\n  entry <hap路径>\n  intake --hap <path> --from-issue <bodyfile>\n  field <bodyfile> <标题>"); process.exit(cmd ? 1 : 0) }
