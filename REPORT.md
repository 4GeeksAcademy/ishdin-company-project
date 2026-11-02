# TrackFlow Frontend Performance Audit Report

## Executive Summary

The TrackFlow frontend performance milestone audited both production frontends:

- Corporate website: `uis/website`
- Internal backoffice: `uis/backoffice`

The work followed a strict **measure -> analyse -> fix -> measure again** workflow. Lighthouse was run against production builds using the same URLs and device profiles before and after the changes.

The goal was measurable improvement rather than chasing perfect scores or rewriting the architecture. The final results meet the milestone performance targets on every audited page.

## Final Before / After Summary

| Page | Device | Perf Before | Perf After | A11y Before | A11y After | LCP Before | LCP After | CLS Before | CLS After |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Homepage | Desktop | 98 | **100** | 96 | **100** | 0.5 s | **0.5 s** | 0.079 | **0.023** |
| Homepage | Mobile | 98 | **99** | 92 | **100** | 1.8 s | **1.8 s** | 0.062 | **0.036** |
| Application form | Desktop | 99 | **100** | 96 | **100** | 0.8 s | **0.6 s** | 0.001 | **0.001** |
| Application form | Mobile | 98 | **99** | 91 | **100** | 2.0 s | **1.7 s** | 0 | **0.008** |
| Backoffice inventory | Desktop | 100 | **100** | 96 | **96** | 0.4 s | **0.4 s** | 0 | **0** |

Best Practices reached `100` on every final run. SEO remained `60-63` because the GitHub Codespaces forwarded environment adds an indexing-blocking header; this is not an application-code regression.

## Changes Implemented

### Corporate website

1. **Added explicit image dimensions and corrected production image serving**
   - Added `width`/`height` to the three service images.
   - Served the source images from `uis/website/public/Images/`.
   - This produced the largest layout-stability win: Desktop homepage CLS improved from `0.079` to `0.023`; Mobile improved from `0.062` to `0.036`.

2. **Made Google Fonts non-render-blocking**
   - Replaced the blocking Google Fonts stylesheet with a preload/onload pattern plus `<noscript>` fallback on both corporate pages.
   - Google Fonts disappeared from the Lighthouse render-blocking list.

3. **Minified form validation JavaScript**
   - Added `uis/website/public/validation.min.js` and loaded it with `defer`.
   - Preserved the readable source file.
   - Form validation and the comments counter were verified after the change.

4. **Improved static-resource caching**
   - HTML: `no-cache, must-revalidate`.
   - CSS/JS: `public, max-age=86400, stale-while-revalidate=604800`.
   - Replaced the previous blanket `no-store` behavior.

5. **Fixed Lighthouse accessibility findings**
   - Introduced a darker accessible signal text color on light backgrounds.
   - Corrected the mobile navigation accessible-name pattern.
   - Replaced a low-contrast text treatment.
   - Corporate Accessibility reached `100` on Desktop and Mobile for both audited pages.

6. **Kept essential CSS synchronous**
   - The main stylesheet was deliberately not deferred because it is required for first paint and deferring it would risk FOUC/CLS for little measurable benefit.

### Backoffice

Implemented reusable hook:

```text
uis/backoffice/hooks/useInventoryProducts.ts
```

Used by:

```text
uis/backoffice/app/backoffice/inventory/orders/inbound/page.tsx
uis/backoffice/app/backoffice/inventory/orders/outbound/page.tsx
```

The hook centralizes shared product-list loading, selected product ID state, loading/error state, and valid `sku_id` preselection.

Outbound-specific fresh-stock loading remains in the outbound page so `getProduct()` still refreshes current stock when the user changes products.

## Refactor Requirement

Two duplication opportunities were documented:

1. Corporate website shared header/navigation/footer markup across `index.html` and `application.html`.
2. Backoffice inbound/outbound repeated inventory product-loading behavior.

The second candidate was implemented as `useInventoryProducts()`, satisfying the requirement to implement at least one reusable abstraction without restructuring the application.

## Verification

Backoffice verification after the refactor:

- Production build: **passed**
- Jest suites: **4 passed / 4 total**
- Tests: **29 passed / 29 total**
- Inbound product loading and valid submission: **verified**
- Outbound current-stock display: **verified**
- Product-change stock refresh: **verified**
- Valid outbound submission: **verified**
- Over-stock warning behavior: **verified**

The final backoffice Lighthouse run remained at **Performance 100**, confirming that the maintainability refactor introduced no measured performance regression.

## Biggest Impact

The highest-value correction was explicit image sizing on the corporate homepage because it materially reduced layout shift while also improving Best Practices.

The next largest outcome was the accessibility work: all corporate audited views improved to **Accessibility 100**.

The form page also showed measurable loading improvement after the font/script changes:

- Desktop LCP: `0.8 s -> 0.6 s`
- Mobile LCP: `2.0 s -> 1.7 s`

## SEO Note

Lighthouse reported SEO scores of `60-63` and "page is blocked from indexing" while auditing through the GitHub Codespaces forwarded domain. The forwarded environment returns:

```text
X-Robots-Tag: noindex, nofollow
```

The local production server does not return this header. The SEO score is therefore environment-limited and was not addressed with a misleading application-side workaround.

## Target Assessment

Required performance targets were met:

| Target | Final result |
|---|---|
| Performance >= 90 | **Met** — lowest final score 99 |
| LCP < 2.5 s | **Met** — highest final LCP 1.8 s |
| CLS < 0.1 | **Met** — highest final CLS 0.036 |
| INP < 200 ms | Field metric not available in these Lighthouse lab runs; TBT remained 0 ms |

## Conclusion

The milestone produced measurable improvements while keeping the implementation targeted and low risk. Corporate layout stability, accessibility, asset delivery, and form loading improved; the backoffice retained excellent lab performance while removing duplicated inventory-loading behavior. No broad architecture rewrite was required.
