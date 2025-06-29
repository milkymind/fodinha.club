ALTER TABLE "card_plays" ADD COLUMN "game_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD COLUMN "game_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "player_bets" ADD COLUMN "game_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "card_plays" ADD CONSTRAINT "card_plays_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_bets" ADD CONSTRAINT "player_bets_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;