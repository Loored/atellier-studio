---
name: atellier-ui-polisher
description: Use when implementing small, safe UI/UX improvements in Atellier Studio after a UI/UX review. Improves hierarchy, spacing, layout, accessibility, responsive behavior, states, and subtle real-time motion feedback without broad redesigns.
---

# Atellier UI Polisher Skill

Use this skill only after identifying specific UI/UX improvements.

## Core rule

Do not redesign the whole app.
Do not rewrite the visual system.
Do not introduce new UI libraries unless explicitly requested.

Make focused improvements that preserve the current Atellier Studio identity.

## Before implementation

Read:

- `AGENTS.md`
- `apps/web/AGENTS.md`
- `docs/current-state-and-next-steps.md` if available
- `docs/design/ui-ux-principles.md` if available
- relevant component files
- relevant CSS/design token files

## Product feel

Atellier Studio should feel like:

- a calm operator console
- a private AI studio
- a premium dark workspace
- a real-time agent control room
- a mini-agency execution dashboard

It should not feel like:

- a toy
- a generic SaaS admin template
- an overanimated game UI
- a crypto dashboard
- a landing page mockup

## Implementation rules

- Keep changes small.
- Preserve existing component structure where possible.
- Do not break API conventions.
- Do not add direct fetch/axios calls in components.
- Do not change backend unless the UX requires new data.
- Do not polish pixel sprites/animation unless explicitly requested.
- Prefer CSS tokens/classes already in the project.
- Preserve dark theme.
- Preserve local-first/operator-console feel.
- Prefer meaningful state feedback over decorative motion.

## Improve

Focus on:

- clearer hierarchy
- better spacing
- better panel composition
- obvious primary actions
- clearer disabled/loading/error states
- better mobile behavior
- better empty states
- clearer badges/status labels
- accessible icon buttons
- long text wrapping
- reduced noisy controls
- subtle real-time feedback animations

## Motion and animation rules

Delicate, elegant animation is allowed when it improves user feedback.

Use motion to make the app feel alive and responsive, not flashy.

Good uses:

- active agent pulse while running
- subtle shimmer on current orchestration step
- fade/slide-in for new logs or messages
- smooth transition when a run moves to completed/failed
- badge transition when status changes
- soft attention cue for `needs-human`
- gentle success animation when deliverable is generated
- hover/focus microinteraction on important controls
- slight panel reveal for terminal/detail surfaces

Bad uses:

- unrelated looping decorative animation
- bouncing UI
- aggressive glow
- slow transitions
- animation that delays work
- animation that hides important content
- animation that makes Atellier feel like a game

Accessibility requirements:

- support `prefers-reduced-motion`
- keep text/icon/status changes as the main signal
- do not rely on color or animation alone
- keep controls usable with keyboard
- do not animate layout in a way that causes disorientation

Suggested CSS pattern:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Do not

Avoid:

- big redesigns
- generic SaaS template look
- excessive gradients
- glassmorphism everywhere
- decorative animations that do not communicate state
- hidden destructive actions
- changing product scope
- adding Figma dependencies
- adding new design libraries
- removing existing operational information just for aesthetics

## Testing

If UI behavior changes:

- update relevant React Testing Library tests
- test behavior, not styling details
- avoid large snapshots

Run:

```bash
pnpm --filter @atellier/web typecheck
pnpm test:web
```

If shared types changed:

```bash
pnpm typecheck
pnpm test
```

## Output format

Return:

## Summary
What changed.

## UX improvements
Specific before/after improvements.

## Motion improvements
Specific animation/feedback improvements and why they help.

## Files changed
List by component/style/test.

## Tests run
Commands and results.

## Risks
Any visual, responsive, accessibility, or motion risk.

## Next suggested polish
One small next step.
