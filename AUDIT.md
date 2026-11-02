# TrackFlow Frontend Performance Audit

## Scope

This audit covers both TrackFlow frontends:

- Corporate website: `uis/website`
- Backoffice: `uis/backoffice`

The audit follows the required loop:

**measure -> analyse -> fix -> measure again**

All Lighthouse baseline measurements were taken against production builds. Development mode (`npm run dev` / `next dev`) was not used for the official measurements.

Baseline screenshots are stored under:

- `audit/before/`

The final comparison screenshots are stored under:

- `audit/after/`

---

## Audit Environment

### Corporate website

Production commands used:

```bash
cd uis/website
npm run build
npm run start
```

### Backoffice

Production commands used:

```bash
cd uis/backoffice
npm run build
npm run start -- -p 3001
```

The backoffice production build originally failed because the production TypeScript configuration included Jest test files. The `__tests__` directory and `*.test.ts(x)` files were excluded from the production TypeScript build. Jest remains configured separately and all tests still pass.

Test verification:

- 4 test suites passed
- 29 tests passed
- 0 failed

The backoffice login also required the browser-facing API base URL to use the Next.js `/backend` rewrite rather than `http://localhost:8000` when running through GitHub Codespaces.

---

# Initial Lighthouse Results

## Corporate Website - Homepage

### Desktop

| Metric | Result |
|---|---:|
| Performance | 98 |
| Accessibility | 96 |
| Best Practices | 96 |
| SEO | 63 |
| First Contentful Paint | 0.5 s |
| Largest Contentful Paint | 0.5 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0.079 |
| Speed Index | 0.5 s |

### Mobile

| Metric | Result |
|---|---:|
| Performance | 98 |
| Accessibility | 92 |
| Best Practices | 96 |
| SEO | 63 |
| First Contentful Paint | 1.8 s |
| Largest Contentful Paint | 1.8 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0.062 |
| Speed Index | 1.8 s |

### Issues identified

#### 1. Render-blocking requests

**Evidence:** Lighthouse reports render-blocking requests from the site stylesheet and Google Fonts.

- Desktop estimated savings: approximately 220 ms
- Mobile estimated savings: approximately 670 ms

**Root cause:** The page depends on external font CSS and the main stylesheet before the initial render can complete. Google Fonts also adds additional font-file requests to the critical path.

**Planned correction:** Review the font-loading strategy and critical CSS path. Prefer a solution that reduces external render-blocking work without restructuring the site.

#### 2. Network dependency chain from Google Fonts

**Evidence:** Lighthouse shows multiple `.woff2` files behind the Google Fonts stylesheet in the critical request chain.

**Root cause:** The browser must first fetch the Google Fonts stylesheet and then discover and fetch the font files.

**Planned correction:** Reduce or remove the external font dependency from the critical path, for example by using a system font stack or another targeted font-loading strategy.

#### 3. Images do not have explicit width and height

**Evidence:** Lighthouse identifies the following service images:

- `Images/Warehouse.jpg`
- `Images/last-mile delivery.png`
- `Images/Reverse logistics.jpg`

**Root cause:** The `<img>` elements do not reserve their final dimensions before the image resource loads. This can contribute to layout movement.

**Impact:** CLS is still within the healthy range, but explicit image dimensions would make the layout more stable and predictable.

**Planned correction:** Add explicit `width` and `height` attributes while preserving the responsive CSS behavior.

#### 4. Response compression is not applied

**Evidence:** Lighthouse reports "No compression applied" for the document response.

**Root cause:** The current serving path returns the static website content without compressed transfer encoding.

**Planned correction:** Review the production-serving path and apply compression where appropriate without changing the overall architecture.

#### 5. Mobile main-thread task

**Evidence:** Lighthouse reports one long main-thread task of approximately 124 ms on the homepage mobile run.

**Root cause:** The task was associated with initial page work. The page still has 0 ms Total Blocking Time, so this is a low-priority finding compared with the render-blocking and SEO issues.

**Planned correction:** Reassess after higher-impact corrections are applied.

---

## Corporate Website - Application / Form Page

### Desktop

