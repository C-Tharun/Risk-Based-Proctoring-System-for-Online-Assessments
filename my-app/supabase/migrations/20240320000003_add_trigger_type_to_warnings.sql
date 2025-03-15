-- Add trigger_type column to admin_warnings if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'admin_warnings' 
        AND column_name = 'trigger_type'
    ) THEN
        ALTER TABLE admin_warnings 
        ADD COLUMN trigger_type TEXT;
    END IF;
END $$; 