import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Supabase Storage config - needs project URL (not PostgreSQL URL)
// URL format: https://your-project-ref.supabase.co
const SUPABASE_PROJECT_URL = process.env.DATABASE_FILE_STORAGE_URL;
// Service role key from Supabase Dashboard -> Settings -> API
const SUPABASE_KEY = process.env.DATABASE_FILE_STORAGE_KEY;
// Bucket name from environment variable, default to 'appbase'
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'appbase';

let supabaseClient: SupabaseClient | null = null;

/**
 * Check if URL looks like a Supabase project URL (not PostgreSQL)
 */
function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Supabase project URL starts with https:// and contains .supabase.co
  return url.startsWith('https://') && url.includes('.supabase.co');
}

/**
 * Initialize Supabase client for storage operations
 */
function getSupabaseClient(): SupabaseClient | null {
  if (!isValidSupabaseUrl(SUPABASE_PROJECT_URL)) {
    // Only log once
    return null;
  }
  
  if (!SUPABASE_KEY) {
    console.warn('[Supabase Storage] Missing DATABASE_FILE_STORAGE_KEY - using anon access');
  }
  
  if (!supabaseClient && SUPABASE_PROJECT_URL) {
    // Use provided key or empty string for public bucket access
    const key = SUPABASE_KEY || '';
    if (!key) {
      console.warn('[Supabase Storage] No API key provided - storage will likely fail');
      return null;
    }
    
    supabaseClient = createClient(SUPABASE_PROJECT_URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[Supabase Storage] Client initialized');
  }
  
  return supabaseClient;
}

/**
 * Check if Supabase Storage is available
 */
export function isStorageAvailable(): boolean {
  return isValidSupabaseUrl(SUPABASE_PROJECT_URL) && !!SUPABASE_KEY;
}

/**
 * Ensure the storage bucket exists, create if not
 */
async function ensureBucketExists(client: SupabaseClient): Promise<boolean> {
  try {
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      console.error('[Supabase Storage] Failed to list buckets:', listError.message);
      return false;
    }
    
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`[Supabase Storage] Creating bucket: ${BUCKET_NAME}`);
      const { error: createError } = await client.storage.createBucket(BUCKET_NAME, {
        public: false, // Files require authentication
        fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
      });
      
      if (createError) {
        console.error('[Supabase Storage] Failed to create bucket:', createError.message);
        return false;
      }
      console.log(`[Supabase Storage] Bucket created: ${BUCKET_NAME}`);
    }
    
    return true;
  } catch (err) {
    console.error('[Supabase Storage] Bucket check error:', err);
    return false;
  }
}

/**
 * Sanitize filename for safe storage path
 * - Apply NFKD normalization to decompose Unicode characters
 * - Replace unsafe characters with underscore
 * - Collapse multiple underscores to single underscore
 * - Preserve file extension
 * - Max length: 255 characters
 */
function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';
  
  // Prevent path traversal
  filename = filename.replace(/\.\.[\/\\]/g, '');
  
  // Split into name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  let name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  let ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
  
  // Apply NFKD normalization (decompose Unicode characters)
  name = name.normalize('NFKD');
  
  // Replace unsafe characters with underscore
  // Keep: alphanumeric, dot, dash, underscore, Cyrillic
  name = name.replace(/[^a-zA-Z0-9._\-\u0400-\u04FF]/g, '_');
  
  // Collapse multiple underscores/spaces to single underscore
  name = name.replace(/_{2,}/g, '_');
  
  // Remove leading/trailing underscores
  name = name.replace(/^_+|_+$/g, '');
  
  // Ensure not empty
  if (!name) name = 'file';
  
  // Truncate if too long (leave room for extension and resourceId prefix)
  const maxNameLength = 200;
  if (name.length > maxNameLength) {
    name = name.substring(0, maxNameLength);
  }
  
  return name + ext;
}

