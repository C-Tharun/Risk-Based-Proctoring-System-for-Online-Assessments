-- Add exam_id column to exam_sessions table
DO $$ 
BEGIN
    -- Add exam_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_sessions' 
        AND column_name = 'exam_id'
    ) THEN
        ALTER TABLE exam_sessions 
        ADD COLUMN exam_id TEXT NOT NULL DEFAULT '';
    END IF;

    -- Create index for exam_id
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE indexname = 'idx_exam_sessions_exam_id'
    ) THEN
        CREATE INDEX idx_exam_sessions_exam_id ON exam_sessions(exam_id);
    END IF;
END $$; 