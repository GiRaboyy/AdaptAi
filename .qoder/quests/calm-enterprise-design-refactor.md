# ADAPT Platform — Calm Enterprise Design System Refactor

## Overview

This design document defines a visual-only refactor of the ADAPT B2B onboarding and training platform. The goal is to transform all screens into a calm, readable, professional enterprise interface while preserving 100% of existing business logic, routing, data models, and user flows.

## Design Principles

### Core Philosophy
- **Calm over Colorful**: Muted, professional color palette with strategic accent usage
- **Readability First**: Clear typography hierarchy, generous whitespace, optimal line lengths
- **Consistent Enterprise**: Every screen feels part of the same premium product
- **Non-Gamified**: No XP, missions, rewards, or playful elements
- **Strategic Green**: Accent color used only for primary actions, focus states, and selection

### Visual Constraints
- No changes to business logic, API endpoints, routing structure, or database schema
- No changes to UX flow or information architecture (sidebar, topbar, tabs, navigation remain)
- Changes limited to: visual styling, components, typography, spacing, colors, conditional UI rendering
- "Modules" introduced as visual grouping layer only (derived from existing lesson metadata)

---

## Design Token System

### Color Palette

#### Backgrounds
- `--bg`: #FFFFFF — Primary background
- `--bg-soft`: #F8FAFC — Subtle background variation

#### Surfaces
- `--surface`: #FFFFFF — Card and panel backgrounds
- `--surface-soft`: #F1F5F9 — Alternative surface for depth

#### Borders
- `--border`: #E2E8F0 — Standard border
- `--border-strong`: #CBD5E1 — Emphasized border

#### Typography
- `--text`: #0F172A — Primary text
- `--muted`: #475569 — Secondary text
- `--muted-2`: #64748B — Tertiary text

#### Accent (Primary)
- `--primary`: #9EDB6A — Primary action color
- `--primary-hover`: #8BCF5A — Hover state
- `--primary-soft`: rgba(158,219,106,0.18) — Subtle background
- `--primary-ink`: #0F172A — Text on primary background

#### Semantic Colors
- `--error`: #DC2626 — Error states
- `--warning`: #F59E0B — Warning states
- `--info`: #2563EB — Informational states

#### Shadows
- `--shadow-sm`: 0 1px 2px rgba(15,23,42,0.06) — Subtle elevation
- `--shadow-md`: 0 8px 20px rgba(15,23,42,0.08) — Card elevation

#### Border Radius
- `--r-sm`: 8px — Small elements
- `--r-md`: 10px — Buttons, inputs
- `--r-lg`: 12px — Cards
- `--r-xl`: 16px — Modals, large containers

### Prohibited Styles
- Thick black borders
- Border radius exceeding 16px
- Green section backgrounds
- Green headings or decorative elements
- Overly bright or saturated colors

---

## Typography System

### Font Family
- **Primary**: Inter (all weights)
- Fallback: system-ui, -apple-system, sans-serif

### Base Settings
- Font size: 16px
- Line height: 1.55 (24.8px)
- Weight: 400–500 for body text

### Hierarchy

#### Headings
- **H1**: 32–36px, weight 700, line-height 1.2
- **H2**: 24–28px, weight 650–700, line-height 1.3
- **H3**: 18–20px, weight 600, line-height 1.4
- **H4**: 16–18px, weight 600, line-height 1.5

#### Body Text
- **Base**: 16px, weight 400–500
- **Small**: 14px, weight 400
- **Caption**: 12px, weight 400

#### Guidelines
- No loud typography (avoid all-caps, excessive bold)
- No green headings
- Consistent use of muted colors for secondary information
- Maintain readability with sufficient contrast ratios

---

## Component Library

### Button System

#### Philosophy
- **Rule**: Only ONE Primary CTA per screen
- Avoid visual noise through button hierarchy
- Never use full-width buttons inside cards

#### Button Variants

**Primary Button**
- Background: `--primary`
- Text: `--primary-ink`
- Border radius: `--r-md`
- Height: 48px (desktop), 44px (mobile)
- Padding: 12px horizontal, 18px vertical
- Shadow: `--shadow-sm`
- Font weight: 500–600
- Use case: Single primary action per screen

