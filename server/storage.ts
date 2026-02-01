import { db } from "./db";
import {
  users, tracks, steps, enrollments, drillAttempts, knowledgeSources, kbIndex, promoCodes, courseMembers,
  type User, type InsertUser, type Track, type Step, type Enrollment, type DrillAttempt,
  type KnowledgeSource, type KBIndex, type PromoCode, type CourseMember,
  type InsertUser as InsertUserType
} from "@shared/schema";
import { eq, and, count, avg, sql } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUserType): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  incrementCreatedCoursesCount(userId: number): Promise<void>;

  // Tracks
  createTrack(track: typeof tracks.$inferInsert): Promise<Track>;
  createSteps(stepsList: typeof steps.$inferInsert[]): Promise<Step[]>;
  createStep(step: typeof steps.$inferInsert): Promise<Step>;
  updateStep(id: number, content: any): Promise<Step | undefined>;
  getTracksByCurator(curatorId: number): Promise<Track[]>;
  getTracksWithEmployeeCount(curatorId: number): Promise<Array<Omit<Track, 'rawKnowledgeBase'> & { employeeCount: number }>>;
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
  addNeedsRepeatTag(enrollmentId: number, tag: string): Promise<Enrollment>;

  // Analytics
  getCuratorAnalytics(curatorId: number): Promise<any>;
  getTrackAnalytics(trackId: number): Promise<any>;

  // Drills
  createDrillAttempt(attempt: typeof drillAttempts.$inferInsert): Promise<DrillAttempt>;
  getDrillAttemptsByTrack(trackId: number): Promise<DrillAttempt[]>;
  
  // Knowledge Sources
  createKnowledgeSource(source: typeof knowledgeSources.$inferInsert): Promise<KnowledgeSource>;
  getKnowledgeSourcesByCourseId(courseId: number): Promise<KnowledgeSource[]>;
  updateKnowledgeSourceStatus(id: number, status: string, errorMessage?: string): Promise<KnowledgeSource | undefined>;
  
  // KB Index
  createKBIndex(index: typeof kbIndex.$inferInsert): Promise<KBIndex>;
  getKBIndexByCourseId(courseId: number): Promise<KBIndex | undefined>;
  
  // Promo Codes
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  redeemPromoCode(promoId: string, userId: number): Promise<PromoCode | undefined>;
  
  // Course Members
  createCourseMember(member: typeof courseMembers.$inferInsert): Promise<CourseMember>;
  getCourseMemberCount(courseId: number, role?: 'curator' | 'employee'): Promise<number>;
  isCourseMember(courseId: number, userId: number): Promise<boolean>;
  
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
    // Case-insensitive email lookup - critical for Supabase sync
    // Supabase normalizes emails to lowercase, but users might register with mixed case
    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }

  async createUser(insertUser: InsertUserType): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async incrementCreatedCoursesCount(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ createdCoursesCount: sql`${users.createdCoursesCount} + 1` })
      .where(eq(users.id, userId));
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

  async createStep(step: typeof steps.$inferInsert): Promise<Step> {
    const [newStep] = await db.insert(steps).values(step).returning();
    return newStep;
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

  async getTracksWithEmployeeCount(curatorId: number): Promise<Array<Omit<Track, 'rawKnowledgeBase'> & { employeeCount: number }>> {
    // Optimized query - excludes rawKnowledgeBase for faster loading
    const result = await db
      .select({
        id: tracks.id,
        curatorId: tracks.curatorId,
        title: tracks.title,
        description: tracks.description,
        strictMode: tracks.strictMode,
        joinCode: tracks.joinCode,
        createdAt: tracks.createdAt,
        employeeCount: sql<number>`COALESCE(COUNT(DISTINCT ${enrollments.userId}), 0)::int`,
      })
      .from(tracks)
      .leftJoin(enrollments, eq(tracks.id, enrollments.trackId))
      .where(eq(tracks.curatorId, curatorId))
      .groupBy(tracks.id)
      .orderBy(sql`${tracks.createdAt} DESC`);
    
    return result as Array<Omit<Track, 'rawKnowledgeBase'> & { employeeCount: number }>;
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

  async addNeedsRepeatTag(enrollmentId: number, tag: string): Promise<Enrollment> {
    const enrollment = await this.getEnrollmentById(enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");
    
    const currentTags = enrollment.needsRepeatTags || [];
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
    }
    
    const [updated] = await db
      .update(enrollments)
      .set({ needsRepeatTags: currentTags, updatedAt: new Date() })
      .where(eq(enrollments.id, enrollmentId))
      .returning();
    return updated;
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

    // Calculate global problem topics from all attempts
    const allProblemTags: Record<string, { correct: number; total: number }> = {};
    for (const track of curatorTracks) {
      const trackAttempts = await this.getDrillAttemptsByTrack(track.id);
      trackAttempts.forEach(attempt => {
        const tag = attempt.tag || 'без_тега';
        if (!allProblemTags[tag]) allProblemTags[tag] = { correct: 0, total: 0 };
        allProblemTags[tag].total++;
        if (attempt.isCorrect) allProblemTags[tag].correct++;
      });
    }

    const problemTopics = Object.entries(allProblemTags)
      .map(([tag, stats]) => ({
        tag,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        attempts: stats.total,
        errors: stats.total - stats.correct
      }))
      .filter(t => t.accuracy < 80)
      .sort((a, b) => a.accuracy - b.accuracy);

    return {
      totalTracks: curatorTracks.length,
      totalEmployees,
      avgCompletion: enrollmentCount > 0 ? Math.round(totalProgress / enrollmentCount) : 0,
      avgAccuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
      trackStats,
      problemTopics
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

  // Knowledge Sources
  async createKnowledgeSource(source: typeof knowledgeSources.$inferInsert): Promise<KnowledgeSource> {
    const [newSource] = await db.insert(knowledgeSources).values(source).returning();
    return newSource;
  }

  async getKnowledgeSourcesByCourseId(courseId: number): Promise<KnowledgeSource[]> {
    return await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.courseId, courseId))
      .orderBy(knowledgeSources.createdAt);
  }

  async updateKnowledgeSourceStatus(
    id: number,
    status: string,
    errorMessage?: string
  ): Promise<KnowledgeSource | undefined> {
    const [updated] = await db
      .update(knowledgeSources)
      .set({ status: status as any, errorMessage })
      .where(eq(knowledgeSources.id, id))
      .returning();
    return updated;
  }

  // KB Index
  async createKBIndex(index: typeof kbIndex.$inferInsert): Promise<KBIndex> {
    const [newIndex] = await db.insert(kbIndex).values(index).returning();
    return newIndex;
  }

  async getKBIndexByCourseId(courseId: number): Promise<KBIndex | undefined> {
    const [index] = await db
      .select()
      .from(kbIndex)
      .where(eq(kbIndex.courseId, courseId))
      .orderBy(sql`${kbIndex.createdAt} DESC`)
      .limit(1);
    return index;
  }

  // Promo Codes
  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code));
    return promo;
  }

  async redeemPromoCode(promoId: string, userId: number): Promise<PromoCode | undefined> {
    const [redeemed] = await db
      .update(promoCodes)
      .set({
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(eq(promoCodes.id, promoId))
      .returning();
    return redeemed;
  }

  // Course Members
  async createCourseMember(member: typeof courseMembers.$inferInsert): Promise<CourseMember> {
    const [newMember] = await db
      .insert(courseMembers)
      .values(member)
      .returning();
    return newMember;
  }

  async getCourseMemberCount(courseId: number, role?: 'curator' | 'employee'): Promise<number> {
    if (role) {
      const result = await db
        .select({ count: count() })
        .from(courseMembers)
        .where(and(
          eq(courseMembers.courseId, courseId), 
          eq(courseMembers.memberRole, role as 'curator' | 'employee')
        ));
      return result[0]?.count || 0;
    }

    const result = await db
      .select({ count: count() })
      .from(courseMembers)
      .where(eq(courseMembers.courseId, courseId));
    return result[0]?.count || 0;
  }

  async isCourseMember(courseId: number, userId: number): Promise<boolean> {
    const [member] = await db
      .select()
      .from(courseMembers)
      .where(
        and(
          eq(courseMembers.courseId, courseId),
          eq(courseMembers.userId, userId)
        )
      );
    return !!member;
  }
}

export const storage = new DatabaseStorage();
