# PFE MVP audit — 4 November 2026

Scope: existing Vintage Dress pages and design. No new page routes or stylesheet changes. Functional controls use existing components/classes. Cash on delivery is the supported payment flow.

## Findings fixed

| Finding | Result |
| --- | --- |
| Homepage category cards showed every product | Boutique filters the selected category, with a reset control |
| Favorites tab was permanently empty | Product dialog adds/removes real customer favorites; account lists saved dresses |
| Add address button only showed “Bientôt disponible” | Save complete addresses, delete addresses, set default; default prefills checkout |
| Notification switches reset and implied working email | Preferences persist; page clearly states email sending is inactive |
| Orders could exceed inventory | Available stock in product form; transaction locks prevent two customers buying the last unit |
| Cancellation could cause stock errors | Cancellation restores quantity exactly once; terminal states cannot reopen |
| COD totals counted unpaid/cancelled orders | Revenue and customer spending count delivered orders |
| Category management only allowed creation; malformed names caused errors | Validated create/rename/delete, duplicate handling, protection of categories used by dresses |
| Product-photo replacement broke old order images | Referenced uploaded photos remain available |
| Lost checkout response could strand a last-unit purchase | Customer-scoped request lookup recovers the existing order before checking current stock |
| Admin tabs reset after refresh; pagination could show an empty final page | URL preserves tab; pagination clamps after deletion/filter changes |
| Product errors could hide behind the form | Errors remain inside the product form |
| Local startup assumed exactly seven tables | Startup accepts the extended schema and checks required original tables |
| Google/recovery links implied unavailable authentication | Google explicitly unavailable; contact-based login help labelled accurately |

Authentication, role checks, uploads, cart/checkout, customer order privacy and contact-to-admin delivery were regression tested.

## Verification

Run with the database and API/web servers running:

```powershell
npm.cmd run build
npm.cmd run verify:auth
npm.cmd run verify:uploads
npm.cmd run verify:checkout
npm.cmd run verify:mvp
```

The API checks create and remove isolated records. They cover persisted account data, cross-customer isolation, blocked/deleted sessions, permissions, authoritative pricing, transactions, concurrent order retries, last-unit contention, cancellation/restock, order transitions, image retention and inbox delivery. Existing business records remain intact.

Fresh `schema.sql` was also executed in an isolated temporary database: all 10 tables, foreign keys and stock default created successfully. The temporary database was removed. Portable `db:up` was checked again against the migrated existing database.

Browser checks: homepage category selection, customer login, saved address after reload, favorites after reload, checkout default address, notification settings after reload, admin tab after reload, stock field in existing product form. Mobile checkout/account checked at 390 × 844. No browser console errors/warnings observed during these flows.

Stock migration sets existing sample products to 20 available units. New product form defaults to 1. Stock is per product across sizes; size-specific inventory is outside this MVP. Historical orders remain untouched.

## Suggested presentation flow

1. Open homepage, select a category, search/sort dresses and open details.
2. Create a customer account. Save a favorite and a complete default address.
3. Add a dress, open Panier, continue checkout; verify saved delivery details and COD total.
4. Confirm once, reload confirmation, inspect customer order history.
5. Sign in as principal admin through the shared login. Inspect order, mark Expédiée then Livrée. Verify delivered revenue.
6. Demonstrate product image upload and stock adjustment; rename an empty test category.
7. Submit a contact message and use Actualiser in admin Messages.
8. Demonstrate secondary admin permissions and blocked customer rejection using disposable accounts.

## Explicit limits

- No card payment/provider: cash on delivery only.
- No external email transport, automated password reset or Google OAuth. Notification choices are stored preferences only.
- Ratings and catalog descriptions/photos are demonstration content; no customer-review system.
- Stock is a total per product, not a separate inventory for each size/color.
- Home/about banners still rely on external images; the original founder photo uses its existing fallback.

These integrations are not required to demonstrate the supported local PFE purchase workflow. The project remains a student/local MVP; public hosting and its operational configuration are separate work.
