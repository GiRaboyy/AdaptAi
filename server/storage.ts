import { db } from "./db";
import {
  users, tracks, steps, enrollments, drillAttempts,
  type User, type InsertUser, type Track, type Step, type Enrollment, type DrillAttempt,
  type InsertUser as InsertUserType // Alias to avoid conflict
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUserType): Promise<User>;

  // Tracks
  createTrack(track: typeof tracks.$inferInsert): Promise<Track>;
  createSteps(stepsList: typeof steps.$inferInsert[]): Promise<Step[]>;
  getTracksByCurator(curatorId: number): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  getTrackByCode(code: string): Promise<Track | undefined>;
  getStepsByTrackId(trackId: number): Promise<Step[]>;

  // Enrollments
  createEnrollment(userId: number, trackId: number): Promise<Enrollment>;
  getEnrollment(userId: number, trackId: number): Promise<Enrollment | undefined>;
  getUserEnrollments(userId: number): Promise<{ enrollment: Enrollment; track: Track }[]>;
  updateEnrollmentProgress(id: number, stepIndex: number, isCompleted?: boolean): Promise<Enrollment>;

  // Drills
  createDrillAttempt(attempt: typeof drillAttempts.$inferInsert): Promise<DrillAttempt>;
  
  // Session store helper
  sessionStore: any;
}

import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUserType): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Tracks
  async createTrack(track: typeof tracks.$inferInsert): Promise<Track> {
    const [newTrack] = await db.insert(tracks).values(track).returning();
    return newTrack;
  }

  async createSteps(stepsList: typeof steps.$inferInsert[]): Promise<Step[]> {
    if (stepsList.length === 0) return [];
    return await db.insert(steps).values(stepsList).returning();
  }

  async getTracksByCurator(curatorId: number): Promise<Track[]> {
    return await db.select().from(tracks).where(eq(tracks.curatorId, curatorId));
  }

  async getTrack(id: number): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
    return track;
  }

  async getTrackByCode(code: string): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.joinCode, code));
    return track;
  }

  async getStepsByTrackId(trackId: number): Promise<Step[]> {
    return await db
      .select()
      .from(steps)
      .where(eq(steps.trackId, trackId))
      .orderBy(steps.orderIndex);
  }

  // Enrollments
  async createEnrollment(userId: number, trackId: number): Promise<Enrollment> {
    const [enrollment] = await db
      .insert(enrollments)
      .values({ userId, trackId })
      .returning();
    return enrollment;
  }

  async getEnrollment(userId: number, trackId: number): Promise<Enrollment | undefined> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId)));
    return enrollment;
  }

  async getUserEnrollments(userId: number): Promise<{ enrollment: Enrollment; track: Track }[]> {
    const result = await db
      .select({ enrollment: enrollments, track: tracks })
      .from(enrollments)
      .innerJoin(tracks, eq(enrollments.trackId, tracks.id))
      .where(eq(enrollments.userId, userId));
    return result;
  }

  async updateEnrollmentProgress(id: number, stepIndex: number, isCompleted?: boolean): Promise<Enrollment> {
    const values: any = { lastStepIndex: stepIndex, updatedAt: new Date() };
    if (isCompleted !== undefined) values.isCompleted = isCompleted;
    if (stepIndex > 0 || isCompleted) {
      // Logic for progress percentage could be more complex, but simplified here
       // Note: To calculate real %, we'd need total steps. 
       // For now, we update the index.
    }
    
    const [updated] = await db
      .update(enrollments)
      .set(values)
      .where(eq(enrollments.id, id))
      .returning();
    return updated;
  }

  // Drills
  async createDrillAttempt(attempt: typeof drillAttempts.$inferInsert): Promise<DrillAttempt> {
    const [newAttempt] = await db.insert(drillAttempts).values(attempt).returning();
    return newAttempt;
  }
}

export const storage = new DatabaseStorage();
