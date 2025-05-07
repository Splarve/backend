import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // To load .env file for SUPABASE_URL and SUPABASE_ANON_KEY

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// --- CONFIGURATION ---
// Option 1: Sign IN an existing user - COMMENTED OUT
/*
const TEST_USER_EMAIL_SIGN_IN = 'test@example.com'; 
const TEST_USER_PASSWORD_SIGN_IN = 'password123';   
*/

// Option 2: Sign UP a new user - CONFIGURED
const TEST_USER_EMAIL_SIGN_UP = process.env.TEST_EMAIL; // Using the chosen email
const TEST_USER_PASSWORD_SIGN_UP = process.env.TEST_PASSWORD;    // Using the chosen password
// --- END CONFIGURATION ---


if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file or environment.'
  );
  process.exit(1);
}

// Initialize Supabase client with the ANONYMOUS key (needed for auth operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getTestJwt() {
  let sessionData;
  let operationError;

  // --- Decide whether to sign in or sign up ---
  // Forcing sign up as per current configuration
  const useSignUp = true; 

  if (useSignUp) {
    console.log(`Attempting to SIGN UP user: ${TEST_USER_EMAIL_SIGN_UP}`);
    const { data, error } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL_SIGN_UP,
      password: TEST_USER_PASSWORD_SIGN_UP,
    });
    sessionData = data;
    operationError = error;
    if (error) {
        console.error('Error signing up:', error.message);
        if (error.message.includes('User already registered')) {
            console.log('User already exists. Attempting to sign in instead...');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: TEST_USER_EMAIL_SIGN_UP, // Use the sign-up email
                password: TEST_USER_PASSWORD_SIGN_UP, // Use the sign-up password
            });
            sessionData = signInData;
            operationError = signInError;
        }
    } else if (!data.session && data.user) {
        // This happens if email confirmation is required and the user is created but not logged in.
        console.warn('User signed up, but no session created (email confirmation might be pending).');
        console.log('If email confirmation is ON, you need to confirm the email before you can get a JWT by signing in.');
        console.log('User details:', data.user);
        return; // Exit if no session
    }

  } else {
    // This part is currently skipped due to useSignUp = true
    console.log(`Attempting to SIGN IN user: ${TEST_USER_EMAIL_SIGN_IN}`);
    const { data, error } = await supabase.auth.signInWithPassword({
      // email: TEST_USER_EMAIL_SIGN_IN, // This would need to be defined
      // password: TEST_USER_PASSWORD_SIGN_IN, // This would need to be defined
    });
    sessionData = data;
    operationError = error;
  }
  // --- End sign in/sign up decision ---


  if (operationError) {
    console.error('Error during authentication:', operationError.message);
    return;
  }

  if (sessionData && sessionData.session && sessionData.session.access_token) {
    console.log('\n--- Successfully obtained JWT! ---');
    console.log('User ID:', sessionData.session.user.id);
    console.log('User Email:', sessionData.session.user.email);
    console.log('\nCOPY THE JWT BELOW:\n');
    console.log(sessionData.session.access_token);
    console.log('\n----------------------------------\n');
  } else if (sessionData && sessionData.user && !sessionData.session) {
    console.warn('User exists or was created, but no active session (email confirmation might be pending or login failed silently).');
  }
  else {
    console.error('Could not obtain JWT. Response:', sessionData);
  }
}

getTestJwt(); 