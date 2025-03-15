-- Drop the trigger first (if the table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_sessions') THEN
        DROP TRIGGER IF EXISTS update_exam_sessions_updated_at ON exam_sessions;
    END IF;
END $$;

-- Drop the function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS exam_violations CASCADE;
DROP TABLE IF EXISTS admin_warnings CASCADE;
DROP TABLE IF EXISTS exam_sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE; 