**Secondary Button**
- Background: `--surface` (white)
- Border: 1px solid `--border`
- Text: `--text`
- Border radius: `--r-md`
- Height: 44px
- Padding: 10px 16px
- Use case: Secondary actions, navigation

**Ghost Button**
- Background: transparent
- Text: `--text` or `--muted`
- Hover: `--surface-soft`
- Border radius: `--r-md`
- Padding: 8px 12px
- Use case: Tertiary actions, inline actions

#### States
- Hover: Slight darkening or lightening, subtle scale (1.02)
- Active: Pressed appearance, scale (0.98)
- Disabled: Opacity 0.5, no pointer events
- Loading: Spinner replaces text, maintains dimensions

### Card Component

#### Standard Card
- Background: `--surface`
- Border: 1px solid `--border`
- Border radius: `--r-lg`
- Padding: 20px (mobile), 24px (desktop)
- Shadow: `--shadow-sm`
- Hover: Optional subtle lift with `--shadow-md`

#### Card Variants
- **Flat Card**: No border, background `--surface-soft`
- **Elevated Card**: `--shadow-md`, subtle hover lift
- **Interactive Card**: Hover state with cursor pointer

### Input System

#### Text Input
- Height: 44px
- Border: 1px solid `--border`
- Border radius: `--r-md`
- Padding: 10px 12px
- Font size: 16px
- Focus state: Border `--primary`, subtle glow

#### Input States
- Default: Border `--border`
- Focus: Border `--primary`, outline ring `--primary-soft`
- Error: Border `--error`, helper text in `--error`
- Disabled: Background `--surface-soft`, opacity 0.6

#### Helper Text
- Font size: 14px
- Color: `--muted` (default), `--error` (error state)
- Margin top: 6px

### Progress Indicators

#### Progress Bar
- Height: 2–3px (thin design)
- Background: `--surface-soft`
- Fill: `--primary`
- Border radius: 999px (fully rounded)
- Animation: Smooth transitions (0.3s ease)

#### Step Counter
- Format: "Step X of Y" or "Lesson X/Y"
- Font size: 14px
- Color: `--muted`
- Position: Above or beside progress bar

### Badge Component
- Padding: 4px 10px
- Border radius: `--r-sm`
- Font size: 12px
- Font weight: 500
- Variants:
  - Success: Background `--primary-soft`, text `--text`
  - Error: Background rgba(220,38,38,0.1), text `--error`
  - Neutral: Background `--surface-soft`, text `--muted`

---

## Application Shell

### Sidebar Navigation

#### Layout
- Width: 256px (desktop), collapsible on tablet/mobile
- Background: `--surface`
- Border right: 1px solid `--border`
- Padding: 16px

#### Navigation Items
- Height: 40px
- Padding: 10px 12px
- Border radius: `--r-md`
- Default state: Text `--muted`, icon `--muted-2`
- Hover: Background `--surface-soft`
- Active state:
  - Background: `--primary-soft`
  - Left indicator: 3px solid `--primary`
  - Text: `--text`
  - Icon: `--primary`

#### Sections
- Group related items with subtle dividers
- Section headers: 12px, uppercase, letter-spacing 0.05em, color `--muted-2`

### Top Bar

#### Structure
- Height: 64px
- Background: `--surface`
- Border bottom: 1px solid `--border`
- Padding: 0 24px
- Display: Flex layout for logo, actions, user menu

#### Content Areas
- Left: Logo or page title
- Center: Optional search or tabs
- Right: Notifications, user avatar, settings

#### Guidelines
- Remove double borders between sidebar and topbar
- Keep single vertical divider if needed
- Maintain consistent spacing and alignment

---

## Modules Feature (Visual Only)

### Purpose
Provide visual grouping of lessons without backend changes. Modules are derived from existing lesson data through client-side logic.

### Derivation Logic

