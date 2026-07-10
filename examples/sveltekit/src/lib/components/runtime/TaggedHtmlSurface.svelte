<script lang="ts">
  import type { UiComponent } from "gruntend/ui-runtime";

  type Props = {
    readonly component: UiComponent;
    readonly class?: string;
    readonly onError?: (error: unknown) => void;
  };

  let { component, class: className = "", onError }: Props = $props();
  let running = $state(false);
  let surfaceError = $state("");

  function mountSurface(node: HTMLDivElement, mountedComponent: UiComponent) {
    let currentComponent = mountedComponent;

    function render() {
      const next = currentComponent.render();

      if (next.status === "ok") {
        surfaceError = "";
        node.innerHTML = next.value.html;
        return;
      }

      surfaceError = next.error.message;
      onError?.(next.error);
    }

    function runHandler(handlerId: string, event?: Event) {
      try {
        running = true;
        Promise.resolve(currentComponent.dispatch(handlerId, event ? eventPayload(event) : undefined)).then(
          () => {
            render();
            running = false;
          },
          (error: unknown) => {
            running = false;
            onError?.(error);
          },
        );
      } catch (error) {
        running = false;
        onError?.(error);
      }
    }

    function readHandlerId(event: Event, attribute: string): string | undefined {
      const target = event.target;
      if (!(target instanceof Element)) return undefined;

      const control = target.closest(`[${attribute}]`);
      const handlerId = control?.getAttribute(attribute)?.trim();
      return handlerId || undefined;
    }

    function eventPayload(event: Event) {
      const target = event.target;
      const control = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
        ? target
        : undefined;

      return {
        type: event.type,
        target: control
          ? {
              name: control.name,
              value: control.value,
              checked: control instanceof HTMLInputElement ? control.checked : false,
            }
          : undefined,
        preventDefault() {
          event.preventDefault();
        },
      };
    }

    const onClick = (event: MouseEvent) => {
      const handlerId = readHandlerId(event, "data-gr-click");
      if (!handlerId) return;

      event.preventDefault();
      runHandler(handlerId, event);
    };

    const onSubmit = (event: SubmitEvent) => {
      const handlerId = readHandlerId(event, "data-gr-submit");
      if (!handlerId) return;

      event.preventDefault();
      runHandler(handlerId, event);
    };

    const onInput = (event: Event) => {
      const handlerId = readHandlerId(event, "data-gr-input");
      if (!handlerId) return;

      runHandler(handlerId, event);
    };

    const onChange = (event: Event) => {
      const handlerId = readHandlerId(event, "data-gr-change");
      if (!handlerId) return;

      runHandler(handlerId, event);
    };

    render();
    node.addEventListener("click", onClick);
    node.addEventListener("submit", onSubmit);
    node.addEventListener("input", onInput);
    node.addEventListener("change", onChange);

    return {
      update(nextComponent: UiComponent) {
        currentComponent = nextComponent;
        render();
      },
      destroy() {
        node.removeEventListener("click", onClick);
        node.removeEventListener("submit", onSubmit);
        node.removeEventListener("input", onInput);
        node.removeEventListener("change", onChange);
      },
    };
  }
</script>

<div use:mountSurface={component} class={`tagged-html-surface ${className}`.trim()}></div>
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
