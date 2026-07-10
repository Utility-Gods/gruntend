<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import type { GeneratedUi } from "gruntend/ui";
  import { mountGeneratedUi } from "gruntend/ui/dom";

  type Props = {
    readonly ui: GeneratedUi;
    readonly class?: string;
    readonly onError?: (error: unknown) => void;
  };

  let { ui, class: className = "", onError }: Props = $props();
  let running = $state(false);
  let surfaceError = $state("");

  function mountSurface(mountedUi: GeneratedUi): Attachment<HTMLDivElement> {
    return (node) => {
      const mounted = mountGeneratedUi(node, mountedUi, {
        onError(error) {
          surfaceError = error instanceof Error ? error.message : String(error);
          onError?.(error);
        },
        onRender() {
          surfaceError = "";
        },
        onActionStart() {
          running = true;
        },
        onActionEnd() {
          running = false;
        },
      });

      return () => {
        mounted.destroy();
      };
    };
  }
</script>

<div {@attach mountSurface(ui)} class={`tagged-html-surface ${className}`.trim()}></div>
{#if running}
  <p class="tagged-html-status">Running generated action...</p>
{/if}
{#if surfaceError}
  <p class="tagged-html-error">{surfaceError}</p>
{/if}

<style>
  .tagged-html-surface :global([data-gr-click]),
  .tagged-html-surface :global([data-gr-submit]),
  .tagged-html-surface :global([data-gr-input]),
  .tagged-html-surface :global([data-gr-change]) {
    cursor: pointer;
  }

  .tagged-html-surface :global(.surface-card) {
    display: grid;
    gap: 0.9rem;
    background: #fff;
    padding: 1rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  }

  .tagged-html-surface :global(.surface-title) {
    color: var(--color-text-primary);
    font-size: 1.1rem;
    font-weight: 700;
  }

  .tagged-html-surface :global(.surface-text),
  .tagged-html-surface :global(.surface-muted) {
    color: var(--color-text-secondary);
  }

  .tagged-html-surface :global(.surface-badge) {
    display: inline-flex;
    align-items: center;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 0.15rem 0.45rem;
    font-size: 0.75rem;
    font-weight: 650;
  }

  .tagged-html-surface :global(.surface-list) {
    display: grid;
    gap: 0.45rem;
    border-top: 1px solid var(--color-border);
    padding-top: 0.75rem;
  }

  .tagged-html-surface :global(.surface-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tagged-html-surface :global(.surface-actions button),
  .tagged-html-surface :global(button.surface-action),
  .tagged-html-surface :global(a.surface-action) {
    border: 0;
    background: var(--color-primary-600);
    color: #fff;
    padding: 0.55rem 0.8rem;
    font-weight: 650;
    text-decoration: none;
  }

  .tagged-html-surface :global(.surface-actions button:hover),
  .tagged-html-surface :global(button.surface-action:hover),
  .tagged-html-surface :global(a.surface-action:hover) {
    background: var(--color-primary-700);
  }

  .tagged-html-surface :global(.surface-item) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--color-border);
    background: #fff;
    padding: 0.85rem;
    color: var(--color-text-primary);
    text-align: left;
  }

  .tagged-html-surface :global(.surface-item.is-selected) {
    border-color: var(--color-primary-600);
    background: var(--color-primary-50);
  }

  .tagged-html-surface :global(.surface-item strong),
  .tagged-html-surface :global(.surface-item span) {
    display: block;
  }

  .tagged-html-surface :global(.surface-item strong) {
    font-weight: 650;
  }

  .tagged-html-surface :global(.surface-item span span) {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .tagged-html-surface :global(.surface-table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .tagged-html-surface :global(.surface-table th),
  .tagged-html-surface :global(.surface-table td) {
    border-bottom: 1px solid var(--color-border);
    padding: 0.55rem 0.35rem;
    text-align: left;
    vertical-align: top;
  }

  .tagged-html-surface :global(.surface-table th) {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .tagged-html-status {
    margin-top: 0.5rem;
    color: var(--color-primary-700);
    font-size: 0.85rem;
    font-weight: 650;
  }

  .tagged-html-error {
    margin-top: 0.5rem;
    color: var(--color-error);
    font-size: 0.85rem;
    font-weight: 650;
  }
</style>
