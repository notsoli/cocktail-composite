import { default as WGPU } from './wgpu.js'
import { default as Shaker } from './shaker.js'
import { default as Interface } from './interface.js'
import { default as configs } from './configs.js'

import { UniformValues } from './wgpu.js'
import { NodeConfig, OutputConfig } from './configs.js'

export interface Config {
    root: Node
    effect_nodes: {[x: string]: any}
    passes: PassConfig[]
    return: string
}

class PassConfig {
    root_id: number | string
    canvas: HTMLCanvasElement
    uniforms: Object
    return: string
}

export class Node {
    id: number
    name: string
    inputs: {[x: string]: any}
    outputs: {[x: string]: string}
    children: Node[]

    constructor(id:number, name: string, inputs: {[x: string]: any}, outputs: {[x: string]: string}) {
        this.id = id
        this.name = name
        this.inputs = inputs
        this.outputs = outputs
        this.children = []
    }
}

const tree: Config = {
    root: null,
    effect_nodes: {},
    passes: [],
    return: null
}

const canvases: {main_canvas: HTMLCanvasElement, effect_canvases: {[x: string]: HTMLCanvasElement}} = {
    main_canvas: null,
    effect_canvases: {}
}

let data: UniformValues

window.onload = async () => {
    canvases.main_canvas = document.querySelector("#visualizer-canvas")
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight

    data = await WGPU.init({ frame: 0 })

    // const effects = [ "distance", "example", "flatten", "grid", "normalized_position" ]
    // await populateConfigs(effects)
    App.configs = configs

    const interfaceInfo = await Interface.init()
    canvases.effect_canvases = interfaceInfo.effect_canvases
    generateEffectPreviews()

    // const passes = await buildShaders(config_2)

    await buildShaders(tree)
}

async function buildShaders(config: Config) {
    WGPU.clear_passes()
    
    let mainPassUniforms: UniformValues
    for (const passID in config.passes) {
        const passConfig = config.passes[passID]

        // there's a better way to do this
        let rootNode
        if (typeof passConfig.root_id === "string") {
            rootNode = config.effect_nodes[passConfig.root_id]
        } else {
            rootNode = findNodeFromID(config.root, passConfig.root_id)
        }

        const newConfig: Config = {
            root: rootNode,
            return: passConfig.return,
            effect_nodes: {},
            passes: []
        }

        const frag = await Shaker.build(newConfig)
        const passUniforms = await WGPU.create_pass({
            canvas: passConfig.canvas,
            fragment: frag,
            uniformValues: passConfig.uniforms
        })

        if (passConfig.canvas === canvases.main_canvas) mainPassUniforms = passUniforms
    }

    if (mainPassUniforms !== undefined) {
        window.onresize = () => { resizeMainCanvas(mainPassUniforms) }
        resizeMainCanvas(mainPassUniforms)
    }

    WGPU.run(() => {
        (data.frame as number)++ // kinda ew, sorry
    })
}

function resizeMainCanvas(uniforms: UniformValues) {
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight
    uniforms.res = [ window.innerWidth, window.innerHeight ]

}

function findNodeFromID(root: Node, nodeid: number): Node {
    if (root.id === nodeid) { return root }
    else {
        for (const node of root.children) {
            const returnedNode = findNodeFromID(node, nodeid)
            if (returnedNode !== null) { return returnedNode }
        }
    }

    return null
}

// async function populateConfigs(effects) {
//     for (const effect of effects) {
//         const configText = await fetch(`../configs/${effect}.json`)
//         const config = await configText.json()
//         App.configs[effect] = config
//     }
// }

function addNodeAsRoot(nodeid: number, config: NodeConfig) {
    const node = formatNodeConfig(nodeid, config)
    tree.root = node
    const defaultOutputKey = Object.keys(node.outputs)[0]

    tree.passes.push({
        root_id: nodeid,
        canvas: canvases.main_canvas,
        uniforms: { res: [ window.innerWidth, window.innerHeight ] },
        return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
    })

    buildShaders(tree)
}

function generateEffectPreviews() {
    for (const config_name in canvases.effect_canvases) {
        const canvas = canvases.effect_canvases[config_name]
        const config = App.configs[config_name]

        const node = formatNodeConfig(0, config)
        tree.effect_nodes[config_name] = node
    
        const defaultOutputKey = Object.keys(node.outputs)[0]
    
        tree.passes.push({
            root_id: config_name,
            canvas: canvas,
            uniforms: { res: [ canvas.width, canvas.height ] },
            return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
        })
    }
}

