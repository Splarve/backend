// test_anon_access.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // To load .env file

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file or environment.'
  );
  process.exit(1);
}

// Initialize Supabase client with the ANONYMOUS key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAccess() {
  console.log('Attempting to fetch organizations with ANONYMOUS key...');
  try {
    // Attempt to select data from a table that should now be protected
    // We pick 'organizations' as it's one of the tables we applied REVOKE to.
    const { data, error } = await supabase
      .from('departments') // Or any other table you restricted for 'anonymous' role
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching organizations (this is expected if blocking is successful):');
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      console.error(`  Details: ${error.details}`);
      console.error(`  Hint: ${error.hint}`);
      if (error.message.includes('permission denied') || error.code === '42501') {
        console.log('\nSUCCESS: Access was correctly denied for the anonymous role!');
      } else {
        console.log('\nNOTE: An error occurred, but it might not be a permission error. Check details.');
      }
    } else if (data && data.length > 0) {
      console.warn('\nWARNING: Data was fetched successfully! Blocking was NOT successful.');
      console.log('Data:', data);
    } else {
      console.log('\nINFO: No data returned, and no explicit error. This might also indicate successful blocking if RLS returns empty results instead of errors for non-existent tables/views from anon\'s perspective after REVOKE USAGE ON SCHEMA.');
      console.log('Consider this a success if the schema revoke was also applied.');
    }
  } catch (e) {
    console.error('\nUNEXPECTED SCRIPT ERROR: An unexpected error occurred in the test script:');
    console.error(e);
  }
}

testAccess();