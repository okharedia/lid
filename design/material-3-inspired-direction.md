# Material 3-Inspired Direction

This pass keeps the static LiD trainer architecture and Tabler icons, but shifts the visual system toward Material 3 primitives.

## Product Feel

- Calm civic study tool, not a generic Google clone.
- Whitish neutral surfaces with green primary actions.
- Component hierarchy comes from surface containers, state layers, and shape instead of heavy borders.

## Token Mapping

- Token architecture now follows the Material hierarchy: `md-ref-*` palette/type tokens feed `md-sys-*` roles, which feed trainer-specific `md-comp-*` component tokens.
- `primary`: main progress and forward actions.
- `primary-container`: active utility toggles and mastered-card affordances.
- `secondary-container`: selected segmented controls and filter chips.
- `tertiary-container`: question number/category tags.
- `surface-container-*`: app bar, answer options, review panel, study dock, and result review surfaces.
- `surface-container-lowest/highest`: extra hierarchy for app chrome, navigation rail, disabled states, and dark-mode depth.
- `error-container`: incorrect answer state.
- `success-container`, `success-outline`: correct answer state.
- `warning-container`, `on-warning-container`: duplicate/variant notes.
- `learning-highlight`: inline learning highlights only.
- `scrim`: review panel backdrop only.
- `shape-corner-*`: small chips, medium controls, large answer options, extra-large sheets.
- `state-layer-*`: hover and pressed overlays for on-surface, primary, secondary, and error interactions.
- `motion-duration-*`, `motion-easing-*`: consistent drawer, navigation, answer, dialog, and snackbar transitions.
- `typescale-*`: Material role-based type scale for headline, title, body, and label text.
- `prefers-contrast: more`: automatic high-contrast remap of the same system roles.

## Component Direction

- Top bar: low surface app bar with filled tonal icon buttons.
- Review panel: desktop persistent drawer; mobile modal drawer with scrim and Escape/outside-click close.
- Desktop review rail: Material-style navigation rail with icon indicators and compact labels.
- Mode switch: outlined segmented control with tonal selected state.
- Filters: Material-style filter chips with leading check on selected tonal fill.
- Answers: rounded list-item/radio hybrids with outline controls and filled feedback controls.
- Study dock: persistent bottom sheet with a handle, elevated container, and rounded keyword chips.
- Question images: tonal image surfaces behave as explicit controls when a higher-resolution view is available, using a Tabler zoom affordance and an elevated Material-style dialog for the enlarged image.
- Bottom nav: sticky action bar pinned to the viewport bottom with text `Prev`, tonal `Mark mastered`, and filled `Next`.
- Snackbar: short-lived confirmation surface for reversible study actions, currently used for `Marked as mastered` with `Undo`.
- Jump dialog: small Material-style modal for direct question navigation from the progress counter.
- Empty states: softened copy and icon treatment, using sentence case instead of command-like uppercase.
- Compact phone tuning: under 430px, hide the truncated category label in the question meta row, reduce headline/answer type scale, tighten top-bar controls, and protect the bottom action bar from clipping down to 280px wide.

## Implementation Notes

- `styles.css` owns the live app tokens.
- `design/tokens.css` mirrors the same Material 3-inspired roles for prototypes.
- Type tokens include system fallback stacks, optical sizing, and trainer-specific roles for answer text, learning notes, filter counts, and bottom navigation so mobile prose avoids sub-12px labels.
- Keep Tabler icons for all icon changes.
- Review panel tabs use the ARIA tabs pattern with roving keyboard navigation.
- Mobile review drawer traps Tab focus while open and closes with Escape or outside click.
- Answers are exposed as a radio group while preserving the existing button interaction model.
- Theme preference defaults to system, then persists light/dark/system after explicit user selection.
- Dark-mode screenshots live alongside light screenshots in `design/screenshots/md3-*-dark.png`.
- Compact mobile QA screenshots live in `design/screenshots/mobile-compact-280-q2.png`, `design/screenshots/mobile-compact-320-q2.png`, and `design/screenshots/mobile-compact-390-q2.png`.
- Surface hierarchy is intentionally token-first: app canvas, app bar, review rail, card content, bottom navigation, dialogs, snackbars, and study sheet each use a named Material surface role.
- Disabled and dimmed answer states avoid low-opacity text in dark mode; contrast comes from tokenized disabled color and softer containers.
- Adaptive layout follows MD3 window-size intent: compact under 600px uses a modal drawer, medium 600-839px uses a non-modal standard drawer, and expanded 840px+ uses the persistent rail/drawer layout.
- Persistent surfaces rely mostly on tonal containers and borders; shadows are reserved for overlay surfaces such as dialogs, snackbars, and modal drawers.
