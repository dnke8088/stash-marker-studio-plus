# Spec: Shot Boundary Enable/Disable Toggle

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add an `enabled` boolean to `ShotBoundaryConfig` (default `false`) so users can explicitly enable or disable shot boundary detection. When disabled, all shot boundary UI controls are hidden. When enabled, the config page marks all four tag fields as required.

## Scope

- Add `enabled: boolean` to `ShotBoundaryConfig` type and Redux slice
- Add toggle switch to shot boundary config page
- Gate shot boundary UI in search page and marker page header on `enabled`
- Timeline shot boundary markers are unaffected (data is never hidden)

---

## 1. Data Model

### `src/serverConfig.ts`

Add `enabled: boolean` to `ShotBoundaryConfig`:

```ts
export interface ShotBoundaryConfig {
  enabled: boolean;
  aiTagged: string;
  shotBoundary: string;
  sourceShotBoundaryAnalysis: string;
  shotBoundaryProcessed: string;
}
```

### `src/store/slices/configSlice.ts`

- Add `enabled: false` to `initialState.shotBoundaryConfig` (required — without it `tsc --noEmit` fails due to interface mismatch):

```ts
shotBoundaryConfig: {
  enabled: false,
  aiTagged: '',
  shotBoundary: '',
  sourceShotBoundaryAnalysis: '',
  shotBoundaryProcessed: '',
},
```

- Update `setShotBoundaryConfig` payload type to include `enabled: boolean`
- Update `setFullConfig` to normalise missing `enabled`. Note: `shotBoundaryConfig` is always present in saved files because it is a required field in `AppConfig` and has been since the app's initial release — nullish guard is still added defensively:

```ts
setFullConfig: (state, action: PayloadAction<AppConfig>) => {
  const markerGroups = state.markerGroups;
  const loaded = { ...action.payload, isLoaded: true, markerGroups };
  if (loaded.shotBoundaryConfig) {
    loaded.shotBoundaryConfig.enabled = loaded.shotBoundaryConfig.enabled ?? false;
  }
  return loaded;
},
```

- Add selector: `export const selectShotBoundaryEnabled = (state: { config: ConfigState }) => state.config.shotBoundaryConfig.enabled ?? false`

All reads of `enabled` throughout the codebase must go through `selectShotBoundaryEnabled` — never read `shotBoundaryConfig.enabled` directly — so the `?? false` fallback is always applied.

---

## 2. Config Page (`src/app/config/shot-boundary/page.tsx`)

### Form state

Add `enabled` to `formData`:

```ts
const [formData, setFormData] = useState({
  enabled: false,
  shotBoundary: "",
  sourceShotBoundaryAnalysis: "",
  aiTagged: "",
  shotBoundaryProcessed: "",
});
```

The existing `useEffect` that seeds form state from Redux must coerce `enabled`:

```ts
useEffect(() => {
  setFormData({ ...shotBoundaryConfig, enabled: shotBoundaryConfig.enabled ?? false });
}, [shotBoundaryConfig]);
```

Add a separate handler for the boolean toggle (the existing `handleInputChange` handles strings only):

```ts
const handleToggleChange = (field: string, value: boolean) => {
  setFormData((prev) => ({ ...prev, [field]: value }));
};
```

### Toggle UI

At the top of the "Shot Boundary Detection" card, add a toggle switch row before the tag fields:

- Label: **"Enable Shot Boundary Detection"**
- Implemented as a styled `<input type="checkbox">` rendered as a pill switch
- Bound to `formData.enabled` via `handleToggleChange("enabled", e.target.checked)`

### Tag fields when disabled

When `formData.enabled === false`:
- Wrap the four tag fields in a div with `className="opacity-50 pointer-events-none"`
- Fields remain visible (user can pre-configure before enabling)

### Required indicators when enabled

When `formData.enabled === true` and a field is empty, show next to the label:
```tsx
<span className="text-red-400 text-xs ml-1">Required</span>
```
And apply `border-red-500` to that field's `className` instead of `border-gray-600`.

The four required fields: `shotBoundary`, `sourceShotBoundaryAnalysis`, `shotBoundaryProcessed`, `aiTagged`.

### Save behaviour

Save always works regardless of validation state — the required indicators are informational only. The `formData` (including `enabled`) is saved as `shotBoundaryConfig` in `app-config.json`. For old installs without `enabled` in the file, the first save will write the current form value (default `false`), completing the migration naturally — no separate migration step is needed.

---

## 3. Search Page (`src/app/search/page.tsx`)

Read `selectShotBoundaryEnabled` from Redux (in addition to the existing `selectShotBoundaryConfig`).

**Detect Shots button**: The existing `showBulkDetectButton` condition:
```ts
const showBulkDetectButton = !!shotBoundaryProcessedId && scenes.length > 0;
```
Add `shotBoundaryEnabled` as an additional AND condition:
```ts
const showBulkDetectButton = shotBoundaryEnabled && !!shotBoundaryProcessedId && scenes.length > 0;
```
The `!!shotBoundaryProcessedId` guard remains — if the feature is enabled but tags aren't configured yet, the button stays hidden rather than showing and failing at runtime.

**🎥 shot count on thumbnails**: Wrap the `<span>` in `{shotBoundaryEnabled && (...)}`.

---

## 4. Marker Page Header

### `src/components/marker/MarkerPageHeader.tsx`

Add `shotBoundaryEnabled: boolean` to the props interface. Keep `isShotBoundaryProcessed`, `isDetectingShots`, and `onDetectShots` as required props (no type change to those). Wrap the Detect Shots button in `{shotBoundaryEnabled && (...)}`.

### `src/app/marker/[sceneId]/page.tsx`

Read `selectShotBoundaryEnabled` and pass as `shotBoundaryEnabled={shotBoundaryEnabled}` to `<MarkerPageHeader>`.

---

## 5. Backward Compatibility

- Old `app-config.json` without `enabled`: `setFullConfig` normalises to `false`, selector applies `?? false` fallback — feature is off by default for existing installs.
- First save from the config page writes `enabled` to the file, completing migration transparently.
- No migration script needed.

---

## Files to Change

| File | Change |
|------|--------|
| `src/serverConfig.ts` | Add `enabled: boolean` to `ShotBoundaryConfig` |
| `src/store/slices/configSlice.ts` | Default `enabled: false`, normalise in `setFullConfig`, update `setShotBoundaryConfig` payload type, add `selectShotBoundaryEnabled` |
| `src/app/config/shot-boundary/page.tsx` | Add `enabled` to form state, seed coercion, toggle UI, dim fields, required indicators |
| `src/app/search/page.tsx` | Add `shotBoundaryEnabled` selector, gate button and 🎥 count |
| `src/components/marker/MarkerPageHeader.tsx` | Add `shotBoundaryEnabled` prop, wrap button |
| `src/app/marker/[sceneId]/page.tsx` | Read `selectShotBoundaryEnabled`, pass to `MarkerPageHeader` |
