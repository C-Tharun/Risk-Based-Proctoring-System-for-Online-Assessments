-- Add typing analysis fields to exam_sessions table
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS typing_test_results JSONB,
ADD COLUMN IF NOT EXISTS baseline_wpm INTEGER;

-- Create index for baseline_wpm for faster queries
CREATE INDEX IF NOT EXISTS idx_exam_sessions_baseline_wpm ON exam_sessions(baseline_wpm);

-- Create violation_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS violation_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    severity VARCHAR(50) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new violation type for typing speed anomalies
INSERT INTO violation_types (name, description, severity)
VALUES ('typing_speed_anomaly', 'Suspicious variation in typing speed detected', 'MEDIUM')
ON CONFLICT (name) DO NOTHING; 