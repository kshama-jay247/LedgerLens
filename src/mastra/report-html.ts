import type { Requirement, RequirementsProfile, SdlcRecommendation } from "./schemas";

const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const list = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${e(x)}</li>`).join("")}</ul>` : "<p class=muted>none</p>");

function reqTable(rs: Requirement[]): string {
  if (!rs.length) return "<p class=muted>none</p>";
  const rows = rs
    .map(
      (r) => `<tr><td>${e(r.id)}</td><td>${r.priority}</td><td>${e(r.statement)}</td><td>${e(r.acceptanceCriteria)}</td><td>${e(r.verification)}</td>
<td><span class="b ${r.status}">${r.status}</span>${r.evidence.length ? `<br><small>${r.evidence.map(e).join("<br>")}</small>` : ""}</td></tr>`,
    )
    .join("");
  return `<div class=scroll><table><tr><th>ID</th><th>Priority</th><th>Statement</th><th>Acceptance criteria</th><th>Verification</th><th>Status</th></tr>${rows}</table></div>`;
}

export function renderHtml(p: RequirementsProfile, s: SdlcRecommendation): string {
  const bars = s.ranking
    .map((r) => `<div class=bar><span>${e(r.method)}</span><div><i style="width:${r.score}%"></i></div><b>${r.score}</b></div>`)
    .join("");
  const hasR = Object.values(s.ratings).some((v) => v.rationale);
  const ratings = Object.entries(s.ratings)
    .map(([k, v]) => `<tr><td>${e(k)}</td><td>${v.score}/5</td>${hasR ? `<td>${e(v.rationale)}</td>` : ""}</tr>`)
    .join("");
  const phases = s.plan.phases
    .map((ph) => `<li><b>${e(ph.name)}</b>: ${e(ph.activities.join("; "))}<br><small>Exit gate: ${e(ph.exitGate)} | Approver: ${e(ph.approver)}</small></li>`)
    .join("");
  return `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>LedgerLens report</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#ddd;--acc:#1f5eff;--card:#f6f7f9}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--fg:#e8e8e8;--mut:#9aa;--line:#333;--acc:#6a96ff;--card:#1d2024}}
body{font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:1000px;margin:2rem auto;padding:0 1rem}
h1{margin-bottom:.2rem}h2{margin-top:2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
.muted,small{color:var(--mut)}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--card)}
.b{padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap}
.EVIDENCE{background:#d7f5df;color:#0b5b24}.REASONED{background:#e4e8ff;color:#2a3a9a}.NEEDS-VALIDATION{background:#ffe6c7;color:#8a4b00}
.bar{display:grid;grid-template-columns:260px 1fr 40px;gap:8px;align-items:center;margin:4px 0}.bar div{background:var(--card);height:14px;border-radius:7px;overflow:hidden}.bar i{display:block;height:100%;background:var(--acc)}
.rec{background:var(--card);padding:.8rem 1rem;border-radius:8px;border-left:4px solid var(--acc)}
</style>
<h1>LedgerLens report</h1>
<p><b>Scenario:</b> ${e(p.scenario)}</p>${p.context ? `<p>${e(p.context)}</p>` : ""}
<h2>Stakeholders</h2>${list(p.stakeholders.map((x) => `${x.name}: ${x.concern}`))}
<h2>Regulatory drivers <small>(verify before relying on them)</small></h2>${list(p.regulatoryDrivers)}
<h2>Functional requirements</h2>${reqTable(p.functional)}
<h2>Non-functional requirements</h2>${reqTable(p.nonFunctional)}
<h2>Risks</h2>${list(p.risks.map((r) => `${r.risk} -> ${r.mitigation}`))}
<h2>Open questions</h2>${list(p.openQuestions)}
<h2>SDLC recommendation</h2><div class=rec><b>Recommended: ${e(s.recommended)}</b></div>${bars}
<h3>Criterion ratings</h3><div class=scroll><table><tr><th>Criterion</th><th>Score</th>${hasR ? "<th>Rationale</th>" : ""}</tr>${ratings}</table></div>
<h3>Project workflow</h3><p>${e(s.plan.rationale)}</p><ol>${phases}</ol>
<h3>Human approval points</h3>${list(s.plan.humanApprovalPoints)}
<h3>Needs validation</h3>${list(s.plan.needsValidation)}
<p class=muted><i>${e(s.disclaimer)}</i></p>
<h2>Evidence used</h2>${list(p.evidenceUsed.map((x) => x.id))}
</html>`;
}
