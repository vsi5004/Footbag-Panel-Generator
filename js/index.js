document.getElementById("canvas").innerHTML = "";

// initialize
// initialize SVG.js
var draw = SVG().addTo('body')

// draw pink square
draw.rect(100, 100).move(100, 50).fill('#f06')