#### Scenario A: Explicit Module Naming
- If lesson titles contain "Module X", "Module 1", etc., extract and group by module number
- Example: "Module 1: Introduction" → Module 1

#### Scenario B: Implicit Grouping
- Group lessons by order index (e.g., every 4–6 lessons = one module)
- Assign sequential module numbers
- Generate descriptive module titles based on lesson themes

### Module Card Design

#### Visual Structure
- Container: Card with `--r-lg` radius, `--border`, padding 20px
- Title: H3 (18–20px, weight 600)
- Description: Short sentence, color `--muted`, 14px
- Progress bar: Thin (2–3px), color `--primary`
- Metadata: "Lessons: N • Completed: M" in `--muted-2`, 14px

#### Interaction
- Accordion-style expand/collapse
- Click to reveal lesson list
- Lessons rendered as clickable items with existing routing

#### Placement
- **Course Overview**: Display modules first, above individual lessons
- **Employee Courses Page**: Show modules before lesson list

### Implementation Constraints
- No new database entities
- No API changes
- No route modifications
- Purely client-side rendering based on existing lesson data

---

## Screen-Specific Design Specifications

### Authentication & Login

#### Visual Structure
- Centered card layout (max-width 440px)
- Card styling: `--surface`, `--border`, `--r-xl`, padding 40px
- Logo positioned above card
- Background: `--bg-soft` with optional subtle pattern

#### Form Elements
- Input fields: Standard text input design (44px height)
- Labels: 14px, weight 500, color `--text`
- Error messages: Below inputs, 14px, color `--error`
- Submit button: Primary button, full-width within card

#### States
- Loading: Spinner on button, inputs disabled
- Error: Input borders turn `--error`, message appears below
- Success: Brief success message before redirect

#### Consistency
- Must match global design token system
- Calm, professional appearance
- No bright colors or playful elements

---

### My Courses (Employee)

#### Page Layout
- Grid or list view of course cards
- Optional filter/search bar at top
- Responsive grid: 1 column (mobile), 2–3 columns (desktop)

#### Course Card Design

**Structure**
- Card component with `--r-lg`, padding 20px
- Title: H3 (18px, weight 600)
- Metadata row: Status badge + curator name, 14px, color `--muted`
- Progress bar: Thin (2–3px), positioned below metadata
- Action row: Flex layout, space-between

**Action Row**
- Left side: "Step X of Y" in `--muted`, 14px
- Right side: Secondary button "Continue →"

**Prohibited Styling**
- No full-width buttons
- No green outlines or borders
- No overly bright colors

#### Join Course Feature

**Trigger**
- Button: "+ Join Course" (secondary or ghost style)
- Positioned prominently but not overwhelming (e.g., top-right)

**Modal**
- Centered modal with `--r-xl`, padding 32px
- Title: "Join a Course"
- Input: Text field for course code
- Actions: Primary "Join" button + ghost "Cancel"

---

### Course Overview

#### Layout Priority
- **First**: Modules section (accordion or card grid)
- **Second**: Individual lessons (if not grouped into modules)
- **Third**: Course metadata and actions

#### Header Section
- Course title: H1
- Course description: Base text, color `--muted`
- Curator info: Small metadata row

#### Modules Section
- Display module cards as defined in Modules Feature
- Allow expand/collapse to reveal lesson list
- Each lesson item links to existing player route

#### Actions
- Secondary button: "Edit Training" (visible to curators only)
- Routes to existing editor without logic changes

---

### Lesson Player

#### Layout Philosophy
- **Readability First**: Single-column, max-width ~820px, centered
- Generous whitespace between elements
- Clear visual hierarchy

#### Header
- Progress bar: Top of screen, thin (2–3px), full-width
- Step counter: "Lesson X of Y" below progress bar, 14px, `--muted`

#### Content Area
- Lesson title: H2
- Lesson content: Base text, optimal line length
- Media embeds: Max-width container, aspect ratio preserved

#### Voice Narration

**Default Behavior**
- NO autoplay
- Button: "🔊 Narrate" (secondary or ghost style)
- Positioned near lesson title or top-right

