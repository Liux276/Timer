import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';

interface InvalidIterationRow {
  id: string;
  invalid_name: number;
  invalid_date: number;
  orphan_user: number;
}

interface ParsedArgs {
  dbPath: string;
  dryRun: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_DB_PATH = join(__dirname, '..', 'data', 'time.db');

function usage(): void {
  console.log(`
Usage:
  pnpm --filter @time/server clean:iterations:dry-run [--db <path>]
  pnpm --filter @time/server clean:iterations:apply [--db <path>]

Options:
  --db <path>   SQLite database file path (default: packages/server/data/time.db)
  --dry-run     Analyze only, no data changes
  --apply       Execute cleanup deletions
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  let dbPath = DEFAULT_DB_PATH;
  let dryRun = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --db');
      }
      dbPath = next;
      i++;
      continue;
    }
    if (arg === '--apply') {
      dryRun = false;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  const resolvedPath = isAbsolute(dbPath) ? dbPath : resolve(process.cwd(), dbPath);
  return { dbPath: resolvedPath, dryRun };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.dbPath)) {
    throw new Error(`Database not found: ${args.dbPath}`);
  }

  const db = new Database(args.dbPath, { readonly: args.dryRun, fileMustExist: true });
  db.pragma('foreign_keys = ON');

  const invalidRows = db.prepare(`
    SELECT
      i.id,
      CASE WHEN TRIM(COALESCE(i.name, '')) = '' THEN 1 ELSE 0 END AS invalid_name,
      CASE
        WHEN i.planned_start IS NOT NULL
         AND i.planned_end IS NOT NULL
         AND i.planned_end < i.planned_start THEN 1
        ELSE 0
      END AS invalid_date,
      CASE WHEN NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id) THEN 1 ELSE 0 END AS orphan_user
    FROM iterations i
    WHERE TRIM(COALESCE(i.name, '')) = ''
       OR (
         i.planned_start IS NOT NULL
         AND i.planned_end IS NOT NULL
         AND i.planned_end < i.planned_start
       )
       OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id)
  `).all() as InvalidIterationRow[];

  const ids = invalidRows.map((row) => row.id);
  const summary = invalidRows.reduce(
    (acc, row) => {
      acc.invalidName += row.invalid_name ? 1 : 0;
      acc.invalidDate += row.invalid_date ? 1 : 0;
      acc.orphanUser += row.orphan_user ? 1 : 0;
      return acc;
    },
    { invalidName: 0, invalidDate: 0, orphanUser: 0 },
  );

  console.log(`[clean-invalid-iterations] db: ${args.dbPath}`);
  console.log(`[clean-invalid-iterations] mode: ${args.dryRun ? 'dry-run' : 'apply'}`);
  console.log(`[clean-invalid-iterations] matched rows: ${ids.length}`);
  console.log(`[clean-invalid-iterations] invalid name: ${summary.invalidName}`);
  console.log(`[clean-invalid-iterations] invalid date: ${summary.invalidDate}`);
  console.log(`[clean-invalid-iterations] orphan user: ${summary.orphanUser}`);

  if (ids.length === 0) {
    db.close();
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const impactedTasks = db
    .prepare(`SELECT COUNT(*) AS cnt FROM tasks WHERE iteration_id IN (${placeholders})`)
    .get(...ids) as { cnt: number };
  console.log(`[clean-invalid-iterations] tasks referencing invalid iterations: ${impactedTasks.cnt}`);

  if (args.dryRun) {
    db.close();
    return;
  }

  const deleteIterations = db.prepare(`DELETE FROM iterations WHERE id IN (${placeholders})`);
  const txn = db.transaction((targetIds: string[]) => {
    deleteIterations.run(...targetIds);
  });
  txn(ids);

  console.log('[clean-invalid-iterations] cleanup completed');
  db.close();
}

try {
  main();
} catch (error) {
  console.error(`[clean-invalid-iterations] ${(error as Error).message}`);
  process.exit(1);
}
