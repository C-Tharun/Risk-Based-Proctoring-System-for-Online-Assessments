-- Remove typing speed and user details columns from exam_sessions table
ALTER TABLE exam_sessions
DROP COLUMN IF EXISTS typing_speed_wpm,
DROP COLUMN IF EXISTS user_details;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own exam sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Users can update their own exam sessions" ON exam_sessions;

-- Create new policies with correct syntax
CREATE POLICY "Users can view their own exam sessions" ON exam_sessions
    USING (auth.uid() = user_id OR 
           EXISTS (
             SELECT 1 FROM profiles 
             WHERE profiles.id = auth.uid() 
             AND profiles.role = 'admin'
           ));

CREATE POLICY "Users can update their own exam sessions" ON exam_sessions
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON COLUMN exam_sessions.typing_speed_wpm IS 'Typing speed in words per minute from the pre-exam typing test';
COMMENT ON COLUMN exam_sessions.user_details IS 'JSON object containing user details collected during the typing test'; 