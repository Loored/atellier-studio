---
name: atellier-ui-ux-reviewer
description: Use when reviewing Atellier Studio UI/UX without Figma. Evaluates hierarchy, clarity, density, accessibility, navigation, information architecture, responsive behavior, motion feedback, and product alignment before implementation.
---

# Atellier UI/UX Reviewer Skill

Use this skill when the user asks to improve UI, UX, layout, dashboard clarity, visual hierarchy, accessibility, mobile behavior, interaction feedback, motion, or product feel.

## Product context

Atellier Studio is a private local-first AI operating system for daily work and mini-agency style operations.

It is not a SaaS landing page.
It is not a game.
It is not a generic task manager.

The UI should feel like:

- an operator console
- a private studio
- a calm AI workroom
- a professional mini-agency dashboard
- a system for memory, execution, review, and deliverables

The UI should not feel like:

- a toy game
- a noisy analytics SaaS
- a generic admin template
- a crypto dashboard
- a decorative Dribbble mockup

## Review first, do not implement immediately

Before changing code:

1. Inspect the relevant components.
2. Identify the user goal of the screen.
3. Identify the primary action.
4. Identify secondary actions.
5. Identify what information must be visible at a glance.
6. Identify what can be collapsed, delayed, or moved.
7. Identify empty/loading/error states.
8. Identify accessibility and keyboard issues.
9. Identify mobile/responsive issues.
10. Identify where subtle motion can improve state feedback.
11. Return a prioritized list of improvements.

## UX priorities

Prioritize in this order:

1. Clarity
2. Task completion
3. Information hierarchy
4. State visibility
5. Accessibility
6. Responsiveness
7. Interaction feedback
8. Visual polish
9. Delight

Do not prioritize visual decoration over operational clarity.

## Atellier-specific UX principles

### 1. Make agent state obvious

Users should instantly know:

- which agents are idle
- which agents are running
- which agents need human input
- which agents are blocked
- which runs need review
- which deliverables are pending

### 2. Make the loop visible

The UI should expose the loop:

```txt
source/input → wiki update → task → agent run → review → deliverable → memory update
```

Do not hide this behind vague generic labels.

### 3. Separate control from observation

Observation:

- dashboards
- status
- logs
- timelines
- current step

Control:

- start run
- approve
- request changes
- promote deliverable
- unblock
- handoff

Do not mix too many controls inside status-only regions.

### 4. Reduce cognitive overload

Avoid:

- too many equal-weight cards
- too many buttons with the same visual priority
- long text blocks in dense panels
- repeated metadata
- icons without labels for critical actions
- hidden destructive actions

### 5. Design for operator confidence

Every important action should answer:

- what will happen?
- which agent/run/task does this affect?
- is it reversible?
- where can I see the result?
- does this cost model/API usage?

## Motion and animation review

Subtle animation is allowed and encouraged when it improves feedback, confidence, and real-time awareness.

Animations should feel:

- delicate
- elegant
- calm
- fast enough to keep flow
- meaningful
- operational
- premium, not flashy

Use motion to communicate:

- an agent is thinking/running
- a run changed state
- a step advanced
- a panel appeared/disappeared
- a handoff happened
- a pending review needs attention
- a command was accepted
- a deliverable was generated
- a destructive action was confirmed

Good motion examples:

- soft pulse for active agents
- subtle shimmer for running steps
- small fade/slide for new logs
- tasteful status badge transition
- gentle card elevation on hover/focus
- progress step transition when orchestration advances
- small checkmark animation when a run completes
- low-intensity attention cue for `needs-human`

Bad motion examples:

- looping decorative animations with no meaning
- aggressive bouncing
- excessive glow
- long transitions that slow the operator
- motion that hides or delays important state
- animation that depends on color only
- animation that makes the app feel like a toy game

Respect accessibility:

- honor `prefers-reduced-motion`
- never rely on animation as the only signal
- pair motion with text/status/icon changes
- keep critical actions usable without animation

## Visual review checklist

Check:

- hierarchy of headings
- spacing consistency
- card density
- button hierarchy
- contrast
- focus states
- empty states
- loading states
- error states
- mobile layout
- touch targets
- sticky/scroll behavior
- long text wrapping
- overflow handling
- whether primary actions are obvious
- whether motion communicates state rather than decoration

## Accessibility checklist

Check:

- semantic buttons, not clickable divs
- aria-labels for icon-only buttons
- keyboard navigation
- visible focus states
- sufficient contrast
- reduced motion support
- form labels
- status regions with aria-live when appropriate
- statuses are not color-only

## Output format

Return:

## UI/UX Review

### Screen goal
Short explanation.

### Current strengths
What is already working.

### Top blockers
Issues that hurt usability.

### Motion opportunities
Where subtle, elegant animation would improve feedback.

### Recommended improvements
Prioritized list.

### Do not change
Things that should remain stable.

### Implementation plan
Small safe steps.

### Acceptance criteria
Concrete checks for the final UI.
