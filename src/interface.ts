import { default as App } from './app.js'
import { Node } from './app.js'
import { InputConfig, NodeConfig, OutputConfig } from './configs.js'

enum View {
    Node,
    Visualizer,
    Tree,
    Variables
}

enum NodeAction {
    None,
    Add
}

interface SelectedParameter {
    node: number
    name: string
    type: string // replace with type enum at some point
}

interface State {
    current_view: View
    current_node_action: NodeAction
    focused_node: number
    selected_effect: string
    selected_parameter: SelectedParameter
}

const state: State = {
    current_view: View.Node,
    current_node_action: NodeAction.None,
    focused_node: null,
    selected_effect: null,
    selected_parameter: null
}

const elements: {[x: string]: HTMLElement} = {}
let effectElements: HTMLElement[]

async function init() {
    // query elements
    elements.visualize_button = document.querySelector("#visualize-button")
    elements.tree_button = document.querySelector("#tree-button")
    elements.variables_button = document.querySelector("#variables-button")
    elements.exit_visualizer_button = document.querySelector("#exit-visualizer-button")

    elements.persistent_interface = document.querySelector("#persistent-interface")
    elements.node_view = document.querySelector("#node-view")
    elements.visualizer_view = document.querySelector("#visualizer-view")
    elements.effects = document.querySelector("#effects")

    elements.parent_placeholder_node = document.querySelector("#parent-node .placeholder-node")
    elements.focus_placeholder_node = document.querySelector("#focus-node .placeholder-node")
    elements.child_placeholder_node = document.querySelector("#child-nodes .placeholder-node")

    elements.parent_node = document.querySelector("#parent-node")
    elements.focus_node = document.querySelector("#focus-node")
    elements.child_nodes = document.querySelector("#child-nodes")

    elements.templates = document.querySelector("#element-templates")

    // set current state
    changeView(View.Node)
    changeNodeAction(NodeAction.Add)

    // link onclick events
    elements.visualize_button.onclick = () => { changeView(View.Visualizer) }
    elements.tree_button.onclick = () => { changeView(View.Tree) }
    elements.variables_button.onclick = () => { changeView(View.Variables) }
    elements.exit_visualizer_button.onclick = () => { changeView(View.Node) }

    // generate toolkit entries and link event listeners
    effectElements = await populateToolkit()
    const effect_canvases: {[x: string]: HTMLCanvasElement} = {}
    for (const element of effectElements) {
        element.onclick = selectEffect
        element.ondragstart = selectEffect

        effect_canvases[element.dataset.name] = element.querySelector("canvas")
    }

    elements.parent_placeholder_node.ondragover = enableDrop
    elements.parent_placeholder_node.ondrop = addParentNode
    elements.parent_placeholder_node.onclick = addParentNode

    elements.focus_placeholder_node.ondragover = enableDrop
    elements.focus_placeholder_node.ondrop = addFocusNode
    elements.focus_placeholder_node.onclick = addFocusNode

    elements.child_placeholder_node.ondragover = enableDrop
    elements.child_placeholder_node.ondrop = addChildNode
    elements.child_placeholder_node.onclick = addChildNode

    elements.persistent_interface.onclick = deselect

    elements.parameter_templates = document.querySelector("#element-templates>.node-parameters")

    return { effect_canvases: effect_canvases }
}

function changeView(newView: View) {
    switch (newView) {
        case View.Node:
            elements.persistent_interface.classList.add("active-view")
            elements.node_view.classList.add("active-view")
            elements.visualizer_view.classList.remove("active-view")
            break
        case View.Visualizer:
            elements.visualizer_view.classList.add("active-view")
            elements.persistent_interface.classList.remove("active-view")
            break
        case View.Variables:
        case View.Tree:
            console.warn("View not implemented")
            break
        default:
            console.error("Unknown view")
            return
    }

    state.current_view = newView
}

function changeNodeAction(newNodeAction: NodeAction) {
    if (newNodeAction == NodeAction.None) {
        elements.parent_placeholder_node.classList.remove("active-placeholder")
        elements.focus_placeholder_node.classList.remove("active-placeholder")
        elements.child_placeholder_node.classList.remove("active-placeholder")
    } else if (newNodeAction == NodeAction.Add) {
        if (state.focused_node != null) {
            elements.parent_placeholder_node.classList.add("active-placeholder")
            elements.focus_placeholder_node.classList.remove("active-placeholder")
            elements.child_placeholder_node.classList.add("active-placeholder")
        } else {
            elements.parent_placeholder_node.classList.remove("active-placeholder")
            elements.focus_placeholder_node.classList.add("active-placeholder")
            elements.child_placeholder_node.classList.remove("active-placeholder")  
        }
    } else {
        console.error("Unknown node action")
        return
    }

    state.current_node_action = newNodeAction
}