function addNodeAsParent(childid: number, nodeid: number, config: NodeConfig) {
    const parentNode = findParentByID(childid)

    let childNode
    if (parentNode !== null) {
        for (let c = 0; c < parentNode.children.length; c++) {
            const child = parentNode.children[c]
            if (child.id == childid) {
                childNode = child
                parentNode.children.splice(c, c)
                break
            }
        }
    }

    const newParentNode = formatNodeConfig(nodeid, config)

    if (parentNode == null) {
        newParentNode.children.push(tree.root)
        tree.root = newParentNode
        addNodePass(nodeid, canvases.main_canvas)
    } else {
        newParentNode.children.push(childNode)
        parentNode.children.push(newParentNode)
    }

    buildShaders(tree)
}

function addNodeAsChild(parentid: number, nodeid: number, config: NodeConfig) {
    const childNode = formatNodeConfig(nodeid, config)
    const parentNode = findNodeByID(parentid)
    parentNode.children.push(childNode)

    buildShaders(tree)
}

function formatNodeConfig(nodeid: number, config: NodeConfig) {
    const inputs: {[x: string]: any} = {}
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs)
            inputs[input_name] = config.inputs[input_name].default
    }

    const outputs: {[x: string]: string} = {}
    for (const output_name in config.outputs)
        outputs[output_name] = `${output_name}_${nodeid}`

    const newNode = new Node(nodeid, config.name, inputs, outputs)

    return newNode
}

function formatOutputToColor(outputName: string, outputConfig: OutputConfig) {
    switch (outputConfig.type) {
        case "f32":
            return `vec4(vec3(${outputName}), 1.)`
        case "vec2f":
            return `vec4(${outputName}, 0., 1.)`
        case "vec3f":
            return `vec4(${outputName}, 1.)`
        case "vec4f":
            return outputName
        default:
            console.error("Unsupported return type!")
    }
}

function findNodeByID(nodeid: number, root?: Node): Node {
    if (root === undefined) root = tree.root
    if (root.id == nodeid) {
        return root
    } else {
        for (const child of root.children) {
            const childResult = findNodeByID(nodeid, child)
            if (childResult != null) return childResult
        }
    }

    return null
}

function findParentByID(nodeid: number, root?: Node): Node {
    if (root === undefined) root = tree.root
    if (root.id === nodeid) return null

    for (const child of root.children) {
        if (child.id === nodeid) return root
        const childResult = findParentByID(nodeid, child)
        if (childResult != null) return childResult
    }

    return null
}

// feed the output of a child node into the input of a parent node
function linkParameter(childID: number, childParameter: string, parentID: number, parentParameter: string) {
    const childNode = findNodeByID(childID)
    const parentNode = findNodeByID(parentID)

    const childParameterName = childNode.outputs[childParameter]
    parentNode.inputs[parentParameter] = childParameterName

    buildShaders(tree)
}

function addNodePass(_nodeid: number, canvas: HTMLCanvasElement) {
    const nodeid = (typeof _nodeid === "string") ? parseInt(_nodeid) : _nodeid

    // if passes targeting this canvas already exist, remove them
    clearPasses(canvas)

    const node = findNodeByID(nodeid)
    const config = App.configs[node.name]

    const defaultOutputKey = Object.keys(node.outputs)[0]
    
    tree.passes.push({
        root_id: nodeid,
        canvas: canvas,
        uniforms: { res: [ canvas.width, canvas.height ] },
        return: formatOutputToColor(node.outputs[defaultOutputKey], config.outputs[defaultOutputKey])
    })

    buildShaders(tree)
}

function clearPasses(canvas: HTMLCanvasElement) {
    for (const passID in tree.passes) {
        const pass = tree.passes[passID]
        if (pass.canvas === canvas) tree.passes[passID] = null
    }
    tree.passes = tree.passes.filter((entry) => entry !== null)
}

function updateParameter(nodeid: number, parameter: string, value: any) {
    const node = findNodeByID(nodeid)
    node.inputs[parameter] = value
    buildShaders(tree)
}

const App = {
    configs,
    current_nodeid: 0,
    addNodeAsRoot,
    addNodeAsParent,
    addNodeAsChild,
    linkParameter,
    addNodePass,
    clearPasses,
    findNodeByID,
    findParentByID,
    updateParameter
}

export default App