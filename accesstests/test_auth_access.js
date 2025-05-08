// test_auth_access.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // To load .env file for SUPABASE_URL and SUPABASE_ANON_KEY

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Still needed for client initialization

// IMPORTANT: Paste the JWT you obtained into the .env WITHIN the accesstests directory
const USER_JWT = process.env.USER_JWT;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file or environment.'
  );
  process.exit(1);
}

if (USER_JWT === 'YOUR_USER_JWT_HERE' || !USER_JWT) {
  console.error(
    'Error: Please replace YOUR_USER_JWT_HERE with the actual JWT obtained from the test user.'
  );
  process.exit(1);
}

// Initialize Supabase client
// The anon key is passed here for initialization, but the JWT will be used for auth for requests.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            Authorization: `Bearer ${USER_JWT}`
        }
    }
});

async function testAuthenticatedAccess() {
  console.log('Attempting to fetch organizations with AUTHENTICATED user JWT...');
  try {
    const { data, error } = await supabase
      .from('organizations') // Or any other table you restricted for 'authenticated' role
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching organizations (this is expected if blocking is successful for authenticated user):');
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      console.error(`  Details: ${error.details}`);
      console.error(`  Hint: ${error.hint}`);
      // Common PostgreSQL error code for permission denied is 42501
      if (error.message.includes('permission denied') || error.code === '42501') {
        console.log('\nSUCCESS: Authenticated user access was correctly denied!');
      } else {
        console.log('\nNOTE: An error occurred, but it might not be the expected permission error. Check details.');
      }
    } else if (data && data.length > 0) {
      console.warn('\nWARNING: Data was fetched successfully by authenticated user! Blocking was NOT successful.');
      console.log('Data:', data);
    } else {
      console.log('\nINFO: No data returned for authenticated user, and no explicit error. This might also indicate successful blocking if RLS returns empty results instead of errors for non-existent tables/views after REVOKE USAGE ON SCHEMA.');
      console.log('Consider this a success if the table/schema revoke was also applied to the authenticated role.');
    }
  } catch (e) {
    console.error('\nUNEXPECTED SCRIPT ERROR: An unexpected error occurred in the test script:');
    console.error(e);
  }
}

testAuthenticatedAccess(); 