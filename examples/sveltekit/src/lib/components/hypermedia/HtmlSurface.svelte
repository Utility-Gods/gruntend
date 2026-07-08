<script lang="ts">
  import { hydrateHtmlSurface, type HtmlSurfaceActionSubmission, type HtmlSurfaceHydration } from "gruntend/hypermedia";

  type Props = {
    readonly html: string;
    readonly submitAction: (actionId: string, submission: HtmlSurfaceActionSubmission) => unknown;
    readonly class?: string;
  };

  let { html, submitAction, class: className = "" }: Props = $props();
  let host: HTMLDivElement;
  let hydration: HtmlSurfaceHydration | undefined;

  $effect(() => {
    if (!host) return;

    hydration?.dispose();
    host.innerHTML = html;
    hydration = hydrateHtmlSurface(host, { submitAction });

    return () => {
      hydration?.dispose();
      hydration = undefined;
    };
  });
</script>

<div bind:this={host} class={`html-surface ${className}`.trim()}></div>

<style>
  .html-surface :global([gr-href]) {
    cursor: pointer;
  }

  .html-surface :global(.surface-card) {
    display: grid;
    gap: 0.9rem;
    border: 0;
    background: #fff;
    padding: 1rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  }

  .html-surface :global(.surface-title) {
    color: var(--color-text-primary);
    font-weight: 650;
  }

  .html-surface :global(.surface-text) {
    color: var(--color-text-secondary);
  }

  .html-surface :global(.surface-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .html-surface :global(.surface-list) {
    display: grid;
    border-top: 1px solid var(--color-border);
  }

  .html-surface :global(.surface-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    padding: 0.85rem 0;
  }

  .html-surface :global(.surface-item strong),
  .html-surface :global(.surface-item span) {
    display: block;
  }

  .html-surface :global(.surface-item strong) {
    color: var(--color-text-primary);
    font-weight: 650;
  }

  .html-surface :global(.surface-item span) {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .html-surface :global(.surface-dropdown) {
    position: relative;
    flex-shrink: 0;
  }

  .html-surface :global(.surface-dropdown summary) {
    cursor: pointer;
    border: 0;
    background: transparent;
    color: var(--color-primary-700);
    padding: 0.25rem 0;
    font-weight: 600;
    list-style: none;
  }

  .html-surface :global(.surface-dropdown summary::-webkit-details-marker) {
    display: none;
  }

  .html-surface :global(.surface-dropdown[open] .surface-dropdown-menu) {
    display: grid;
  }

  .html-surface :global(.surface-dropdown-menu) {
    position: absolute;
    right: 0;
    z-index: 2;
    display: none;
    min-width: 9rem;
    gap: 0.25rem;
    margin-top: 0.35rem;
    border: 1px solid var(--color-border);
    background: #fff;
    padding: 0.35rem;
    box-shadow: var(--shadow-popover);
  }

  .html-surface :global(button),
  .html-surface :global(a[gr-href]) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    text-decoration: none;
  }

  .html-surface :global(.surface-dropdown-menu button) {
    justify-content: flex-start;
    background: #fff;
    color: var(--color-text-primary);
  }

  .html-surface :global(button:hover),
  .html-surface :global(a[gr-href]:hover) {
    background: var(--color-primary-100);
  }
</style>
