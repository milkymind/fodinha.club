ALTER TABLE "game_rounds" ALTER COLUMN "multiplier_value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD COLUMN "is_multiplier_round" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "game_hands" DROP COLUMN "is_multiplier_hand";