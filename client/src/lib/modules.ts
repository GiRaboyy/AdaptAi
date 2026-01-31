/**
 * Module Grouping Utility
 * 
 * Provides visual grouping of lessons without backend changes.
 * Modules are derived from existing lesson data through client-side logic.
 */

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: any[];
  completedCount: number;
  totalCount: number;
  progressPct: number;
}

/**
 * Groups lessons into modules based on their titles or order
 * 
 * Scenario A: If lesson titles contain "Module X", extract and group by module number
 * Scenario B: Otherwise, group lessons by order index (4-6 lessons per module)
 */
export function groupLessonsIntoModules(lessons: any[]): Module[] {
  if (!lessons || lessons.length === 0) return [];

  // Sort lessons by order
  const sortedLessons = [...lessons].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Try Scenario A: Check if lessons have explicit module naming
  const modulePattern = /модуль\s+(\d+)|module\s+(\d+)/i;
  const hasExplicitModules = sortedLessons.some(lesson => 
    modulePattern.test(lesson.title || '')
  );

  if (hasExplicitModules) {
    return groupByExplicitModules(sortedLessons, modulePattern);
  }

  // Scenario B: Group by order index
  return groupByOrderIndex(sortedLessons);
}

/**
 * Scenario A: Extract modules from lesson titles
 */
function groupByExplicitModules(lessons: any[], pattern: RegExp): Module[] {
  const moduleMap = new Map<number, any[]>();

  lessons.forEach(lesson => {
    const match = (lesson.title || '').match(pattern);
    if (match) {
      const moduleNum = parseInt(match[1] || match[2]);
      if (!moduleMap.has(moduleNum)) {
        moduleMap.set(moduleNum, []);
      }
      moduleMap.get(moduleNum)!.push(lesson);
    } else {
      // Put lessons without module designation in "Module 0" (misc)
      if (!moduleMap.has(0)) {
        moduleMap.set(0, []);
      }
      moduleMap.get(0)!.push(lesson);
    }
  });

  return Array.from(moduleMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, moduleLessons]) => createModule(num, moduleLessons));
}

/**
 * Scenario B: Group lessons by order index (4-6 lessons per module)
 */
function groupByOrderIndex(lessons: any[]): Module[] {
  const LESSONS_PER_MODULE = 5;
  const modules: Module[] = [];
  
  for (let i = 0; i < lessons.length; i += LESSONS_PER_MODULE) {
    const moduleLessons = lessons.slice(i, i + LESSONS_PER_MODULE);
    const moduleNum = Math.floor(i / LESSONS_PER_MODULE) + 1;
    modules.push(createModule(moduleNum, moduleLessons));
  }

  return modules;
}

/**
 * Creates a module object from lessons
 */
function createModule(moduleNum: number, lessons: any[]): Module {
  const completedLessons = lessons.filter(l => l.isCompleted || false);
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 
    ? Math.round((completedLessons.length / totalLessons) * 100) 
    : 0;

  // Generate module title
  let title = `Модуль ${moduleNum}`;
  if (moduleNum === 0) {
    title = 'Введение';
  } else {
    // Try to extract theme from first lesson title
    const firstLesson = lessons[0];
    if (firstLesson && firstLesson.title) {
      const cleanTitle = firstLesson.title
        .replace(/модуль\s+\d+:?\s*/i, '')
        .replace(/module\s+\d+:?\s*/i, '')
        .trim();
      if (cleanTitle.length > 0 && cleanTitle.length < 50) {
        const themePart = cleanTitle.split(/[:.,-]/)[0].trim();
        if (themePart.length < 30) {
          title = `Модуль ${moduleNum}: ${themePart}`;
        }
      }
    }
  }

  // Generate description
  const description = generateModuleDescription(lessons, completedLessons.length);

  return {
    id: `module-${moduleNum}`,
    title,
    description,
    lessons,
    completedCount: completedLessons.length,
    totalCount: totalLessons,
    progressPct,
  };
}

/**
 * Generates a short description for the module
 */
function generateModuleDescription(lessons: any[], completedCount: number): string {
  const total = lessons.length;
  
  if (completedCount === total) {
    return `Все ${total} ${pluralizeLessons(total)} завершены`;
  }
  
  if (completedCount === 0) {
    return `${total} ${pluralizeLessons(total)}`;
  }
  
  return `${completedCount} из ${total} ${pluralizeLessons(total)} завершено`;
}

/**
 * Russian pluralization for "уроков"
 */
function pluralizeLessons(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'уроков';
  }

  if (lastDigit === 1) {
    return 'урок';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'урока';
  }

  return 'уроков';
}