| Metric | Result |
|---|---:|
| Performance | 99 |
| Accessibility | 96 |
| Best Practices | 100 |
| SEO | 60 |
| First Contentful Paint | 0.8 s |
| Largest Contentful Paint | 0.8 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0.001 |
| Speed Index | 0.8 s |

### Mobile

| Metric | Result |
|---|---:|
| Performance | 98 |
| Accessibility | 91 |
| Best Practices | 100 |
| SEO | 60 |
| First Contentful Paint | 2.0 s |
| Largest Contentful Paint | 2.0 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 2.0 s |

### Issues identified

#### 1. Render-blocking requests

**Evidence:** Lighthouse identifies the main stylesheet and Google Fonts as render-blocking.

- Desktop estimated savings: approximately 280 ms
- Mobile estimated savings: approximately 770 ms

**Root cause:** Same site-wide font and stylesheet loading pattern as the homepage.

**Planned correction:** Treat this as a shared website-level correction rather than a page-specific workaround.

#### 2. Network dependency chain

**Evidence:** Maximum critical-path latency is approximately:

- Desktop: 601 ms
- Mobile: 707 ms

**Root cause:** External font CSS and multiple font resources extend the critical request chain.

**Planned correction:** Reduce external font dependencies in the initial render path.

#### 3. JavaScript is not fully minified

**Evidence:** Lighthouse identifies `validation.js` with approximately 3.3 KiB estimated savings.

**Root cause:** The corporate website serves the JavaScript file directly as a static resource rather than through a normal JavaScript bundling/minification pipeline.

**Planned correction:** Apply a targeted minification strategy to the existing validation script. Do not rewrite the site architecture solely to fix this audit.

#### 4. Response compression is not applied

**Evidence:** Lighthouse reports that compression is not applied to the document response.

**Root cause:** Same production-serving behavior seen on the homepage.

**Planned correction:** Address at the serving/configuration level if feasible within the milestone scope.

#### 5. Mobile main-thread tasks

**Evidence:** Lighthouse reports several long tasks on the mobile form-page audit.

**Root cause:** Initial page/script work, including the form page's JavaScript, contributes to main-thread execution.

**Impact:** Total Blocking Time is still 0 ms, so this remains secondary to render-blocking, SEO, and accessibility findings.

---

## Backoffice - Inventory Products Page

### Desktop

| Metric | Result |
|---|---:|
| Performance | 100 |
| Accessibility | 96 |
| Best Practices | 100 |
| SEO | 60 |
| First Contentful Paint | 0.3 s |
| Largest Contentful Paint | 0.4 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 0.5 s |

### Issues identified

#### 1. Network dependency chain

**Evidence:** Lighthouse reports a maximum critical-path latency of approximately 401 ms.

**Root cause:** The inventory page depends on the generated Next.js CSS chunk during initial navigation.

**Impact:** The page still receives a 100 Performance score, so this is not currently a high-severity user-performance problem.

**Planned correction:** Avoid unnecessary changes unless the agent-skill review identifies a required correction with measurable benefit.

#### 2. Render-blocking CSS

**Evidence:** Lighthouse identifies a generated CSS chunk of approximately 5.6 KiB as render-blocking.

**Root cause:** Required page styling is loaded before rendering.

**Impact:** Current LCP is 0.4 s and TBT is 0 ms. This is a low-priority optimization compared with website SEO/accessibility and site-wide render-blocking issues.

#### 3. LCP element render delay

**Evidence:** LCP breakdown shows approximately:

- TTFB: 130 ms
- Element render delay: 460 ms

The LCP element is the inventory page heading.

**Root cause:** Client-side application startup and page rendering contribute to the delay before the heading is painted.

**Impact:** Overall LCP remains excellent at 0.4 s.

#### 4. Third-party code shown by Lighthouse

Lighthouse lists Chrome extension scripts under third-party activity.

**Root cause:** Browser extension code, not TrackFlow application code.

**Decision:** This is excluded from the TrackFlow correction scope.

---

# Cross-Frontend Analysis

## Primary measured priorities

The baseline shows that raw Performance scores are already strong. The audit therefore should not chase a perfect 100 for its own sake.

The highest-value areas to investigate are:

