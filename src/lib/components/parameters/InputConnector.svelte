<script lang="ts">
    import { type Input } from "$lib/scripts/tree.svelte";
    import { isCompatible, isAdjacent } from "$lib/scripts/editor.svelte";
    import { editor } from "$lib/scripts/editor.svelte";
    import type { Node } from "$lib/scripts/tree.svelte";

    const { input, node } : { input: Input, node: Node } = $props();

    const selected = $derived( editor.selectedInput?.input === input );
    const compatible = $derived(
        editor.selectedOutput &&
        isCompatible(input, editor.selectedOutput.output) &&
        isAdjacent(node, editor.selectedOutput.node)
    );
    
    function selectInput(e: MouseEvent) {
        e.stopPropagation();
        if (!editor.selectedOutput) {
            editor.selectedInput = { input, node };
        } else {
            input.value = editor.selectedOutput.output;
            editor.selectedOutput = null;
            editor.selectedInput = null;
        }
    }
</script>

<button
    aria-label={`${input.display_name} input connector`}
    onclick={selectInput}
    class={{ selected, compatible }}
    disabled={editor.selectedOutput && !compatible}
></button>

<style>
    button {
        width: calc( 1em + 2 * var(--border-width));
        height: calc( 1em + 2 * var(--border-width));
        border-radius: 50%;
        border: var(--border-width) solid var(--background-color);
    }

    .selected, .compatible, button:hover {
        outline: var(--border-width) solid var(--accent-color);
    }
</style>