**Voice Input**
- Microphone button at bottom or in input area
- Label: "Hold to speak"
- Visual indicator during recording
- **Constraint**: Never overwrite typed text
- Append or replace only upon user confirmation

#### Drill Mode → "Reinforcement"

**Terminology Change**
- Replace "Drill" with "Reinforcement" throughout UI

**Structure**
1. **Why Incorrect**: Explanation in calm tone, color `--muted`
2. **Correct Approach**: Clear guidance, base text
3. **Attempt Indicator**: "Attempt 1 of 2" in `--muted-2`

**Visual Treatment**
- Card-based layout
- Each section clearly separated
- No aggressive colors or warnings

#### Actions
- Primary button: "Continue" or "Submit" (single per screen)
- Secondary button: "Back" or "Skip" if applicable

---

### Analytics (Curator)

#### Layout
- Dashboard grid with calm card components
- Tables with clean styling, readable typography
- Charts with muted color palette

#### Data Visualization
- Use `--primary` sparingly in charts
- Prefer neutral grays with single accent color
- Ensure labels and axes are readable (14px, `--muted`)

#### Tables
- Header row: Background `--surface-soft`, text `--muted-2`, 12px uppercase
- Rows: Border-bottom 1px `--border`, padding 12px
- Hover: Background `--surface-soft`

#### Guidelines
- No decorative green elements
- Focus on data clarity and readability
- Accurate-looking layout without gamification

---

### Additional Screens

#### Curator Dashboard
- Module cards showing course overview
- Quick actions with secondary buttons
- Statistics cards with calm styling

#### Settings Pages
- Form-based layouts with standard inputs
- Clear section headings
- Save button as primary CTA

#### Profile Pages
- Avatar, user info in clean card layout
- Editable fields with standard inputs
- Consistent with overall design system

---

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px – 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Sidebar collapses to hamburger menu
- Course cards stack in single column
- Button heights reduce to 44px
- Modal padding reduces to 24px

### Touch Targets
- Minimum 44px height for all interactive elements
- Adequate spacing between touch targets (8px minimum)

---

## Acceptance Criteria

### Visual Consistency
- [ ] All screens use design token system
- [ ] Typography hierarchy is consistent
- [ ] Spacing follows 4px/8px grid system
- [ ] Button system adhered to (only one primary per screen)

### Calm Aesthetic
- [ ] Not colorful or bright
- [ ] Green used only for actions, focus, selection
- [ ] Readable immediately upon viewing
- [ ] Buttons don't visually "shout"

### Enterprise Feel
- [ ] Not game-like
- [ ] Professional and confident
- [ ] Every screen looks like same product
- [ ] Premium quality in details

### Modules Feature
- [ ] Modules appear cleanly without logic/route/data changes
- [ ] Derived from existing lesson metadata
- [ ] Accordion or expandable interaction
- [ ] Positioned correctly on relevant screens

### No Logic Changes
- [ ] All API endpoints remain unchanged
- [ ] Routing structure preserved
- [ ] Data models untouched
- [ ] Business logic flows intact

---

## Implementation Notes

### Component Refactoring Approach
- Update existing UI components in `client/src/components/ui/`
- Apply design tokens globally via CSS variables
- Ensure backward compatibility with existing props
- Test each component in isolation

### Design Token Integration
- Define tokens in root CSS file or theme configuration
- Use CSS custom properties for runtime theming
- Ensure tokens are accessible in all component files

### Module Rendering Logic
- Implement client-side grouping function
- Parse lesson titles for module indicators
- Fallback to index-based grouping if no explicit modules
- Cache module structure per course to avoid re-computation

### Testing Guidelines
- Visual regression testing for all refactored screens
- Verify no functionality broken during styling changes
- Test responsive behavior across breakpoints
- Validate accessibility (color contrast, focus states)

---

## Glossary

