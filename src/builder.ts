import { default as App } from './app.js'
import { Node, Input, LinkedInput } from './app.js'
import { elements, state, NodeAction } from './interface.js'
import { default as Interface } from './interface.js'

async function populateToolkit() {
    const template = elements.templates.querySelector(".effect")
    const effectElements = []

    for (const configName in App.configs) {
        const config = App.configs[configName]
        const newEffect = template.cloneNode(true) as HTMLElement

        const name = (config.display_name !== undefined) ? config.display_name : config.name
        newEffect.querySelector("h3").innerText = name
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

function constructFocusNode(node: Node) {
    const nodeTemplate = elements.templates.querySelector(".node")
    const newNode = nodeTemplate.cloneNode(true) as HTMLElement

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = node.name
    newNode.querySelector(".node-header>h2").innerHTML = node.display_name

    const nodeParameters = newNode.querySelector(".node-parameters")
    if (node.inputs !== undefined) {
        for (const input_name in node.inputs) {
            const input = node.inputs[input_name]
            const newParameter = assembleParameter(node.id, input_name, input)
            if (newParameter == null) continue
            nodeParameters.appendChild(newParameter)
        }
    } else nodeParameters.remove()

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in node.outputs) {
        const output = node.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = Interface.selectParameter
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

function constructParentNode(node: Node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.parent-node")
    const newNode = smallNodeTemplate.cloneNode(true) as HTMLElement

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const input_name in node.inputs) {
        const input = node.inputs[input_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = input_name
        nodeConnector.dataset.type = input.type

        nodeConnector.onclick = Interface.linkParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = node.name
    newNode.querySelector(".node-header>h2").innerHTML = node.display_name

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            Interface.focusNode(node.id)
        }
    }

    return newNode
}

function constructChildNode(node: Node) {
    const smallNodeTemplate = elements.templates.querySelector(".small-node.child-node")
    const newNode = smallNodeTemplate.cloneNode(true) as HTMLElement

    const nodeConnectors = newNode.querySelector(".node-connectors")
    for (const output_name in node.outputs) {
        const output = node.outputs[output_name]
        const nodeConnector = elements.templates.querySelector(".node-connector").cloneNode(true) as HTMLElement
        nodeConnector.dataset.name = output_name
        nodeConnector.dataset.type = output.type

        nodeConnector.onclick = Interface.selectParameter
        nodeConnectors.appendChild(nodeConnector)
    }

    newNode.dataset.nodeid = node.id.toString()
    newNode.dataset.name = node.name
    newNode.querySelector(".node-header>h2").innerHTML = node.display_name

    const canvas = newNode.querySelector("canvas")
    canvas.width = 125
    canvas.height = 125
    App.addNodePass(node.id, canvas)

    newNode.onclick = (event) => {
        if (event.target == newNode.querySelector(".edit-node-button") ||
            event.target == newNode.querySelector("canvas") ||
            event.target == newNode) {
            Interface.focusNode(node.id)
        }
    }

    return newNode
}

function assembleParameter(nodeid: number, input_name: string, input: Input | LinkedInput) {
    let newParameter: HTMLElement

    if (input.display) {
        newParameter = elements.parameter_templates.querySelector(".display").cloneNode(true) as HTMLElement
    } else if (input instanceof LinkedInput) {
        newParameter = elements.parameter_templates.querySelector(".linked").cloneNode(true) as HTMLElement
    } else {
        newParameter = elements.parameter_templates.querySelector(`.${input.type}`).cloneNode(true) as HTMLElement
        switch (input.type) {
            case "f32":
                newParameter.querySelector("input").value = input.value
                break
            case "vec2f":
                const csv = input.value.match(/(?<=vec2\()(.*)(?=\))/)[0]
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

    const parameterName: HTMLElement = newParameter.querySelector("p.parameter-name")
    parameterName.innerText = input.display_name
    newParameter.dataset.name = input_name
    newParameter.dataset.type = input.type

    const inputs = newParameter.querySelectorAll("input")
    for (const input of inputs) {
        input.onchange = () => {Interface.updateParameter(nodeid, newParameter)}
    }

    newParameter.onclick = Interface.linkParameter

    return newParameter
}

function constructNodeView() {
    const nodeCanvases = document.querySelectorAll(".node canvas, .small-node canvas") as NodeListOf<HTMLCanvasElement>
    for (const canvas of nodeCanvases) App.clearPasses(canvas)
    
    if (state.focused_node == null) Interface.changeNodeAction(NodeAction.Add)

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

    App.buildShaders()
}

const Builder = {
    populateToolkit,
    constructNodeView
}
export default Builder