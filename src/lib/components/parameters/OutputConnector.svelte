<script lang="ts">
    import { isCompatible, type Output } from "$lib/scripts/tree.svelte";
    import { editor } from "$lib/scripts/editor.svelte";

    // state
    const { output } : { output: Output} = $props();

    const selected = $derived( editor.selectedOutput === output );
    const compatible = $derived( editor.selectedInput && isCompatible(editor.selectedInput, output) );
    
    function selectOutput(e: MouseEvent) {
        e.stopPropagation();
        if (!editor.selectedInput) {
            editor.selectedOutput = output;
        } else {
            editor.selectedInput.value = output;
            editor.selectedInput = null;
            editor.selectedOutput = null;
        }
    }
</script>

<button
    aria-label={`${output.display_name} output connector`}
    onclick={selectOutput}
    class={{ selected, compatible }}
    disabled={editor.selectedInput && !compatible}
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