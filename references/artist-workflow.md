# Artist workflow

## Translate an idea into a small patch

Describe the intended audible behavior and the smallest signal path that achieves it. Match the user's experience and any supplied course examples. Do not add effects, nested abstractions or automation merely because they are available. Choose reasonable defaults for routine implementation details; ask only about choices that materially change the result.

Treat a `.maxpat` as a structured graph stored in JSON. Use deterministic edits and graph comparisons to arrange and connect it efficiently. Preserve unknown fields and existing IDs. Valid JSON alone does not establish that Max objects exist, messages execute in the right order, or the patch produces sound. Do not replace unsaved live work with disk JSON.

## Respect grouping choices; keep background edits in the background

- Layout is a user choice. Colored canvas regions, embedded `bpatcher` interfaces, encapsulated subpatchers (`p name`) and reusable abstractions are different valid approaches. Do not impose a single-canvas layout, a particular color scheme, or one user's Unreal Engine-style grouping preference on everyone.
- When the user wants objects collected into a small node, use suitable encapsulation with clear names and inlet/outlet connections. Nested groups are allowed when useful; there is no fixed one-level limit. Preserve behavior, dependencies and interface connections when encapsulating existing objects.
- Encapsulation does not require displaying its contents. Inspect and modify nested scopes through the bridge or appropriate JSON editing without opening their windows, bringing them forward, or automatically navigating through every level. Leave already-open user windows alone. Users can double-click a subpatcher node to explore its internals when they want; open a view only when explicitly requested.
- Choose an embedded `bpatcher` when the user wants module controls visible in the parent view, not as a mandatory replacement for subpatchers. Keep each approach's dependencies and inlet/outlet contract clear.
- Preserve the user's existing organization on narrow fixes. Do not rebuild a working patch to impose a preferred layout or confuse a request to avoid opening windows with a request to avoid nesting.

## Choose readable wiring

- Arrange sources above processing, processing above mixing/output, and related controls beside the object they affect. Align repeated chains; keep left/right channels in the same order throughout.
- Prefer short direct patchcords within a group. Route long cords along clear margins using patchline midpoints where supported; avoid cords crossing controls or text. Inspect actual port roles before connecting.
- Use named send/receive buses for genuinely shared controls or long cross-group routes. Keep names descriptive, show matching labels at both ends, and use instance-local names such as `#0-...` where appropriate. Do not hide a simple local chain behind unnecessary buses or accidentally join unrelated patches with global names.
- Use explicit `trigger` ordering for dependent messages, such as opening a file before starting playback or setting a cold inlet before triggering a calculation. Cosmetic cord order is not an execution guarantee. Preserve existing patchline order unless deliberately changing behavior.
- Check channel count, signal versus message connections, missing destinations, duplicate cords, unintended feedback and summed gain. Connect only the intended outlets; do not guess from a filename or cached port count.

## Verify the target without blocking the conversation

Read `max_status` and `max_inspect`, then compare the returned session, filepath and scope with the requested project before writing. If they match, continue without a confirmation prompt. A responding server alone is not proof of the right target.

If disconnected, pointed at another project, or requiring user-side setup:

1. Explain the specific mismatch and the smallest action needed, naming the intended project.
2. When `request_user_input_async` is available, show one reply card in the user's language: "Is the intended project connected now?" with choices "Ready — check again" and "Not yet — help me troubleshoot". This is a setup-status question, not permission to modify an unrelated patch. If unavailable, ask the same concise question in ordinary conversation.
3. Continue independent work: inspect saved files and dependencies, validate JSON, plan the wiring or prepare a separate draft. Do not end the task merely because the card is pending, and do not overwrite the live project's file.
4. On "Ready", re-read status and target scope before any dependent write. On "Not yet", continue supported background diagnostics and provide the next concrete setup step. A reply or elapsed time never proves connection success.
5. Avoid repeated identical prompts and unbounded polling. If the required capability remains unavailable, keep live mutations pending and report the exact blocker and completed independent work. Do not use Computer Use or reopen the user's patch as a workaround.

## Background diagnosis

For "no sound", "wrong sound" or "not triggering", trace the affected path rather than changing unrelated settings:

- Confirm the target and inspect current controls, cords and player state where exposed.
- Check referenced files and dependencies, source channel count and relevant native object documentation.
- Read bounded `max_console` output and `max_audio_status`; read exposed preferences only when relevant. Console history is global: distinguish old messages from evidence associated with the current action.
- Follow the path from source through gate/fade, gain, bus and output. Use available native meters/readbacks to locate where a signal disappears. If the required measurement is unavailable, say so instead of claiming an audio test passed.
- Fix the smallest demonstrated cause, inspect the result and summarize the cause in ordinary language. Do not enable DSP, change the hardware device or alter global settings merely to make a test pass.

## Make changes recoverable

Before each coherent edit, retain a checkpoint appropriate to the execution route:

- For a saved file, keep an exact backup outside the active search path where possible, record its hash, and record the intended patch changes. Before restoration, compare the current file with the version produced by that edit; do not overwrite later work.
- For live work, record the session, scope, inspected before-state and each successful mutation with its inverse where supported. Capture former values, positions and removed/added connections. Track created objects with the bridge's ownership rules. Read back the after-state so an undo can detect intervening edits.
- "Undo the last change" means reverse that coherent edit, not restore the whole project indiscriminately. Inspect first; preserve later user or other-chat changes. Do not blindly replay after a timeout or reuse runtime IDs after a receiver reload.
- An inspection snapshot is not a complete saved patch. The current bridge does not expose general native undo or saving and cannot remove arbitrary pre-existing objects. Do not promise one-click or universal rollback. For operations whose inverse is unsupported, prepare a separate backed-up draft instead of performing a destructive live edit. State any remaining recovery limitation before that operation.

Keep checkpoints and change records local to the user's work; do not publish recordings, private paths or project content as part of skill maintenance.

## Deliver usable controls

Provide a small, consistent set of labeled controls suited to the request: start/stop, master mute/volume, group volumes, and event frequency or probability when relevant. Show meaningful units and bounded ranges; keep the editable controls separate from meters. Include only the controls the patch actually implements.

Use Presentation Mode when it suits the user's preferred workflow, while retaining a readable editable patch. Place controls according to the agreed organization rather than requiring a single page. Start new sound-producing patches muted with ramped gain, and do not automatically enable audio hardware.

At handoff, name the saved file or live target, explain how to start and stop, identify the useful adjustments, and state exactly what was verified (structure, native readback, signal measurements or listening). Never equate these evidence levels.
