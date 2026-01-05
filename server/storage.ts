import { db } from "./db";
import {
  users, tracks, steps, enrollments, drillAttempts,
  type User, type InsertUser, type Track, type Step, type Enrollment, type DrillAttempt,
  type InsertUser as InsertUserType
} from "@shared/schema";
import { eq, and, count, avg, sql } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUserType): Promise<User>;

  // Tracks
  createTrack(track: typeof tracks.$inferInsert): Promise<Track>;
  createSteps(stepsList: typeof steps.$inferInsert[]): Promise<Step[]>;
  updateStep(id: number, content: any): Promise<Step | undefined>;
  getTracksByCurator(curatorId: number): Promise<Track[]>;
  getTrack(id: number): Promise<Track | undefined>;
  getTrackByCode(code: string): Promise<Track | undefined>;
  getStepsByTrackId(trackId: number): Promise<Step[]>;

  // Enrollments
  createEnrollment(userId: number, trackId: number): Promise<Enrollment>;
  getEnrollment(userId: number, trackId: number): Promise<Enrollment | undefined>;
  getEnrollmentById(id: number): Promise<Enrollment | undefined>;
  getUserEnrollments(userId: number): Promise<{ enrollment: Enrollment; track: Track }[]>;
  updateEnrollmentProgress(id: number, stepIndex: number, isCompleted?: boolean): Promise<Enrollment>;
  getEnrollmentsByTrackId(trackId: number): Promise<{ enrollment: Enrollment; user: User }[]>;

  // Analytics
  getCuratorAnalytics(curatorId: number): Promise<any>;
  getTrackAnalytics(trackId: number): Promise<any>;

  // Drills
  createDrillAttempt(attempt: typeof drillAttempts.$inferInsert): Promise<DrillAttempt>;
  getDrillAttemptsByTrack(trackId: number): Promise<DrillAttempt[]>;
  
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

  async updateStep(id: number, content: any): Promise<Step | undefined> {
    const [updated] = await db.update(steps)
      .set({ content })
      .where(eq(steps.id, id))
      .returning();
    return updated;
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
      .values({ userId, trackId, progressPct: 0 })
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

  async getEnrollmentById(id: number): Promise<Enrollment | undefined> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id));
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
    const enrollment = await this.getEnrollmentById(id);
    if (!enrollment) throw new Error("Enrollment not found");
    
    const trackSteps = await this.getStepsByTrackId(enrollment.trackId);
    const totalSteps = trackSteps.length;
    const progressPct = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;
    
    const values: any = { 
      lastStepIndex: stepIndex, 
      progressPct: Math.min(progressPct, 100),
      updatedAt: new Date() 
    };
    if (isCompleted !== undefined) {
      values.isCompleted = isCompleted;
      if (isCompleted) values.progressPct = 100;
    }
    
    const [updated] = await db
      .update(enrollments)
      .set(values)
      .where(eq(enrollments.id, id))
      .returning();
    return updated;
  }

  async getEnrollmentsByTrackId(trackId: number): Promise<{ enrollment: Enrollment; user: User }[]> {
    const result = await db
      .select({ enrollment: enrollments, user: users })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.trackId, trackId));
    return result;
  }

  // Analytics
  async getCuratorAnalytics(curatorId: number): Promise<any> {
    const curatorTracks = await this.getTracksByCurator(curatorId);
    const trackIds = curatorTracks.map(t => t.id);
    
    if (trackIds.length === 0) {
      return {
        totalTracks: 0,
        totalEmployees: 0,
        avgCompletion: 0,
        avgAccuracy: 0,
        trackStats: []
      };
    }

    let totalEmployees = 0;
    let totalProgress = 0;
    let enrollmentCount = 0;
    let correctAttempts = 0;
    let totalAttempts = 0;
    const trackStats = [];

    for (const track of curatorTracks) {
      const trackEnrollments = await this.getEnrollmentsByTrackId(track.id);
      const trackAttempts = await this.getDrillAttemptsByTrack(track.id);
      
      const employeeCount = trackEnrollments.length;
      const avgProgress = employeeCount > 0 
        ? trackEnrollments.reduce((sum, e) => sum + (e.enrollment.progressPct || 0), 0) / employeeCount 
        : 0;
      const completedCount = trackEnrollments.filter(e => e.enrollment.isCompleted).length;
      const trackCorrect = trackAttempts.filter(a => a.isCorrect).length;
      const trackTotal = trackAttempts.length;

      totalEmployees += employeeCount;
      totalProgress += avgProgress * employeeCount;
      enrollmentCount += employeeCount;
      correctAttempts += trackCorrect;
      totalAttempts += trackTotal;

      trackStats.push({
        trackId: track.id,
        title: track.title,
        employeeCount,
        avgProgress: Math.round(avgProgress),
        completedCount,
        accuracy: trackTotal > 0 ? Math.round((trackCorrect / trackTotal) * 100) : 0,
        employees: trackEnrollments.map(e => ({
          id: e.user.id,
          name: e.user.name,
          email: e.user.email,
          progress: e.enrollment.progressPct || 0,
          isCompleted: e.enrollment.isCompleted
        }))
      });
    }

    return {
      totalTracks: curatorTracks.length,
      totalEmployees,
      avgCompletion: enrollmentCount > 0 ? Math.round(totalProgress / enrollmentCount) : 0,
      avgAccuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
      trackStats
    };
  }

  async getTrackAnalytics(trackId: number): Promise<any> {
    const track = await this.getTrack(trackId);
    if (!track) return null;

    const trackEnrollments = await this.getEnrollmentsByTrackId(trackId);
    const trackAttempts = await this.getDrillAttemptsByTrack(trackId);
    const trackSteps = await this.getStepsByTrackId(trackId);

    const employeeCount = trackEnrollments.length;
    const avgProgress = employeeCount > 0
      ? trackEnrollments.reduce((sum, e) => sum + (e.enrollment.progressPct || 0), 0) / employeeCount
      : 0;
    const completedCount = trackEnrollments.filter(e => e.enrollment.isCompleted).length;
    const correctAttempts = trackAttempts.filter(a => a.isCorrect).length;
    const totalAttempts = trackAttempts.length;

    const problemTags: Record<string, { correct: number; total: number }> = {};
    trackAttempts.forEach(attempt => {
      const tag = attempt.tag || 'без_тега';
      if (!problemTags[tag]) problemTags[tag] = { correct: 0, total: 0 };
      problemTags[tag].total++;
      if (attempt.isCorrect) problemTags[tag].correct++;
    });

    const problemTopics = Object.entries(problemTags)
      .map(([tag, stats]) => ({
        tag,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        attempts: stats.total
      }))
      .filter(t => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy);

    return {
      track,
      employeeCount,
      avgProgress: Math.round(avgProgress),
      completedCount,
      accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
      totalSteps: trackSteps.length,
      problemTopics,
      employees: trackEnrollments.map(e => ({
        id: e.user.id,
        name: e.user.name,
        email: e.user.email,
        progress: e.enrollment.progressPct || 0,
        isCompleted: e.enrollment.isCompleted,
        lastStepIndex: e.enrollment.lastStepIndex
      }))
    };
  }

  // Drills
  async createDrillAttempt(attempt: typeof drillAttempts.$inferInsert): Promise<DrillAttempt> {
    const [newAttempt] = await db.insert(drillAttempts).values(attempt).returning();
    return newAttempt;
  }

  async getDrillAttemptsByTrack(trackId: number): Promise<DrillAttempt[]> {
    return await db
      .select()
      .from(drillAttempts)
      .where(eq(drillAttempts.trackId, trackId));
  }
}

export const storage = new DatabaseStorage();
