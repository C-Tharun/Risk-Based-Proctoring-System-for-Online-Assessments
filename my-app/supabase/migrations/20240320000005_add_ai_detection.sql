-- Add ai_detection_results column to exam_sessions table
DO $$ 
BEGIN
    -- Add ai_detection_results column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'exam_sessions' 
        AND column_name = 'ai_detection_results'
    ) THEN
        ALTER TABLE exam_sessions 
        ADD COLUMN ai_detection_results JSONB DEFAULT NULL;
    END IF;
END $$; 