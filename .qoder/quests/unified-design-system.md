# Unified Design System for ADAPT

## Design Overview

This design document establishes a unified visual language for the entire ADAPT product, addressing visual inconsistencies and establishing a cohesive, professional UI/UX across all pages including Landing, Authentication, Dashboard, Course Management, Analytics, and Profile screens.

**Design Goals:**
- Create a single, consistent visual system across all ADAPT pages
- Reduce excessive use of lime accent color while maintaining brand identity
- Improve text readability and contrast throughout the application
- Establish uniform component behavior and styling
- Achieve "Apple-level clean" aesthetic: calm, minimalist, premium

**Scope Constraints:**
- UI/UX, styles, components, layout, and visual hierarchy only
- No changes to business logic, Supabase, authentication, routing, API, or email flows
- All modifications confined to client-side presentation layer

## Current State Analysis

### Identified Visual Issues

1. **Color Overuse:** Excessive lime green (`#C8F65D`) creates visual noise and breaks hierarchy
2. **Contrast Problems:** Text readability issues on dark/gradient backgrounds
3. **Inconsistent Identity:** Landing ≠ Auth ≠ App pages look like separate products
4. **Component Fragmentation:** Buttons, inputs, tabs, cards, badges, progress bars lack uniformity
5. **Variable Design Language:** Different radii, shadows, spacing, and states across pages
6. **Sidebar Inconsistency:** Mixed styles between curator and employee sidebars

### Current Design Token State

**Existing Palette (from index.css):**
- Primary Lime: `hsl(78 100% 61%)` → `#C8F65D`
- Sidebar is currently white/light, not dark
- Border radius: `--r-md: 14px`, `--r-lg: 18px`
- Shadows defined but inconsistently applied

## Design System Architecture

### 1. Design Tokens (Single Source of Truth)

All design tokens shall be defined as CSS custom properties in `/client/src/index.css` and referenced throughout the application via Tailwind configuration.

#### Color System

**Core Palette:**

| Token | Value (HSL) | Hex | Usage |
|-------|-------------|-----|-------|
| `--navy` | `224 32% 15%` | `#1A1A2E` | Dark sidebar background, text on accent |
| `--lime` | `78 95% 62%` | `#C8F65D` | Primary CTA, active states, success indicators |
| `--lime-hover` | `78 90% 58%` | `#B9E84D` | Hover state for lime buttons |
| `--lime-pressed` | `78 85% 54%` | `#AAD947` | Active/pressed state |
| `--lime-soft` | `78 95% 62% / 0.12` | `rgba(200, 246, 93, 0.12)` | Subtle backgrounds, tints |
| `--bg-base` | `0 0% 100%` | `#FFFFFF` | Main background |
| `--bg-soft` | `220 20% 98%` | `#FAFAFC` | Alternate background |
| `--surface` | `0 0% 100%` | `#FFFFFF` | Card surfaces |
| `--surface-soft` | `220 20% 97%` | `#F7F8FA` | Secondary surfaces |
| `--border` | `220 13% 91%` | `#E6E8EF` | Default borders |
| `--border-strong` | `220 13% 85%` | `#D2D5DD` | Emphasized borders |
| `--text-primary` | `215 25% 7%` | `#0B0F14` | Primary text |
| `--text-secondary` | `220 9% 36%` | `#667085` | Secondary/muted text |
| `--text-on-lime` | `224 32% 15%` | `#1A1A2E` | Text on lime backgrounds |
| `--text-on-dark` | `0 0% 100%` | `#FFFFFF` | Text on dark backgrounds |

**Semantic Colors:**

| Token | Value (HSL) | Usage |
|-------|-------------|-------|
| `--success` | `142 76% 36%` | Success states |
| `--warning` | `38 92% 50%` | Warning states |
| `--error` | `0 72% 51%` | Error states, destructive actions |
| `--info` | `221 83% 53%` | Informational states |

**Accent Usage Rules:**

1. Lime accent shall appear ONLY in:
   - Primary CTA buttons (one per screen maximum)
   - Active navigation states (subtle pill backgrounds)
   - Progress indicators and success badges
   - Small accent elements (icons, micro-interactions)

