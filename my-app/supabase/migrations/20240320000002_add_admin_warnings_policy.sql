-- Enable RLS on admin_warnings table if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_warnings'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE admin_warnings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create policies if they don't exist
DO $$ 
BEGIN
    -- Check and create "Users can insert their own warnings" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_warnings' 
        AND policyname = 'Users can insert their own warnings'
    ) THEN
        CREATE POLICY "Users can insert their own warnings"
            ON admin_warnings FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Check and create "Users can view their own warnings" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_warnings' 
        AND policyname = 'Users can view their own warnings'
    ) THEN
        CREATE POLICY "Users can view their own warnings"
            ON admin_warnings FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    -- Check and create "Admins can manage all warnings" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_warnings' 
        AND policyname = 'Admins can manage all warnings'
    ) THEN
        CREATE POLICY "Admins can manage all warnings"
            ON admin_warnings FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- Create index if it doesn't exist (this is already using IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_admin_warnings_exam_session_id 
    ON admin_warnings(exam_session_id); 