1. Corporate website SEO scores (60-63)
2. Corporate website mobile Accessibility scores (91-92)
3. Website render-blocking stylesheet/font requests
4. Website image dimension / CLS hardening
5. Website unminified `validation.js`
6. Compression/serving behavior if it can be corrected without architectural restructuring

The backoffice inventory page currently has excellent lab performance, so changes there should be evidence-based and targeted.

---

# Refactor Analysis

The CTO requirement asks for at least two repeated component/logic cases and a description of the shared abstraction that could replace them.

## Refactor Candidate 1 - Corporate website shared shell

### Where duplication appears

- `uis/website/index.html`
- `uis/website/application.html`

Both pages repeat the TrackFlow site header/navigation and footer markup.

### Why this qualifies

Any change to navigation links, branding, accessibility attributes, contact information, or footer content must currently be repeated in multiple files. This creates maintenance risk and increases the chance that pages drift out of sync.

### Possible abstraction

A shared website header/footer partial or site-layout mechanism could centralize the repeated shell.

### Decision

Document this as a valid refactor candidate, but do not restructure the corporate website architecture solely to satisfy the audit. The milestone explicitly requires targeted corrections rather than a rewrite.

---

## Refactor Candidate 2 - Inventory inbound/outbound shared product-loading logic

### Where duplication appears

- `uis/backoffice/app/backoffice/inventory/orders/inbound/page.tsx`
- `uis/backoffice/app/backoffice/inventory/orders/outbound/page.tsx`

Both pages repeat several responsibilities:

- product-list state
- selected product ID state
- `getProducts()` loading
- loading/error handling
- reading `sku_id` from the current URL
- validating whether the requested product exists
- nearly identical product `<select>` markup
- repeated input Tailwind class strings
- repeated success/error status presentation

### Why this qualifies

The duplicated logic is behavior, not just similar styling. If the product-loading workflow, URL-prefill behavior, API error handling, or selector presentation changes, both pages must currently be updated independently.

### Proposed abstraction

Create a custom hook such as:

```ts
useInventoryProducts()
```

The hook can own shared responsibilities such as:

- `products`
- `productId`
- `setProductId`
- `loadingProducts`
- initial `sku_id` handling
- product-load error state

A small reusable `ProductSelect` component can then be considered for the repeated selector markup.

### Recommended implementation

This is the preferred refactor to implement during the correction phase because it is contained, improves maintainability, and does not require restructuring the application.

---

# Baseline Conclusion

The baseline audit demonstrated that both frontends already performed well in Lighthouse lab conditions, especially the backoffice inventory page. The correction phase therefore focused on measured bottlenecks, accessibility findings, layout stability, static-asset delivery, and maintainability rather than broad architectural changes.
---

# Implemented Corrections

## Corporate website

### 1. Stabilized service images

Implemented on `uis/website/index.html` and the website public assets.

- Added explicit `width` and `height` attributes to the Warehouse, Last Mile Delivery, and Reverse Logistics images.
- Copied the three source images into `uis/website/public/Images/` so they are served correctly by the production Next.js application.
- Preserved responsive sizing through the existing CSS.

**Measured effect:** Homepage CLS improved from `0.079` to `0.023` on Desktop and from `0.062` to `0.036` on Mobile. Best Practices improved from `96` to `100` on both device profiles.

### 2. Removed Google Fonts from the render-blocking path

Updated both:

- `uis/website/index.html`
- `uis/website/application.html`

The Google Fonts stylesheet now uses a preload/onload pattern with a `<noscript>` fallback. Existing preconnect hints were retained.

**Measured effect:** Google Fonts no longer appeared in the Lighthouse render-blocking request list after the change. The application page improved from `0.8 s` to `0.6 s` LCP on Desktop and from `2.0 s` to `1.7 s` on Mobile in the final runs.

### 3. Minified the form validation script

Created:

- `uis/website/public/validation.min.js`

Updated `application.html` to load the minified script with `defer`. The readable source file remains available for maintenance.

The minified file is approximately 4.9 KiB versus roughly 11 KiB for the readable source. Form validation and the comments counter were functionally verified after the change.

### 4. Added targeted static-asset caching

Updated the website catch-all route so that:

