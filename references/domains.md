# Domain checks

## MSP and Gen

Use native MSP objects for straightforward chains; use gen~ when sample-by-sample feedback or custom DSP materially helps. Confirm operator support in the target Gen namespace. Max messages, MSP signals, GenExpr and RNBO are separate domains.

Declare units for parameters (Hz, ms, samples, linear amplitude or dB). Ramp changing gain/frequency/delay parameters where discontinuities would click. Recalculate sample-dependent coefficients from sample rate. For feedback, verify the required delay/state, loop gain and bounded response; an output clipper alone does not prove internal stability. Test zero input, extremes, reset and at least the actual sample rate. Audio verification needs observed levels or recorded output and, when relevant, listening; JSON checks cannot substitute for it.

Use explicit low initial gain and a user-accessible mute/stop. `line~` accepts message forms beyond a simplistic even-number-list rule; consult its installed reference. Polyphony and MC require verifying voice/channel counts and initialization, not merely finding the object name.

## JavaScript

Select the host deliberately: legacy `js` for legacy engine compatibility; `v8` for the modern in-patcher Max JS API; `node.script` for Node/network/filesystem operations. Do not put Node `require('max-api')` into a legacy `js` object or treat a Node process as a direct Patcher API host. The bundled bridge uses Node for transport and v8 for patch operations. No browser DOM is assumed.

## Max for Live / RNBO

For M4L, confirm Live/device type and lifecycle. Validate Live API paths, IDs, observers, parameter persistence and instance namespace inside Live; standalone Max does not prove these work. Do not rename JSON to `.amxd` and call it a verified device. For RNBO confirm installed package/license and target-supported objects; verify the export separately.

## Editing and UI

Keep existing coordinates and presentation state. Use durable varnames for controls addressed by scripts. File IDs are scope-local; the same ID can occur in different subpatchers. Preserve patchline order and unknown attributes. If a file is open with unsaved edits, choose live editing or a separate output copy, not a disk overwrite.

Sources: [trigger](https://docs.cycling74.com/reference/trigger/), [line~](https://docs.cycling74.com/reference/line~/), [JavaScript](https://docs.cycling74.com/userguide/javascript/), [Node API](https://docs.cycling74.com/apiref/nodeformax/).