/**
 * Upload a file to Supabase Storage
 * @param buffer File content as Buffer
 * @param filename Original filename
 * @param mimetype File MIME type
 * @param courseId Course ID for organizing files
 * @returns Storage path or null on failure
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  courseId: number
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Storage] Client not available, skipping upload');
    return null;
  }
  
  try {
    // Ensure bucket exists
    const bucketReady = await ensureBucketExists(client);
    if (!bucketReady) {
      return null;
    }
    
    // Generate unique storage path: courses/{courseId}/resources/{resourceId}-{safeFilename}
    const resourceId = randomUUID().slice(0, 8);
    const safeFilename = sanitizeFilename(filename);
    const storagePath = `courses/${courseId}/resources/${resourceId}-${safeFilename}`;
    
    console.log(`[Supabase Storage] Uploading: ${storagePath} (${(buffer.length / 1024).toFixed(1)}KB)`);
    console.log(`[Supabase Storage] Original filename: "${filename}" -> Sanitized: "${safeFilename}"`);
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimetype,
        upsert: false
      });
    
    if (error) {
      console.error(`[Supabase Storage] Upload failed for ${filename}:`, error.message);
      return null;
    }
    
    console.log(`[Supabase Storage] Upload success: ${storagePath}`);
    return `supabase:${BUCKET_NAME}/${storagePath}`;
  } catch (err) {
    console.error(`[Supabase Storage] Upload error for ${filename}:`, err);
    return null;
  }
}

/**
 * Download a file from Supabase Storage
 * @param storagePath Storage path (with or without supabase: prefix)
 * @returns Buffer and content type, or null on failure
 */
export async function downloadFile(storagePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Storage] Client not available');
    return null;
  }
  
  try {
    // Remove prefix and get the actual path
    let path = storagePath;
    if (path.startsWith('supabase:')) {
      path = path.replace('supabase:', '');
      // Remove bucket name from path if present
      if (path.startsWith(`${BUCKET_NAME}/`)) {
        path = path.replace(`${BUCKET_NAME}/`, '');
      }
    }
    
    console.log(`[Supabase Storage] Downloading: ${path}`);
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .download(path);
    
    if (error) {
      console.error(`[Supabase Storage] Download failed:`, error.message);
      return null;
    }
    
    if (!data) {
      console.error(`[Supabase Storage] Download returned no data`);
      return null;
    }
    
    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[Supabase Storage] Download success: ${path} (${(buffer.length / 1024).toFixed(1)}KB)`);
    
    return {
      buffer,
      contentType: data.type || 'application/octet-stream'
    };
  } catch (err) {
    console.error(`[Supabase Storage] Download error:`, err);
    return null;
  }
}

/**
 * Get a signed URL for temporary file access
 * @param storagePath Storage path
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null on failure
 */
export async function getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  
  try {
    // Remove prefix and get the actual path
    let path = storagePath;
    if (path.startsWith('supabase:')) {
      path = path.replace('supabase:', '');
      if (path.startsWith(`${BUCKET_NAME}/`)) {
        path = path.replace(`${BUCKET_NAME}/`, '');
      }
    }
    
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);
    
    if (error) {
      console.error(`[Supabase Storage] Signed URL failed:`, error.message);
      return null;
    }
    
    return data.signedUrl;
  } catch (err) {
    console.error(`[Supabase Storage] Signed URL error:`, err);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param storagePath Storage path
 * @returns true on success, false on failure
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }
  
  try {
    let path = storagePath;
    if (path.startsWith('supabase:')) {
      path = path.replace('supabase:', '');
      if (path.startsWith(`${BUCKET_NAME}/`)) {
        path = path.replace(`${BUCKET_NAME}/`, '');
      }
    }
    
    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      console.error(`[Supabase Storage] Delete failed:`, error.message);
      return false;
    }
    
    console.log(`[Supabase Storage] File deleted: ${path}`);
    return true;
  } catch (err) {
    console.error(`[Supabase Storage] Delete error:`, err);
    return false;
  }
}
