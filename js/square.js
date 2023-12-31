import { Panel } from "./panel.js";

export class Square extends Panel{
    constructor(side_len, bite, stitches, stitch_length, hole_diameter, canvas){
        const sides = [side_len, side_len, side_len, side_len];
        super(bite, stitches, stitch_length, hole_diameter, side_len, sides, false, canvas);
    }

    draw_stitch_row(){
        var total_holes = this.stitches*2;
        if (this.skip_sides){
            total_holes = this.stitches * 2 + 2;
        }
        const g_stitch_holes = this.draw.group();
        //const stitch_offset = this.side_len / 2 - (total_holes - 1) * this.stitch_len / 2;
        for (var x=0; x<total_holes; x++){
            g_stitch_holes.circle(this.hole_dia).fill('#f06').move(this.stitch_len * x,this.bite);
        }
        return g_stitch_holes;
    }
}