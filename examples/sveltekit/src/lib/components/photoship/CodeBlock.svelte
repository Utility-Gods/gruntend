<script lang="ts">
  type Props = {
    readonly code: string;
    readonly compact?: boolean;
  };

  let { code, compact = false }: Props = $props();
</script>

<pre class:compact><code>{code}</code></pre>
