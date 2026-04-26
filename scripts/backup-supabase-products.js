// backup-supabase-products.js
// Node.js script to export Supabase 'products' table to CSV daily
// Usage: node backup-supabase-products.js


const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// === CONFIGURATION ===
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKUP_DIR = 'D:/supabase-backups'; // Change this if you want a different folder
const TABLE = 'products';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase URL or Key. Check your .env.local file.');
  process.exit(1);
}


console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase Key length:', SUPABASE_KEY ? SUPABASE_KEY.length : 0);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backupProducts() {
  // Fetch all products
  try {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) {
      console.error('Error fetching products:', error.message, error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.warn('No products found to backup.');
    }
    // Convert to CSV
    const fields = data.length > 0 ? Object.keys(data[0]) : [];
    const csv = [fields.join(',')].concat(
      data.map(row => fields.map(f => JSON.stringify(row[f] ?? '')).join(','))
    ).join('\n');

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    // Write file with timestamp
    const filename = `products-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, csv);
    console.log(`Backup complete: ${filepath}`);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

backupProducts();
