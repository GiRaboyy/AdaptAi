import { createClient } from '@supabase/supabase-js';

const url = process.env.DATABASE_FILE_STORAGE_URL;
const key = process.env.DATABASE_FILE_STORAGE_KEY;

console.log('=== Supabase Storage Test ===');
console.log('URL:', url);
console.log('Key present:', !!key);

if (!url || !key) {
  console.log('❌ Missing URL or KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  // Test: list buckets
  console.log('\n1. Testing bucket list...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.log('❌ Bucket list failed:', bucketsError.message);
  } else {
    console.log('✅ Buckets found:', buckets?.map(b => b.name).join(', '));
  }

  // Test: upload a small test file
  console.log('\n2. Testing file upload...');
  const testContent = Buffer.from('Hello from ADAPT test!', 'utf-8');
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('adapt-ai-files')
    .upload('test/hello.txt', testContent, {
      contentType: 'text/plain',
      upsert: true
    });

  if (uploadError) {
    console.log('❌ Upload failed:', uploadError.message);
  } else {
    console.log('✅ Upload success:', uploadData?.path);
  }

  // Test: download the file
  console.log('\n3. Testing file download...');
  const { data: downloadData, error: downloadError } = await supabase.storage
    .from('adapt-ai-files')
    .download('test/hello.txt');

  if (downloadError) {
    console.log('❌ Download failed:', downloadError.message);
  } else {
    const text = await downloadData?.text();
    console.log('✅ Download success:', text);
  }

  // Cleanup
  console.log('\n4. Cleanup test file...');
  await supabase.storage.from('adapt-ai-files').remove(['test/hello.txt']);
  console.log('✅ Cleanup done');

  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
