/**
 * Parser Tests for ADAPT Platform
 * 
 * Tests text extraction from PDF, DOCX, and TXT files.
 * Run with: npx tsx server/ai/parsers.test.ts
 * 
 * This is a standalone test script that doesn't require a test framework.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPDF, extractTextFromDOCX, extractTextFromFile } from './parsers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test results tracking
let passed = 0;
let failed = 0;
let skipped = 0;

// Helper to create mock Express.Multer.File
function createMockFile(content: string | Buffer, filename: string, mimetype?: string): Express.Multer.File {
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimetype || 'application/octet-stream',
    size: buffer.length,
    buffer,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };
}

// Test assertion helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertContains(text: string, substring: string, message?: string): void {
  if (!text.includes(substring)) {
    throw new Error(message || `Expected "${text}" to contain "${substring}"`);
  }
}

function assertEqual(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertThrows(fn: () => Promise<any>, messagePattern?: RegExp): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error && error.message === 'Expected function to throw, but it did not') {
      throw error;
    }
    if (messagePattern && error instanceof Error) {
      if (!messagePattern.test(error.message)) {
        throw new Error(`Expected error to match ${messagePattern}, got: ${error.message}`);
      }
    }
  }
}

// Test runner
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (error) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function skip(name: string, reason?: string): void {
  console.log(`  - ${name} (SKIPPED${reason ? ': ' + reason : ''})`);
  skipped++;
}

function describe(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  return fn();
}

// ============================================================================
// PDF Extraction Tests
// ============================================================================

async function runPdfTests(): Promise<void> {
  await describe('extractTextFromPDF', async () => {
    await test('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await assertThrows(
        () => extractTextFromPDF(emptyBuffer, 'empty.pdf'),
        /пустой или не был загружен/i
      );
    });

    await test('should throw error for non-PDF file', async () => {
      const textBuffer = Buffer.from('This is just plain text, not a PDF');
      await assertThrows(
        () => extractTextFromPDF(textBuffer, 'fake.pdf'),
        /не является корректным PDF/i
      );
    });

    await test('should throw error for HTML masquerading as PDF', async () => {
      const htmlBuffer = Buffer.from('<html><body>Not a PDF</body></html>');
      await assertThrows(
        () => extractTextFromPDF(htmlBuffer, 'fake.pdf'),
        /не является корректным PDF/i
      );
    });

    await test('should fail on minimal PDF header without content', async () => {
      const minimalPdf = Buffer.from('%PDF-1.4 minimal');
      await assertThrows(
        () => extractTextFromPDF(minimalPdf, 'minimal.pdf')
      );
    });

    // Integration test with real PDF file (if available)
    const fixturesDir = path.join(__dirname, '__fixtures__');
    const testPdfPath = path.join(fixturesDir, 'sample.pdf');
    
    if (fs.existsSync(testPdfPath)) {
      await test('should extract text from a real PDF file', async () => {
        const buffer = fs.readFileSync(testPdfPath);
        const result = await extractTextFromPDF(buffer, 'sample.pdf');
        
        assert(result.fullText.length > 0, 'Expected fullText to be non-empty');
        assert(result.pageCount > 0, 'Expected pageCount > 0');
        assert(result.extractedCharCount > 0, 'Expected extractedCharCount > 0');
        assert(typeof result.metadata.encrypted === 'boolean', 'Expected encrypted to be boolean');
      });
    } else {
      skip('should extract text from a real PDF file', 'no sample.pdf in fixtures');
    }
  });
}

// ============================================================================
// DOCX Extraction Tests
// ============================================================================

async function runDocxTests(): Promise<void> {
  await describe('extractTextFromDOCX', async () => {
    await test('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await assertThrows(() => extractTextFromDOCX(emptyBuffer));
    });

    await test('should throw error for invalid DOCX (plain text)', async () => {
      const textBuffer = Buffer.from('This is plain text, not a DOCX');
      await assertThrows(
        () => extractTextFromDOCX(textBuffer),
        /не удалось прочитать docx/i
      );
    });

    await test('should throw error for invalid DOCX (random bytes)', async () => {
      const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      await assertThrows(
        () => extractTextFromDOCX(randomBuffer),
        /не удалось прочитать docx/i
      );
    });

    // Integration test with real DOCX file (if available)
    const fixturesDir = path.join(__dirname, '__fixtures__');
    const testDocxPath = path.join(fixturesDir, 'sample.docx');
    
    if (fs.existsSync(testDocxPath)) {
      await test('should extract text from a real DOCX file', async () => {
        const buffer = fs.readFileSync(testDocxPath);
        const text = await extractTextFromDOCX(buffer);
        
        assert(text.length > 0, 'Expected text to be non-empty');
      });
    } else {
      skip('should extract text from a real DOCX file', 'no sample.docx in fixtures');
    }
  });
}

// ============================================================================
// TXT/MD Extraction Tests
// ============================================================================

async function runTxtTests(): Promise<void> {
  await describe('extractTextFromFile - TXT', async () => {
    await test('should extract text from plain text file', async () => {
      const content = 'Hello, this is a test text file.\nWith multiple lines.\n';
      const mockFile = createMockFile(content, 'test.txt', 'text/plain');
      
      const result = await extractTextFromFile(mockFile);
      
      assertContains(result, 'Hello, this is a test text file.');
      assertContains(result, 'With multiple lines.');
    });

    await test('should extract text from markdown file', async () => {
      const content = '# Heading\n\nSome **bold** text.\n\n- List item 1\n- List item 2';
      const mockFile = createMockFile(content, 'test.md', 'text/markdown');
      
      const result = await extractTextFromFile(mockFile);
      
      assertContains(result, '# Heading');
      assertContains(result, 'Some **bold** text.');
    });

    await test('should normalize excessive newlines', async () => {
      const content = 'Line 1\n\n\n\n\nLine 2';
      const mockFile = createMockFile(content, 'test.txt', 'text/plain');
      
      const result = await extractTextFromFile(mockFile);
      
      // Should collapse to max 2 newlines
      assert(!result.match(/\n{3,}/), 'Expected no more than 2 consecutive newlines');
    });

    await test('should remove null bytes from text', async () => {
      const content = 'Text with\x00null\x00bytes';
      const mockFile = createMockFile(content, 'test.txt', 'text/plain');
      
      const result = await extractTextFromFile(mockFile);
      
      assert(!result.includes('\x00'), 'Expected no null bytes');
    });

    await test('should handle Cyrillic text correctly', async () => {
      const content = 'Привет, мир! Это тестовый файл на русском языке.';
      const mockFile = createMockFile(content, 'тест.txt', 'text/plain');
      
      const result = await extractTextFromFile(mockFile);
      
      assertContains(result, 'Привет, мир!');
      assertContains(result, 'русском языке');
    });

    await test('should trim whitespace', async () => {
      const content = '   \n\n  Content with leading whitespace   \n\n   ';
      const mockFile = createMockFile(content, 'test.txt', 'text/plain');
      
      const result = await extractTextFromFile(mockFile);
      
      assertEqual(result, 'Content with leading whitespace');
    });
  });
}

// ============================================================================
// File Format Routing Tests
// ============================================================================

async function runRoutingTests(): Promise<void> {
  await describe('extractTextFromFile - format routing', async () => {
    await test('should reject unsupported file formats', async () => {
      const mockFile = createMockFile('data', 'test.xyz');
      await assertThrows(
        () => extractTextFromFile(mockFile),
        /не поддерживается/i
      );
    });

    await test('should reject executable files', async () => {
      const mockFile = createMockFile('data', 'test.exe');
      await assertThrows(
        () => extractTextFromFile(mockFile),
        /не поддерживается/i
      );
    });

    await test('should reject script files', async () => {
      const mockFile = createMockFile('data', 'test.js');
      await assertThrows(
        () => extractTextFromFile(mockFile),
        /не поддерживается/i
      );
    });

    await test('should handle case-insensitive extensions', async () => {
      const content = 'Test content';
      const mockFileTXT = createMockFile(content, 'test.TXT', 'text/plain');
      const mockFileTxt = createMockFile(content, 'test.Txt', 'text/plain');
      
      const result1 = await extractTextFromFile(mockFileTXT);
      const result2 = await extractTextFromFile(mockFileTxt);
      
      assertEqual(result1, 'Test content');
      assertEqual(result2, 'Test content');
    });

    await test('should enforce file size limits', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 25 * 1024 * 1024, // 25 MB - over the 20 MB limit
        buffer: Buffer.from('small'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
      
      await assertThrows(
        () => extractTextFromFile(mockFile),
        /слишком большой/i
      );
    });

    await test('should enforce image file size limits', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024, // 6 MB - over the 5 MB limit for images
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
      
      await assertThrows(
        () => extractTextFromFile(mockFile),
        /слишком большой.*5 МБ/i
      );
    });
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('ADAPT Parser Tests');
  console.log('========================================');

  try {
    await runPdfTests();
    await runDocxTests();
    await runTxtTests();
    await runRoutingTests();

    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nTest runner error:', error);
    process.exit(1);
  }
}

main();
