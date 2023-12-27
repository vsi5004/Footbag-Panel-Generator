import { Panel } from "./panel.js";

export class Square extends Panel{
    constructor(side_len, bite, stitches, stitch_length, hole_diameter, canvas){
        const sides = [side_len, side_len, side_len, side_len];
        super(bite, stitches, hole_diameter, side_len, sides, false, canvas);
        this.width = side_len;
    }

    render(rows, cols){
        // Create rows and columns of squares
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Create a rectangle (square) for each position
                this.draw_single(c*this.side_len, r*this.side_len);
            }
        }
        
    }

    draw_single(x, y){
        this.draw.rect(this.side_len, this.side_len).stroke('#f06').move(x,y);
    }
}