2. Lime accent shall NEVER appear as:
   - Large section backgrounds
   - Default card backgrounds
   - Body text color
   - Multiple competing CTAs on same screen

#### Typography

**Font Stack:**
- Primary: `Inter` (400, 500, 600, 700, 800 weights)
- Fallback: System UI stack
- Monospace: System monospace stack

**Type Scale:**

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| H1 | 48px (3rem) | 700 | 1.1 | -0.025em |
| H2 | 36px (2.25rem) | 700 | 1.15 | -0.02em |
| H3 | 24px (1.5rem) | 600 | 1.25 | -0.015em |
| Body Large | 18px (1.125rem) | 400 | 1.6 | 0 |
| Body | 16px (1rem) | 400 | 1.55 | 0 |
| Body Small | 14px (0.875rem) | 400 | 1.5 | 0 |
| Caption | 12px (0.75rem) | 500 | 1.4 | 0 |

**Responsive Typography:**
- Mobile (< 768px): Reduce H1 by 33%, H2 by 25%
- Maintain body text at 16px for readability

#### Layout & Spacing

**Spacing Scale (4px base unit):**
```
1 → 4px
2 → 8px
3 → 12px
4 → 16px
5 → 20px
6 → 24px
8 → 32px
10 → 40px
12 → 48px
16 → 64px
20 → 80px
```

**Layout Constraints:**
- Maximum content width: `1200px` (container)
- Section padding: `64px` vertical (mobile: `32px`)
- Card padding: `24px` (mobile: `16px`)
- Component spacing: `16px` default gap

**Border Radius:**

| Token | Value | Usage |
|-------|-------|-------|
| `--r-sm` | 8px | Small elements, badges |
| `--r-md` | 12px | Inputs, buttons |
| `--r-lg` | 16px | Cards, modals |
| `--r-xl` | 20px | Large containers |
| `--r-full` | 999px | Pills, avatar fallback |

**Elevation (Shadows):**

| Level | Token | Shadow Value | Usage |
|-------|-------|--------------|-------|
| 0 | None | None | Flush elements |
| 1 | `--shadow-xs` | `0 1px 2px rgba(11,15,20,0.04)` | Subtle lift |
| 2 | `--shadow-sm` | `0 4px 12px rgba(11,15,20,0.06)` | Cards default |
| 3 | `--shadow-md` | `0 8px 24px rgba(11,15,20,0.08)` | Cards hover, modals |
| 4 | `--shadow-lg` | `0 16px 40px rgba(11,15,20,0.10)` | Popovers, dropdowns |

#### Interaction States

**Focus:**
- Ring: `0 0 0 3px rgba(200, 246, 93, 0.25)` (lime with 25% opacity)
- Visible on keyboard navigation only (`:focus-visible`)

**Hover:**
- Subtle background change
- Border color intensification
- No dramatic color shifts

**Active/Pressed:**
- Scale transform: `scale(0.98)` for buttons
- Darker background for lime buttons

**Disabled:**
- Opacity: 50%
- Cursor: `not-allowed`
- Greyed out appearance

### 2. Component Library

All UI components shall be defined in `/client/src/components/ui/` following consistent patterns.

#### Button

**Variants:**

| Variant | Background | Text Color | Border | Usage |
|---------|------------|------------|--------|-------|
| Primary | `--lime` | `--text-on-lime` | None | Single CTA per screen |
| Secondary | `--surface` | `--text-primary` | `--border` | Secondary actions |
| Ghost | Transparent | `--text-primary` | None | Tertiary actions, toolbar |
| Destructive | `--error` | White | None | Delete, remove actions |
| Outline | Transparent | `--text-primary` | `--border` | Alternative secondary |

**Sizes:**

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 40px | 12px 16px | 14px |
| default | 48px | 16px 24px | 16px |
| lg | 56px | 20px 32px | 18px |

**States:**
- Default: Base styling with shadow-xs
- Hover: Lighter/darker shade, border-strong (if bordered)
- Active: Scale 0.98, pressed color variant
- Focus: Lime ring
- Disabled: 50% opacity, no hover
- Loading: Spinner icon, disabled state

