const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const appJson = JSON.parse(fs.readFileSync('./app.json'));
const supabaseUrl = appJson.expo.extra.supabaseUrl;
const supabaseKey = appJson.expo.extra.supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

run();
