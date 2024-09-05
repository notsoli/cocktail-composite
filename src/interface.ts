import { default as App } from './app.js'
import { default as Builder } from './builder.js'

enum View {
    Node,
    Visualizer,
    Tree,
    Variables
}

export enum NodeAction {
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

export const state: State = {
    current_view: View.Node,
    current_node_action: NodeAction.None,
    focused_node: null,
    selected_effect: null,
    selected_parameter: null
}

export const elements: {[x: string]: HTMLElement} = {}
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
    effectElements = await Builder.populateToolkit()
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
    if (config === undefined) { // not sure if i need this check
        console.error(`Congfiguration for effect ${state.selected_effect} does not exist`)
        return
    }

    // generate nodeid
    const nodeid = App.current_nodeid++

    App.addNodeAsRoot(nodeid, config)
    state.focused_node = nodeid
    Builder.constructNodeView()
    changeNodeAction(NodeAction.None)
}

// TODO: make parameter its own type that extends HTMLElement
function updateParameter(nodeid: number, parameter: HTMLElement) {
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
    Builder.constructNodeView()
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
    Builder.constructNodeView()
    changeNodeAction(NodeAction.None)
}

function focusNode(nodeid: number) {
    state.focused_node = nodeid
    Builder.constructNodeView()
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
    Builder.constructNodeView() // this can be more efficient
}

// export public functions
const Interface = {
    init,
    selectParameter,
    linkParameter,
    focusNode,
    updateParameter,
    changeNodeAction
}
export default Interface