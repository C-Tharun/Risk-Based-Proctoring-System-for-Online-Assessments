-- Enable RLS on exam_violations table if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'exam_violations'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE exam_violations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create policies if they don't exist
DO $$ 
BEGIN
    -- Check and create "Users can insert their own violations" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'exam_violations' 
        AND policyname = 'Users can insert their own violations'
    ) THEN
        CREATE POLICY "Users can insert their own violations"
            ON exam_violations FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Check and create "Users can view their own violations" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'exam_violations' 
        AND policyname = 'Users can view their own violations'
    ) THEN
        CREATE POLICY "Users can view their own violations"
            ON exam_violations FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    -- Check and create "Admins can manage all violations" policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'exam_violations' 
        AND policyname = 'Admins can manage all violations'
    ) THEN
        CREATE POLICY "Admins can manage all violations"
            ON exam_violations FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );
    END IF;
END $$;

-- Add any missing columns to exam_violations table
DO $$
BEGIN
    -- Add details column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_violations' 
        AND column_name = 'details'
    ) THEN
        ALTER TABLE exam_violations 
        ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add risk_score column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_violations' 
        AND column_name = 'risk_score'
    ) THEN
        ALTER TABLE exam_violations 
        ADD COLUMN risk_score INTEGER DEFAULT 0;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_violations' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE exam_violations 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_exam_violations_exam_session_id 
    ON exam_violations(exam_session_id); 