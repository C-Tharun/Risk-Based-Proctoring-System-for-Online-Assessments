-- Add new columns to exam_sessions if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_sessions' 
        AND column_name = 'monitoring_level'
    ) THEN
        ALTER TABLE exam_sessions 
        ADD COLUMN monitoring_level TEXT DEFAULT 'STANDARD' NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_violations' 
        AND column_name = 'details'
    ) THEN
        ALTER TABLE exam_violations 
        ADD COLUMN details JSONB DEFAULT '{}' NOT NULL;
    END IF;
END $$;

-- Create admin_notifications table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_notifications') THEN
        CREATE TABLE admin_notifications (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING' NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;
END $$;

-- Create behavior_logs table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'behavior_logs') THEN
        CREATE TABLE behavior_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
            behavior_type TEXT NOT NULL,
            behavior_data JSONB NOT NULL,
            risk_contribution FLOAT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_notifications
CREATE POLICY "Admins can manage all notifications"
    ON admin_notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create policies for behavior_logs
CREATE POLICY "Users can view their own behavior logs"
    ON behavior_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exam_sessions
            WHERE exam_sessions.id = behavior_logs.exam_session_id
            AND exam_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all behavior logs"
    ON behavior_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create new indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_behavior_logs_exam_session_id') THEN
        CREATE INDEX idx_behavior_logs_exam_session_id ON behavior_logs(exam_session_id);
    END IF;
END $$; 