- **Design Tokens**: Centralized style values (colors, spacing, etc.) used throughout the application
- **Modules**: Visual grouping of lessons derived from existing data without backend changes
- **Primary CTA**: Primary Call-to-Action button; the main action on a screen
- **Calm Aesthetic**: Design approach emphasizing readability, subtlety, and professionalism over brightness and playfulness
#### Scenario B: Implicit Grouping
- Group lessons by order index (e.g., every 4–6 lessons = one module)
- Assign sequential module numbers
- Generate descriptive module titles based on lesson themes

### Module Card Design

#### Visual Structure
- Container: Card with `--r-lg` radius, `--border`, padding 20px
- Title: H3 (18–20px, weight 600)
- Description: Short sentence, color `--muted`, 14px
- Progress bar: Thin (2–3px), color `--primary`
- Metadata: "Lessons: N • Completed: M" in `--muted-2`, 14px

#### Interaction
- Accordion-style expand/collapse
- Click to reveal lesson list
- Lessons rendered as clickable items with existing routing

#### Placement
- **Course Overview**: Display modules first, above individual lessons
- **Employee Courses Page**: Show modules before lesson list

### Implementation Constraints
- No new database entities
- No API changes
- No route modifications
- Purely client-side rendering based on existing lesson data

---

## Screen-Specific Design Specifications

### Authentication & Login

#### Visual Structure
- Centered card layout (max-width 440px)
- Card styling: `--surface`, `--border`, `--r-xl`, padding 40px
- Logo positioned above card
- Background: `--bg-soft` with optional subtle pattern

#### Form Elements
- Input fields: Standard text input design (44px height)
- Labels: 14px, weight 500, color `--text`
- Error messages: Below inputs, 14px, color `--error`
- Submit button: Primary button, full-width within card

#### States
- Loading: Spinner on button, inputs disabled
- Error: Input borders turn `--error`, message appears below
- Success: Brief success message before redirect

#### Consistency
- Must match global design token system
- Calm, professional appearance
- No bright colors or playful elements

---

### My Courses (Employee)

#### Page Layout
- Grid or list view of course cards
- Optional filter/search bar at top
- Responsive grid: 1 column (mobile), 2–3 columns (desktop)

#### Course Card Design

**Structure**
- Card component with `--r-lg`, padding 20px
- Title: H3 (18px, weight 600)
- Metadata row: Status badge + curator name, 14px, color `--muted`
- Progress bar: Thin (2–3px), positioned below metadata
- Action row: Flex layout, space-between

**Action Row**
- Left side: "Step X of Y" in `--muted`, 14px
- Right side: Secondary button "Continue →"

**Prohibited Styling**
- No full-width buttons
- No green outlines or borders
- No overly bright colors

#### Join Course Feature

**Trigger**
- Button: "+ Join Course" (secondary or ghost style)
- Positioned prominently but not overwhelming (e.g., top-right)

**Modal**
- Centered modal with `--r-xl`, padding 32px
- Title: "Join a Course"
- Input: Text field for course code
- Actions: Primary "Join" button + ghost "Cancel"

---

### Course Overview

#### Layout Priority
- **First**: Modules section (accordion or card grid)
- **Second**: Individual lessons (if not grouped into modules)
- **Third**: Course metadata and actions

#### Header Section
- Course title: H1
- Course description: Base text, color `--muted`
- Curator info: Small metadata row

#### Modules Section
- Display module cards as defined in Modules Feature
- Allow expand/collapse to reveal lesson list
- Each lesson item links to existing player route

#### Actions
- Secondary button: "Edit Training" (visible to curators only)
- Routes to existing editor without logic changes

---

### Lesson Player

#### Layout Philosophy
- **Readability First**: Single-column, max-width ~820px, centered
- Generous whitespace between elements
- Clear visual hierarchy

#### Header
- Progress bar: Top of screen, thin (2–3px), full-width
- Step counter: "Lesson X of Y" below progress bar, 14px, `--muted`

#### Content Area
- Lesson title: H2
- Lesson content: Base text, optimal line length
- Media embeds: Max-width container, aspect ratio preserved

#### Voice Narration

**Default Behavior**
- NO autoplay
- Button: "🔊 Narrate" (secondary or ghost style)
- Positioned near lesson title or top-right

