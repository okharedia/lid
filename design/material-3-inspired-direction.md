# Material 3-Inspired Direction

This pass keeps the static LiD trainer architecture and Tabler icons, but shifts the visual system toward Material 3 primitives.

## Product Feel

- Calm civic study tool, not a generic Google clone.
- Whitish neutral surfaces with green primary actions.
- Component hierarchy comes from surface containers, state layers, and shape instead of heavy borders.

## Token Mapping

- `primary`: main progress and forward actions.
- `primary-container`: active utility toggles and known-question affordances.
- `secondary-container`: selected segmented controls and filter chips.
- `tertiary-container`: question number/category tags.
- `surface-container-*`: app bar, answer options, review panel, study dock, and result review surfaces.
- `error-container`: incorrect answer state.
- `success-container`, `success-outline`: correct answer state.
- `warning-container`, `on-warning-container`: duplicate/variant notes.
- `learning-highlight`: inline learning highlights only.
- `scrim`: review panel backdrop only.

## Component Direction

- Top bar: low surface app bar with filled tonal icon buttons.
- Mode switch: outlined segmented control with tonal selected state.
- Filters: Material-style filter chips with selected tonal fill.
- Answers: rounded selectable surfaces with soft state-layer hover.
- Study dock: low container surface with rounded keyword chips.
- Bottom nav: action bar surface with primary next action.

## Implementation Notes

- `styles.css` owns the live app tokens.
- `design/tokens.css` mirrors the same Material 3-inspired roles for prototypes.
- Keep Tabler icons for all icon changes.
