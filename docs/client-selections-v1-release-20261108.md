# Client Selections V1: workflow simplification and variation pricing (8 Nov 2026)

Owner rule: Client Selections is not a quantity takeoff. Clients choose finishes and products; all
measurements and quantities belong to AI Takeoff, the BOQ and Quotation Builder.

## What changed for the client

- **Cabinetry client view (default).** The Cabinet Schedule step shows the room's layout as a
  read-only list, with no quantity, width or length to enter. Hidden from the client:
  - end-panel quantities;
  - kick-panel height;
  - benchtop lengths ("Edit dimensions" and "Length needed");
  - the quotation range classification and override;
  - supplier price groups.

  A builder switches to estimator view with "Builder: edit quantities". It is a per-browser
  setting, not a login role.
- **Bulkheads.** "Would you like bulkheads above your overhead kitchen cabinetry?" offers three
  options, with the owner's reference photo:
  - **Keep standard inclusion.**
  - **Add bulkheads.** Only offered when bulkheads are not standard.
  - **Remove bulkheads.** Only when they are standard and the builder has ticked "allow the client
    to remove bulkheads".

  No dimensions are asked. Wet rooms do not show the question.
- **Benchtops without a mapped price** show Builder Review Required in client view.

## What stays with the estimator

- Every technical quantity stays on the job and in `lib/construction-estimation/cabinetryRequirements.js`.
- **Add:** schedules `bulkhead_300` with `runs: []` and `clientAddedBulkhead`. The engine reports
  "Bulkhead length required" with quantity 0, so no length is invented.
- **Remove:** leaves the builder's bulkhead line and measured runs untouched until the variation is
  approved in Quotation Builder.
- A client decision changes no quotation charge (verified on the real job).

## Pricing states (`lib/builders/selectionVariationPricing.js`)

| State | When | Shown |
|---|---|---|
| Standard | Kept standard inclusion | No variation |
| A Calculable | Quantity, price and GST basis known | Estimated amount inc GST, "subject to builder approval" |
| B Builder review | Any of quantity, price or GST basis missing | "Builder Review Required" + exact missing items; never $0 |
| C Confirmed | Builder supplied figures and approved for issue | Confirmed amount; client Accept / Decline |

- **Builder-review tasks.** The task id is job + room + selection + product, so tasks are never
  duplicated. A task leaves the queue as soon as the builder supplies the missing figures.
- **Builder approval and client acceptance are separate.** The client can only accept after the
  builder approves. Editing a reviewed figure withdraws both.
- **Where reviews are stored.** In `book.metadata.selectionPricingReviews`, so re-saving a
  selection or cabinetry cannot drop them. A review for a different choice is ignored.
- **Variation Summary (Review Schedule).** Shows standard → selected, room, quantity source,
  estimated and confirmed totals kept apart, the builder-review count, and builder approval and
  client acceptance per row. It cannot be issued as final while any price is unresolved.
- **Nothing writes to the quotation.** Approved variations reach Quotation Builder only through
  the existing reconciliation.

## Real job (merged candidate, isolated copy)

- 33 changes from the standard inclusions in total.
  - 18 are calculable: estimated +$14,435.95 inc GST, subject to approval.
  - 15 are builder review: every one is missing a verified price. These are the same items the
    attention panel lists as PRICE REQUIRED.

## Verification

- Node suites: 54/54 pass, including the new `scripts/test-client-selections-variation-pricing.mjs`.
- TypeScript: pass.
- Production build (`.next-cs-v1-20261108b`): pass.
- Real-job browser acceptance (`scripts/test-client-selections-cabinetry-approval-browser.mjs`,
  V1 steps added): pass. Report in `artifacts/test-artifacts/cabinetry-approval/acceptance.json`.

## Open

- Owner to confirm the bulkhead reference photo:
  `public/images/client-selections/kitchen-bulkhead-reference.jpeg`, copied from
  `Downloads\056C9922-...-768x1024.jpeg`.
- The client/estimator switch is not role-based; client portal permissions need real roles.
- Variations are not printed in the PDF schedule. The PDF's existing Builder Review page and
  Outstanding decisions page still apply.