**Voice Input**
- Microphone button at bottom or in input area
- Label: "Hold to speak"
- Visual indicator during recording
- **Constraint**: Never overwrite typed text
- Append or replace only upon user confirmation

#### Drill Mode → "Reinforcement"

**Terminology Change**
- Replace "Drill" with "Reinforcement" throughout UI

**Structure**
1. **Why Incorrect**: Explanation in calm tone, color `--muted`
2. **Correct Approach**: Clear guidance, base text
3. **Attempt Indicator**: "Attempt 1 of 2" in `--muted-2`

**Visual Treatment**
- Card-based layout
- Each section clearly separated
- No aggressive colors or warnings

#### Actions
- Primary button: "Continue" or "Submit" (single per screen)
- Secondary button: "Back" or "Skip" if applicable

---

### Analytics (Curator)

#### Layout
- Dashboard grid with calm card components
- Tables with clean styling, readable typography
- Charts with muted color palette

#### Data Visualization
- Use `--primary` sparingly in charts
- Prefer neutral grays with single accent color
- Ensure labels and axes are readable (14px, `--muted`)

#### Tables
- Header row: Background `--surface-soft`, text `--muted-2`, 12px uppercase
- Rows: Border-bottom 1px `--border`, padding 12px
- Hover: Background `--surface-soft`

#### Guidelines
- No decorative green elements
- Focus on data clarity and readability
- Accurate-looking layout without gamification

---

### Additional Screens

#### Curator Dashboard
- Module cards showing course overview
- Quick actions with secondary buttons
- Statistics cards with calm styling

#### Settings Pages
- Form-based layouts with standard inputs
- Clear section headings
- Save button as primary CTA

#### Profile Pages
- Avatar, user info in clean card layout
- Editable fields with standard inputs
- Consistent with overall design system

---

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px – 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Sidebar collapses to hamburger menu
- Course cards stack in single column
- Button heights reduce to 44px
- Modal padding reduces to 24px

### Touch Targets
- Minimum 44px height for all interactive elements
- Adequate spacing between touch targets (8px minimum)

---

## Acceptance Criteria

### Visual Consistency
- [ ] All screens use design token system
- [ ] Typography hierarchy is consistent
- [ ] Spacing follows 4px/8px grid system
- [ ] Button system adhered to (only one primary per screen)

### Calm Aesthetic
- [ ] Not colorful or bright
- [ ] Green used only for actions, focus, selection
- [ ] Readable immediately upon viewing
- [ ] Buttons don't visually "shout"

### Enterprise Feel
- [ ] Not game-like
- [ ] Professional and confident
- [ ] Every screen looks like same product
- [ ] Premium quality in details

### Modules Feature
- [ ] Modules appear cleanly without logic/route/data changes
- [ ] Derived from existing lesson metadata
- [ ] Accordion or expandable interaction
- [ ] Positioned correctly on relevant screens

### No Logic Changes
- [ ] All API endpoints remain unchanged
- [ ] Routing structure preserved
- [ ] Data models untouched
- [ ] Business logic flows intact

---

## Implementation Notes

### Component Refactoring Approach
- Update existing UI components in `client/src/components/ui/`
- Apply design tokens globally via CSS variables
- Ensure backward compatibility with existing props
- Test each component in isolation

### Design Token Integration
- Define tokens in root CSS file or theme configuration
- Use CSS custom properties for runtime theming
- Ensure tokens are accessible in all component files

### Module Rendering Logic
- Implement client-side grouping function
- Parse lesson titles for module indicators
- Fallback to index-based grouping if no explicit modules
- Cache module structure per course to avoid re-computation

### Testing Guidelines
- Visual regression testing for all refactored screens
- Verify no functionality broken during styling changes
- Test responsive behavior across breakpoints
- Validate accessibility (color contrast, focus states)

---

## Glossary

