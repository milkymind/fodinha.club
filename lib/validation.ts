import { z } from 'zod';

// Game Actions Validation
export const playCardSchema = z.object({
  player_id: z.number().int().positive().max(100), // Reasonable limit
  card_index: z.number().int().min(0).max(13), // Max 13 cards in hand
});

export const makeBetSchema = z.object({
  player_id: z.number().int().positive().max(100),
  bet: z.number().int().min(0).max(13), // Can't bet more than max cards
});

export const startRoundSchema = z.object({
  player_id: z.number().int().positive().max(100),
});

// Game Creation Validation
export const createGameSchema = z.object({
  player_name: z.string().min(1).max(50).trim(),
  lives: z.number().int().min(1).max(10), // Reasonable lives limit
  start_from: z.enum(['one', 'max']).optional(),
});

export const joinGameSchema = z.object({
  player_name: z.string().min(1).max(50).trim(),
});

// General Game ID Validation
export const gameIdSchema = z.string().min(1).max(20).regex(/^[A-Z0-9]+$/);

// Player Name Validation (sanitize against XSS)
export const playerNameSchema = z.string()
  .min(1, 'Name is required')
  .max(50, 'Name too long')
  .trim()
  .refine(
    (name) => !/<[^>]*>/.test(name), 
    'HTML tags not allowed'
  )
  .refine(
    (name) => !/[<>&"']/.test(name),
    'Special characters not allowed'
  );

// Validation Helper Function
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed: ${errorMessage}` };
    }
    return { success: false, error: 'Invalid input data' };
  }
}

// Type exports for TypeScript
export type PlayCardRequest = z.infer<typeof playCardSchema>;
export type MakeBetRequest = z.infer<typeof makeBetSchema>;
export type StartRoundRequest = z.infer<typeof startRoundSchema>;
export type CreateGameRequest = z.infer<typeof createGameSchema>;
export type JoinGameRequest = z.infer<typeof joinGameSchema>; 