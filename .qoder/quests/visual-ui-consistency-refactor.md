# Visual UI Consistency Refactor

## Overview

This design document outlines a comprehensive visual refactoring of the ADAPT application to achieve a premium, consistent, enterprise-grade user interface. The refactor targets visual consistency, styling improvements, and component standardization while maintaining all existing business logic, routing, and data flows.

## Design Principles

### 1. Visual-Only Scope
- No changes to business logic, API calls, routing, database schema, or data flows
- Preserve existing user flows and information architecture
- Modify only styling, layout spacing, component composition, visual states, typography, and icons
- Conditional UI rendering adjustments permitted for visual polish only

### 2. Premium Enterprise Aesthetic
- Modern, readable, calm professional appearance
- Inspired by reference (Unihunter-like): dark sidebar, clean white canvas, bold bright lime accents
- Color philosophy: BLACK + WHITE + LIME with calm neutrals
- No gamification features; corporate and calm language

### 3. Consistency Goals
- Single unified design system with centralized tokens
- All screens use identical shell metrics, spacing, and component styles
- Every page follows the same container width, padding, and vertical rhythm
- Components behave predictably across all contexts

## Current Problems Identified

### Visual Issues
1. **Weak Lime Accent**: Current lime (#A6E85B / HSL 83 66% 72%) is too pale and inconsistent across screens
2. **Cheap Borders**: Thin, harsh outlines create a wireframe/prototype appearance
3. **Inconsistent Spacing**: Different pages use different container widths, card padding, and layout metrics
4. **Landing Page Issues**: Partners section and buttons lack premium feel; appear random
5. **Uneven Shell Design**: Sidebar and topbar lines feel messy; excessive empty space on some pages

### Inconsistency Patterns
- Auth screen uses large flat green block; doesn't match app aesthetic
- Course cards have unequal heights and inconsistent structure
- Analytics page KPI cards differ in dimensions and typography
- Tab components vary in style across different pages
- Button hierarchies not enforced (multiple primary CTAs per screen)

## Design Token System

### Color Palette

#### Base & Surfaces
```
--bg: #FFFFFF
--bg-soft: #F6F7FB
--surface: #FFFFFF
--surface-2: #F3F5F8
```

#### Ink & Text (Dark)
```
--ink: #0B0F14
--ink-2: #111827
--muted: #4B5563
--muted-2: #6B7280
```

#### Borders (Use Sparingly)
```
--border: rgba(17,24,39,0.08)
--border-strong: rgba(17,24,39,0.14)
```

#### Lime Accent (Brighter, Premium)
```
--lime: #B9FF3B          /* Primary lime - actions/highlights */
--lime-hover: #A6F52A     /* Hover state */
--lime-soft: rgba(185,255,59,0.18)  /* Soft background */
--lime-pressed: #93E81F   /* Active/pressed state */
```

**Lime Usage Rules:**
- Use only for actions, focus states, highlights, and active navigation
- Never for entire page backgrounds
- Replaces current pale #A6E85B

#### Shadows (Replace Thin Borders)
```
--shadow-xs: 0 1px 1px rgba(11,15,20,0.04)
--shadow-sm: 0 6px 18px rgba(11,15,20,0.08)
--shadow-md: 0 14px 32px rgba(11,15,20,0.10)
```

**Shadow Strategy:**
- Primary elevation method instead of borders
- Use shadow-sm for cards, shadow-md for modals
- Combine with subtle border only when needed

#### Border Radii (Premium Balance)
```
--r-sm: 10px
--r-md: 14px
--r-lg: 18px
```

**Radius Rules:**
- Never exceed 18px (avoid cartoon appearance)
- Primary buttons: r-md (14px)
- Cards: r-lg (18px)
- Small elements: r-sm (10px)

#### Focus Ring
```
--focus: 0 0 0 3px rgba(185,255,59,0.28)
```

### Typography

#### Font Stack
- **Family**: Inter (everywhere)
- **Base Size**: 16px
- **Line Height**: 1.55

#### Heading Scale
```
H1: 32–36px / 700 weight / -0.025em tracking
H2: 24–28px / 700 weight / -0.025em tracking
H3: 18–20px / 600 weight / -0.025em tracking
```

#### Text Colors
```
--text-primary: var(--ink)
--text-secondary: var(--muted)
--text-tertiary: var(--muted-2)
```

### Layout Grid

#### App Shell Constants
```
Sidebar Width: 280px (desktop) | 72px (collapsed)
Topbar Height: 64px
Page Horizontal Padding: 24px (desktop) | 16px (mobile)
Max Content Width: 1200px (enforced everywhere)
Vertical Rhythm: 8px grid (multiples: 8, 16, 24, 32, 40, 48)
```

#### Spacing System
```
--space-1: 8px
--space-2: 16px
--space-3: 24px
--space-4: 32px
--space-5: 40px
--space-6: 48px
```

## Component System

### Button Hierarchy

#### Primary Button
- **Purpose**: Single primary action per view
- **Style**: 
  - Background: var(--lime)
  - Text: var(--ink)
  - Radius: r-md
  - Height: 44–48px
  - Shadow: shadow-xs
- **States**:
  - Hover: background --lime-hover
  - Active: background --lime-pressed, scale(0.98)
  - Focus: ring --focus
- **Enforcement**: Only one Primary button per screen

#### Secondary Button
- **Purpose**: Alternative actions
- **Style**:
  - Background: white
  - Text: var(--ink)
  - Border: 1px solid var(--border)
  - Shadow: shadow-xs
  - Radius: r-md
- **States**:
  - Hover: border-strong

#### Ghost Button
- **Purpose**: Tertiary actions, back/home controls
- **Style**:
  - Background: transparent
  - Text: var(--ink)
  - Radius: r-md
- **States**:
  - Hover: background rgba(11,15,20,0.04)

### Card Component

#### Standard Card
- **Structure**:
  - Background: white
  - Shadow: shadow-sm
  - Border: 1px solid var(--border) (optional)
  - Radius: r-lg
  - Padding: 16–20px
- **Hover State**:
  - Slightly stronger shadow
  - Border transitions to border-strong
  - No layout jump

#### Card Rules
- Equal heights within grid contexts where possible
- Consistent header structure across card types
- Remove thin dark borders; rely on shadows for elevation

### Tabs Component

#### Unified Tab Style
```
Container: soft background surface
Tab Item:
  - Height: 40px
  - Padding: 12px 16px
  - Radius: r-sm
  - Inactive: text muted, transparent
  - Active: bg lime-soft, text ink, shadow-xs
  - Hover: text foreground
```

**Consistency Rule**: Same tab component style everywhere (auth, analytics, course details)

### Input & Form Controls

#### Text Input
- **Style**:
  - Background: #F6F7FB
  - Border: 1px solid var(--border)
  - Radius: r-md
  - Height: 44px
  - Padding: 12px 16px
- **Focus State**:
  - Ring: var(--focus)
  - Border: var(--border-strong)
- **Helper Text**: color muted-2

#### Form Layout
- Label spacing: 8px above input
- Input spacing: 16px between fields
- Helper text: 4px below input

### Layout Primitives

#### AppShell
- **Purpose**: Consistent outer frame for all authenticated pages
- **Structure**:
  - Sidebar: 280px fixed (or collapsed)
  - Topbar: 64px height
  - Content area: flex-1 with padding

#### PageLayout
- **Purpose**: Standard page container
- **Structure**:
  - Max width: 1200px
  - Horizontal padding: 24px
  - Vertical padding: 32px
  - Centered horizontally

#### PageHeader
- **Purpose**: Consistent page title area
- **Structure**:
  - Height: 64px
  - Flex: title left, actions right
  - Bottom margin: 24px

#### ContentGrid
- **Purpose**: Card grid layout
- **Structure**:
  - Gap: 16px
  - Columns: responsive (1 → 2 → 3)
  - Items: equal height where possible

## Application Shell Redesign

### Sidebar

#### Visual Design
- **Background**: Deep ink gradient
  - From: #0B0F14
  - To: #101826
  - Subtle transition creates depth
- **Text**: White with muted states (opacity 0.72 for inactive)
- **Width**: 280px (desktop), 72px (collapsed)

#### Navigation Items
- **Inactive State**:
  - Text: white, opacity 0.72
  - Background: transparent
  - Icon: white, opacity 0.72
- **Hover State**:
  - Background: rgba(255,255,255,0.05)
  - No harsh borders
- **Active State**:
  - Background: var(--lime-soft)
  - Left indicator: 3px solid var(--lime)
  - Text: white, full opacity
  - Icon: lime color

#### Sidebar Footer
- User info card with avatar
- Logout button with ghost variant
- Border top: subtle separator

### Topbar

#### Structure
- **Height**: 64px fixed
- **Background**: white
- **Bottom divider**: 1px solid var(--border) OR shadow-xs (not both)
- **Content**: Page title, breadcrumbs, actions aligned

#### Separation Strategy
- Single clean separation between sidebar and content
- No double borders or stacked separators
- Use shadow OR border, not both

## Page-Specific Refactoring

### Landing Page

#### Partners Section
- **Current Problem**: Random-looking list, inconsistent logos
- **Solution**:
  - Render logos as grayscale/neutral (muted color)
  - Same height baseline alignment
  - Consistent horizontal spacing (16px gaps)
  - On hover: opacity 1.0, optional subtle lime underline
  - Clean "Trusted by" or "Works with" label
  - No links unless intentional

#### CTA Buttons
- **Current Problem**: Varying sizes, inconsistent styling
- **Solution**:
  - Primary CTA: lime background, clean icon, correct padding, shadow-xs
  - Remove oversized buttons; maintain hierarchy
  - Consistent radius (r-md for buttons, r-lg for hero CTA)
  - Icon size: 20-24px, 8px spacing from text

#### Hero Section
- Maintain current layout
- Ensure consistent spacing (24px vertical rhythm)
- Typography follows H1 scale
- CTA follows primary button spec

### Auth Page

#### Current Problems
- Large flat green block feels disconnected
- Doesn't match app aesthetic
- Tabs inconsistent with rest of app

#### Refactor Strategy

**Left Panel (Optional Decorative)**:
- Subtle lime-soft gradient wash instead of solid green
- Elegant minimal text if existing
- Maintain responsive behavior (hide on mobile)
- Match sidebar gradient philosophy

**Right Panel (Auth Card)**:
- Background: white
- Shadow: shadow-md
- Max width: 480px
- Padding: 48px
- Radius: r-lg

**Tabs (Login/Registration)**:
- Use global Tabs component style
- Background: surface-2
- Active: lime-soft background
- Height: 40px

**Inputs**:
- Follow global Input specification
- Height: 44px
- Consistent spacing

**Buttons**:
- Follow button hierarchy
- Primary for "Login" / "Register"
- Ghost for "Back" link

### My Courses (Curator & Employee)

#### Current Problems
- Cards with unequal heights
- Thin outlines look cheap
- Inconsistent spacing
- Page feels empty on some screens

#### Refactor Strategy

**Page Layout**:
- Use PageLayout primitive (1200px max width)
- PageHeader with title left, "Create" button right
- 24px padding, 32px vertical spacing

**Course Cards**:
- Equal height grid items
- Card specification:
  - Shadow: shadow-sm
  - Border: 1px solid var(--border)
  - Radius: r-lg
  - Padding: 20px
  - Hover: shadow-md, border-strong

**Card Header Row**:
- Icon: 40px circle, lime-soft background, lime icon
- Title: H3 scale
- Join code pill: inline, right-aligned, monospace font

**Card Content**:
- User count with icon
- Progress indicator (if applicable)
- Arrow icon (bottom right)

**Empty State**:
- Centered content
- Icon: 64px circle, lime-soft background
- CTA: Primary button

### Analytics Page

#### Current Problems
- KPI cards inconsistent dimensions
- Lime used incorrectly (whole borders)
- Charts container lacks polish
- Tabs differ from other pages

#### Refactor Strategy

**KPI Cards**:
- Consistent height: 120px
- Same padding: 24px
- Same typography: 
  - Label: 14px muted
  - Value: 32px bold ink
  - Change indicator: 14px with lime or error
- Lime highlight: small indicator pill only, not entire border

**Charts Container**:
- Card with shadow-sm
- Padding: 24px
- Correct spacing from KPIs (24px gap)

**Tabs Within Analytics**:
- Use global Tabs component
- Same height, padding, style as everywhere else

### General Back/Home Controls

#### Specification
- Small ghost button with arrow icon
- Position: consistent location in PageHeader
- Icon: 16px
- Spacing: 8px from text
- No border; hover background only

## Implementation Mapping

### CSS Variables Update
Map new design tokens to Tailwind theme in `tailwind.config.ts` and `index.css`:
- Update lime values to brighter palette
- Add shadow-xs, shadow-sm, shadow-md
- Update radius values to r-sm/md/lg
- Add ink, ink-2, muted, muted-2 colors

### Component Refactoring Sequence

1. **Shared UI Components** (`components/ui/`):
   - Update button variants with new styles
   - Update card component with shadow-first approach
   - Create or update tabs component
   - Update input component
   - Ensure focus rings use new --focus token

2. **Layout Primitives** (new or updated components):
   - AppShell component (sidebar + topbar + content)
   - PageLayout component (max-width container)
   - PageHeader component (title + actions)
   - ContentGrid component (responsive card grid)

3. **Sidebar Components**:
   - Update CuratorSidebar gradient background
   - Apply new active state styling
   - Update EmployeeSidebar with same pattern

4. **Page-by-Page Refactor**:
   - Landing page: partners section, CTAs, spacing
   - Auth page: remove flat green, apply new card styling
   - My Courses (curator): apply card specs, layout primitives
   - My Courses (employee): same treatment
   - Analytics: KPI cards, charts container, tabs
   - Course details: consistent spacing, tabs, cards
   - Player/join: consistent shell, buttons

### ClassNames Strategy
- Replace custom color values with token references
- Remove `border-black`, thin border patterns
- Replace with `shadow-sm`, `border border-border`
- Ensure all pages use `max-w-container` (1200px)
- Apply consistent padding classes

## Acceptance Criteria

### Visual Consistency
- [ ] UI looks like ONE product (no stitched-together appearance)
- [ ] Lime is brighter (#B9FF3B) and used only for actions/active/focus
- [ ] No wireframe-like thin outlines; cards feel premium
- [ ] All screens align to same width (1200px) and padding (24px)
- [ ] Tabs and cards are consistent across all pages

### Component Standards
- [ ] Only one Primary button per view
- [ ] All cards use shadow-sm with r-lg radius
- [ ] All inputs use same height (44px) and styling
- [ ] All tabs use same component and height (40px)
- [ ] Buttons follow 44-48px height standard

### Page-Specific
- [ ] Landing partners strip looks intentional and premium
- [ ] Auth screen matches rest of product (no flat green block)
- [ ] Course cards have equal heights and consistent structure
- [ ] Analytics KPI cards have uniform dimensions
- [ ] Sidebar uses gradient background with proper active states

### Technical
- [ ] No changes to business logic, routing, or API calls
- [ ] User flows remain identical
- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Focus states accessible and consistent
- [ ] Animations smooth (150-200ms transitions)

## Anti-Patterns to Avoid

### Forbidden Changes
- Modifying business logic or data flows
- Changing user flows or information architecture
- Altering routing structure
- Modifying database schemas or API contracts
- Adding new features or functionality

### Visual Anti-Patterns
- Using lime for large backgrounds
- Exceeding 18px border radius
- Multiple primary buttons on same screen
- Inconsistent container widths across pages
- Mixing shadow and thick border approaches
- Different card padding on different pages
- Different tab heights in different contexts

## Testing Considerations

### Visual Regression Testing
- Compare before/after screenshots of all pages
- Verify consistent spacing measurements
- Confirm color palette compliance
- Check focus states on all interactive elements

### Cross-Browser Testing
- Test gradient backgrounds (Safari, Firefox, Chrome)
- Verify shadow rendering consistency
- Confirm font rendering (Inter across browsers)

### Responsive Testing
- Mobile: sidebar collapse, touch targets ≥44px
- Tablet: card grid transitions (2 columns)
- Desktop: full layout with 280px sidebar

### Accessibility Testing
- Focus ring visibility on all interactive elements
- Color contrast ratios meet WCAG AA
- Touch targets meet minimum size requirements

## Migration Notes

### Incremental Rollout
This refactor can be implemented incrementally:
1. Phase 1: Design tokens and shared UI components
2. Phase 2: Layout primitives and shell (sidebar/topbar)
3. Phase 3: Page-by-page visual updates (landing, auth)
4. Phase 4: Authenticated pages (courses, analytics, player)

### Backward Compatibility
- No breaking changes to component APIs
- Props and behaviors remain unchanged
- Only className and style changes applied

### Performance Considerations
- Shadow rendering is GPU-accelerated (no performance impact)
- Gradient backgrounds are static (no animation overhead)
- CSS variables enable efficient theme management
  - Shadow: shadow-xs
- **States**:
  - Hover: background --lime-hover
  - Active: background --lime-pressed, scale(0.98)
  - Focus: ring --focus
- **Enforcement**: Only one Primary button per screen

#### Secondary Button
- **Purpose**: Alternative actions
- **Style**:
  - Background: white
  - Text: var(--ink)
  - Border: 1px solid var(--border)
  - Shadow: shadow-xs
  - Radius: r-md
- **States**:
  - Hover: border-strong

#### Ghost Button
- **Purpose**: Tertiary actions, back/home controls
- **Style**:
  - Background: transparent
  - Text: var(--ink)
  - Radius: r-md
- **States**:
  - Hover: background rgba(11,15,20,0.04)

### Card Component

#### Standard Card
- **Structure**:
  - Background: white
  - Shadow: shadow-sm
  - Border: 1px solid var(--border) (optional)
  - Radius: r-lg
  - Padding: 16–20px
- **Hover State**:
  - Slightly stronger shadow
  - Border transitions to border-strong
  - No layout jump

#### Card Rules
- Equal heights within grid contexts where possible
- Consistent header structure across card types
- Remove thin dark borders; rely on shadows for elevation

### Tabs Component

#### Unified Tab Style
```
Container: soft background surface
Tab Item:
  - Height: 40px
  - Padding: 12px 16px
  - Radius: r-sm
  - Inactive: text muted, transparent
  - Active: bg lime-soft, text ink, shadow-xs
  - Hover: text foreground
```

**Consistency Rule**: Same tab component style everywhere (auth, analytics, course details)

### Input & Form Controls

#### Text Input
- **Style**:
  - Background: #F6F7FB
  - Border: 1px solid var(--border)
  - Radius: r-md
  - Height: 44px
  - Padding: 12px 16px
- **Focus State**:
  - Ring: var(--focus)
  - Border: var(--border-strong)
- **Helper Text**: color muted-2

#### Form Layout
- Label spacing: 8px above input
- Input spacing: 16px between fields
- Helper text: 4px below input

### Layout Primitives

#### AppShell
- **Purpose**: Consistent outer frame for all authenticated pages
- **Structure**:
  - Sidebar: 280px fixed (or collapsed)
  - Topbar: 64px height
  - Content area: flex-1 with padding

#### PageLayout
- **Purpose**: Standard page container
- **Structure**:
  - Max width: 1200px
  - Horizontal padding: 24px
  - Vertical padding: 32px
  - Centered horizontally

#### PageHeader
- **Purpose**: Consistent page title area
- **Structure**:
  - Height: 64px
  - Flex: title left, actions right
  - Bottom margin: 24px

#### ContentGrid
- **Purpose**: Card grid layout
- **Structure**:
  - Gap: 16px
  - Columns: responsive (1 → 2 → 3)
  - Items: equal height where possible

## Application Shell Redesign

### Sidebar

#### Visual Design
- **Background**: Deep ink gradient
  - From: #0B0F14
  - To: #101826
  - Subtle transition creates depth
- **Text**: White with muted states (opacity 0.72 for inactive)
- **Width**: 280px (desktop), 72px (collapsed)

#### Navigation Items
- **Inactive State**:
  - Text: white, opacity 0.72
  - Background: transparent
  - Icon: white, opacity 0.72
- **Hover State**:
  - Background: rgba(255,255,255,0.05)
  - No harsh borders
- **Active State**:
  - Background: var(--lime-soft)
  - Left indicator: 3px solid var(--lime)
  - Text: white, full opacity
  - Icon: lime color

#### Sidebar Footer
- User info card with avatar
- Logout button with ghost variant
- Border top: subtle separator

### Topbar

#### Structure
- **Height**: 64px fixed
- **Background**: white
- **Bottom divider**: 1px solid var(--border) OR shadow-xs (not both)
- **Content**: Page title, breadcrumbs, actions aligned

#### Separation Strategy
- Single clean separation between sidebar and content
- No double borders or stacked separators
- Use shadow OR border, not both

## Page-Specific Refactoring

### Landing Page

#### Partners Section
- **Current Problem**: Random-looking list, inconsistent logos
- **Solution**:
  - Render logos as grayscale/neutral (muted color)
  - Same height baseline alignment
  - Consistent horizontal spacing (16px gaps)
  - On hover: opacity 1.0, optional subtle lime underline
  - Clean "Trusted by" or "Works with" label
  - No links unless intentional

#### CTA Buttons
- **Current Problem**: Varying sizes, inconsistent styling
- **Solution**:
  - Primary CTA: lime background, clean icon, correct padding, shadow-xs
  - Remove oversized buttons; maintain hierarchy
  - Consistent radius (r-md for buttons, r-lg for hero CTA)
  - Icon size: 20-24px, 8px spacing from text

#### Hero Section
- Maintain current layout
- Ensure consistent spacing (24px vertical rhythm)
- Typography follows H1 scale
- CTA follows primary button spec

### Auth Page

#### Current Problems
- Large flat green block feels disconnected
- Doesn't match app aesthetic
- Tabs inconsistent with rest of app

#### Refactor Strategy

**Left Panel (Optional Decorative)**:
- Subtle lime-soft gradient wash instead of solid green
- Elegant minimal text if existing
- Maintain responsive behavior (hide on mobile)
- Match sidebar gradient philosophy

**Right Panel (Auth Card)**:
- Background: white
- Shadow: shadow-md
- Max width: 480px
- Padding: 48px
- Radius: r-lg

**Tabs (Login/Registration)**:
- Use global Tabs component style
- Background: surface-2
- Active: lime-soft background
- Height: 40px

**Inputs**:
- Follow global Input specification
- Height: 44px
- Consistent spacing

**Buttons**:
- Follow button hierarchy
- Primary for "Login" / "Register"
- Ghost for "Back" link

### My Courses (Curator & Employee)

#### Current Problems
- Cards with unequal heights
- Thin outlines look cheap
- Inconsistent spacing
- Page feels empty on some screens

#### Refactor Strategy

**Page Layout**:
- Use PageLayout primitive (1200px max width)
- PageHeader with title left, "Create" button right
- 24px padding, 32px vertical spacing

**Course Cards**:
- Equal height grid items
- Card specification:
  - Shadow: shadow-sm
  - Border: 1px solid var(--border)
  - Radius: r-lg
  - Padding: 20px
  - Hover: shadow-md, border-strong

**Card Header Row**:
- Icon: 40px circle, lime-soft background, lime icon
- Title: H3 scale
- Join code pill: inline, right-aligned, monospace font

**Card Content**:
- User count with icon
- Progress indicator (if applicable)
- Arrow icon (bottom right)

**Empty State**:
- Centered content
- Icon: 64px circle, lime-soft background
- CTA: Primary button

### Analytics Page

#### Current Problems
- KPI cards inconsistent dimensions
- Lime used incorrectly (whole borders)
- Charts container lacks polish
- Tabs differ from other pages

#### Refactor Strategy

**KPI Cards**:
- Consistent height: 120px
- Same padding: 24px
- Same typography: 
  - Label: 14px muted
  - Value: 32px bold ink
  - Change indicator: 14px with lime or error
- Lime highlight: small indicator pill only, not entire border

**Charts Container**:
- Card with shadow-sm
- Padding: 24px
- Correct spacing from KPIs (24px gap)

**Tabs Within Analytics**:
- Use global Tabs component
- Same height, padding, style as everywhere else

### General Back/Home Controls

#### Specification
- Small ghost button with arrow icon
- Position: consistent location in PageHeader
- Icon: 16px
- Spacing: 8px from text
- No border; hover background only

## Implementation Mapping

### CSS Variables Update
Map new design tokens to Tailwind theme in `tailwind.config.ts` and `index.css`:
- Update lime values to brighter palette
- Add shadow-xs, shadow-sm, shadow-md
- Update radius values to r-sm/md/lg
- Add ink, ink-2, muted, muted-2 colors

### Component Refactoring Sequence

1. **Shared UI Components** (`components/ui/`):
   - Update button variants with new styles
   - Update card component with shadow-first approach
   - Create or update tabs component
   - Update input component
   - Ensure focus rings use new --focus token

2. **Layout Primitives** (new or updated components):
   - AppShell component (sidebar + topbar + content)
   - PageLayout component (max-width container)
   - PageHeader component (title + actions)
   - ContentGrid component (responsive card grid)

3. **Sidebar Components**:
   - Update CuratorSidebar gradient background
   - Apply new active state styling
   - Update EmployeeSidebar with same pattern

4. **Page-by-Page Refactor**:
   - Landing page: partners section, CTAs, spacing
   - Auth page: remove flat green, apply new card styling
   - My Courses (curator): apply card specs, layout primitives
   - My Courses (employee): same treatment
   - Analytics: KPI cards, charts container, tabs
   - Course details: consistent spacing, tabs, cards
   - Player/join: consistent shell, buttons

### ClassNames Strategy
- Replace custom color values with token references
- Remove `border-black`, thin border patterns
- Replace with `shadow-sm`, `border border-border`
- Ensure all pages use `max-w-container` (1200px)
- Apply consistent padding classes

## Acceptance Criteria

### Visual Consistency
- [ ] UI looks like ONE product (no stitched-together appearance)
- [ ] Lime is brighter (#B9FF3B) and used only for actions/active/focus
- [ ] No wireframe-like thin outlines; cards feel premium
- [ ] All screens align to same width (1200px) and padding (24px)
- [ ] Tabs and cards are consistent across all pages

### Component Standards
- [ ] Only one Primary button per view
- [ ] All cards use shadow-sm with r-lg radius
- [ ] All inputs use same height (44px) and styling
- [ ] All tabs use same component and height (40px)
- [ ] Buttons follow 44-48px height standard

### Page-Specific
- [ ] Landing partners strip looks intentional and premium
- [ ] Auth screen matches rest of product (no flat green block)
- [ ] Course cards have equal heights and consistent structure
- [ ] Analytics KPI cards have uniform dimensions
- [ ] Sidebar uses gradient background with proper active states

### Technical
- [ ] No changes to business logic, routing, or API calls
- [ ] User flows remain identical
- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Focus states accessible and consistent
- [ ] Animations smooth (150-200ms transitions)

## Anti-Patterns to Avoid

### Forbidden Changes
- Modifying business logic or data flows
- Changing user flows or information architecture
- Altering routing structure
- Modifying database schemas or API contracts
- Adding new features or functionality

### Visual Anti-Patterns
- Using lime for large backgrounds
- Exceeding 18px border radius
- Multiple primary buttons on same screen
- Inconsistent container widths across pages
- Mixing shadow and thick border approaches
- Different card padding on different pages
- Different tab heights in different contexts

## Testing Considerations

### Visual Regression Testing
- Compare before/after screenshots of all pages
- Verify consistent spacing measurements
- Confirm color palette compliance
- Check focus states on all interactive elements

### Cross-Browser Testing
- Test gradient backgrounds (Safari, Firefox, Chrome)
- Verify shadow rendering consistency
- Confirm font rendering (Inter across browsers)

### Responsive Testing
- Mobile: sidebar collapse, touch targets ≥44px
- Tablet: card grid transitions (2 columns)
- Desktop: full layout with 280px sidebar

### Accessibility Testing
- Focus ring visibility on all interactive elements
- Color contrast ratios meet WCAG AA
- Touch targets meet minimum size requirements

## Migration Notes

### Incremental Rollout
This refactor can be implemented incrementally:
1. Phase 1: Design tokens and shared UI components
2. Phase 2: Layout primitives and shell (sidebar/topbar)
3. Phase 3: Page-by-page visual updates (landing, auth)
4. Phase 4: Authenticated pages (courses, analytics, player)

### Backward Compatibility
- No breaking changes to component APIs
- Props and behaviors remain unchanged
- Only className and style changes applied

### Performance Considerations
- Shadow rendering is GPU-accelerated (no performance impact)
- Gradient backgrounds are static (no animation overhead)
- CSS variables enable efficient theme management
  - Shadow: shadow-xs
- **States**:
  - Hover: background --lime-hover
  - Active: background --lime-pressed, scale(0.98)
  - Focus: ring --focus
- **Enforcement**: Only one Primary button per screen

#### Secondary Button
- **Purpose**: Alternative actions
- **Style**:
  - Background: white
  - Text: var(--ink)
  - Border: 1px solid var(--border)
  - Shadow: shadow-xs
  - Radius: r-md
- **States**:
  - Hover: border-strong

#### Ghost Button
- **Purpose**: Tertiary actions, back/home controls
- **Style**:
  - Background: transparent
  - Text: var(--ink)
  - Radius: r-md
- **States**:
  - Hover: background rgba(11,15,20,0.04)

### Card Component

#### Standard Card
- **Structure**:
  - Background: white
  - Shadow: shadow-sm
  - Border: 1px solid var(--border) (optional)
  - Radius: r-lg
  - Padding: 16–20px
- **Hover State**:
  - Slightly stronger shadow
  - Border transitions to border-strong
  - No layout jump

#### Card Rules
- Equal heights within grid contexts where possible
- Consistent header structure across card types
- Remove thin dark borders; rely on shadows for elevation

### Tabs Component

#### Unified Tab Style
```
Container: soft background surface
Tab Item:
  - Height: 40px
  - Padding: 12px 16px
  - Radius: r-sm
  - Inactive: text muted, transparent
  - Active: bg lime-soft, text ink, shadow-xs
  - Hover: text foreground
```

**Consistency Rule**: Same tab component style everywhere (auth, analytics, course details)

### Input & Form Controls

#### Text Input
- **Style**:
  - Background: #F6F7FB
  - Border: 1px solid var(--border)
  - Radius: r-md
  - Height: 44px
  - Padding: 12px 16px
- **Focus State**:
  - Ring: var(--focus)
  - Border: var(--border-strong)
- **Helper Text**: color muted-2

#### Form Layout
- Label spacing: 8px above input
- Input spacing: 16px between fields
- Helper text: 4px below input

### Layout Primitives

#### AppShell
- **Purpose**: Consistent outer frame for all authenticated pages
- **Structure**:
  - Sidebar: 280px fixed (or collapsed)
  - Topbar: 64px height
  - Content area: flex-1 with padding

#### PageLayout
- **Purpose**: Standard page container
- **Structure**:
  - Max width: 1200px
  - Horizontal padding: 24px
  - Vertical padding: 32px
  - Centered horizontally

#### PageHeader
- **Purpose**: Consistent page title area
- **Structure**:
  - Height: 64px
  - Flex: title left, actions right
  - Bottom margin: 24px

#### ContentGrid
- **Purpose**: Card grid layout
- **Structure**:
  - Gap: 16px
  - Columns: responsive (1 → 2 → 3)
  - Items: equal height where possible

## Application Shell Redesign

### Sidebar

#### Visual Design
- **Background**: Deep ink gradient
  - From: #0B0F14
  - To: #101826
  - Subtle transition creates depth
- **Text**: White with muted states (opacity 0.72 for inactive)
- **Width**: 280px (desktop), 72px (collapsed)

#### Navigation Items
- **Inactive State**:
  - Text: white, opacity 0.72
  - Background: transparent
  - Icon: white, opacity 0.72
- **Hover State**:
  - Background: rgba(255,255,255,0.05)
  - No harsh borders
- **Active State**:
  - Background: var(--lime-soft)
  - Left indicator: 3px solid var(--lime)
  - Text: white, full opacity
  - Icon: lime color

#### Sidebar Footer
- User info card with avatar
- Logout button with ghost variant
- Border top: subtle separator

### Topbar

#### Structure
- **Height**: 64px fixed
- **Background**: white
- **Bottom divider**: 1px solid var(--border) OR shadow-xs (not both)
- **Content**: Page title, breadcrumbs, actions aligned

#### Separation Strategy
- Single clean separation between sidebar and content
- No double borders or stacked separators
- Use shadow OR border, not both

## Page-Specific Refactoring

### Landing Page

#### Partners Section
- **Current Problem**: Random-looking list, inconsistent logos
- **Solution**:
  - Render logos as grayscale/neutral (muted color)
  - Same height baseline alignment
  - Consistent horizontal spacing (16px gaps)
  - On hover: opacity 1.0, optional subtle lime underline
  - Clean "Trusted by" or "Works with" label
  - No links unless intentional

#### CTA Buttons
- **Current Problem**: Varying sizes, inconsistent styling
- **Solution**:
  - Primary CTA: lime background, clean icon, correct padding, shadow-xs
  - Remove oversized buttons; maintain hierarchy
  - Consistent radius (r-md for buttons, r-lg for hero CTA)
  - Icon size: 20-24px, 8px spacing from text

#### Hero Section
- Maintain current layout
- Ensure consistent spacing (24px vertical rhythm)
- Typography follows H1 scale
- CTA follows primary button spec

### Auth Page

#### Current Problems
- Large flat green block feels disconnected
- Doesn't match app aesthetic
- Tabs inconsistent with rest of app

#### Refactor Strategy

**Left Panel (Optional Decorative)**:
- Subtle lime-soft gradient wash instead of solid green
- Elegant minimal text if existing
- Maintain responsive behavior (hide on mobile)
- Match sidebar gradient philosophy

**Right Panel (Auth Card)**:
- Background: white
- Shadow: shadow-md
- Max width: 480px
- Padding: 48px
- Radius: r-lg

**Tabs (Login/Registration)**:
- Use global Tabs component style
- Background: surface-2
- Active: lime-soft background
- Height: 40px

**Inputs**:
- Follow global Input specification
- Height: 44px
- Consistent spacing

**Buttons**:
- Follow button hierarchy
- Primary for "Login" / "Register"
- Ghost for "Back" link

### My Courses (Curator & Employee)

#### Current Problems
- Cards with unequal heights
- Thin outlines look cheap
- Inconsistent spacing
- Page feels empty on some screens

#### Refactor Strategy

**Page Layout**:
- Use PageLayout primitive (1200px max width)
- PageHeader with title left, "Create" button right
- 24px padding, 32px vertical spacing

**Course Cards**:
- Equal height grid items
- Card specification:
  - Shadow: shadow-sm
  - Border: 1px solid var(--border)
  - Radius: r-lg
  - Padding: 20px
  - Hover: shadow-md, border-strong

**Card Header Row**:
- Icon: 40px circle, lime-soft background, lime icon
- Title: H3 scale
- Join code pill: inline, right-aligned, monospace font

**Card Content**:
- User count with icon
- Progress indicator (if applicable)
- Arrow icon (bottom right)

**Empty State**:
- Centered content
- Icon: 64px circle, lime-soft background
- CTA: Primary button

### Analytics Page

#### Current Problems
- KPI cards inconsistent dimensions
- Lime used incorrectly (whole borders)
- Charts container lacks polish
- Tabs differ from other pages

#### Refactor Strategy

**KPI Cards**:
- Consistent height: 120px
- Same padding: 24px
- Same typography: 
  - Label: 14px muted
  - Value: 32px bold ink
  - Change indicator: 14px with lime or error
- Lime highlight: small indicator pill only, not entire border

**Charts Container**:
- Card with shadow-sm
- Padding: 24px
- Correct spacing from KPIs (24px gap)

**Tabs Within Analytics**:
- Use global Tabs component
- Same height, padding, style as everywhere else

### General Back/Home Controls

#### Specification
- Small ghost button with arrow icon
- Position: consistent location in PageHeader
- Icon: 16px
- Spacing: 8px from text
- No border; hover background only

## Implementation Mapping

### CSS Variables Update
Map new design tokens to Tailwind theme in `tailwind.config.ts` and `index.css`:
- Update lime values to brighter palette
- Add shadow-xs, shadow-sm, shadow-md
- Update radius values to r-sm/md/lg
- Add ink, ink-2, muted, muted-2 colors

### Component Refactoring Sequence

1. **Shared UI Components** (`components/ui/`):
   - Update button variants with new styles
   - Update card component with shadow-first approach
   - Create or update tabs component
   - Update input component
   - Ensure focus rings use new --focus token

2. **Layout Primitives** (new or updated components):
   - AppShell component (sidebar + topbar + content)
   - PageLayout component (max-width container)
   - PageHeader component (title + actions)
   - ContentGrid component (responsive card grid)

3. **Sidebar Components**:
   - Update CuratorSidebar gradient background
   - Apply new active state styling
   - Update EmployeeSidebar with same pattern

4. **Page-by-Page Refactor**:
   - Landing page: partners section, CTAs, spacing
   - Auth page: remove flat green, apply new card styling
   - My Courses (curator): apply card specs, layout primitives
   - My Courses (employee): same treatment
   - Analytics: KPI cards, charts container, tabs
   - Course details: consistent spacing, tabs, cards
   - Player/join: consistent shell, buttons

### ClassNames Strategy
- Replace custom color values with token references
- Remove `border-black`, thin border patterns
- Replace with `shadow-sm`, `border border-border`
- Ensure all pages use `max-w-container` (1200px)
- Apply consistent padding classes

## Acceptance Criteria

### Visual Consistency
- [ ] UI looks like ONE product (no stitched-together appearance)
- [ ] Lime is brighter (#B9FF3B) and used only for actions/active/focus
- [ ] No wireframe-like thin outlines; cards feel premium
- [ ] All screens align to same width (1200px) and padding (24px)
- [ ] Tabs and cards are consistent across all pages

### Component Standards
- [ ] Only one Primary button per view
- [ ] All cards use shadow-sm with r-lg radius
- [ ] All inputs use same height (44px) and styling
- [ ] All tabs use same component and height (40px)
- [ ] Buttons follow 44-48px height standard

### Page-Specific
- [ ] Landing partners strip looks intentional and premium
- [ ] Auth screen matches rest of product (no flat green block)
- [ ] Course cards have equal heights and consistent structure
- [ ] Analytics KPI cards have uniform dimensions
- [ ] Sidebar uses gradient background with proper active states

### Technical
- [ ] No changes to business logic, routing, or API calls
- [ ] User flows remain identical
- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Focus states accessible and consistent
- [ ] Animations smooth (150-200ms transitions)

## Anti-Patterns to Avoid

### Forbidden Changes
- Modifying business logic or data flows
- Changing user flows or information architecture
- Altering routing structure
- Modifying database schemas or API contracts
- Adding new features or functionality

### Visual Anti-Patterns
- Using lime for large backgrounds
- Exceeding 18px border radius
- Multiple primary buttons on same screen
- Inconsistent container widths across pages
- Mixing shadow and thick border approaches
- Different card padding on different pages
- Different tab heights in different contexts

## Testing Considerations

### Visual Regression Testing
- Compare before/after screenshots of all pages
- Verify consistent spacing measurements
- Confirm color palette compliance
- Check focus states on all interactive elements

### Cross-Browser Testing
- Test gradient backgrounds (Safari, Firefox, Chrome)
- Verify shadow rendering consistency
- Confirm font rendering (Inter across browsers)

### Responsive Testing
- Mobile: sidebar collapse, touch targets ≥44px
- Tablet: card grid transitions (2 columns)
- Desktop: full layout with 280px sidebar

### Accessibility Testing
- Focus ring visibility on all interactive elements
- Color contrast ratios meet WCAG AA
- Touch targets meet minimum size requirements

## Migration Notes

### Incremental Rollout
This refactor can be implemented incrementally:
1. Phase 1: Design tokens and shared UI components
2. Phase 2: Layout primitives and shell (sidebar/topbar)
3. Phase 3: Page-by-page visual updates (landing, auth)
4. Phase 4: Authenticated pages (courses, analytics, player)

### Backward Compatibility
- No breaking changes to component APIs
- Props and behaviors remain unchanged
- Only className and style changes applied

### Performance Considerations
- Shadow rendering is GPU-accelerated (no performance impact)
- Gradient backgrounds are static (no animation overhead)
- CSS variables enable efficient theme management