**Implementation Pattern:**
```
Button uses class-variance-authority (CVA) for variant management.
Focus ring applied via focus-visible pseudo-class.
Active scale applied via transform utility.
```

#### Input / TextField

**Base Styling:**
- Height: 48px
- Border: 1px solid `--border`
- Border radius: `--r-md` (12px)
- Padding: 12px 16px
- Background: `--surface`
- Font size: 16px

**States:**

| State | Border | Background | Additional |
|-------|--------|------------|------------|
| Default | `--border` | `--surface` | Placeholder muted |
| Hover | `--border-strong` | `--surface` | Subtle transition |
| Focus | `--border-strong` | `--surface` | Lime focus ring |
| Error | `--error` | `--surface` | Red ring, error text below |
| Disabled | `--border` | `--surface-soft` | 50% opacity, no interaction |

**Label Pattern:**
- Label above input, 14px, medium weight, 8px gap
- Error message below input, 12px, error color, 4px gap

**Password Input:**
- Eye/EyeOff icon toggle positioned absolutely right side
- Icon color: muted, hover: primary
- Toggle does not affect input validation state

#### Tabs / Segmented Control

**Visual Pattern:**
- Container: `--surface-soft` background, 1.5px padding, `--r-md` radius
- Tab button: 12px vertical padding, 16px horizontal padding
- Active tab: `--surface` background, subtle shadow, `--text-primary`
- Inactive tab: Transparent, `--text-secondary`, hover lightens

**Behavior:**
- Smooth transition between states (150ms ease)
- Active indicator follows tab selection
- Keyboard navigable with arrow keys

**Usage Contexts:**
- Auth screen: Login/Register toggle
- Analytics: Overview/Courses/Employees/Topics
- Course filters: All/In Progress/Completed

#### Card

**Base Structure:**
- Background: `--surface`
- Border: 1px solid `--border`
- Border radius: `--r-lg` (16px)
- Padding: 24px
- Shadow: `--shadow-sm` default

**Hover State:**
- Shadow: `--shadow-md`
- Border: `--border-strong`
- Subtle lift transition (150ms)

**Variants:**

| Variant | Modification | Usage |
|---------|-------------|-------|
| Default | Standard styling | General content cards |
| Elevated | Always uses `--shadow-md` | Featured content |
| Flat | No shadow, only border | Nested cards, low emphasis |
| Interactive | Cursor pointer, hover lift | Clickable course cards |

**Internal Hierarchy:**
- CardHeader: 24px padding, 6px bottom gap
- CardTitle: H3 sizing, primary text
- CardDescription: Body small, secondary text
- CardContent: 24px padding, 0 top padding
- CardFooter: 24px padding, 0 top padding, flex row gap 12px

#### Badge / Chip

**Base Styling:**
- Height: 24px
- Padding: 4px 10px
- Border radius: `--r-sm` (8px)
- Font size: 12px, medium weight
- No border (unless outline variant)

**Semantic Variants:**

| Variant | Background | Text Color | Usage |
|---------|------------|------------|-------|
| Default | `--surface-soft` | `--text-primary` | Neutral labels |
| Success | `--lime-soft` | `--text-primary` | Active, complete status |
| Warning | `--warning` 10% alpha | `--warning` | Pending, review needed |
| Error | `--error` 10% alpha | `--error` | Failed, blocked status |
| Info | `--info` 10% alpha | `--info` | Informational tags |
| Outline | Transparent | `--text-primary` | Secondary tags with border |

**Usage Context:**
- Course step types: MCQ, Open, Roleplay
- Status indicators: Test, Open, Repeat, Completed
- Tags and categories

#### Progress Indicator

**Progress Bar:**
- Height: 8px
- Background: `--surface-soft`
- Fill: `--lime`
- Border radius: `--r-full` (pill shape)
- Transition: Smooth width animation (300ms ease)

**Circular Progress:**
- Stroke width: 8px
- Background stroke: `--border`
- Active stroke: `--lime`
- Size variants: 40px, 64px, 80px

**Text Display:**
- Percentage positioned adjacent to bar
- 14px, medium weight, primary text
- Format: "75%" or "6/8 completed"

