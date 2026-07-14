# gruntend

## 0.3.0

### Minor Changes

- 8549f18: Add restricted native SVG chart markup to generated UI. SVG markup is reconstructed through explicit element and attribute allowlists, with external resources, executable capabilities, malformed tags, and forged delegated-handler targets rejected.

## 0.2.0

### Minor Changes

- 1cfd775: Make application-owned code-plan prompts first-class by allowing `generateCodePlan()` to receive exact `system` and `user` prompt text.
- 1cfd775: Prompt is first class citizen now

## 0.1.0

Initial public beta release.

- Define typed application tools with runtime input and output validation.
- Run generated or handwritten JavaScript code plans through app-owned handlers.
- Render task-specific generated UI with the `html` tagged-template runtime.
- Mount generated UI through DOM, React, Svelte, Vue, and Solid adapters.
- Generate code-plan prompts and parse model responses without coupling execution to one LLM provider.
