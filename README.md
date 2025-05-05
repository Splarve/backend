# Splarve backend

To successfully set up the backend and tests, please do the following.

1.Make sure to have supabase CLI in your system. To download it via brew, you can do:

```
brew install supabase/tap/supabase
```

2.After supabase is installed, you should make sure you have Docker downloaded in your system. If you have docker up and you are logged in, please go to the backend root directory, and run

```
supabase start
```

3.After your docker containers are up and running, you are going to receive a bunch of credentials. Open an environment file, `.env `at the root directory, and put in the following environment variables:

```
SUPABASE_URL="API URL goes here"
SUPBASE_ANON_KEY="ANON KEY goes here"
```

4.Run a fresh instance of your resetted database just in case:

```
supabase db reset
```

5.Now you can do the classic bun install, and bun run dev as follows:

```
bun install
bun run dev
```

And voi'la, your backend should be up and running!

#### Developing

If you want to change databases, please do so by creating supabase migrations and there is not an already existing migration that builds those schemas, you can start a new migration by:

```
supabase migration new ___yourmigrationname___
```

If there is already a migration that sets up those schemas, edit them or alter them instead of creating new migrations. Then you need to reset your database to build them as well with `supabase db reset.`

For seeding your database, just use `seed.sql` inside the supabase directory. We are trying to keep all the seeding data there for automation!

Other than this, for every feature, there is a flow that is followed:

- Write your validation script for your inputs as `feature-name.validation.ts`
- Write your queries as `feature-name.service.ts`
- Write the routing as `feature-name.routes.ts`
- Compile everything together in `index.ts`
- Write your test cases in an importable json format in `postman-tests.json`
- Also denote your test environment for your fellow developers in `Test Env.postman-environment.json`
- After you develop your feature, do not forget to add a main router to `index.ts` that serves for the entire `src` directory.
