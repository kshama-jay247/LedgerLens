---
source: LedgerLens project notes (general engineering practice, NOT a regulatory or authoritative source; verify and replace with cited material)
---

KYC onboarding practices: customer identity is verified before the account can transact, often in tiers where higher limits need stronger verification. Typical steps are document capture, identity and liveness checks, sanctions and watchlist screening, and a risk score that decides approval, rejection or manual review. Which checks are legally mandatory depends on jurisdiction and must be confirmed with compliance.

KYC onboarding practices: every verification decision needs an audit trail (who or what decided, on which data, when). Personal data should be minimised, access-controlled and retained only as long as policy allows; retention periods must be confirmed with compliance.

Fraud monitoring practices: transactions are scored in near real time using rules (velocity, amount, geography, new device) and optionally models. Suspicious transactions are held or flagged and routed to a manual review queue with case notes. Rules need versioning, tuning metrics (false positives, detection rate) and a documented change process.
