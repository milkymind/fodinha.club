CREATE TABLE "card_plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"card_played" text NOT NULL,
	"play_order" integer NOT NULL,
	"is_winning_card" boolean DEFAULT false,
	"play_timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_hands" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"hand_number" integer NOT NULL,
	"cards_per_player" integer NOT NULL,
	"dealer_player_id" integer NOT NULL,
	"middle_card" text,
	"manilha" text NOT NULL,
	"total_bets" integer NOT NULL,
	"is_multiplier_hand" boolean DEFAULT false,
	"multiplier_value" integer DEFAULT 1,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" text NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"final_position" integer,
	"lives_remaining" integer,
	"is_winner" boolean DEFAULT false,
	"is_connected" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"eliminated_at" timestamp,
	"disconnected_at" timestamp,
	"reconnected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"hand_id" integer NOT NULL,
	"round_number" integer NOT NULL,
	"winner_player_id" integer,
	"winning_card" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "games" (
	"game_id" text PRIMARY KEY NOT NULL,
	"host_user_id" text NOT NULL,
	"max_players" integer NOT NULL,
	"initial_lives" integer NOT NULL,
	"start_from" text NOT NULL,
	"game_status" text NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"hand_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"bet_value" integer NOT NULL,
	"actual_tricks" integer,
	"is_last_to_bet" boolean DEFAULT false,
	"lives_before_bet" integer NOT NULL,
	"is_perfect_prediction" boolean,
	"bet_accuracy_score" integer,
	"bet_timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"win_percentage" numeric(5, 2),
	"perfect_prediction_rate" numeric(5, 2),
	"avg_bet_accuracy_score" numeric(5, 2),
	"avg_survival_rate" numeric(5, 2),
	"multiplier_efficiency" numeric(5, 2),
	"last_player_win_rate" numeric(5, 2),
	"high_pressure_accuracy" numeric(5, 2),
	"total_games_played" integer DEFAULT 0,
	"total_hands_played" integer DEFAULT 0,
	"total_rounds_played" integer DEFAULT 0,
	"total_perfect_predictions" integer DEFAULT 0,
	"total_multiplier_hands" integer DEFAULT 0,
	"total_last_player_bets" integer DEFAULT 0,
	"total_high_pressure_bets" integer DEFAULT 0,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_plays" ADD CONSTRAINT "card_plays_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_plays" ADD CONSTRAINT "card_plays_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_hands" ADD CONSTRAINT "game_hands_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("game_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_hand_id_game_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."game_hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_bets" ADD CONSTRAINT "player_bets_hand_id_game_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."game_hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_bets" ADD CONSTRAINT "player_bets_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;