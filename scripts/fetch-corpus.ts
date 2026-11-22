/* Downloads public README/CONTRIBUTING docs of finance projects into docs/ingested/finance/<project>/.
   Each file gets a provenance header. Add regulatory/standards text manually (see docs/ingested/finance/README.md). */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECTS: Record<string, string> = {
  fineract: "apache/fineract",
  "mifos-web-app": "openMF/web-app",
  "firefly-iii": "firefly-iii/firefly-iii",
  gnucash: "GnuCash/gnucash",
  erpnext: "frappe/erpnext",
  besu: "hyperledger/besu",
  beancount: "beancount/beancount",
  openbb: "OpenBB-finance/OpenBB",
  akaunting: "akaunting/akaunting",
};
const FILES = ["README.md", "CONTRIBUTING.md", ".github/CONTRIBUTING.md"];
const BRANCHES = ["main", "master", "develop"];
const out = join(process.cwd(), "docs", "ingested", "finance");

for (const [name, repo] of Object.entries(PROJECTS)) {
  mkdirSync(join(out, name), { recursive: true });
  for (const file of FILES) {
    for (const branch of BRANCHES) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
      const r = await fetch(url).catch(() => null);
      if (r?.ok) {
        const body = await r.text();
        writeFileSync(join(out, name, file.replace(/\//g, "_")), `---\nsource: ${url}\nfetched: ${new Date().toISOString()}\n---\n\n${body}`);
        console.log("ok  ", url);
        break;
      }
    }
  }
}
console.log("Done. Review the files, delete anything irrelevant, then run `npm run demo`.");
