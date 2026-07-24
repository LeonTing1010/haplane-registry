#!/usr/bin/env node
// HapLane Registry 工具脚本(零依赖,Node ≥18)。
//   node scripts/registry.mjs validate            校验 index.json + 本地 haps/(PR 机器验收,CI 可跑)
//   node scripts/registry.mjs entry <hap路径>      读 hap 生成 index.json 条目模板(投稿小抄)
// 验收标准即代码:字段齐全/ id 唯一/ license 在白名单/ 本地 hap 的 sha256·大小·包名与条目一致。

import { readFileSync, existsSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { inflateRawSync } from "node:zlib"
import { resolve, basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const REQUIRED = ["id", "name", "packageName", "version", "developer", "license", "source", "description", "deviceTypes", "hap", "sha256", "sizeBytes"]
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
  for (const a of idx.apps || []) {
    const tag = `[${a.id || "(无id)"}]`
    for (const f of REQUIRED) if (a[f] === undefined || a[f] === "") problems.push(`${tag} 缺字段 ${f}`)
    if (ids.has(a.id)) problems.push(`${tag} id 重复`)
    ids.add(a.id)
    if (a.license && !LICENSES.has(a.license)) problems.push(`${tag} license「${a.license}」不在白名单(自有作品写「作者自有」)`)
    if (a.sha256 && !/^[0-9a-f]{64}$/.test(a.sha256)) problems.push(`${tag} sha256 格式不对`)
    // 凡本仓 haps/ 里有同名文件的(不论 hap 字段指 raw 还是 Release 直链),做强校验:sha256 对、大小对、包名一致
    const m = /\/([^/?#]+\.hap)$/.exec(a.hap || "")
    if (m && existsSync(join(ROOT, "haps", m[1]))) {
      const f = join(ROOT, "haps", m[1])
      if (statSync(f).size !== a.sizeBytes) problems.push(`${tag} sizeBytes ≠ 实际 ${statSync(f).size}`)
      if (sha256(f) !== a.sha256) problems.push(`${tag} sha256 与文件不符`)
      try {
        const mod = readModule(f)
        const bn = mod?.app?.bundleName
        if (bn && bn !== a.packageName) problems.push(`${tag} packageName「${a.packageName}」≠ hap 内 bundleName「${bn}」`)
      } catch (e) { problems.push(`${tag} module.json 读取失败: ${e.message}`) }
    }
  }
  if (problems.length) { console.error(`✗ ${problems.length} 个问题:`); for (const p of problems) console.error("  - " + p); process.exit(1) }
  console.log(`✓ index.json 全绿(${(idx.apps || []).length} 个条目)`)
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
    hap: `https://gitee.com/LeonTing1010/haplane-registry/raw/main/haps/${basename(f)}`,
    sha256: sha256(f),
    sizeBytes: statSync(f).size,
  }
  console.log(JSON.stringify(tpl, null, 2))
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === "validate") validate()
else if (cmd === "entry" && arg) entry(arg)
else { console.log("用法:\n  node scripts/registry.mjs validate\n  node scripts/registry.mjs entry <hap路径>"); process.exit(cmd ? 1 : 0) }