#### Toast / Alert

**Toast (Temporary Notification):**
- Position: Bottom-right, 16px margin
- Max-width: 400px
- Background: `--surface`
- Border: 1px solid `--border`
- Shadow: `--shadow-lg`
- Border radius: `--r-md`
- Padding: 16px
- Auto-dismiss: 4 seconds

**Alert (Persistent Message):**
- Full width of container
- Padding: 16px
- Border radius: `--r-md`
- Icon left-aligned, 20px size
- Text aligned to icon baseline

**Variants:**

| Type | Background | Border | Icon | Usage |
|------|------------|--------|------|-------|
| Success | Success 10% alpha | Success | CheckCircle | Confirmation messages |
| Error | Error 10% alpha | Error | AlertCircle | Error feedback |
| Warning | Warning 10% alpha | Warning | AlertTriangle | Cautionary notes |
| Info | Info 10% alpha | Info | Info | Informational |

#### Table / List Row

**Table Structure:**
- Full width, border-collapse
- Header: `--surface-soft` background, 12px padding, bold 14px text
- Row: 16px vertical padding, border-bottom `--border`
- Cell: 12px horizontal padding, 16px vertical padding

**Row States:**
- Default: White background
- Hover: `--surface-soft` background, cursor pointer (if clickable)
- Selected: `--lime-soft` background

**Course Step List Pattern:**
- Row structure: `[Number] [Question/Title] [Type Badge] [Tags] [Actions]`
- Number: Monospace, muted, 40px width
- Question: Flex-1, truncate overflow
- Type badge: Fixed width badge
- Tags: Flex wrap, 8px gap
- Actions: Icon buttons, ghost variant

### 3. Page-Specific Design Specifications

#### A. Landing Page

**Current Issues:**
- Excessive lime green in hero and CTA sections
- Full-width lime background in bottom CTA overwhelming

**Design Solution:**

**Hero Section:**
- Background: `--bg-base` (white)
- Headline: H1, primary text with lime accent only on key phrase ("обучать команду")
- Subheadline: Body large, secondary text, max-width 600px
- CTA button: Primary variant, lime background (SINGLE CTA)
- Demo card: White card with subtle shadow, lime used sparingly for selected state

**Navigation:**
- Background: `--surface`, sticky, 64px height
- Logo: Lime accent square (40px) with "A", black text "ADAPT"
- Login link: Ghost button style, secondary text
- Sign-up button: Primary variant (lime)

**"How It Works" Section:**
- Background: `--bg-base`
- Three cards in grid layout
- Card styling: White surface, border, shadow-sm, hover shadow-md
- Step numbers: Lime accent circle (64px), black text
- Icons: Single color, consistent weight

**Bottom CTA Section:**
- REPLACE full-width lime background
- NEW design: White background with centered card container
- Card: Max-width 800px, centered, white surface, shadow-lg
- Headline: H2, primary text
- Description: Body large, secondary text
- CTA button: Primary variant centered

**Footer:**
- Background: `--surface-soft`
- Border-top: `--border`
- Height: 80px
- Text: Caption size, secondary color

#### B. Authentication Pages

**Unified Auth Layout:**

Left Panel (Desktop only, hidden on mobile):
- Width: 50% viewport
- Background: Gradient from `--navy` to lighter navy variant
- Decorative elements: Subtle blur circles (lime 10% alpha, white 5% alpha)
- Logo: Top-left, lime square + white text
- Content: Center-aligned max-width 480px
- Headline: H2, white text, leading-tight
- Description: Body large, white 70% alpha
- Footer: Caption, white 50% alpha

