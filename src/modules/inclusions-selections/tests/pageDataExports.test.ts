import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

type DataExportCounts = {
  getServerSideProps: number;
  getStaticProps: number;
  getStaticPaths: number;
};

const DATA_EXPORT_PATTERN = /\bexport\s+(?:async\s+)?(?:function|const)\s+(getServerSideProps|getStaticProps|getStaticPaths)\b|\bexport\s*\{[^}]*\b(getServerSideProps|getStaticProps|getStaticPaths)\b[^}]*\}/g;

function countDataExports(fileSource: string): DataExportCounts {
  const counts: DataExportCounts = {
    getServerSideProps: 0,
    getStaticProps: 0,
    getStaticPaths: 0,
  };

  for (const match of fileSource.matchAll(DATA_EXPORT_PATTERN)) {
    const exportName = match[1] ?? match[2];
    counts[exportName as keyof DataExportCounts] += 1;
  }

  return counts;
}

export function runSelectionsPageDataExportTests(): void {
  const routeFiles = [
    "areas.tsx",
    "templates.tsx",
    "workspace.tsx",
    "review.tsx",
    "approvals.tsx",
    "documents-export.tsx",
    "procurement.tsx",
  ];

  for (const fileName of routeFiles) {
    const page = source("pages", "inclusions-selections", fileName);
    const counts = countDataExports(page);
    const total = counts.getServerSideProps + counts.getStaticProps + counts.getStaticPaths;

    assert(total <= 1, `${fileName} must not export conflicting Next.js data-loading methods.`);
    assert(counts.getStaticProps === 0, `${fileName} must not use getStaticProps for local selections project files.`);
    assert(counts.getStaticPaths === 0, `${fileName} must not use getStaticPaths for local selections project files.`);
  }

  const areasPage = source("pages", "inclusions-selections", "areas.tsx");
  assert(areasPage.includes("useRouter()"), "Areas should resolve query/local-file context client-side.");
  assert(areasPage.includes("contextFromQuery(router.query)"), "Areas should keep project query context client-side.");
  assert(areasPage.includes("InclusionsSelectionsProjectBanner"), "Areas should render the local-file project banner.");
  assert(areasPage.includes("InclusionsSelectionsStageNav"), "Areas should render stage navigation.");
  assert(!areasPage.includes("Open Existing Job"), "Areas must not reintroduce the database-only project picker action.");
}

runSelectionsPageDataExportTests();
