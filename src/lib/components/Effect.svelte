<script lang="ts">
    import type { NodeConfig } from "$lib/scripts/config";
    import { build } from "$lib/scripts/builder";
    import { formatNodeConfig, formatOutputToColor, tree } from "$lib/scripts/tree.svelte";
    import { editor } from "$lib/scripts/editor.svelte";
    
    import { createPass, removePass } from "devolute";
    import type { Pass } from "devolute";
    import { onMount, onDestroy } from "svelte";

    let { config }: { config: NodeConfig } = $props();
    let canvas: HTMLCanvasElement;
    let pass: Pass;

    onMount(async () => {
        // set the canvas size
        canvas.width = 100;
        canvas.height = 100;

        // create a `Node` and adds it to the tree
        const node = formatNodeConfig(0, config);
    
        // make the first output what will be displayed in the effect preview
        const returnValue = formatOutputToColor(node.outputs[Object.keys(node.outputs)[0]]);

        // generate a fragment shader
        const frag = build(node, returnValue, tree.configs);
        if (!frag) return;

        // create a pass
        const passInfo = await createPass({
            canvas,
            uniforms: {
                res: { type: "vec2f", value: [ 100, 100 ] }
            },
            fragment: frag
        });

        pass = passInfo.pass;
    });

    onDestroy(() => {
        removePass(pass);
    });
</script>

<button draggable="true"
    onclick={() => {editor.selectedEffect = config}}
    class={{selected: editor.selectedEffect === config}}
>
    <h2>{config.display_name ?? config.name}</h2>
    <div>
        <p>{config.description}</p>
        <canvas bind:this={canvas}></canvas>
    </div>
</button>

<style>
    button {
        width: 9rem;
        background-color: var(--background-color);
        color: var(--primary-color);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        border: var(--border-width) solid transparent;
        gap: var(--small-gap);
    }

    h2 {
        text-align: center;
    }

    .selected, button:hover {
        border: var(--border-width) solid var(--accent-color);
    }

    button:hover p {
        display: block;
        line-height: 1;
        hyphens: auto;
    }

    div {
        width: 100%;
        height: 6.25rem;
        position: relative;
        display: flex;
        justify-content: center;
    }

    canvas {
        width: 6.25rem;
        height: 100%;
    }

    p {
        display: none;
        position: absolute;
        inset: 0;
        padding: var(--small-gap);
        font-size: var(--small-text);
        background-color: var(--background-color);
    }
</style>