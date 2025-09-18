<script lang="ts">
    import { type ColorInputConfig } from "$lib/scripts/config";
    import { type ColorInput } from "$lib/scripts/tree.svelte";
    import { hexToArray } from "$lib/scripts/tree.svelte";
    const { input, config } : { input: ColorInput, config: ColorInputConfig } = $props();

    let preview_color = $state(config.default);

    function updateColor(e: Event) {
        if ("text" in input.value) return;

        // parse the value into channels with values from 0-1
        const target = e.target as HTMLInputElement;
        const color_array = hexToArray(target.value);

        // update the rgb channels, retaining the alpha
        input.value = [...color_array.slice(0, 3), input.value[3]];
    }

    function updateAlpha(e: Event) {
        if ("text" in input.value) return;

        // set the 4th (alpha) channel to the new value
        const target = e.target as HTMLInputElement;
        const alpha = parseFloat(target.value);
        if (!isNaN(alpha)) input.value[3] = alpha;
    }
</script>

{#if !("text" in input.value)}
    <div>
        <input
            type="color" aria-label={`${input.display_name} color input`}
            defaultValue={config.default}
            onblur={updateColor}
            onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
            bind:value={preview_color}
        >
        <input
            type="number" aria-label={`${input.display_name} alpha input`}
            defaultValue={input.value[3]} min="0" max="1" step="0.05"
            onblur={updateAlpha}
            onkeypress={(e) => {if (e.key === "Enter") e.currentTarget.blur()}}
            placeholder="alpha"
        >
    </div>
{/if}

<style>
    div {
        display: flex;
        align-items: center;
        gap: var(--small-gap);
    }

    input[type="color"] {
        width: 2em;
        height: 1.8em;
    }

    input[type="number"] {
        width: 4em;
        border-radius: var(--small-radius);
        border: var(--border-width) solid var(--accent-color);
        background-color: var(--darker-accent-color);
        color: var(--background-color);
        padding: 0.1rem 0.2rem;
        font-size: var(--small-text);
    }

    ::placeholder {
        opacity: 0.5;
    }

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        display: none;
        -webkit-appearance: none;
        margin: 0;
    }
</style>