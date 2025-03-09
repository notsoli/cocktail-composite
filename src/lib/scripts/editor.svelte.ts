import type { Node } from './tree.svelte';
import type { NodeConfig } from './config';
import type { Input, Output } from './tree.svelte';


export const editor: {
    focusedNode: Node | null,
    selectedEffect: NodeConfig | null,
    selectedInput: Input | null,
    selectedOutput: Output | null
} = $state({
    focusedNode: null,
    selectedEffect: null,
    selectedInput: null,
    selectedOutput: null
});