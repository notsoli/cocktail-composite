<script lang="ts">
    import { build, buildTemplate } from "$lib/scripts/builder";
    import { type DisplayInput, type Node, formatDisplayInputToColor, formatOutputToColor, tree } from "$lib/scripts/tree.svelte";
    import { createPass, removePass, type Pass } from "devolute";
    let canvas: HTMLCanvasElement;

    // state
    const { input, node } : { input: DisplayInput, node: Node } = $props();

    $effect(() => {
        // set the canvas size
        canvas.width = 30;
        canvas.height = 30;
        if (typeof input.value === "string") {
            // generate a fragment shader
            const returnValue = formatDisplayInputToColor(input);
            const frag = buildTemplate(returnValue);

            // create a pass
            let pass: Pass;
            createPass({
                canvas,
                uniforms: {
                    res: { type: "vec2f", value: [30, 30] }
                },
                fragment: frag
            }).then((passInfo) => {
                pass = passInfo.pass;
            });

            // remove the pass when the node or configs change
            return () => {
                removePass(pass);
            };
        } else {
            // find node associated with the input
            let linkedNode: Node | null = null;
            for (const child of node.children) {
                for (const childOutput of Object.values(child.outputs)) {
                    if (childOutput.text === input.value.text) {
                        linkedNode = child;
                        break;
                    }
                }
            }

            if (!linkedNode) return;

            // generate a fragment shader
            const returnValue = formatOutputToColor(input.value);
            const frag = build(linkedNode, returnValue, tree.configs);
            if (!frag) return;

            // create a pass
            let pass: Pass;
            createPass({
                canvas,
                uniforms: {
                    res: { type: "vec2f", value: [30, 30] }
                },
                fragment: frag
            }).then((passInfo) => {
                pass = passInfo.pass;
            });

            // remove the pass when the node or configs change
            return () => {
                removePass(pass);
            };
        }
    });
</script>

<canvas bind:this={canvas}></canvas>