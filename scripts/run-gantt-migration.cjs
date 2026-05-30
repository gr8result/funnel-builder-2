// scripts/run-gantt-migration.cjs
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const migrations = [
  {
    name: 'note_red column on job_board_tasks',
    sql: `ALTER TABLE job_board_tasks ADD COLUMN IF NOT EXISTS note_red TEXT;`,
  },
  {
    name: 'gantt_projects table',
    sql: `
      CREATE TABLE IF NOT EXISTS gantt_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'New Build',
        client_name TEXT,
        job_address TEXT,
        job_type TEXT DEFAULT 'New Build',
        start_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'gantt_projects RLS',
    sql: `ALTER TABLE gantt_projects ENABLE ROW LEVEL SECURITY;`,
  },
  {
    name: 'gantt_projects policy',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'gantt_projects' AND policyname = 'own_gantt_projects'
        ) THEN
          CREATE POLICY own_gantt_projects ON gantt_projects
            FOR ALL USING (auth.uid() = user_id);
        END IF;
      END $$;
    `,
  },
  {
    name: 'gantt_tasks table',
    sql: `
      CREATE TABLE IF NOT EXISTS gantt_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES gantt_projects(id) ON DELETE CASCADE,
        phase TEXT NOT NULL DEFAULT 'General',
        phase_order INT DEFAULT 0,
        name TEXT NOT NULL,
        start_day INT DEFAULT 0,
        duration_days INT DEFAULT 7,
        status TEXT DEFAULT 'pending',
        assigned_trade TEXT,
        is_milestone BOOLEAN DEFAULT false,
        is_long_lead BOOLEAN DEFAULT false,
        dependencies JSONB DEFAULT '[]',
        notes TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'gantt_tasks RLS',
    sql: `ALTER TABLE gantt_tasks ENABLE ROW LEVEL SECURITY;`,
  },
  {
    name: 'gantt_tasks policy',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'gantt_tasks' AND policyname = 'own_gantt_tasks'
        ) THEN
          CREATE POLICY own_gantt_tasks ON gantt_tasks
            FOR ALL USING (
              EXISTS (
                SELECT 1 FROM gantt_projects
                WHERE gantt_projects.id = gantt_tasks.project_id
                  AND gantt_projects.user_id = auth.uid()
              )
            );
        END IF;
      END $$;
    `,
  },
];

async function runMigrations() {
  for (const m of migrations) {
    process.stdout.write(`  Running: ${m.name}... `);
    const { error } = await supabase.rpc('exec_sql', { sql: m.sql }).maybeSingle();
    if (error) {
      // Try direct fetch with pg endpoint
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'tx=commit',
          },
          body: JSON.stringify({ query: m.sql }),
        }
      );
      if (!res.ok && res.status !== 200) {
        console.log(`WARN (rpc not available, may need manual run): ${error.message}`);
      } else {
        console.log('ok');
      }
    } else {
      console.log('ok');
    }
  }
  console.log('\nDone. If any steps showed WARN, run the SQL manually in Supabase > SQL Editor.');
}

runMigrations().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
