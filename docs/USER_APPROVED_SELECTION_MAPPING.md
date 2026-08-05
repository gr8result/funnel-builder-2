# User Approved Selection Mapping

Approved selection mappings are created only from a user-uploaded CSV. Gr8 Result does not automatically classify quotation rows as client-selectable.

The mapping preserves the original `quote_item_code` from Quotation Builder and stores selection-facing labels separately. This lets the same quotation item remain intact for estimating while appearing in the builder-friendly selections workflow only when approved by the uploaded CSV.

No database migration is required for this workflow. The current implementation stores mappings in browser local storage scoped by organisation and project, matching the local-file-first direction of Inclusions & Selections.
