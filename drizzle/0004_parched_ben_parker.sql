ALTER TABLE "game_rounds" ADD COLUMN "multiplier_value" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "game_hands" DROP COLUMN "multiplier_value";