# Material 3-Inspired Direction

This pass keeps the static LiD trainer architecture and Tabler icons, but shifts the visual system toward Material 3 primitives.

## Product Feel

- Calm civic study tool, not a generic Google clone.
- Whitish neutral surfaces with green primary actions.
- Component hierarchy comes from surface containers, state layers, and shape instead of heavy borders.

## Token Mapping

- `primary`: main progress and forward actions.
- `primary-container`: active utility toggles and mastered-card affordances.
- `secondary-container`: selected segmented controls and filter chips.
- `tertiary-container`: question number/category tags.
- `surface-container-*`: app bar, answer options, review panel, study dock, and result review surfaces.
- `error-container`: incorrect answer state.
- `success-container`, `success-outline`: correct answer state.
- `warning-container`, `on-warning-container`: duplicate/variant notes.
- `learning-highlight`: inline learning highlights only.
- `scrim`: review panel backdrop only.
- `shape-corner-*`: small chips, medium controls, large answer options, extra-large sheets.
- `motion-duration-*`, `motion-easing-standard`: consistent drawer, navigation, answer, and card transitions.

## Component Direction

- Top bar: low surface app bar with filled tonal icon buttons.
- Review panel: desktop persistent drawer; mobile modal drawer with scrim and Escape/outside-click close.
- Mode switch: outlined segmented control with tonal selected state.
- Filters: Material-style filter chips with leading check on selected tonal fill.
- Answers: rounded list-item/radio hybrids with outline controls and filled feedback controls.
- Study dock: persistent bottom sheet with a handle, elevated container, and rounded keyword chips.
- Bottom nav: action bar with text `Prev`, tonal `Mark mastered`, and filled `Next`.
- Snackbar: short-lived confirmation surface for reversible study actions, currently used for `Marked as mastered` with `Undo`.
- Jump dialog: small Material-style modal for direct question navigation from the progress counter.
- Empty states: softened copy and icon treatment, using sentence case instead of command-like uppercase.

## Implementation Notes

- `styles.css` owns the live app tokens.
- `design/tokens.css` mirrors the same Material 3-inspired roles for prototypes.
- Keep Tabler icons for all icon changes.
- Review panel tabs use the ARIA tabs pattern with roving keyboard navigation.
- Mobile review drawer traps Tab focus while open and closes with Escape or outside click.
- Answers are exposed as a radio group while preserving the existing button interaction model.
- Theme preference defaults to system, then persists light/dark/system after explicit user selection.
- Dark-mode screenshots live alongside light screenshots in `design/screenshots/md3-*-dark.png`.