- **Design Tokens**: Centralized style values (colors, spacing, etc.) used throughout the application
- **Modules**: Visual grouping of lessons derived from existing data without backend changes
- **Primary CTA**: Primary Call-to-Action button; the main action on a screen
- **Calm Aesthetic**: Design approach emphasizing readability, subtlety, and professionalism over brightness and playfulness#### Scenario B: Implicit Grouping
- Group lessons by order index (e.g., every 4–6 lessons = one module)
- Assign sequential module numbers
- Generate descriptive module titles based on lesson themes

### Module Card Design

#### Visual Structure
- Container: Card with `--r-lg` radius, `--border`, padding 20px
- Title: H3 (18–20px, weight 600)
- Description: Short sentence, color `--muted`, 14px
- Progress bar: Thin (2–3px), color `--primary`
- Metadata: "Lessons: N • Completed: M" in `--muted-2`, 14px

#### Interaction
- Accordion-style expand/collapse
- Click to reveal lesson list
- Lessons rendered as clickable items with existing routing

#### Placement
- **Course Overview**: Display modules first, above individual lessons
- **Employee Courses Page**: Show modules before lesson list

### Implementation Constraints
- No new database entities
- No API changes
- No route modifications
- Purely client-side rendering based on existing lesson data

---

## Screen-Specific Design Specifications

### Authentication & Login

#### Visual Structure
- Centered card layout (max-width 440px)
- Card styling: `--surface`, `--border`, `--r-xl`, padding 40px
- Logo positioned above card
- Background: `--bg-soft` with optional subtle pattern

#### Form Elements
- Input fields: Standard text input design (44px height)
- Labels: 14px, weight 500, color `--text`
- Error messages: Below inputs, 14px, color `--error`
- Submit button: Primary button, full-width within card

#### States
- Loading: Spinner on button, inputs disabled
- Error: Input borders turn `--error`, message appears below
- Success: Brief success message before redirect

#### Consistency
- Must match global design token system
- Calm, professional appearance
- No bright colors or playful elements

---

### My Courses (Employee)

#### Page Layout
- Grid or list view of course cards
- Optional filter/search bar at top
- Responsive grid: 1 column (mobile), 2–3 columns (desktop)

#### Course Card Design

**Structure**
- Card component with `--r-lg`, padding 20px
- Title: H3 (18px, weight 600)
- Metadata row: Status badge + curator name, 14px, color `--muted`
- Progress bar: Thin (2–3px), positioned below metadata
- Action row: Flex layout, space-between

**Action Row**
- Left side: "Step X of Y" in `--muted`, 14px
- Right side: Secondary button "Continue →"

**Prohibited Styling**
- No full-width buttons
- No green outlines or borders
- No overly bright colors

#### Join Course Feature

**Trigger**
- Button: "+ Join Course" (secondary or ghost style)
- Positioned prominently but not overwhelming (e.g., top-right)

**Modal**
- Centered modal with `--r-xl`, padding 32px
- Title: "Join a Course"
- Input: Text field for course code
- Actions: Primary "Join" button + ghost "Cancel"

---

### Course Overview

#### Layout Priority
- **First**: Modules section (accordion or card grid)
- **Second**: Individual lessons (if not grouped into modules)
- **Third**: Course metadata and actions

#### Header Section
- Course title: H1
- Course description: Base text, color `--muted`
- Curator info: Small metadata row

#### Modules Section
- Display module cards as defined in Modules Feature
- Allow expand/collapse to reveal lesson list
- Each lesson item links to existing player route

#### Actions
- Secondary button: "Edit Training" (visible to curators only)
- Routes to existing editor without logic changes

---

### Lesson Player

#### Layout Philosophy
- **Readability First**: Single-column, max-width ~820px, centered
- Generous whitespace between elements
- Clear visual hierarchy

#### Header
- Progress bar: Top of screen, thin (2–3px), full-width
- Step counter: "Lesson X of Y" below progress bar, 14px, `--muted`

#### Content Area
- Lesson title: H2
- Lesson content: Base text, optimal line length
- Media embeds: Max-width container, aspect ratio preserved

#### Voice Narration

**Default Behavior**
- NO autoplay
- Button: "🔊 Narrate" (secondary or ghost style)
- Positioned near lesson title or top-right