Right Panel:
- Width: 50% viewport (100% mobile)
- Background: `--bg-soft` (#F0F1F3)
- Content: Centered card, max-width 480px

**Auth Card:**
- Background: `--surface` (white)
- Border radius: `--r-xl` (20px)
- Shadow: `--shadow-lg`
- Padding: 32px

**Form Components:**
- Tabs: Segmented control style, Login/Register
- Inputs: Standard Input component (48px height)
- Labels: 14px medium weight, 8px gap above input
- Password toggle: Eye icon inside input, right-aligned
- Primary button: Full width, lime background, 48px height
- Error messages: 12px, error color, below field, 4px gap

**Role Selector:**
- Two-button grid layout
- Inactive: White background, border, secondary text
- Active: Lime soft background, lime border, primary text
- Height: 48px per button, 12px gap between

**Verification Pending Screen:**
- Icon: Mail icon in lime soft circle (64px)
- Headline: H2, "Подтвердите email"
- Email display: Gray card, monospace font, 16px
- Instructions: Body small, secondary text, centered
- Buttons: Primary (resend) + Secondary (change email)
- Cooldown state: Button disabled with countdown text
- Link: "Already verified? Login" as text button below

#### C. App Shell (Sidebar + Layout)

**Sidebar Specification:**

**Visual Design:**
- Background: `--navy` (#1A1A2E)
- Width: 240px expanded, 72px collapsed
- Height: 100vh, fixed position
- No border-right (seamless dark panel)
- Smooth width transition (200ms ease)

**Header Section:**
- Padding: 16px
- Logo: Lime square (40px) + white "ADAPT" text when expanded
- Menu toggle: Top-right when expanded, center when collapsed
- Icon: Menu icon, white 60% alpha, hover white 100%

**Navigation Items:**
- Height: 48px per item
- Border radius: 12px
- Spacing: 8px gap between items
- Icon: 20px, flex-shrink-0, always visible

Active State:
- Background: White
- Text: `--navy` (black)
- Icon: Black

Inactive State:
- Background: Transparent
- Text: White 80% alpha
- Icon: White 80% alpha
- Hover: White 10% alpha background, white text

**Footer Section:**
- Border-top: None (seamless)
- Padding: 16px
- User avatar: Lime background, 40px, initials in navy
- User info: Name (white), email (white 50% alpha), stacked
- Logout button: Ghost style matching inactive nav items

**Collapsed State:**
- All items centered, 56px width
- Tooltips appear on hover (right side, white background)
- Logo shows only "A" square
- Avatar shows without text
- Smooth animations for all transitions

**Main Content Area:**
- Left margin: 240px (expanded sidebar) or 72px (collapsed)
- Background: `--bg-soft`
- Padding: 32px
- Max-width content: 1200px centered

#### D. Dashboard (Мои курсы)

**Continue Learning Hero Block:**
- REMOVE lime background fill
- NEW: White card with border and shadow
- Height: 200px
- Padding: 32px
- Layout: Flex row, course info left, progress right
- Course title: H3, primary text
- Progress bar: Lime fill on neutral background
- CTA: Secondary button (not primary, since not primary action)

**Statistics Cards Grid:**
- Four cards: Total/In Progress/Completed/Average Progress
- Grid: 4 columns desktop, 2 columns tablet, 1 column mobile
- Card styling: Standard card component
- Metric number: H2 size, primary text
- Label: Body small, secondary text
- Icon: 40px, lime soft background circle, positioned top-right

**Filter Tabs:**
- Segmented control component
- Options: Все / В процессе / Завершено / Повторить
- Positioned above course list
- Full width on mobile, inline on desktop

**Search + Join Code Row:**
- Flex row layout, 16px gap
- Search input: Standard input with search icon left-aligned
- Join button: Secondary variant (not primary)
- Heights match: 48px

**Course Cards Grid:**
- Grid: 3 columns desktop, 2 tablet, 1 mobile
- Card hover: Lift effect with shadow-md
- Card padding: 24px
- Top: Icon (40px lime soft circle) + Join code badge (small, right-aligned)
- Title: H3, 2-line clamp
- Description: Body small, secondary text, 3-line clamp
- Footer: Divider + metadata (date, status badges)

#### E. Course Details Page

**Header Section:**
- Background: White card
- Padding: 32px
- Course title: H2, primary text
- Metadata row: Join code badge + status + date
- Actions: Edit button (secondary), Generate step (primary if needed)

**Step List Table:**
- Clean table structure with hover states
- Column headers: Number / Question / Type / Tags / Actions
- Row styling:
  - Default: White background, bottom border
  - Hover: Light gray background, pointer cursor
  - Height: 64px minimum for touch targets

**Step Row Components:**
- Number: Monospace, 48px width, centered, muted text
- Question: Truncate at 80 characters, tooltip on hover for full text
- Type badge: MCQ/Open/Roleplay using Badge component, appropriate variant
- Tags: Multiple badges, wrap if needed, 8px gap
- Actions: Icon buttons (edit, delete) ghost variant, 40px touch targets

**Edit Step Modal:**
- Modal: Max-width 800px, centered, white surface, shadow-lg
- Header: H3, close button top-right
- Form sections: Clear visual separation with dividers
- Input labels: Positioned above, bold, 8px gap
- Action buttons: Primary (save) + Secondary (cancel), right-aligned

#### F. Analytics Page

**Tab Navigation:**
- Main tabs: Обзор / По курсам / По сотрудникам / Проблемные темы
- Tabs component at page top below header

**Metric Cards:**
- Four-column grid (same as dashboard)
- Consistent card styling across all tabs
- Icons in lime soft circles
- Numbers prominent, labels secondary

**Charts & Graphs:**
- Background: White cards
- Chart colors: Primary (lime), secondary (teal), tertiary (blue)
- Avoid lime dominance: Use as accent within multi-color datasets
- Axis labels: 12px, secondary text
- Grid lines: Subtle, border color

**Table Views (Employee/Course Lists):**
- Standard table component with hover states
- Sortable headers: Icon indicating sort direction
- Progress bars in cells: Inline, 120px width, lime fill
- Action buttons: Ghost variant, right-aligned

#### G. Profile Page

**Profile Card:**
- Top card: White surface, shadow, 32px padding
- Avatar: 80px, lime background, initials or image
- Layout: Avatar left, info stacked right
- Name: H2
- Email: Body small, secondary
- Role badge: Positioned below email

**Metrics Grid:**
- Reuse statistics cards from dashboard
- User-specific metrics: Courses completed, hours spent, average score
- Same visual treatment: Icon + number + label

**Settings Section:**
- Form layout: Labels above inputs
- Input fields: Standard component
- Save button: Primary variant, positioned bottom-right
- Cancel button: Secondary variant

### 4. Responsive Design Strategy

**Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: ≥ 1024px

**Mobile Adaptations:**

1. **Sidebar:**
   - Converts to overlay drawer (slide from left)
   - Backdrop overlay when open
   - Close on navigation selection
   - Toggle button in top-left of main header

2. **Layout:**
   - Single column for all grid layouts
   - Reduced padding: 16px instead of 32px
   - Stack horizontal flex layouts vertically

3. **Typography:**
   - Scale down H1: 36px (from 48px)
   - Scale down H2: 28px (from 36px)
   - Maintain body at 16px for readability

4. **Cards:**
   - Full width minus container padding
   - Reduce internal padding: 16px (from 24px)

5. **Buttons:**
   - Full width in mobile forms
   - Maintain height for touch targets (48px minimum)

6. **Tables:**
   - Convert to card list view on mobile
   - Each row becomes a card with stacked content
   - Actions dropdown menu instead of inline buttons

### 5. Accessibility Standards

**Color Contrast:**
- All text shall meet WCAG AA standards minimum (4.5:1 for body, 3:1 for large text)
- Primary text on white: `#0B0F14` (18.5:1 ratio)
- Secondary text on white: `#667085` (5.8:1 ratio)
- Text on lime: Navy `#1A1A2E` (7.2:1 ratio)
- Never place secondary text on lime accent

**Keyboard Navigation:**
- All interactive elements must be keyboard accessible
- Visible focus indicators on all focusable elements (lime ring)
- Logical tab order following visual hierarchy
- Skip links for sidebar navigation

**Screen Reader Support:**
- Semantic HTML elements (nav, main, aside, article)
- ARIA labels for icon-only buttons
- ARIA live regions for toast notifications
- Alt text for decorative images marked as `aria-hidden="true"`

**Touch Targets:**
- Minimum size: 44px × 44px (WCAG AAA)
- Standard button height: 48px
- Adequate spacing between adjacent touch targets (8px minimum)

**Motion & Animation:**
- Respect `prefers-reduced-motion` media query
- Disable transitions when user prefers reduced motion
- No auto-playing animations without user control

### 6. Implementation Strategy

**Phase 1: Foundation (Token System)**
1. Update `/client/src/index.css` with corrected design tokens
2. Modify `tailwind.config.ts` to reference new token structure
3. Create utility classes for common patterns

**Phase 2: Component Library Rebuild**
1. Refactor existing components in `/client/src/components/ui/`:
   - Button (all variants)
   - Input/TextField
   - Card
   - Badge
   - Tabs
   - Progress
   - Toast/Alert
2. Create new shared components as needed
3. Document each component's API and variants

**Phase 3: Design System Showcase**
1. Create `/client/src/pages/design-system.tsx` route (dev only)
2. Display all colors, typography, spacing
3. Showcase every component variant with code examples
4. Interactive state demonstrations
5. Guarded by environment check: only accessible in development

**Phase 4: Page Migration (Sequential)**
1. Landing page redesign
2. Authentication pages (login, register, verification)
3. App shell (sidebar + layout wrapper)
4. Dashboard (curator and employee)
5. Course details/management
6. Analytics
7. Profile

**Phase 5: Responsive Testing & Polish**
1. Test all breakpoints for each page
2. Verify keyboard navigation and focus management
3. Screen reader testing
4. Cross-browser compatibility check
5. Performance optimization (remove unused CSS)

### 7. Development Guidelines

**CSS Organization:**
- Define all tokens in `:root` selector in `index.css`
- Use Tailwind utilities for composition, not inline styles
- Create custom utility classes for repeated patterns
- Avoid `!important` unless absolutely necessary

**Component Patterns:**
- Use CVA (class-variance-authority) for variant management
- Forward refs for form components (React Hook Form compatibility)
- Compound component patterns for complex UI (Card.Header, Card.Content)
- Consistent prop APIs across similar components

**State Management:**
- Visual state (hover, focus, active) via CSS pseudo-classes
- Interactive state (loading, disabled) via component props
- No business logic in UI components

**Testing Strategy:**
- Visual regression testing for component changes
- Verify all interactive states render correctly
- Check responsive behavior at all breakpoints
- Accessibility audit with axe-core

**File Naming:**
- Component files: kebab-case (e.g., `button.tsx`, `text-input.tsx`)
- Pages: kebab-case (e.g., `landing.tsx`, `course-details.tsx`)
- Utilities: kebab-case (e.g., `utils.ts`, `cn.ts`)

### 8. Quality Acceptance Criteria

**Visual Consistency:**
- [ ] All pages use identical button, input, card, and badge styling
- [ ] Lime accent appears sparingly, never overwhelming
- [ ] Sidebar consistent between curator and employee roles
- [ ] Typography hierarchy clear and consistent site-wide

**Contrast & Readability:**
- [ ] All text meets WCAG AA contrast ratios
- [ ] No text readability issues on any background
- [ ] Primary content area uses white or near-white backgrounds
- [ ] Dark backgrounds reserved for sidebar only

**Component Uniformity:**
- [ ] Buttons have consistent heights, padding, and radii
- [ ] Inputs share identical styling and state behaviors
- [ ] Cards use same shadows, borders, and hover effects
- [ ] Badges follow semantic color system

**Spacing & Rhythm:**
- [ ] Consistent spacing scale applied throughout
- [ ] Identical padding within similar component types
- [ ] Uniform gaps between related elements
- [ ] Predictable vertical rhythm in content areas

**Responsive Behavior:**
- [ ] Functional and visually correct at 375px, 768px, 1280px
- [ ] Sidebar converts to drawer on mobile
- [ ] Typography scales appropriately
- [ ] Touch targets minimum 44px on mobile

**Accessibility:**
- [ ] Keyboard navigation works throughout application
- [ ] Focus rings visible on all interactive elements
- [ ] Screen reader announces all UI changes correctly
- [ ] Respects user's reduced motion preference

**Performance:**
- [ ] No visual jank or layout shift during page load
- [ ] Smooth transitions and animations (60fps)
- [ ] Fast initial paint and interactive time

### 9. Deliverables

1. **Code Changes:**
   - Updated design token definitions in `index.css` and `tailwind.config.ts`
   - Refactored UI components in `/client/src/components/ui/`
   - Redesigned page components in `/client/src/pages/`
   - New design system showcase page at `/design-system` (dev only)

2. **Documentation:**
   - `UI_CHANGELOG.md`: Summary of all visual changes
   - Component API documentation in showcase page
   - Migration guide for future component usage

3. **Design System Showcase:**
   - Route: `/design-system` (development environment only)
   - Sections: Colors, Typography, Spacing, Components
   - Interactive component state viewer
   - Code snippets for each component variant

### 10. Success Metrics

**Qualitative:**
- Product feels cohesive and professional
- "Apple-level clean" aesthetic achieved
- Reduced visual noise and cognitive load
- Clear information hierarchy throughout

**Quantitative:**
- WCAG AA compliance: 100% of text elements
- Touch target compliance: 100% of interactive elements
- Cross-browser compatibility: Chrome, Firefox, Safari, Edge
- Performance budget: Largest Contentful Paint < 2.5s

## Design Rationale

**Why Minimal Lime Accent:**
The lime green (`#C8F65D`) is a strong, high-energy color that demands attention. Using it sparingly creates focal points and guides user actions without overwhelming the interface. Overuse leads to visual fatigue and dilutes its effectiveness as a CTA indicator.

**Why Dark Sidebar:**
The dark navy sidebar (`#1A1A2E`) creates clear spatial separation between navigation and content. This high-contrast approach improves scannability and provides a professional, premium aesthetic common in enterprise applications.

**Why White Content Backgrounds:**
White and near-white backgrounds maximize readability and reduce eye strain during extended use. They provide a neutral canvas that allows content and data to take center stage without competing with colorful backgrounds.

**Why Consistent Components:**
Uniform component behavior creates learned patterns for users, reducing cognitive load. When buttons, inputs, and cards behave predictably across the application, users can focus on tasks rather than decoding interface inconsistencies.

**Why 48px Button Height:**
This height meets WCAG AAA touch target guidelines (44px minimum) while providing comfortable click/tap areas. The additional 4px creates visual breathing room and improves the perceived quality of the interface.

**Why Inter Font:**
Inter is designed specifically for digital interfaces with optimized legibility at small sizes and on screens. Its consistent metrics and extensive character set make it ideal for enterprise applications with multilingual support.

## Migration Notes

**Backward Compatibility:**
- Existing component props remain unchanged where possible
- New variants added without breaking current usage
- Gradual migration path allows incremental updates

**Testing Checkpoints:**
- After Phase 2: Verify Storybook/showcase renders all components
- After each page migration: Visual regression test
- Before final merge: Full application accessibility audit

**Rollback Strategy:**
- Design tokens isolated in CSS variables (easy to revert)
- Component changes isolated to `/components/ui/` directory
- Page changes in separate commits for granular rollback

## Open Questions & Decisions Needed

1. **Design System Route Protection:** Should `/design-system` be password-protected or simply hidden in production builds?
   - **Recommendation:** Hidden in production via environment variable check

2. **Sidebar State Persistence:** Should sidebar collapsed/expanded state persist across sessions?
   - **Recommendation:** Store in localStorage per user preference

3. **Animation Duration Standard:** Should all transitions use consistent timing?
   - **Recommendation:** Yes - 150ms for micro-interactions, 300ms for larger transitions

4. **Mobile Sidebar Behavior:** Should mobile sidebar close on route change?
   - **Recommendation:** Yes - auto-close after navigation selection

5. **Dark Mode Support:** Is dark mode theme needed for future?
   - **Current Decision:** Out of scope for this design, but token structure allows future extension

## Conclusion

This unified design system establishes ADAPT as a cohesive, professional, and accessible learning platform. By constraining the lime accent, establishing consistent components, and defining clear design tokens, the product achieves visual maturity and operational clarity. The implementation strategy provides a structured path from foundation to completion while maintaining application stability throughout the migration process.
