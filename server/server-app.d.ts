/**
 * Type declarations for the compiled server app bundle
 * This file is copied to dist/ during build
 */

import type { Express } from 'express';

export function createApp(): Promise<Express>;
