# Search Page Scene Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "Showing X of Y scenes" below the filter chips on the search page when filters are active, where X is the true filtered count (not capped at 200) and Y is total scenes in Stash.

**Architecture:** Add `getTotalSceneCount()` to `StashappService`, fire it in parallel with `searchScenes` in the Redux thunk, store both counts in Redux state, and render the count line in the search page component.

**Tech Stack:** TypeScript, Redux Toolkit, Next.js, GraphQL (via StashappService)

---

### Task 1: Add `getTotalSceneCount()` to StashappService

**Files:**
- Modify: `src/services/StashappService.ts` (after the `searchScenes` method, around line 580)

- [ ] **Step 1: Add the method**

Insert the following method immediately after the closing brace of `searchScenes` (before `addApiKeysToMediaUrls`):

```ts
async getTotalSceneCount(): Promise<number> {
  const query = `
    query FindScenesCount {
      findScenes(filter: { per_page: 0 }) {
        count
      }
    }
  `;
  const result = await this.fetchGraphQL<{ data: { findScenes: { count: number } } }>(
    query,
    {}
  );
  return result.data.findScenes.count;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/StashappService.ts
git commit -m "feat: add getTotalSceneCount to StashappService"
```

---

### Task 2: Update Redux state and thunk in searchSlice

**Files:**
- Modify: `src/store/slices/searchSlice.ts`

- [ ] **Step 1: Add `filteredCount` and `totalCount` to `SearchState` interface**

Find the `SearchState` interface (around line 24). Add two fields to the `// Results` section:

```ts
// Results
scenes: SceneWithMarkers[];
filteredCount: number | null;
totalCount: number | null;
```

- [ ] **Step 2: Add the fields to `initialState`**

Find `initialState` (around line 54). Add after `scenes: []`:

```ts
filteredCount: null,
totalCount: null,
```

- [ ] **Step 3: Update the `searchScenes` thunk to fetch both in parallel and return counts**

Replace the current `searchScenes` thunk body (lines 113–137) with:

```ts
export const searchScenes = createAsyncThunk(
  'search/searchScenes',
  async (params: {
    query: string;
    selectedTags: SelectedTag[];
    sortField: SortField;
    sortDirection: 'ASC' | 'DESC';
  }) => {
    const includedTagIds = params.selectedTags
      .filter(tag => tag.type === 'included')
      .map(tag => tag.id);
    const excludedTagIds = params.selectedTags
      .filter(tag => tag.type === 'excluded')
      .map(tag => tag.id);

    const [scenesResult, totalCount] = await Promise.all([
      stashappService.searchScenes(
        params.query,
        includedTagIds,
        params.sortField,
        params.sortDirection,
        excludedTagIds
      ),
      stashappService.getTotalSceneCount(),
    ]);

    return {
      scenes: scenesResult.findScenes.scenes,
      filteredCount: scenesResult.findScenes.count,
      totalCount,
    };
  }
);
```

- [ ] **Step 4: Update `searchScenes.pending` to clear counts**

Find the `searchScenes.pending` case in `extraReducers` (around line 267). Add two lines to clear stale counts:

```ts
.addCase(searchScenes.pending, (state) => {
  state.loading = true;
  state.error = null;
  state.hasSearched = true;
  state.scenes = [];
  state.filteredCount = null;
  state.totalCount = null;
})
```

- [ ] **Step 5: Update `searchScenes.fulfilled` to store counts**

Find the `searchScenes.fulfilled` case (around line 274). Update it:

```ts
.addCase(searchScenes.fulfilled, (state, action) => {
  state.loading = false;
  state.scenes = action.payload.scenes;
  state.filteredCount = action.payload.filteredCount;
  state.totalCount = action.payload.totalCount;
})
```

- [ ] **Step 6: Add `selectSceneCounts` selector**

At the bottom of the selectors section (around line 320), add:

```ts
export const selectSceneCounts = (state: { search: SearchState }) => ({
  filteredCount: state.search.filteredCount,
  totalCount: state.search.totalCount,
});
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/store/slices/searchSlice.ts
git commit -m "feat: store filteredCount and totalCount in search Redux state"
```

---

### Task 3: Render the count line in the search page

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Import `selectSceneCounts`**

Find the import from `@/store/slices/searchSlice` at the top of the file. Add `selectSceneCounts` to the named imports:

```ts
import {
  initializeSearch,
  searchScenes,
  setQuery,
  setSortField,
  toggleSortDirection,
  addSelectedTag,
  removeSelectedTag,
  setTagSearchQuery,
  updateTagSuggestions,
  selectSearchState,
  selectInitialized,
  selectInitializing,
  selectInitializationError,
  selectHasSearched,
  selectSceneCounts,
  SortField,
} from "@/store/slices/searchSlice";
```

- [ ] **Step 2: Select the counts in the component**

Add after the existing `useAppSelector` calls (around line 84):

```ts
const { filteredCount, totalCount } = useAppSelector(selectSceneCounts);
```

- [ ] **Step 3: Derive `hasFilters`**

Add immediately after the line above:

```ts
const hasFilters = query.trim().length > 0 || selectedTags.length > 0;
```

- [ ] **Step 4: Render the count line**

Find the error block in the JSX (around line 452):

```tsx
{error && (
  <div className="mb-4 p-3 bg-red-800 text-red-200 rounded">
    Error: {error}
  </div>
)}
```

Add the count line immediately after it:

```tsx
{!loading && hasFilters && filteredCount !== null && totalCount !== null && (
  <p className="text-sm text-gray-400 mb-4">
    Showing{" "}
    <span className="text-white font-semibold">
      {filteredCount.toLocaleString()}
    </span>{" "}
    of{" "}
    <span className="text-white font-semibold">
      {totalCount.toLocaleString()}
    </span>{" "}
    scenes
  </p>
)}
```

- [ ] **Step 5: Verify TypeScript compiles and lint passes**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Smoke test in the browser**

Start the dev server:

```bash
npm run dev
```

Navigate to the search page (http://localhost:3000/search):

1. No filters active → count line should not appear.
2. Type something in the search box → count line appears: "Showing X of Y scenes".
3. Clear the search box → count line disappears.
4. Add a tag filter → count line appears with filtered count.
5. Remove all tag filters and clear query → count line disappears.
6. Verify X reflects the true match count (not capped at 200) if you have more than 200 scenes.

- [ ] **Step 7: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat: show filtered/total scene count on search page"
```

---

### Task 4: Version bump

- [ ] **Step 1: Review commits since last tag**

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

This feature adds new UI behaviour — it's a minor version bump.

- [ ] **Step 2: Bump version**

```bash
npm version minor --no-git-tag-version
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```
