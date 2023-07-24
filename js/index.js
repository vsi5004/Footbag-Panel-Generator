var side_len = 0;
var side_len_short = 0;
var bite = 0;
var stitch_len = 0;
var stitch_num = 0;
var stitch_dia = 0;
var rows = 0;
var cols = 0;
var draw = SVG().addTo('#canvas')

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
    draw.clear();
    // draw pink square
    draw.rect(100, 100).move(100, 50).fill('#f06')
}

function parseInputChanges() {
    const inputs = document.getElementsByTagName("input");
    console.log("Values Changed!");
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