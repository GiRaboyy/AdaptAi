-- Migration: Enhance knowledge_sources table for better file storage tracking
-- Author: AI Assistant
-- Date: 2026-02-05

-- Add new columns for enhanced file storage tracking
ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS extracted_text_chars INTEGER NOT NULL DEFAULT 0;

-- Backfill extraction_status for existing records based on current status
UPDATE knowledge_sources
SET extraction_status = CASE
  WHEN status = 'indexed' THEN 'ok'
  WHEN status = 'failed' AND error_message IS NOT NULL THEN 'failed'
  ELSE 'pending'
END
WHERE extraction_status = 'pending';

-- Backfill extracted_text_chars from existing extractedCharCount
UPDATE knowledge_sources
SET extracted_text_chars = COALESCE(extracted_char_count, 0)
WHERE extracted_text_chars = 0 AND extracted_char_count IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN knowledge_sources.storage_bucket IS 'Supabase Storage bucket name (e.g., appbase)';
COMMENT ON COLUMN knowledge_sources.extraction_status IS 'Text extraction status: pending, ok, no_text, failed';
COMMENT ON COLUMN knowledge_sources.extraction_error IS 'Error message if extraction failed';
COMMENT ON COLUMN knowledge_sources.extracted_text_chars IS 'Number of characters extracted from file';