- HTML uses `no-cache, must-revalidate`.
- Static CSS/JS resources use `public, max-age=86400, stale-while-revalidate=604800`.

This avoids the previous blanket `Cache-Control: no-store` policy while keeping HTML revalidation safe.

### 5. Fixed corporate-site accessibility issues

Updated the homepage and application form to address the Lighthouse findings.

Changes included:

- Added an accessible darker orange text color for text placed on light backgrounds.
- Retained the original signal color where contrast was already valid on dark backgrounds.
- Moved the mobile navigation accessible name from the `<label>` to the checkbox control.
- Changed the mobile checkbox from `hidden` to an accessible `sr-only md:hidden` pattern.
- Replaced one low-contrast `text-steel/80` usage with `text-steel`.

**Measured effect:**

- Homepage Desktop Accessibility: `96 -> 100`
- Homepage Mobile Accessibility: `92 -> 100`
- Form Desktop Accessibility: `96 -> 100`
- Form Mobile Accessibility: `91 -> 100`

### 6. Kept the main stylesheet synchronous

Lighthouse continued to identify the main stylesheet as part of the initial render path. It was intentionally **not** deferred because it contains essential first-paint styling. Deferring it would risk flash-of-unstyled-content and layout instability for minimal measurable benefit given the already excellent LCP and TBT scores.

This is an evidence-based non-change rather than an unaddressed implementation error.

---

# Completed Maintainability Refactor

## Shared inventory product-loading hook

Implemented:

- `uis/backoffice/hooks/useInventoryProducts.ts`

Adopted by:

- `uis/backoffice/app/backoffice/inventory/orders/inbound/page.tsx`
- `uis/backoffice/app/backoffice/inventory/orders/outbound/page.tsx`

The hook centralizes:

- product-list state
- selected product ID state
- `getProducts()` loading
- loading state
- product-load errors
- valid `sku_id` query-string preselection

The outbound page intentionally keeps its `getProduct()` detail request outside the shared hook so that available stock is fetched fresh whenever the selected product changes.

Functional verification completed:

- Inbound product selection and submission work correctly.
- Outbound product selection displays current stock.
- Changing the outbound product refreshes stock.
- Valid outbound submission still works.
- Over-stock validation still works.

Build and automated-test verification:

- `npm run build` passed.
- 4 Jest test suites passed.
- 29 tests passed.
- 0 tests failed.

This satisfies the milestone requirement to identify at least two duplication opportunities and implement at least one reusable component/hook refactor.

---

# Final Lighthouse Results

All final Lighthouse measurements used the same production-mode pages and device profiles as the baseline measurements.

## Corporate Website - Homepage

### Desktop - Before vs After

| Metric | Before | After | Outcome |
|---|---:|---:|---|
| Performance | 98 | **100** | Improved |
| Accessibility | 96 | **100** | Improved |
| Best Practices | 96 | **100** | Improved |
| SEO | 63 | **63** | Environment-limited |
| First Contentful Paint | 0.5 s | **0.5 s** | Maintained |
| Largest Contentful Paint | 0.5 s | **0.5 s** | Maintained |
| Total Blocking Time | 0 ms | **0 ms** | Maintained |
| Cumulative Layout Shift | 0.079 | **0.023** | Improved |
| Speed Index | 0.5 s | **0.5 s** | Maintained |

### Mobile - Before vs After

| Metric | Before | After | Outcome |
|---|---:|---:|---|
| Performance | 98 | **99** | Improved |
| Accessibility | 92 | **100** | Improved |
| Best Practices | 96 | **100** | Improved |
| SEO | 63 | **63** | Environment-limited |
| First Contentful Paint | 1.8 s | **1.8 s** | Maintained |
| Largest Contentful Paint | 1.8 s | **1.8 s** | Maintained |
| Total Blocking Time | 0 ms | **0 ms** | Maintained |
| Cumulative Layout Shift | 0.062 | **0.036** | Improved |
| Speed Index | 1.8 s | **1.8 s** | Maintained |

## Corporate Website - Application / Form

### Desktop - Before vs After

