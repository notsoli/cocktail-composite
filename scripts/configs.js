const configs = {
    distance: {
        "name": "distance",
        "description": "outputs the distance from each pixel to a specified point (defaults to 0.5,0.5)",
        "locals": [ "res" ],
        "inputs": {
            "position": {
                "type": "vec2f",
                "default": "pos.xy / res",
                "display": true
            },
            "point": {
                "type": "vec2f",
                "default": "vec2(0.5, 0.5)"
            }
        },
        "outputs": {
            "distance": {
                "type": "f32"
            }
        },
        "function": "fn distance(pos : vec2f, point: vec2f) -> f32 { return sqrt((pos.x - point.x) * (pos.x - point.x) + (pos.y - point.y) * (pos.y - point.y)); }",
        "inline": "let $o{distance} = distance($i{position}, $i{point});"
    },
    example: {
        "name": "example",
        "description": "example node used for testing",
        "locals": [ "res" ],
        "globals": [ "frame" ],
        "outputs": {
            "new_color": {
                "display_name": "new color",
                "type": "vec4f"
            }
        },
        "function": "fn example(position : vec2f, frame : f32) -> vec4f { return vec4(position.x, position.y, 0.5 + sin(frame / 25.) / 2, 1.); }",
        "inline": "let $o{new_color} = example(pos.xy / res, frame);"
    },
    flatten: {
        "name": "flatten",
        "description": "polarizes values to either 0 or 1 based on a specified threshold (defaults to 0.5)",
        "locals": [ "res" ],
        "inputs": {
            "value": {
                "type": "f32",
                "default": "pos.x / res.x",
                "display": true
            },
            "cutoff": {
                "type": "f32",
                "default": 0.5
            }
        },
        "outputs": {
            "flattened_value": {
                "type": "f32"
            }
        },
        "inline": "let $o{flattened_value} = step($i{cutoff}, $i{value});"
    },
    grid: {
        "name": "grid",
        "description": "makes a grid of a specified size out of its input nodes (defaults to 3,3)",
        "locals": [ "res" ],
        "inputs": {
            "position": {
                "type": "vec2f",
                "default": "pos.xy / res",
                "display": true
            },
            "tiles": {
                "type": "f32",
                "default": "3."
            }
        },
        "outputs": {
            "new_position": {
                "display_name": "new position",
                "type": "vec2f"
            },
            "tile_index": {
                "display_name": "tile index",
                "type": "vec2f"
            }
        },
        "inline": "let v_$id{} = $i{position} * $i{tiles}; let $o{new_position} = fract(v_$id{}); let $o{tile_index} = floor(v_$id{});"
    },
    normalized_position: {
        "name": "normalized_position",
        "display_name": "normalized position",
        "description": "translates pixel positions into a range from 0 to 1",
        "locals": [ "res" ],
        "outputs": {
            "position": {
                "type": "vec2f"
            }
        },
        "function": "fn normalized_position(pos : vec4f, res : vec2f) -> vec2f { return pos.xy / res; }",
        "inline": "let $o{position} = normalized_position(pos, res);"
    }
}

export default configs