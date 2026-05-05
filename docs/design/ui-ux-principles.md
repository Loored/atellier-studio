# Atellier Studio UI/UX Principles

Atellier Studio is a private AI operating system for personal and mini-agency work.

This document defines the design direction for future UI/UX work. Use it when reviewing or polishing the interface, especially when there is no Figma file.

## Desired feel

Atellier Studio should feel:

- calm
- focused
- operational
- dark
- precise
- trustworthy
- elegant
- slightly futuristic
- alive in real time
- not childish
- not generic SaaS

## Product metaphor

Atellier is an operator studio.

The user is not browsing an app.
The user is supervising a private AI workroom.

The interface should help the user answer:

- what is happening now?
- what needs my attention?
- what did the agents produce?
- what should be reviewed?
- what knowledge was captured?
- what changed since the last run?

## Primary UX loop

The core loop is:

```txt
source/input → wiki update → task → agent run → review → deliverable → memory update
```

The UI should make this loop visible.

## Primary user questions

Every screen should help answer:

1. What is happening now?
2. Which agent/run/task needs me?
3. What can I safely do next?
4. What work is waiting for review?
5. What knowledge has been captured?
6. What changed since the last run?
7. Am I about to spend real model/API usage?

## Navigation model

Prefer these zones:

- Dashboard: system overview
- Office: live agent state
- Runs: execution history
- Deliverables: reviewable outputs
- Wiki: durable memory
- Tasks: work queue
- Agents: configuration and roles

## Visual hierarchy

Use clear levels:

1. Page title
2. Primary status/action
3. Active work
4. Review queue
5. Historical logs
6. Secondary metadata

Do not make all cards/buttons look equally important.

## Status priority

Highest priority:

- needs-human
- blocked
- failed
- pending review
- real OpenAI/Codex usage active

Medium priority:

- running
- active
- waiting
- handoff in progress

Low priority:

- completed
- idle
- archived

## Button hierarchy

Primary button:

- start orchestration
- run agent
- approve/review critical output

Secondary button:

- view details
- promote deliverable
- open terminal
- inspect logs

Danger/destructive:

- unlink
- delete
- reset
- clear

Danger actions must require confirmation.

## Empty states

Empty states should teach the workflow.

Bad:

```txt
No data.
```

Good:

```txt
No runs yet. Start an orchestration to create the first reviewable run.
```

## Motion and animation philosophy

Animation is allowed and encouraged when it improves user feedback.

Atellier should feel alive, but never noisy.

Motion should be:

- delicate
- elegant
- fast
- purposeful
- low-intensity
- tied to real system state
- supportive of operator confidence

Motion should not be:

- decorative for its own sake
- loud
- bouncy
- game-like
- distracting
- slow
- disorienting
- the only way a state is communicated

## Good motion use cases

Use subtle animation for:

- active agent running/thinking state
- orchestration step progress
- handoff between agents
- new log/message arrival
- run completion
- run failure
- deliverable generated
- pending review attention
- needs-human status
- terminal/detail panel reveal
- hover/focus affordances
- command accepted feedback

## Recommended motion patterns

Prefer:

- opacity fade
- small vertical slide, 2–6px
- subtle scale, 0.98–1.02
- soft pulse for active states
- understated shimmer for current step
- brief success check animation
- smooth color/border transition
- gentle card elevation on hover/focus

Avoid:

- large movement
- bounce
- elastic easing
- intense glow
- infinite decorative loops
- long intro animations
- animation that blocks input

## Timing guidance

General timings:

```txt
micro feedback:     100–180ms
panel transition:   180–260ms
state transition:   160–240ms
attention pulse:    1.5–2.5s loop, subtle intensity only
```

Use easing that feels calm and precise:

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

## Reduced motion

Always support reduced motion.

Use this baseline pattern when adding animations:

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

Important: reduced motion does not mean removing feedback. It means replacing motion with clear text, icon, border, or status changes.

## Real-time feedback principles

When the system is doing real work, the user should see:

- which agent is active
- what step is active
- what comes next
- whether the system is waiting for the user
- whether a real model/API call may be running
- whether something failed
- where the output was saved

Every real-time feedback state should have:

1. text label
2. visual status
3. optional subtle motion
4. accessible fallback

## Accessibility

- icon-only buttons need aria-label
- important statuses should be text, not color only
- focus states must be visible
- forms need labels
- live status areas should use aria-live when useful
- avoid tiny touch targets on mobile
- animation must respect prefers-reduced-motion

## UI review heuristic

For every screen, ask:

```txt
Can the user understand the system state in 5 seconds?
Can the user identify the next safe action in 5 seconds?
Can the user tell what needs review?
Can the user tell what is running and what it may cost?
Can the user find the produced deliverable or wiki memory?
```

If not, improve hierarchy before adding visual decoration.