| Metric | Before | After | Outcome |
|---|---:|---:|---|
| Performance | 99 | **100** | Improved |
| Accessibility | 96 | **100** | Improved |
| Best Practices | 100 | **100** | Maintained |
| SEO | 60 | **60** | Environment-limited |
| First Contentful Paint | 0.8 s | **0.6 s** | Improved |
| Largest Contentful Paint | 0.8 s | **0.6 s** | Improved |
| Total Blocking Time | 0 ms | **0 ms** | Maintained |
| Cumulative Layout Shift | 0.001 | **0.001** | Maintained |
| Speed Index | 0.8 s | **0.6 s** | Improved |

### Mobile - Before vs After

| Metric | Before | After | Outcome |
|---|---:|---:|---|
| Performance | 98 | **99** | Improved |
| Accessibility | 91 | **100** | Improved |
| Best Practices | 100 | **100** | Maintained |
| SEO | 60 | **60** | Environment-limited |
| First Contentful Paint | 2.0 s | **1.7 s** | Improved |
| Largest Contentful Paint | 2.0 s | **1.7 s** | Improved |
| Total Blocking Time | 0 ms | **0 ms** | Maintained |
| Cumulative Layout Shift | 0 | **0.008** | Remains excellent |
| Speed Index | 2.0 s | **1.7 s** | Improved |

## Backoffice - Inventory Products - Desktop

| Metric | Before | After | Outcome |
|---|---:|---:|---|
| Performance | 100 | **100** | Maintained |
| Accessibility | 96 | **96** | No regression |
| Best Practices | 100 | **100** | Maintained |
| SEO | 60 | **60** | Environment-limited |
| First Contentful Paint | 0.3 s | **0.2 s** | Improved |
| Largest Contentful Paint | 0.4 s | **0.4 s** | Maintained |
| Total Blocking Time | 0 ms | **0 ms** | Maintained |
| Cumulative Layout Shift | 0 | **0** | Maintained |
| Speed Index | 0.5 s | **0.4 s** | Improved |

---

# SEO Environment Finding

The corporate website and backoffice continued to report SEO scores of `60-63` during Lighthouse runs performed through the GitHub Codespaces forwarded domain.

Investigation showed that the forwarded `*.app.github.dev` environment supplies:

```text
X-Robots-Tag: noindex, nofollow
```

A direct request to the local production server did **not** return that header. Therefore the "page is blocked from indexing" Lighthouse failure is caused by the audit environment rather than TrackFlow application code.

No artificial application-side change was made to override this development-environment behavior.

---

# Core Web Vitals / Performance Target Review

Milestone targets:

- Performance score >= 90
- LCP < 2.5 s
- CLS < 0.1
- INP < 200 ms where field data is available

Final lab results meet the measurable Lighthouse targets on every audited page and device profile:

- Lowest final Performance score: **99** on the corporate mobile runs.
- Highest final LCP: **1.8 s** on the homepage Mobile run.
- Highest final CLS: **0.036** on the homepage Mobile run.
- Total Blocking Time: **0 ms** on all final audited runs.

INP is a field responsiveness metric and is not produced as a directly comparable Lighthouse lab value in these runs. TBT remained `0 ms`, and no new interaction-blocking regression was introduced.

---

# Final Conclusion

The performance audit achieved measurable improvement without an architecture rewrite.

The most important outcomes were:

1. Homepage layout stability improved substantially through explicit image sizing.
2. Google Fonts were removed from the render-blocking path.
3. Form JavaScript payload was reduced through targeted minification.
4. Static website caching was improved without making HTML stale.
5. Corporate-site accessibility reached `100` in all four final corporate Lighthouse runs.
6. Corporate mobile LCP remained below the `2.5 s` target, with the form improving from `2.0 s` to `1.7 s`.
7. Backoffice Performance remained `100` after the reusable-hook refactor, demonstrating no performance regression.
8. Repeated inventory product-loading behavior was centralized in `useInventoryProducts()` while preserving outbound fresh-stock behavior.
9. The remaining Lighthouse SEO limitation was traced to GitHub Codespaces `noindex` headers rather than TrackFlow application code.

The final state meets the milestone objective of applying evidence-based, incremental improvements and documenting measurable before/after results.

