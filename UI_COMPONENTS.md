# UI_COMPONENTS.md
CityHelper – React + shadcn/ui Component Catalogue  
_Last updated: 2025-05-28_

---

## 1. Philosophy & Foundation

| Principle | Implementation |
|-----------|----------------|
| **Code-owned UI** | shadcn/ui copies component source into `web/src/components/ui`; we fully own & customise. |
| **Composable** | Prefer small, headless primitives (Radix) composed into feature components. |
| **Accessible by default** | All interactivity derived from Radix which provides keyboard nav & ARIA. |
| **Design-system driven** | Single Tailwind theme token file; dark-mode & high-contrast ready. |
| **Type-safe** | Strict TypeScript generics for prop modelling; exported component types. |

---

## 2. Directory Layout

```
web/src/
├── components/
│   ├── ui/             # shadcn primitives (auto-generated)
│   ├── common/         # generic composites reused across features
│   ├── layout/         # shell: Header, Sidebar, Footer
│   └── icons/          # Lucide-react icon wrappers
├── features/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignUpForm.tsx
│   ├── serviceRequest/
│   │   ├── RequestForm/
│   │   │   └── index.tsx
│   │   ├── RequestCard.tsx
│   │   └── RequestList.tsx
│   ├── map/
│   │   └── RequestMap.tsx
│   └── admin/
│       ├── DataTable.tsx
│       └── FiltersBar.tsx
└── lib/
    └── cn.ts          # `clsx`/`tailwind-merge` helper
```

---

## 3. Generating & Updating shadcn Components

```bash
pnpm dlx shadcn-ui@latest add button dialog input
```

* Components appear in `components/ui/*.tsx`.
* **Do not** edit inside `node_modules`.
* Keep patches minimal; if customisation large, wrap in `common/`.

---

## 4. Theming & Styling

### 4.1 Tailwind Tokens

`tailwind.config.ts` exposes semantic CSS variables:

```ts
theme: {
  extend: {
    colors: {
      primary: 'hsl(var(--primary))',
      surface: 'hsl(var(--surface))',
      ring: 'hsl(var(--ring))',
    },
    borderRadius: {
      lg: 'var(--radius)',
    },
  },
}
```

Tokens reside in `src/theme.css` (& injected into `<html>`).  
Dark mode toggles via `data-theme="dark"` attribute managed by `useTheme()` hook (`components/common/ThemeToggle.tsx`).

### 4.2 Custom Utility `cn`

Utility merges Tailwind classes avoiding duplicates:

```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Used throughout: `className={cn("grid gap-2", props.className)}`

---

## 5. Component Patterns

| Pattern | Description | Key shadcn/Radix Pieces |
|---------|-------------|-------------------------|
| **Forms** | Managed by `react-hook-form`, validated with `zodResolver` | `Input`, `Textarea`, `Select`, `FormField`, `Button` |
| **Modal Dialogs** | Confirm deletes, edit assets | `Dialog`, `DialogTrigger`, `DialogContent` |
| **Wizard / Stepper** | Multi-page requests | `Tabs` + internal context |
| **Data Table** | TanStack Table, sortable & paginated | `Table`, `DropdownMenu`, `Checkbox` |
| **Map Overlay** | Leaflet map with overlay panel | custom `MapPopover` (uses `Popover`) |
| **Toast / Alerts** | System notifications | `Toast` provider at root |
| **Tabs + Cards** | Admin dashboard segments | `Tabs`, `Card` |
| **Sheet** | Mobile off-canvas filters | `Sheet`, `SheetContent` |

---

## 6. Accessibility (a11y)

1. All Radix primitives ship with correct ARIA roles.  
2. Maintain colour contrast ratio ≥ 4.5:1 (tokens enforced).  
3. Every interactive element: keyboard focus ring `outline-ring` via Tailwind.  
4. Use `VisuallyHidden` for icon-only buttons.  
5. Localization: components read text from `react-i18next` resources.  
6. Motion: respect `prefers-reduced-motion`; animations via `@radix-ui/react-tooltip` honour prop.

---

## 7. Component Specification Template

For any **new component**, add markdown under `docs/components/`:

```
### <ComponentName>

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| id | string | — | Stable identifier |

Usage:

<RequestCard request={request} onSelect={...} />
```

---

## 8. Key Components Details

### 8.1 `RequestForm`

* **LocationPicker** sub-component integrates Mapbox autocomplete + draggable pin.  
* Steps: Category → Details → Location → Review.  
* On submit: `mutation` via TanStack Query; optimistic UI.

### 8.2 `RequestCard`

Card displaying status, category icon, partial description; colour coded by `status`.  
Interactive (`role=button`) – opens `Dialog` with full info.

### 8.3 `DataTable`

Props:

| name | type | description |
|------|------|-------------|
| `columns` | `ColumnDef<T>[]` | TanStack column defs |
| `data` | `T[]` | row data |
| `onRowClick?` | `(row: T) => void` | optional |

Features: column visibility toggle, CSV export, server-side pagination.

---

## 9. Storybook

Run `pnpm storybook`.  
Stories live next to components: `Component.stories.tsx`.  
Use **Controls** for all boolean/string props; visual regression tested via Chromatic.

---

## 10. Testing Strategy

| Layer | Tool | Guideline |
|-------|------|-----------|
| Unit | `vitest` + RTL | Assert DOM roles, label associations, aria-attributes. |
| Interaction | `@testing-library/user-event` | Tab order & keyboard nav. |
| Visual | Storybook + Chromatic | Snapshot on PR. |

---

## 11. Performance Considerations

* Split shadcn components by route via React.lazy (`Loadable`).  
* Use `autoAnimate` for list transitions instead of heavy libraries.  
* Memoize icon imports using `react-icons/lu` dynamic import.

---

## 12. Migration & Updates

1. Track upstream shadcn commit diff.  
2. Run `shadcn-ui@latest sync` quarterly.  
3. Review breaking changes with visual regression tests before merge.

---

## 13. Component Checklist (DoD)

- [ ] Written in TSX, typed props.  
- [ ] Storybook story added.  
- [ ] Unit test covers happy path & a11y.  
- [ ] Dark mode verified.  
- [ ] Responsive at mobile (≥ 360 px) & desktop.  
- [ ] Included in Figma library sync.  

---

_End of UI Components Document_
