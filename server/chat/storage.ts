import { db, isDatabaseAvailable } from "../db";
import { conversations, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
}

function ensureDb() {
  if (!isDatabaseAvailable() || !db) {
    throw new Error('Database is not available. Please configure Supabase integration.');
  }
  return db;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const database = ensureDb();
    const [conversation] = await database.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    const database = ensureDb();
    return database.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string) {
    const database = ensureDb();
    const [conversation] = await database.insert(conversations).values({ title }).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    const database = ensureDb();
    await database.delete(messages).where(eq(messages.conversationId, id));
    await database.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    const database = ensureDb();
    return database.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const database = ensureDb();
    const [message] = await database.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  },
};

