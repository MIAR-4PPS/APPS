import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const engajaMessagesTable = pgTable("engaja_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEngajaMessageSchema = z.object({
  userId: z.string(),
  role: z.string(),
  content: z.string(),
});

export type InsertEngajaMessage = z.infer<typeof insertEngajaMessageSchema>;
export type EngajaMessage = typeof engajaMessagesTable.$inferSelect;