**Voice Input**
- Microphone button at bottom or in input area
- Label: "Hold to speak"
- Visual indicator during recording
- **Constraint**: Never overwrite typed text
- Append or replace only upon user confirmation

#### Drill Mode → "Reinforcement"

**Terminology Change**
- Replace "Drill" with "Reinforcement" throughout UI

**Structure**
1. **Why Incorrect**: Explanation in calm tone, color `--muted`
2. **Correct Approach**: Clear guidance, base text
3. **Attempt Indicator**: "Attempt 1 of 2" in `--muted-2`

**Visual Treatment**
- Card-based layout
- Each section clearly separated
- No aggressive colors or warnings

#### Actions
- Primary button: "Continue" or "Submit" (single per screen)
- Secondary button: "Back" or "Skip" if applicable

---

### Analytics (Curator)

#### Layout
- Dashboard grid with calm card components
- Tables with clean styling, readable typography
- Charts with muted color palette

#### Data Visualization
- Use `--primary` sparingly in charts
- Prefer neutral grays with single accent color
- Ensure labels and axes are readable (14px, `--muted`)

#### Tables
- Header row: Background `--surface-soft`, text `--muted-2`, 12px uppercase
- Rows: Border-bottom 1px `--border`, padding 12px
- Hover: Background `--surface-soft`

#### Guidelines
- No decorative green elements
- Focus on data clarity and readability
- Accurate-looking layout without gamification

---

### Additional Screens

#### Curator Dashboard
- Module cards showing course overview
- Quick actions with secondary buttons
- Statistics cards with calm styling

#### Settings Pages
- Form-based layouts with standard inputs
- Clear section headings
- Save button as primary CTA

#### Profile Pages
- Avatar, user info in clean card layout
- Editable fields with standard inputs
- Consistent with overall design system

---

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px – 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Sidebar collapses to hamburger menu
- Course cards stack in single column
- Button heights reduce to 44px
- Modal padding reduces to 24px

### Touch Targets
- Minimum 44px height for all interactive elements
- Adequate spacing between touch targets (8px minimum)

---

## Acceptance Criteria

### Visual Consistency
- [ ] All screens use design token system
- [ ] Typography hierarchy is consistent
- [ ] Spacing follows 4px/8px grid system
- [ ] Button system adhered to (only one primary per screen)

### Calm Aesthetic
- [ ] Not colorful or bright
- [ ] Green used only for actions, focus, selection
- [ ] Readable immediately upon viewing
- [ ] Buttons don't visually "shout"

### Enterprise Feel
- [ ] Not game-like
- [ ] Professional and confident
- [ ] Every screen looks like same product
- [ ] Premium quality in details

### Modules Feature
- [ ] Modules appear cleanly without logic/route/data changes
- [ ] Derived from existing lesson metadata
- [ ] Accordion or expandable interaction
- [ ] Positioned correctly on relevant screens

### No Logic Changes
- [ ] All API endpoints remain unchanged
- [ ] Routing structure preserved
- [ ] Data models untouched
- [ ] Business logic flows intact

---

## Implementation Notes

### Component Refactoring Approach
- Update existing UI components in `client/src/components/ui/`
- Apply design tokens globally via CSS variables
- Ensure backward compatibility with existing props
- Test each component in isolation

### Design Token Integration
- Define tokens in root CSS file or theme configuration
- Use CSS custom properties for runtime theming
- Ensure tokens are accessible in all component files

### Module Rendering Logic
- Implement client-side grouping function
- Parse lesson titles for module indicators
- Fallback to index-based grouping if no explicit modules
- Cache module structure per course to avoid re-computation

### Testing Guidelines
- Visual regression testing for all refactored screens
- Verify no functionality broken during styling changes
- Test responsive behavior across breakpoints
- Validate accessibility (color contrast, focus states)

---

## Glossary

- **Design Tokens**: Centralized style values (colors, spacing, etc.) used throughout the application
- **Modules**: Visual grouping of lessons derived from existing data without backend changes
- **Primary CTA**: Primary Call-to-Action button; the main action on a screen
