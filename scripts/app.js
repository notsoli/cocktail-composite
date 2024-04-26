import { default as WGPU } from './wgpu.js'
import { default as Shaker } from './shaker.js'
import { default as Interface } from './interface.js'

const tree = {
    root: {},
    passes: []
}

const canvases = {
    main_canvas: null,
    effect_canvases: {},
    node_canvases: []
}

window.onload = async () => {
    canvases.main_canvas = document.querySelector("#visualizer-canvas")
    canvases.main_canvas.width = window.innerWidth
    canvases.main_canvas.height = window.innerHeight

    const config_1 = {
        root: {
            name: "example",
            id: 2,
            inputs: {
                normalized_position: "grid_pos"
            },
            outputs: {
                new_color: "color"
            },
            children: [
                { name: "grid",
                id: 1,
                inputs: {
                    tiles: "4.0",
                    position: "norm_pos"
                },
                outputs: {
                    new_position: "grid_pos",
                    tile_index: "grid_index"
                },
                children: [
                    { name: "normalized_position",
                    id: 0,
                    inputs: {},
                    outputs: { position: "norm_pos" },
                    children: [] }
                ] }
            ]
        },
        passes: [
            {
                root_id: 2,
                canvas: canvases.main_canvas,
                uniforms: { res: [ window.innerWidth, window.innerHeight ] },
                return: "color",
            }
        ]
    }
    
    const config_2 = {
        root: {
            name: "distance",
            id: 2,
            inputs: {
                position: "grid_pos",
                point: "vec2(0.5, 0.5)"
            },
            outputs: {
                distance: "distance"
            },
            children: [
                { name: "grid",
                id: 1,
                inputs: {
                    tiles: "3.0",
                    position: "norm_pos"
                },
                outputs: {
                    new_position: "grid_pos",
                    tile_index: "grid_index"
                },
                children: [
                    { name: "normalized_position",
                    id: 0,
                    inputs: {},
                    outputs: { position: "norm_pos" },
                    children: [] }
                ] }
            ] },
        passes: [
            {
                root_id: 2,
                canvas: canvases.main_canvas,
                uniforms: { res: [ window.innerWidth, window.innerHeight ] },
                return: "vec4(distance, distance, distance, 1.0)",
            }
        ]
    }

    const effects = [ "distance", "example", "flatten", "grid", "normalized_position" ]
    await populateConfigs(effects)

    const interfaceInfo = await Interface.init()
    canvases.effect_canvases = interfaceInfo.effect_canvases

    const passes = await buildShaders(config_2)

    window.onresize = () => {
        canvases.main_canvas.width = window.innerWidth
        canvases.main_canvas.height = window.innerHeight
        passes[0].res = [ window.innerWidth, window.innerHeight ]
    }
}

async function buildShaders(config) {
    const wgpuconfig = {
        data: { frame: 0 },
        p1: { res: [ window.innerWidth, window.innerHeight ] }
    }

    const data = await WGPU.init(wgpuconfig.data)

    const passes = []
    for (const passConfig of config.passes) {
        const rootNode = findNodeFromID(config.root, passConfig.root_id)
        const newConfig = {
            root: rootNode,
            return: passConfig.return
        }

        const frag = await Shaker.build(newConfig)
        const pass = await WGPU.create_pass({
            canvas: passConfig.canvas,
            fragment: frag,
            uniforms: passConfig.uniforms
        })

        passes.push(pass)
    }

    WGPU.run(() => {
        data.frame++
    })

    return passes
}

function findNodeFromID(root, nodeid) {
    if (root.id === nodeid) { return root }
    else {
        for (const node of root.children) {
            const returnedNode = findNodeFromID(node, nodeid)
            if (returnedNode !== null) { return returnedNode }
        }
    }

    return null
}

async function populateConfigs(effects) {
    for (const effect of effects) {
        const configText = await fetch(`../configs/${effect}.json`)
        const config = await configText.json()
        App.configs[effect] = config
    }
}

function addNodeAsRoot(nodeid, config) {
    const node = formatNodeConfig(nodeid, config)
    tree.root = node

    const defaultOutputKey = Object.keys(node.outputs)[0]
    const defaultOutputName = node.outputs[defaultOutputKey]
    let defaultOutputConfig
    for (const output of config.outputs) {
        if (output.name === defaultOutputKey) {
            defaultOutputConfig = output
            break
        }
    }

    tree.passes = [{
        root_id: nodeid,
        canvas: canvases.main_canvas,
        uniforms: { res: [ window.innerWidth, window.innerHeight ] },
        return: formatOutputToColor(defaultOutputName, defaultOutputConfig)
    }]
    buildShaders(tree)
    return tree.root
}

function addNodeAsChild(parentid, nodeid, config) {
    const childNode = formatNodeConfig(nodeid, config)
    const parentNode = findNodeByID(tree.root, parentid)
    parentNode.children.push(childNode)

    buildShaders(tree)
    console.log(tree)
    return childNode
}

function formatNodeConfig(nodeid, config) {
    const node = {
        name: (config.internal_name !== undefined) ? config.internal_name : config.name,
        id: nodeid,
        inputs: {},
        outputs: {},
        children: []
    }

    if (Array.isArray(config.inputs)) {
        for (const input of config.inputs)
            node.inputs[input.name] = input.default
    }
    for (const output of config.outputs)
        node.outputs[output.name] = `${output.name}_${nodeid}`

    return node
}

function formatOutputToColor(outputName, outputConfig) {
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

function findNodeByID(root, nodeid) {
    if (root.id == nodeid) {
        return root
    } else {
        for (const child of root.children) {
            const childResult = findNodeByID(child, nodeid)
            if (childResult != null) return childResult
        }
    }

    return null
}

const App = {
    configs: {},
    current_nodeid: 0,
    addNodeAsRoot,
    addNodeAsChild
}

export default App