const { Level } = require('level');
const path = require('path');
const fs = require('fs');

async function recoverJob() {
  const dbPath = path.join(
    process.env.LOCALAPPDATA,
    'Google/Chrome/User Data/Profile 6/IndexedDB/http_localhost_3000.indexeddb.leveldb'
  );

  if (!fs.existsSync(dbPath)) {
    console.error('IndexedDB path not found:', dbPath);
    process.exit(1);
  }

  const db = new Level(dbPath);
  let jobCount = 0;
  let totalSize = 0;
  let revisionCount = 0;
  const jobs = {};
  let targetJobData = null;

  try {
    console.log('Scanning IndexedDB...\n');

    for await (const [key, value] of db.iterator()) {
      const keyStr = key.toString('utf8');
      
      if (keyStr.includes('job:')) {
        jobCount++;
        const size = Buffer.byteLength(value);
        totalSize += size;

        // Extract job ID
        const jobMatch = keyStr.match(/job:([^/]+\/[^/]+)/);
        if (jobMatch) {
          const jobId = jobMatch[1];
          if (!jobs[jobId]) {
            jobs[jobId] = { revisions: [], totalSize: 0, pageCount: 0, blobCount: 0 };
          }
          
          jobs[jobId].totalSize += size;
          jobs[jobId].revisions.push({ key: keyStr, size });
          revisionCount++;

          // Check for embedded PDFs/blobs
          if (value.includes('data:') || value.includes('base64')) {
            jobs[jobId].blobCount++;
          }

          // Recover target job
          if (jobId === '03-09/123') {
            targetJobData = { key: keyStr, size, sizeKB: (size / 1024).toFixed(2) };
          }
        }
      }
    }

    console.log('=== INDEXEDDB SCAN RESULTS ===\n');
    console.log(`Total jobs found: ${jobCount}`);
    console.log(`Total revisions: ${revisionCount}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('=== JOB BREAKDOWN (Top 15) ===\n');
    Object.entries(jobs)
      .sort((a, b) => b[1].totalSize - a[1].totalSize)
      .slice(0, 15)
      .forEach(([id, data]) => {
        console.log(
          `job:${id}`,
          `| Revisions: ${data.revisions.length.toString().padStart(4)}`,
          `| Size: ${(data.totalSize / 1024 / 1024).toFixed(2).padStart(7)} MB`,
          `| Avg/rev: ${(data.totalSize / data.revisions.length / 1024).toFixed(1).padStart(7)} KB`
        );
      });

    console.log('\n=== TARGET JOB RECOVERY ===\n');
    if (targetJobData) {
      console.log(`✓ FOUND job:03-09/123`);
      console.log(`  Key: ${targetJobData.key}`);
      console.log(`  Size: ${targetJobData.sizeKB} KB`);
      console.log(`  Revisions: ${jobs['03-09/123'].revisions.length}`);
      
      // Create backup
      const backupDir = path.join(
        process.cwd(),
        'recovery',
        `.gr8takeoff-job-03-09-123-backup-${Date.now()}`
      );
      fs.mkdirSync(backupDir, { recursive: true });
      
      const jobData = {
        jobId: '03-09/123',
        recovered: new Date().toISOString(),
        revisionCount: jobs['03-09/123'].revisions.length,
        totalSize: jobs['03-09/123'].totalSize,
        revisions: jobs['03-09/123'].revisions.map(r => ({
          key: r.key,
          sizeKB: (r.size / 1024).toFixed(2)
        }))
      };
      
      fs.writeFileSync(
        path.join(backupDir, 'job-metadata.json'),
        JSON.stringify(jobData, null, 2)
      );
      
      console.log(`\n✓ Backup created: ${backupDir}`);
      console.log(`  Metadata size: ${(Buffer.byteLength(JSON.stringify(jobData)) / 1024).toFixed(2)} KB`);
    } else {
      console.log('✗ Target job job:03-09/123 NOT FOUND');
    }

  } catch (e) {
    console.error('Error reading IndexedDB:', e.message);
  } finally {
    await db.close();
    console.log('\nRecovery scan complete.');
  }
}

recoverJob().catch(console.error);
