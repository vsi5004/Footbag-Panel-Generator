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
let panelGroup;
let rulerGroup;
const rulerHeight = 20;


document.getElementById('panelChoice1').addEventListener('change', hexagon_check);
document.getElementById('panelChoice2').addEventListener('change', hexagon_check);
document.getElementById('panelChoice3').addEventListener('change', hexagon_check);
document.getElementById('exportBtn').addEventListener('click', exportSVG);

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

function exportSVG() {
    rulerGroup.remove();
    var svgData = canvas.svg();
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "panel-design.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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
    panelGroup = canvas.group();

    let shape;
    switch (selectedValue) {
        case '4':
            shape = new Square(side_len, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        case '5':
            shape = new Pentagon(side_len, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        case '6':
            shape = new Hexagon(side_len, side_len_short, bite, stitch_num, stitch_len, stitch_dia, canvas);
            break;
        default:
            console.log("Invalid selection");
    }

    if (shape) {
        console.log(`Created a shape with ${shape.sides.length} sides.`);
        const width = cols * shape.width;
        const height = rows * shape.height;
        canvas.size(width, height + rulerHeight);
        shape.render(rows, cols);
        drawRuler(height, width);
    }
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

function drawRuler(y_offset, width) {
    rulerGroup = canvas.group();

    // Draw the ruler background
    rulerGroup.rect(width, rulerHeight).move(0, y_offset).fill('#FFF');

    // Draw millimeter lines on the ruler
    for (let i = 0; i <= width; i++) {
        let lineLength = i % 10 === 0 ? 10 : 5; // Longer lines for every 10 mm
        let line = rulerGroup.line(i, y_offset, i, y_offset + lineLength).stroke({ width: 0.4, color: '#000' });

        // Add labels for every 10 mm
        if (i % 10 === 0) {
            rulerGroup.text(String(i))
                .move(i, y_offset + lineLength + 5) // Adjust text position as needed
                .fill('#000')
                .font({ size: 4, anchor: 'middle' });
        }
    }
}


hexagon_check();
parseInputChanges();