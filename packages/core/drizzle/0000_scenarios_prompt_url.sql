-- Adds prompt-first scenario support.
-- Existing YAML scenarios remain valid; new scenarios populate (prompt, url) instead.

ALTER TABLE "scenarios" ADD COLUMN IF NOT EXISTS "prompt" text;
ALTER TABLE "scenarios" ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE "scenarios" ALTER COLUMN "yaml_content" DROP NOT NULL;

ALTER TABLE "scenarios" DROP CONSTRAINT IF EXISTS "scenarios_prompt_or_yaml";
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_prompt_or_yaml"
  CHECK ((prompt IS NOT NULL AND url IS NOT NULL) OR yaml_content IS NOT NULL);
