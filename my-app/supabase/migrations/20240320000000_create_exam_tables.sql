-- Create profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE TABLE profiles (
            id UUID REFERENCES auth.users(id) PRIMARY KEY,
            role TEXT DEFAULT 'user' NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;
END $$;

-- Enable RLS on profiles if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Create admin policy for profiles
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Update exam_sessions table if it exists
DO $$ 
BEGIN
    -- Drop existing exam_sessions table if it exists
    DROP TABLE IF EXISTS exam_sessions CASCADE;
    
    -- Create exam_sessions table with updated schema
    CREATE TABLE exam_sessions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        risk_score INT4 DEFAULT 0 NOT NULL,
        warnings INT4 DEFAULT 0 NOT NULL,
        duration INT4 NOT NULL,
        completed BOOLEAN DEFAULT false NOT NULL,
        terminated BOOLEAN DEFAULT false NOT NULL,
        monitoring_level TEXT DEFAULT 'STANDARD' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Add indexes for better query performance
    CREATE INDEX idx_exam_sessions_user_id ON exam_sessions(user_id);
    CREATE INDEX idx_exam_sessions_completed ON exam_sessions(completed);
    CREATE INDEX idx_exam_sessions_created_at ON exam_sessions(created_at DESC);

    -- Add RLS policies
    ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own exam sessions" ON exam_sessions;
    DROP POLICY IF EXISTS "Users can insert their own exam sessions" ON exam_sessions;
    DROP POLICY IF EXISTS "Users can update their own exam sessions" ON exam_sessions;
    DROP POLICY IF EXISTS "Admins can view all exam sessions" ON exam_sessions;

    -- Allow users to view their own exam sessions
    CREATE POLICY "Users can view their own exam sessions"
        ON exam_sessions FOR SELECT
        TO authenticated
        USING (
            auth.uid() = user_id OR
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
            )
        );

    -- Allow users to insert their own exam sessions
    CREATE POLICY "Users can insert their own exam sessions"
        ON exam_sessions FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);

    -- Allow users to update their own exam sessions
    CREATE POLICY "Users can update their own exam sessions"
        ON exam_sessions FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id);

    -- Allow admins to view all exam sessions
    CREATE POLICY "Admins can view all exam sessions"
        ON exam_sessions FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
            )
        );
END $$;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_exam_sessions_updated_at
    BEFORE UPDATE ON exam_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create admin_warnings table
DO $$ 
BEGIN
    -- Drop existing admin_warnings table if it exists
    DROP TABLE IF EXISTS admin_warnings CASCADE;
    
    -- Create admin_warnings table with updated schema
    CREATE TABLE admin_warnings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );
END $$;

-- Create exam_violations table
DO $$ 
BEGIN
    -- Drop existing exam_violations table if it exists
    DROP TABLE IF EXISTS exam_violations CASCADE;
    
    -- Create exam_violations table with updated schema
    CREATE TABLE exam_violations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        details JSONB DEFAULT '{}' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );
END $$;

-- Create admin_notifications table
DO $$ 
BEGIN
    -- Drop existing admin_notifications table if it exists
    DROP TABLE IF EXISTS admin_notifications CASCADE;
    
    -- Create admin_notifications table with updated schema
    CREATE TABLE admin_notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );
END $$;

-- Create behavior_logs table
DO $$ 
BEGIN
    -- Drop existing behavior_logs table if it exists
    DROP TABLE IF EXISTS behavior_logs CASCADE;
    
    -- Create behavior_logs table with updated schema
    CREATE TABLE behavior_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        behavior_type TEXT NOT NULL,
        behavior_data JSONB NOT NULL,
        risk_contribution FLOAT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );
END $$;

-- Enable RLS on tables
ALTER TABLE admin_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own warnings" ON admin_warnings;
DROP POLICY IF EXISTS "Admins can view all warnings" ON admin_warnings;
DROP POLICY IF EXISTS "Admins can insert warnings" ON admin_warnings;
DROP POLICY IF EXISTS "Admins can manage all warnings" ON admin_warnings;
DROP POLICY IF EXISTS "Users can view their own violations" ON exam_violations;
DROP POLICY IF EXISTS "Admins can view all violations" ON exam_violations;
DROP POLICY IF EXISTS "Admins can manage all violations" ON exam_violations;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Users can insert their own behavior logs" ON behavior_logs;
DROP POLICY IF EXISTS "Users can view their own behavior logs" ON behavior_logs;
DROP POLICY IF EXISTS "Admins can view all behavior logs" ON behavior_logs;

-- Create policies for admin_warnings
CREATE POLICY "Users can view their own warnings"
    ON admin_warnings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all warnings"
    ON admin_warnings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create policies for exam_violations
CREATE POLICY "Users can view their own violations"
    ON exam_violations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all violations"
    ON exam_violations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

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
CREATE POLICY "Users can insert their own behavior logs"
    ON behavior_logs FOR INSERT TO authenticated
    WITH CHECK (
        exam_session_id IN (
            SELECT id FROM exam_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own behavior logs"
    ON behavior_logs FOR SELECT TO authenticated
    USING (
        exam_session_id IN (
            SELECT id FROM exam_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all behavior logs"
    ON behavior_logs FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_admin_warnings_exam_session_id') THEN
        CREATE INDEX idx_admin_warnings_exam_session_id ON admin_warnings(exam_session_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_admin_warnings_user_id') THEN
        CREATE INDEX idx_admin_warnings_user_id ON admin_warnings(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_exam_violations_exam_session_id') THEN
        CREATE INDEX idx_exam_violations_exam_session_id ON exam_violations(exam_session_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_exam_violations_user_id') THEN
        CREATE INDEX idx_exam_violations_user_id ON exam_violations(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_behavior_logs_exam_session_id') THEN
        CREATE INDEX idx_behavior_logs_exam_session_id ON behavior_logs(exam_session_id);
    END IF;
END $$; 