async function populateToolkit() {
    const template = elements.templates.querySelector(".effect")
    const effectElements = []

    for (const configName in App.configs) {
        const config = App.configs[configName]
        const newEffect = template.cloneNode(true) as HTMLElement

        newEffect.querySelector("h3").innerText = getNodeName(config)
        newEffect.querySelector(".tooltip").innerHTML = config.description
        const canvas = newEffect.querySelector("canvas")
        canvas.width = 100
        canvas.height = 100

        newEffect.dataset.name = config.name
        elements.effects.appendChild(newEffect)
        effectElements.push(newEffect)
    }

    return effectElements
}

function selectEffect() {
    state.selected_effect = this.dataset.name

    for (const element of effectElements)
        element.classList.remove("selected-effect")
    this.classList.add("selected-effect")

    elements.parent_placeholder_node.classList.add("pointer")
    elements.focus_placeholder_node.classList.add("pointer")
    elements.child_placeholder_node.classList.add("pointer")

    changeNodeAction(NodeAction.Add)
}

function enableDrop(event: DragEvent) { event.preventDefault() }

function addFocusNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    App.addNodeAsRoot(nodeid, config)
    state.focused_node = nodeid
    constructNodeView()
    changeNodeAction(NodeAction.None)
}

function constructFocusNode(node: Node) {
    const nodeTemplate = elements.templates.querySelector(".node")
    const newNode = nodeTemplate.cloneNode(true) as HTMLElement

    const config = App.configs[node.name]

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerHTML = getNodeName(config)

    const nodeParameters = newNode.querySelector(".node-parameters")
    if (config.inputs !== undefined) {
        for (const input_name in config.inputs) {
            const input = config.inputs[input_name]
            const newParameter = assembleParameter(node.id, input_name, input)
            if (newParameter == null) continue
            nodeParameters.appendChild(newParameter)
        }
    } else nodeParameters.remove()

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in config.outputs) {
        const output = config.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = selectParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    const removeButton = newNode.querySelector(".remove-node-button") as HTMLElement
    removeButton.onclick = () => {
        // newNode.remove()
        // state.focused_node = null
        // changeNodeAction(NodeAction.add)
    }

    const canvas = newNode.querySelector("canvas")
    canvas.width = 175
    canvas.height = 175
    App.addNodePass(node.id, canvas)

    return newNode
}

function assembleParameter(nodeid: number, input_name: string, input: InputConfig) {
    let newParameter: HTMLElement
    if (input.display) {
        newParameter = elements.parameter_templates.querySelector(".display").cloneNode(true) as HTMLElement
    } else {
        newParameter = elements.parameter_templates.querySelector(`.${input.type}`).cloneNode(true) as HTMLElement
        switch (input.type) {
            case "f32":
                newParameter.querySelector("input").value = input.default
                break
            case "vec2f":
                const csv = input.default.match(/(?<=vec2\()(.*)(?=\))/)[0]
                const values = csv.split(", ")

                const xInput = newParameter.querySelector(".x-input") as HTMLInputElement
                xInput.value = values[0]

                const yInput = newParameter.querySelector(".y-input") as HTMLInputElement
                yInput.value = values[1]
        }
    }

    if (newParameter === undefined) {
        console.error(`Input type "${input.type}" does not have a corresponding parameter interface.`)
        return null
    }

    newParameter.querySelector("p").innerText = getParameterName(input, input_name)
    newParameter.dataset.name = input_name
    newParameter.dataset.type = input.type

    const inputs = newParameter.querySelectorAll("input")
    for (const input of inputs) {
        input.onchange = () => {updateParameter(nodeid, newParameter)}
    }

    newParameter.onclick = linkParameter

    return newParameter
}

// TODO: make parameter its own type that extends HTMLElement
function updateParameter(nodeid: number, parameter: HTMLElement) {
    console.log(parameter)
    let newValue
    switch (parameter.dataset.type) {
        case "f32":
            let floatValue = parseFloat(parameter.querySelector("input").value)
            if (isNaN(floatValue)) {
                console.warn("Entered value cannot be parsed as a float!")
                return
            }
            let floatText = floatValue.toString()
            if (!floatText.includes(".")) floatText += "."
            
            newValue = floatValue
            break
        case "vec2f":
            const xInput = parameter.querySelector(".x-input") as HTMLInputElement
            const xValue = parseFloat(xInput.value)

            const yInput = parameter.querySelector(".y-input") as HTMLInputElement
            const yValue = parseFloat(yInput.value)

            if (isNaN(xValue) || isNaN(yValue)) {
                console.warn("Entered value cannot be parsed as a float!")
                return
            }
            let xText = xValue.toString()
            if (!xText.includes(".")) xText += "."
            let yText = yValue.toString()
            if (!yText.includes(".")) yText += "."

            newValue = `vec2(${xText}, ${yText})`
        case "display":
            break
        default:
            console.error("Unsupported type.")
    }

    App.updateParameter(nodeid, parameter.dataset.name, newValue)
}

function addParentNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    App.addNodeAsParent(state.focused_node, nodeid, config)
    constructNodeView()
    changeNodeAction(NodeAction.None)
}

function addChildNode() {
    if (state.selected_effect === null) {
        console.warn("No effect selected")
        return
    }

    const config = App.configs[state.selected_effect]
    if (config === undefined) {
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    // find parent id
    const parentElement = document.querySelector("#focus-node>.node") as HTMLElement
    const parentid = parseInt(parentElement.dataset.nodeid)

    App.addNodeAsChild(parentid, nodeid, config)
    constructNodeView()
    changeNodeAction(NodeAction.None)
}

function constructParentNode(node: Node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.parent-node")
    const newNode = smallNodeTemplate.cloneNode(true) as HTMLElement

    const config = App.configs[node.name]

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const input_name in config.inputs) {
        const input = config.inputs[input_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = input_name
        nodeConnector.dataset.type = input.type

        nodeConnector.onclick = linkParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerHTML = getNodeName(config)

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            focusNode(node.id)
        }
    }

    return newNode
}

function constructChildNode(node: Node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.child-node")
    const newNode = smallNodeTemplate.cloneNode(true) as HTMLElement

    const config = App.configs[node.name]

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in config.outputs) {
        const output = config.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = selectParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = config.name
    newNode.querySelector(".node-header>h2").innerHTML = getNodeName(config)

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            focusNode(node.id)
        }
    }

    return newNode
}

function focusNode(nodeid: number) {
    state.focused_node = nodeid
    constructNodeView()
}

function selectParameter() {
    if (state.selected_parameter != null) return

    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")
    this.classList.add("active-connector")

    const node = this.parentElement.parentElement
    if (node.classList.contains("node")) {
        const parentConnectors = document.querySelectorAll("#parent-node .node-connector")
        for (const connector of parentConnectors) {
            if (this.dataset.type == (connector as HTMLElement).dataset.type) {
                connector.classList.add("active-connector")
            }
        }
    } else {
        const parentNode = document.querySelector("#focus-node>.node")
        const parentParameters = parentNode.querySelectorAll(".parameter")
    
        for (const parameter of parentParameters) {
            if (this.dataset.type == (parameter as HTMLElement).dataset.type) {
                parameter.classList.add("active-parameter")
                parameter.querySelector(".node-connector").classList.add("active-connector")
            }
        }
    }

    state.selected_parameter = {
        node: node.dataset.nodeid,
        name: this.dataset.name,
        type: this.dataset.type
    }
}

function deselect(event: MouseEvent) {
    const deselectIDs = [
        'nodes', 'parent-node', 'focus-node',
        'child-nodes', 'effect-view', 'effects'
    ]

    if (!deselectIDs.includes((event.target as HTMLElement).id)) return

    state.selected_effect = null
    state.selected_parameter = null

    for (const element of effectElements) element.classList.remove("selected-effect")
    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")

    if (state.focused_node != null) changeNodeAction(NodeAction.None)
}

function linkParameter() {
    // make sure a parameter is already selected and the datatypes match
    if (state.selected_parameter == null ||
        state.selected_parameter.type !== this.dataset.type) return

    const node = this.parentElement.parentElement

    App.linkParameter(
        state.selected_parameter.node,
        state.selected_parameter.name,
        node.dataset.nodeid,
        this.dataset.name
    )

    if (this.classList.contains("display")) {
        const canvas = this.querySelector("canvas")
        App.addNodePass(state.selected_parameter.node, canvas)
    } 

    const connectors = document.querySelectorAll(".node-connector")
    for (const connector of connectors) connector.classList.remove("active-connector")

    state.selected_parameter = null
}

function getNodeName(config: NodeConfig) {
    return (config.display_name !== undefined) ? config.display_name : config.name
}

function getParameterName(config: InputConfig | OutputConfig, name: string) {
    return (config.display_name !== undefined) ? config.display_name : name
}

function constructNodeView() {
    const nodeCanvases = document.querySelectorAll(".node canvas, .small-node canvas") as NodeListOf<HTMLCanvasElement>
    for (const canvas of nodeCanvases) App.clearPasses(canvas)
    
    if (state.focused_node == null) changeNodeAction(NodeAction.Add)

    const parentElement = elements.parent_node.querySelector(".small-node")
    if (parentElement != null) parentElement.remove()
    const parent = App.findParentByID(state.focused_node)
    if (parent != null) elements.parent_node.appendChild(constructParentNode(parent))

    const node = App.findNodeByID(state.focused_node)
    const focusElement = elements.focus_node.querySelector(".node")
    if (focusElement != null) focusElement.remove()
    elements.focus_node.appendChild(constructFocusNode(node))

    const children = elements.child_nodes.querySelectorAll(".small-node")
    for (const childElement of children) childElement.remove()
    for (const child of node.children) elements.child_nodes.appendChild(constructChildNode(child))
}

// export public functions
const Interface = {
    init: init
}
export default Interface