import { Hexagon } from "./hexagon.js";
import { Pentagon } from "./pentagon.js";
import { Square } from "./square.js";

var side_len = 0;
var side_len_short = 0;
var bite = 0;
var stitch_len = 0;
var stitch_num = 0;
var stitch_dia = 0;
var rows = 0;
var cols = 0;
const canvas = SVG().addTo('#canvas');


document.getElementById('panelChoice1').addEventListener('change', hexagon_check);
document.getElementById('panelChoice2').addEventListener('change', hexagon_check);
document.getElementById('panelChoice3').addEventListener('change', hexagon_check);


const inputFields = document.querySelectorAll('input');
for (var index = 0; index < inputFields.length; ++index) {
    var inputField = inputFields[index];
    if (inputField.type == 'button') {
        console.log(inputField);
    }
    else {
        inputField.addEventListener('change', parseInputChanges);
        console.log(inputField);
    }
}


function hexagon_check() {
    if (!document.getElementById('panelChoice3').checked) {
        document.getElementById('side_short_input').style.display = 'none';
    }
    else {
        document.getElementById('side_short_input').style.display = 'block';
    }
}

function addShape() {
    canvas.clear();

    // Get the selected value from the radio buttons
    const selectedValue = document.querySelector('input[name="panel_shape"]:checked').value;

    let shape;
    switch (selectedValue) {
        case '4': // If the value is '4', create a Square
            shape = new Square(side_len, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        case '5': // If the value is '5', create a Pentagon
            shape = new Pentagon(side_len, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        case '6': // If the value is '6', create a Hexagon
            shape = new Hexagon(side_len, side_len_short, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        default:
            console.log("Invalid selection");
    }

    if (shape) {
        console.log(`Created a shape with ${shape.sides.length} sides.`);
        const width = cols*side_len;
        const height = rows*side_len;
        canvas.size(width, height);
        shape.render( rows, cols);
    }
    //canvas.scale(2);
    //const shape = new Square();
    // draw pink square
    //draw.rect(100, 100).move(100, 50).fill('#f06')
}

function parseInputChanges() {
    const inputs = document.getElementsByTagName("input");
    console.log("Values Changed!");
    console.log(inputs);
    side_len = inputs.side_long.valueAsNumber;
    side_len_short = inputs.side_short.valueAsNumber;
    bite = inputs.stitch_bite.valueAsNumber;
    stitch_len = inputs.stitch_length.valueAsNumber;
    stitch_num = inputs.stitch_number.valueAsNumber;
    stitch_dia = inputs.stitch_diameter.valueAsNumber;
    rows = inputs.panel_rows.valueAsNumber;
    cols = inputs.panel_cols.valueAsNumber;
    addShape();
}



hexagon_check();
parseInputChanges();